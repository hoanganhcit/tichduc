// Kiểm thử API Vercel (api/_lib/api.js) với Redis giả lập trong bộ nhớ. Chạy: npm run test:api
'use strict';
const assert = require('node:assert/strict');
const { createApi } = require('../api/_lib/api.js');

// Redis giả: chỉ các lệnh API dùng, trả kết quả giống @upstash/redis
function fakeRedis() {
  const kv = new Map();
  const z = (k) => (kv.has(k) ? kv.get(k) : kv.set(k, new Map()).get(k));
  const range = (m, rev) => [...m.entries()].sort((a, b) => (rev ? b[1] - a[1] : a[1] - b[1]));
  const bound = (v, lo) => (v === '+inf' ? Infinity : v === '-inf' ? -Infinity : String(v).startsWith('(') ? Number(String(v).slice(1)) + (lo ? 1e-9 : -1e-9) : Number(v));
  const r = {
    async get(k) { return kv.get(k) ?? null; },
    async set(k, v, o = {}) { if (o.nx && kv.has(k)) return null; kv.set(k, v); return 'OK'; },
    async del(k) { kv.delete(k); return 1; },
    async expire() { return 1; },
    async incrby(k, n) { kv.set(k, (Number(kv.get(k)) || 0) + n); return kv.get(k); },
    async hset(k, o) { kv.set(k, { ...(kv.get(k) || {}), ...o }); return 1; },
    async hgetall(k) { return kv.get(k) || null; },
    async hincrby(k, f, n) { const h = kv.get(k) || {}; h[f] = (Number(h[f]) || 0) + n; kv.set(k, h); return h[f]; },
    async sadd(k, v) { (kv.get(k) || kv.set(k, new Set()).get(k)).add(v); return 1; },
    async smembers(k) { return [...(kv.get(k) || [])]; },
    async sismember(k, v) { return kv.get(k)?.has(v) ? 1 : 0; },
    async lpush(k, v) { (kv.get(k) || kv.set(k, []).get(k)).unshift(v); return 1; },
    async ltrim(k, a, b) { kv.set(k, (kv.get(k) || []).slice(a, b + 1)); return 'OK'; },
    async lrange(k, a, b) { return (kv.get(k) || []).slice(a, b + 1).map((s) => JSON.parse(s)); },   // Upstash tự parse JSON
    async zadd(k, { score, member }) { z(k).set(member, score); return 1; },
    async zincrby(k, n, m) { const s = z(k); s.set(m, (s.get(m) || 0) + n); return s.get(m); },
    async zscore(k, m) { return z(k).get(m) ?? null; },
    async zcard(k) { return z(k).size; },
    async zcount(k, a, b) { const lo = bound(a, true), hi = bound(b, false); return [...z(k).values()].filter((s) => s >= lo && s <= hi).length; },
    async zremrangebyscore(k, a, b) { for (const [m, s] of z(k)) if (s >= a && s <= b) z(k).delete(m); return 1; },
    async zrange(k, a, b, o = {}) {
      const all = range(z(k), o.rev), end = b < 0 ? all.length : b + 1;
      return all.slice(a, end).flatMap(([m, s]) => (o.withScores ? [m, s] : [m]));
    },
    pipeline() { const q = []; const p = new Proxy({}, { get: (_, cmd) => (cmd === 'exec' ? async () => { for (const [c, a] of q) await r[c](...a); } : (...a) => q.push([cmd, a])) }); return p; },
  };
  return r;
}

