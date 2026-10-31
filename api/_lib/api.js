// API Tích Đức cho Vercel: cùng các đường dẫn /api/* như server/index.js nhưng lưu trong Redis (Upstash).
// Không có chính điện nhiều người (/api/room/*) — trên Vercel chính điện 3D chạy một mình.
'use strict';
const crypto = require('node:crypto');
const R = require('./rules.js');
const { PRODUCTS, PROVINCES, MAX_TPS, IMPORT_CAP, ORDER_TTL, ORDER_RE, REALMS } = R;

/* Khoá Redis
   u:{id}            hash   hồ sơ + tiến trình
   code:{sha256}     string mã khôi phục → id
   owned:{id}        set    mõ đã mua
   lb:all            zset   công đức theo người        lb:day:{ngày}   zset nhịp hôm nay
   prov:all          zset   công đức theo tỉnh         prov:day:{ngày} zset nhịp hôm nay theo tỉnh
   prov:members      hash   số người mỗi tỉnh          daytaps:{ngày}  tổng nhịp trong ngày
   online            zset   id → lần đồng bộ cuối      events          list sự kiện gần đây
   ord:{mã}          json   đơn hàng                   ordopen:{id}:{sp} mã đơn đang chờ (15 phút)
   tx:{id}           đánh dấu giao dịch SePay đã xử lý */
const DAY_TTL = 3 * 86400;
const num = (v) => Number(v) || 0;
const parse = (v) => (typeof v === 'string' ? JSON.parse(v) : v);

function createApi(redis, env = process.env) {
  const PAY = R.payConfig(env);

  async function getUser(id) {
    if (!id || typeof id !== 'string') return null;
    const h = await redis.hgetall(`u:${id}`);
    if (!h || !h.id) return null;
    return { id: String(h.id), codeHash: String(h.codeHash), name: String(h.name ?? ''), province: h.province ? String(h.province) : '',
      merit: num(h.merit), taps: num(h.taps), realm: num(h.realm), day: String(h.day ?? ''), todayTaps: num(h.todayTaps),
      lastSync: num(h.lastSync), memberUntil: num(h.memberUntil) };
  }
  async function auth(b) {
    const u = await getUser(b.uid);
    return u && b.code && u.codeHash === R.hash(String(b.code).toUpperCase()) ? u : null;
  }
  const isMember = (u) => u.memberUntil > Date.now();
  const publicUser = (u) => ({ name: u.name, province: u.province, merit: u.merit, taps: u.taps, realm: u.realm,
    todayTaps: u.day === R.today() ? u.todayTaps : 0, member: isMember(u) });
  const selfUser = async (u) => ({ ...publicUser(u), owned: (await redis.smembers(`owned:${u.id}`)) || [], memberUntil: u.memberUntil });

  async function event(text) {
    await redis.lpush('events', JSON.stringify({ text, at: Date.now() }));
    await redis.ltrim('events', 0, 29);
  }

  // Cộng n nhịp + cập nhật bảng xếp hạng. countToday=false khi mang tiến trình cũ lên lúc tạo tài khoản.
  async function addTaps(u, n, countToday = true) {
    const d = R.today(), meritBefore = u.merit;
    if (u.day !== d) { u.day = d; u.todayTaps = 0; }
    if (countToday) u.todayTaps += n;
    const reached = R.stepTaps(u, n);
    const p = redis.pipeline();
    p.hset(`u:${u.id}`, { merit: u.merit, taps: u.taps, realm: u.realm, day: u.day, todayTaps: u.todayTaps, lastSync: u.lastSync });
    p.zadd('online', { score: Date.now(), member: u.id });
    if (n > 0) {
      p.zadd('lb:all', { score: u.merit, member: u.id });
      if (u.province) p.zincrby('prov:all', u.merit - meritBefore, u.province);
      if (countToday) {
        p.incrby(`daytaps:${d}`, n); p.expire(`daytaps:${d}`, DAY_TTL);
        p.zadd(`lb:day:${d}`, { score: u.todayTaps, member: u.id }); p.expire(`lb:day:${d}`, DAY_TTL);
        if (u.province) { p.zincrby(`prov:day:${d}`, n, u.province); p.expire(`prov:day:${d}`, DAY_TTL); }
      }
    }
    await p.exec();
    for (const r of reached) if (r >= 2) await event(`✨ ${R.label(u)} vừa đột phá ${REALMS[r]}`);
  }

  async function grant(u, p) {
    if (p.skin) await redis.sadd(`owned:${u.id}`, p.skin);
    if (p.days) {
      u.memberUntil = Math.max(Date.now(), u.memberUntil) + p.days * 864e5;
      await redis.hset(`u:${u.id}`, { memberUntil: u.memberUntil });
    }
  }

  // Ghi nhận một giao dịch tiền vào (webhook thật hoặc nút giả lập)
  async function applyPayment({ txId, content, amount, type }) {
    if (type !== 'in') return { success: true, ignored: 'not incoming' };
    if (!(await redis.set(`tx:${txId}`, 1, { nx: true, ex: 30 * 86400 }))) return { success: true, duplicate: true };   // SePay có thể gửi lại
    const match = String(content || '').toUpperCase().match(ORDER_RE);
    if (!match) { console.warn('[pay] không khớp đơn nào:', txId, content); return { success: true, ignored: 'no order' }; }
    // Khoá đơn trong lúc xử lý để hai giao dịch đến cùng lúc không cấp hai lần
    if (!(await redis.set(`lock:ord:${match[0]}`, 1, { nx: true, ex: 30 }))) return { success: true, duplicate: true };
    try {
      const o = parse(await redis.get(`ord:${match[0]}`));
      if (!o) { console.warn('[pay] không khớp đơn nào:', txId, content); return { success: true, ignored: 'no order' }; }
      if (o.status === 'paid') return { success: true, duplicate: true };
      const u = await getUser(o.uid);
      o.paidAmount = Number(amount);
      if (o.paidAmount < o.amount || !u) {
        o.status = 'underpaid';
        await redis.set(`ord:${o.code}`, JSON.stringify(o));
        console.warn('[pay] chuyển thiếu tiền:', o.code, amount, '/', o.amount);
        return { success: true, underpaid: true };
      }
      o.status = 'paid'; o.paidAt = Date.now(); o.txId = txId;
      await redis.set(`ord:${o.code}`, JSON.stringify(o));
      await grant(u, PRODUCTS[o.product]);
      console.log('[pay] đã thanh toán:', o.code, o.product, o.amount);
      return { success: true };
    } finally { await redis.del(`lock:ord:${match[0]}`); }
  }

  const routes = {
    async 'POST /api/id'(b) {
      const id = crypto.randomUUID(), code = R.newCode(), now = Date.now();
      const u = { id, codeHash: R.hash(code), name: R.cleanName(b.name) || `Đạo hữu #${crypto.randomInt(1000, 9999)}`,
        province: PROVINCES.has(b.province) ? b.province : '', merit: 0, taps: 0, realm: 0, day: R.today(), todayTaps: 0, lastSync: now, memberUntil: 0 };
      await redis.hset(`u:${id}`, { ...u, created: now });
      await redis.set(`code:${u.codeHash}`, id);
      if (u.province) await redis.hincrby('prov:members', u.province, 1);
      await addTaps(u, Math.min(IMPORT_CAP, Math.max(0, b.taps | 0)), false);
      await event(`🪷 ${R.label(u)} vừa gia nhập tích đức`);
      return { uid: id, code, user: await selfUser(u) };
    },

    async 'POST /api/sync'(b) {
      const u = await auth(b);
      if (!u) return [401, { error: 'Sai mã đồng bộ' }];
      const now = Date.now(), elapsed = Math.min(600, Math.max(1, (now - u.lastSync) / 1000));
      const sent = Math.max(0, b.pending | 0), allowed = Math.ceil(elapsed * MAX_TPS) + 20;
      u.lastSync = now;
      await addTaps(u, Math.min(sent, allowed));
      return { user: await selfUser(u), capped: sent > allowed };
    },

    async 'POST /api/profile'(b) {
      const u = await auth(b);
      if (!u) return [401, { error: 'Sai mã đồng bộ' }];
      const name = R.cleanName(b.name), prov = b.province === '' || PROVINCES.has(b.province) ? b.province : u.province;
      if (prov !== u.province) {
        // Chuyển tỉnh: dời công đức và số thành viên sang tỉnh mới
        const d = R.today(), today = u.day === d ? u.todayTaps : 0, p = redis.pipeline();
        if (u.province) { p.hincrby('prov:members', u.province, -1); p.zincrby('prov:all', -u.merit, u.province); if (today) p.zincrby(`prov:day:${d}`, -today, u.province); }
        if (prov) { p.hincrby('prov:members', prov, 1); p.zincrby('prov:all', u.merit, prov); if (today) p.zincrby(`prov:day:${d}`, today, prov); }
        await p.exec();
        u.province = prov;
      }
      if (name) u.name = name;
      await redis.hset(`u:${u.id}`, { name: u.name, province: u.province });
      return { user: await selfUser(u) };
    },

    async 'POST /api/restore'(b) {
      const code = String(b.code || '').toUpperCase().trim();
      const u = await getUser(await redis.get(`code:${R.hash(code)}`));
      if (!u) return [404, { error: 'Không tìm thấy mã khôi phục' }];
      return { uid: u.id, code, user: await selfUser(u) };
    },

    async 'GET /api/leaderboard'(q) {
      const tab = q.get('tab') === 'today' ? 'today' : 'all', uid = q.get('uid') || '';
      const key = tab === 'today' ? `lb:day:${R.today()}` : 'lb:all';
      const flat = (await redis.zrange(key, 0, 49, { rev: true, withScores: true })) || [];
      const ids = [], scores = [];
      for (let i = 0; i < flat.length; i += 2) if (num(flat[i + 1]) > 0) { ids.push(String(flat[i])); scores.push(num(flat[i + 1])); }
      const users = await Promise.all(ids.map(getUser));
      const top = users.map((u, i) => u && { ...publicUser(u), score: scores[i], me: u.id === uid }).filter(Boolean);
      let me = null;
      if (uid) {
        // Hạng = số người điểm cao hơn mình + 1
        const score = num(await redis.zscore(key, uid));
        if (score > 0) me = { rank: num(await redis.zcount(key, `(${score}`, '+inf')) + 1, score };
      }
      return { tab, top, me, total: num(await redis.zcard(key)) };
    },

    async 'GET /api/leaderboard/province'() {
      const d = R.today();
      const [all, day, members] = await Promise.all([
        redis.zrange('prov:all', 0, -1, { rev: true, withScores: true }),
        redis.zrange(`prov:day:${d}`, 0, -1, { withScores: true }),
        redis.hgetall('prov:members'),
      ]);
      const todayOf = {};
      for (let i = 0; i < (day || []).length; i += 2) todayOf[day[i]] = num(day[i + 1]);
      const top = [];
      for (let i = 0; i < (all || []).length; i += 2) {
        const province = String(all[i]), m = num(members?.[province]);
        if (m > 0) top.push({ province, merit: num(all[i + 1]), today: todayOf[province] || 0, members: m });
      }
      return { top };
    },

    async 'GET /api/live-stats'() {
      const now = Date.now(), d = R.today();
      await redis.zremrangebyscore('online', 0, now - 120e3);
      const [online, taps, events] = await Promise.all([
        redis.zcount('online', now - 60e3, '+inf'), redis.get(`daytaps:${d}`), redis.lrange('events', 0, 14),
      ]);
      return { online: num(online), todayTaps: num(taps), events: (events || []).map(parse) };
    },

    'GET /api/provinces'() { return { provinces: [...PROVINCES].sort((a, b) => a.localeCompare(b, 'vi')) }; },

    'GET /api/shop'() {
      return { products: Object.entries(PRODUCTS).map(([id, p]) => ({ id, ...p })), open: !!PAY.account || PAY.test, test: PAY.test };
    },

    async 'POST /api/orders'(b) {
      const u = await auth(b);
      if (!u) return [401, { error: 'Sai mã đồng bộ' }];
      if (!PAY.account && !PAY.test) return [503, { error: 'Cửa hàng chưa mở' }];
      const p = PRODUCTS[b.product];
      if (!p) return [400, { error: 'Không có sản phẩm này' }];
      if (p.skin && await redis.sismember(`owned:${u.id}`, p.skin)) return [400, { error: 'Bạn đã có vật phẩm này' }];
      const now = Date.now(), openKey = `ordopen:${u.id}:${b.product}`;
      // Dùng lại đơn đang chờ của cùng sản phẩm để không sinh nhiều mã cho một lần mua
      const openCode = await redis.get(openKey);
      const open = openCode && parse(await redis.get(`ord:${openCode}`));
      if (open && open.status === 'pending' && now - open.created < ORDER_TTL) return R.orderView(open, PAY);
      let o;
      for (;;) {
        o = { code: R.newOrderCode(), uid: u.id, product: b.product, amount: p.price, status: 'pending', created: now };
        if (await redis.set(`ord:${o.code}`, JSON.stringify(o), { nx: true })) break;
      }
      await redis.set(openKey, o.code, { ex: ORDER_TTL / 1000 });
      return R.orderView(o, PAY);
    },

    async 'POST /api/orders/status'(b) {
      const u = await auth(b);
      if (!u) return [401, { error: 'Sai mã đồng bộ' }];
      const o = parse(await redis.get(`ord:${String(b.order || '').slice(0, 12)}`));
      if (!o || o.uid !== u.id) return [404, { error: 'Không tìm thấy đơn' }];
      return { status: o.status, paidAmount: o.paidAmount, user: await selfUser(await getUser(u.id)) };
    },

    // SePay gọi vào đây khi tài khoản nhận tiền. Header: "Authorization: Apikey <SEPAY_API_KEY>"
    async 'POST /api/sepay/webhook'(b, headers) {
      if (!PAY.apiKey) return [503, { success: false, error: 'Chưa cấu hình SEPAY_API_KEY' }];
      if (!R.safeEqual(headers.authorization || '', `Apikey ${PAY.apiKey}`)) return [401, { success: false }];
      return applyPayment({ txId: 'sepay:' + b.id, content: `${b.code || ''} ${b.content || ''} ${b.description || ''}`, amount: b.transferAmount, type: b.transferType });
    },

    // Chỉ khi PAYMENT_TEST=1: giả lập khách đã chuyển khoản đủ tiền
    async 'POST /api/dev/pay'(b) {
      if (!PAY.test) return [404, { error: 'Không có API này' }];
      const u = await auth(b), o = parse(await redis.get(`ord:${String(b.order || '').slice(0, 12)}`));
      if (!u || !o || o.uid !== u.id) return [404, { error: 'Không tìm thấy đơn' }];
      return applyPayment({ txId: 'test:' + o.code, content: o.code, amount: o.amount, type: 'in' });
    },
  };

  // Trả về { status, data } cho mọi yêu cầu /api/*
  async function handle(method, pathname, query, body, headers = {}) {
    const route = routes[`${method} ${pathname}`];
    if (!route) return { status: 404, data: { error: 'Không có API này' } };
    const out = await route(method === 'GET' ? query : (body && typeof body === 'object' ? body : {}), headers);
    return Array.isArray(out) ? { status: out[0], data: out[1] } : { status: 200, data: out };
  }

  return { handle };
}

module.exports = { createApi };