(async () => {
  const redis = fakeRedis();
  const api = createApi(redis, { SEPAY_API_KEY: 'k', BANK_ACCOUNT: '123', BANK_NAME: 'MBBank', PAYMENT_TEST: '1' });
  const call = async (m, p, b = {}, h = {}) => api.handle(m, p, new URLSearchParams(m === 'GET' ? b : {}), b, h);
  const ok = (r) => { assert.equal(r.status, 200, JSON.stringify(r.data)); return r.data; };

  // Tạo tài khoản, mang 150 nhịp cũ lên: 100×1 + 50×2 = 200 công đức, lên Định tâm
  const a = ok(await call('POST', '/api/id', { name: 'An <b>', province: 'Hà Nội', taps: 150 }));
  assert.equal(a.user.merit, 200); assert.equal(a.user.realm, 1); assert.equal(a.user.name, 'An b');
  const A = { uid: a.uid, code: a.code };

  // Đồng bộ: gửi quá nhiều nhịp bị cắt theo thời gian
  const s = ok(await call('POST', '/api/sync', { ...A, pending: 100000 }));
  assert.equal(s.capped, true); assert.ok(s.user.taps < 200);
  assert.equal((await call('POST', '/api/sync', { uid: a.uid, code: 'SAI', pending: 1 })).status, 401);

  // Người thứ hai + bảng xếp hạng
  const b = ok(await call('POST', '/api/id', { name: 'Bình', province: 'Huế' }));
  ok(await call('POST', '/api/sync', { uid: b.uid, code: b.code, pending: 10 }));
  const lb = ok(await call('GET', '/api/leaderboard', { tab: 'all', uid: b.uid }));
  assert.equal(lb.top[0].name, 'An b'); assert.deepEqual(lb.me, { rank: 2, score: 10 });
  const lbDay = ok(await call('GET', '/api/leaderboard', { tab: 'today', uid: a.uid }));
  assert.equal(lbDay.me.rank, 1);

  // Đổi tỉnh: công đức và thành viên chuyển theo
  ok(await call('POST', '/api/profile', { ...A, name: 'An', province: 'Huế' }));
  const prov = ok(await call('GET', '/api/leaderboard/province')).top;
  assert.equal(prov.length, 1); assert.equal(prov[0].province, 'Huế'); assert.equal(prov[0].members, 2);

  // Trực tiếp + khôi phục
  const live = ok(await call('GET', '/api/live-stats'));
  assert.equal(live.online, 2); assert.ok(live.events.length >= 2);
  assert.equal(ok(await call('POST', '/api/restore', { code: a.code.toLowerCase() })).uid, a.uid);

  // Cửa hàng: tạo đơn, dùng lại đơn đang chờ
  const o1 = ok(await call('POST', '/api/orders', { ...A, product: 'skin-long' }));
  assert.equal(o1.amount, 49000); assert.match(o1.code, /^TD[A-Z2-9]{6}$/);
  assert.equal(ok(await call('POST', '/api/orders', { ...A, product: 'skin-long' })).code, o1.code);
  assert.equal((await call('POST', '/api/orders', { ...A, product: 'mien-phi' })).status, 400);

  // Webhook SePay: sai khoá, thiếu tiền, đủ tiền, gửi trùng
  const hook = (body, key = 'k') => call('POST', '/api/sepay/webhook', body, { authorization: `Apikey ${key}` });
  assert.equal((await hook({}, 'sai')).status, 401);
  assert.ok(ok(await hook({ id: 1, transferType: 'in', transferAmount: 1000, content: `ck ${o1.code}` })).underpaid);
  const o2 = ok(await call('POST', '/api/orders', { ...A, product: 'member-30' }));
  assert.deepEqual(ok(await hook({ id: 2, transferType: 'in', transferAmount: 49000, content: `MB ${o2.code.toLowerCase()} An` })), { success: true });
  assert.ok(ok(await hook({ id: 2, transferType: 'in', transferAmount: 49000, content: o2.code })).duplicate);
  const st = ok(await call('POST', '/api/orders/status', { ...A, order: o2.code }));
  assert.equal(st.status, 'paid'); assert.equal(st.user.member, true);
  assert.equal((await call('POST', '/api/orders/status', { uid: b.uid, code: b.code, order: o2.code })).status, 404);

  // Nút giả lập (PAYMENT_TEST=1) mở khoá mõ, mua lại thì báo đã có
  const o3 = ok(await call('POST', '/api/orders', { ...A, product: 'skin-kylan' }));
  ok(await call('POST', '/api/dev/pay', { ...A, order: o3.code }));
  assert.deepEqual(ok(await call('POST', '/api/sync', { ...A, pending: 0 })).user.owned, ['kylan']);
  assert.equal((await call('POST', '/api/orders', { ...A, product: 'skin-kylan' })).status, 400);

  // Chính điện nhiều người không có trên Vercel
  assert.equal((await call('POST', '/api/room/join', {})).status, 404);

  // Không bật PAYMENT_TEST thì không giả lập được
  const prod = createApi(redis, { SEPAY_API_KEY: 'k', BANK_ACCOUNT: '123' });
  assert.equal((await prod.handle('POST', '/api/dev/pay', null, { ...A, order: o1.code })).status, 404);

  console.log('✅ Tất cả kiểm thử API Vercel đều đạt');
})().catch((e) => { console.error('❌', e); process.exit(1); });
