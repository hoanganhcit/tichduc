// Máy chủ Tích Đức: phục vụ file tĩnh + API, dữ liệu lưu trong server/data.json.
// Chạy: node tichduc/server/index.js  (PORT mặc định 5173). Không cần cài thêm package.
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.join(__dirname, '..');
const DB_FILE = path.join(__dirname, 'data.json');
const PORT = Number(process.env.PORT) || 5173;
const HOST = process.env.HOST || '0.0.0.0';             // sau Caddy/Nginx nên đặt HOST=127.0.0.1
const TRUST_PROXY = process.env.TRUST_PROXY === '1';    // lấy IP thật từ X-Forwarded-For khi chạy sau proxy

/* ===== Luật game & sản phẩm: dùng chung với API Vercel ===== */
const {
  REALMS, MAX_TPS, IMPORT_CAP, PROVINCES, PRODUCTS, ORDER_TTL, ORDER_RE,
  today, hash, newCode, newOrderCode, cleanName, label, stepTaps, orderView: viewOrder, safeEqual, payConfig,
} = require('../api/_lib/rules.js');

/* ===== Lưu trữ ===== */
let db = { users: {}, codes: {}, days: {}, events: [], orders: {}, txIds: [] };
try { db = { ...db, ...JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) }; } catch {}
let dirty = false;
function flush() {
  if (!dirty) return;
  fs.writeFileSync(DB_FILE + '.tmp', JSON.stringify(db));
  fs.renameSync(DB_FILE + '.tmp', DB_FILE);
  dirty = false;
}
setInterval(flush, 5000);
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { flush(); process.exit(0); });

function event(text) {
  db.events.unshift({ text, at: Date.now() });
  db.events.length = Math.min(db.events.length, 30);
}

function rollDay(u) {
  const d = today();
  if (u.day !== d) { u.day = d; u.todayTaps = 0; }
}

// Cộng n nhịp theo đúng luật: mỗi nhịp cộng hệ số cảnh giới hiện tại, đủ công đức thì lên cảnh giới
function addTaps(u, n) {
  rollDay(u);
  const d = (db.days[u.day] ||= { taps: 0 });
  u.todayTaps += n; d.taps += n;
  for (const r of stepTaps(u, n)) if (r >= 2) event(`✨ ${label(u)} vừa đột phá ${REALMS[r]}`);
}

const isMember = (u) => (u.memberUntil || 0) > Date.now();
const publicUser = (u) => ({ name: u.name, province: u.province, merit: u.merit, taps: u.taps, realm: u.realm,
  todayTaps: u.day === today() ? u.todayTaps : 0, member: isMember(u) });
// Thông tin chỉ trả cho chính chủ: vật phẩm đã mua, hạn hội viên
const selfUser = (u) => ({ ...publicUser(u), owned: u.owned || [], memberUntil: u.memberUntil || 0 });

function auth(body) {
  const u = db.users[body.uid];
  return u && body.code && u.codeHash === hash(String(body.code).toUpperCase()) ? u : null;
}

/* ===== API ===== */
const routes = {
  'POST /api/id'(b) {
    const id = crypto.randomUUID(), code = newCode();
    const u = { id, codeHash: hash(code), name: cleanName(b.name) || `Đạo hữu #${crypto.randomInt(1000, 9999)}`,
      province: PROVINCES.has(b.province) ? b.province : '', merit: 0, taps: 0, realm: 0, day: today(), todayTaps: 0,
      lastSync: Date.now(), created: Date.now() };
    addTaps(u, Math.min(IMPORT_CAP, Math.max(0, b.taps | 0)));
    u.todayTaps = Math.min(u.todayTaps, Math.max(0, b.todayTaps | 0));
    db.users[id] = u; db.codes[u.codeHash] = id; dirty = true;
    event(`🪷 ${label(u)} vừa gia nhập tích đức`);
    return { uid: id, code, user: selfUser(u) };
  },

  'POST /api/sync'(b) {
    const u = auth(b);
    if (!u) return [401, { error: 'Sai mã đồng bộ' }];
    const now = Date.now(), elapsed = Math.min(600, Math.max(1, (now - u.lastSync) / 1000));
    const sent = Math.max(0, b.pending | 0), allowed = Math.ceil(elapsed * MAX_TPS) + 20;
    const accepted = Math.min(sent, allowed);
    addTaps(u, accepted);
    u.lastSync = now; dirty = true;
    return { user: selfUser(u), capped: sent > allowed };
  },

  'POST /api/profile'(b) {
    const u = auth(b);
    if (!u) return [401, { error: 'Sai mã đồng bộ' }];
    const name = cleanName(b.name);
    if (name) u.name = name;
    if (b.province === '' || PROVINCES.has(b.province)) u.province = b.province;
    dirty = true;
    return { user: selfUser(u) };
  },

  'POST /api/restore'(b) {
    const code = String(b.code || '').toUpperCase().trim();
    const u = db.users[db.codes[hash(code)]];
    if (!u) return [404, { error: 'Không tìm thấy mã khôi phục' }];
    return { uid: u.id, code, user: selfUser(u) };
  },

  'GET /api/leaderboard'(q) {
    const d = today(), tab = q.get('tab') === 'today' ? 'today' : 'all';
    const score = (u) => (tab === 'today' ? (u.day === d ? u.todayTaps : 0) : u.merit);
    const list = Object.values(db.users).filter((u) => score(u) > 0).sort((a, b) => score(b) - score(a));
    const me = list.findIndex((u) => u.id === q.get('uid'));
    return {
      tab,
      top: list.slice(0, 50).map((u) => ({ ...publicUser(u), score: score(u), me: u.id === q.get('uid') })),
      me: me >= 0 ? { rank: me + 1, score: score(list[me]) } : null,
      total: list.length,
    };
  },

  'GET /api/leaderboard/province'() {
    const d = today(), agg = {};
    for (const u of Object.values(db.users)) {
      if (!u.province) continue;
      const p = (agg[u.province] ||= { province: u.province, merit: 0, today: 0, members: 0 });
      p.merit += u.merit; p.members++;
      if (u.day === d) p.today += u.todayTaps;
    }
    return { top: Object.values(agg).sort((a, b) => b.merit - a.merit) };
  },

  'GET /api/live-stats'() {
    const now = Date.now();
    const online = Object.values(db.users).filter((u) => now - u.lastSync < 60e3).length;
    return { online, todayTaps: db.days[today()]?.taps || 0, events: db.events.slice(0, 15) };
  },

  'GET /api/provinces'() { return { provinces: [...PROVINCES].sort((a, b) => a.localeCompare(b, 'vi')) }; },
};

/* ===== Chính điện nhiều người: Server-Sent Events để phát, POST để gửi hành động ===== */
const ROOM_SIZE = 20;                 // bằng số đệm quỳ trong cảnh 3D; đầy thì mở phòng mới
const AV = { gender: ['nam', 'nu'], hair: ['troc', 'ngan', 'bui', 'dai'], outfit: ['lam', 'nau', 'xam'] };
const ACTIONS = new Set(['light', 'bow', 'plant', 'emote', 'kneel', 'stand', 'move', 'chant', 'offer']);
const EMOTES = ['🙏', '🪷', '❤️', '☸️'];
const SUTRA_COUNT = 8;                // số câu kinh trong SUTRA ở chua.js — client gửi số thứ tự, không gửi chữ tự do
// Dâng lễ miễn phí nhưng có thời gian chờ, điểm cộng vào Bảng Công Đức của phòng
const OFFERINGS = { hoa: { pts: 1, cd: 3e3 }, huong: { pts: 3, cd: 8e3 }, sen: { pts: 9, cd: 20e3 }, chuong: { pts: 27, cd: 45e3 } };
const boardTop = (room) => [...room.board.values()].sort((a, b) => b.pts - a.pts).slice(0, 10);
const rooms = [];                     // { id, members: Map(pid → member), incense: [] }
const members = new Map();

const cleanProfile = (p) => ({
  name: cleanName(p.name) || 'Đạo hữu',
  gender: AV.gender.includes(p.gender) ? p.gender : 'nam',
  hair: AV.hair.includes(p.hair) ? p.hair : 'troc',
  skin: Math.min(4, Math.max(0, p.skin | 0)),
  outfit: AV.outfit.includes(p.outfit) ? p.outfit : 'lam',
});
const pub = (m) => ({ pid: m.pid, slot: m.slot, held: m.held, pos: m.pos, kneel: m.kneel, ...m.profile });

function broadcast(room, event, data, exceptPid) {
  const line = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const m of room.members.values()) if (m.res && m.pid !== exceptPid) m.res.write(line);
}

function leaveRoom(m) {
  if (!members.delete(m.pid)) return;
  m.room.members.delete(m.pid);
  m.res?.end();
  if (m.announced) broadcast(m.room, 'leave', { pid: m.pid });
}

function openStream(req, res, q) {
  const m = members.get(q.get('pid'));
  if (!m || m.token !== q.get('token')) return send(res, 401, { error: 'expired' });
  clearTimeout(m.timer);
  if (m.res) m.res.end();
  res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  m.res = res;
  const now = Date.now();
  m.room.incense = m.room.incense.filter((i) => now - i.at < 180e3);
  const others = [...m.room.members.values()].filter((x) => x !== m && x.announced).map(pub);
  res.write(`event: snapshot\ndata: ${JSON.stringify({ now, room: m.room.id, members: others, incense: m.room.incense, board: boardTop(m.room) })}\n\n`);
  if (!m.announced) { m.announced = true; broadcast(m.room, 'join', pub(m), m.pid); }
  const ping = setInterval(() => res.write(': ping\n\n'), 20e3);
  req.on('close', () => {
    clearInterval(ping);
    // Cho 8 giây để kết nối lại (mạng chập chờn, chuyển tab) trước khi tính là rời đi
    if (m.res === res) { m.res = null; m.timer = setTimeout(() => leaveRoom(m), 8e3); }
  });
}

Object.assign(routes, {
  'POST /api/room/join'(b) {
    let room = rooms.find((r) => r.members.size < ROOM_SIZE);
    if (!room) { room = { id: rooms.length + 1, members: new Map(), incense: [], board: new Map() }; rooms.push(room); }
    const used = new Set([...room.members.values()].map((m) => m.slot));
    let slot = Number.isInteger(b.slot) && b.slot >= 0 && b.slot < ROOM_SIZE && !used.has(b.slot) ? b.slot : 0;
    while (used.has(slot)) slot++;
    const m = { pid: crypto.randomBytes(6).toString('hex'), token: crypto.randomBytes(16).toString('hex'),
      room, slot, held: 0, profile: cleanProfile(b), res: null, acts: [], announced: false };
    room.members.set(m.pid, m); members.set(m.pid, m);
    m.timer = setTimeout(() => leaveRoom(m), 20e3);   // phải mở kết nối trong 20 giây
    return { pid: m.pid, token: m.token, slot, room: room.id };
  },

  'POST /api/room/act'(b) {
    const m = members.get(b.pid);
    if (!m || m.token !== b.token) return [401, { error: 'expired' }];
    const now = Date.now(), type = String(b.type);
    if (!ACTIONS.has(type)) return [400, { error: 'Hành động không hợp lệ' }];
    // Di chuyển gửi dày hơn (~5 lần/giây) nên tính riêng với các hành động khác
    const bucket = type === 'move' ? (m.moves ||= []) : m.acts, [win, max] = type === 'move' ? [2000, 14] : [5000, 8];
    while (bucket.length && now - bucket[0] > win) bucket.shift();
    if (bucket.length >= max) return [429, { error: 'Chậm lại một chút' }];
    bucket.push(now);
    const ev = { pid: m.pid, type };
    if (type === 'move') {
      const x = Number(b.x), z = Number(b.z);
      if (!Number.isFinite(x) || !Number.isFinite(z)) return [400, { error: 'Vị trí không hợp lệ' }];
      ev.x = Math.min(6.5, Math.max(-6.5, x)); ev.z = Math.min(9.5, Math.max(-2.5, z));
      m.pos = [ev.x, ev.z];
    }
    if (type === 'kneel') m.kneel = true;
    if (type === 'stand') m.kneel = false;
    if (type === 'light') m.held = ev.count = [1, 3, 5].includes(b.count) ? b.count : 3;
    if (type === 'plant') {
      if (!m.held) return [400, { error: 'Chưa thắp hương' }];
      ev.count = m.held; m.held = 0;
      ev.off = [+(Math.random() * 0.4 - 0.2).toFixed(3), +(Math.random() * 0.2 - 0.1).toFixed(3)];
      ev.id = crypto.randomBytes(4).toString('hex');
      m.room.incense.push({ id: ev.id, count: ev.count, off: ev.off, at: now });
      if (m.room.incense.length > 60) m.room.incense.shift();
    }
    if (type === 'emote') ev.e = EMOTES.includes(b.e) ? b.e : '🙏';
    if (type === 'chant') {
      ev.i = Number.isInteger(b.i) && b.i >= 0 && b.i < SUTRA_COUNT ? b.i : 0;
      ev.name = m.profile.name;
    }
    if (type === 'offer') {
      const o = OFFERINGS[b.kind];
      if (!o) return [400, { error: 'Lễ vật không hợp lệ' }];
      m.lastOffer ||= {};
      if (now - (m.lastOffer[b.kind] || 0) < o.cd) return [429, { error: 'Xin chờ một chút rồi dâng tiếp' }];
      m.lastOffer[b.kind] = now;
      // Gộp theo pháp danh: vào lại phòng (mạng chập chờn, tải lại trang) vẫn cộng tiếp vào dòng cũ
      const entry = m.room.board.get(m.profile.name) || { name: m.profile.name, pts: 0 };
      entry.pts += o.pts; m.room.board.set(m.profile.name, entry);
      Object.assign(ev, { kind: b.kind, name: m.profile.name, total: entry.pts, board: boardTop(m.room) });
    }
    broadcast(m.room, 'act', ev, m.pid);
    return ev;
  },
});

/* ===== Cửa hàng & thanh toán: chuyển khoản VietQR, SePay báo về qua webhook ===== */
// Cấu hình bằng biến môi trường (xem DEPLOY.md). Sản phẩm & giá nằm trong lib/rules.js.
const PAY = payConfig();
const orderView = (o) => viewOrder(o, PAY);

function grant(u, p) {
  if (p.skin) u.owned = [...new Set([...(u.owned || []), p.skin])];
  if (p.days) u.memberUntil = Math.max(Date.now(), u.memberUntil || 0) + p.days * 864e5;
}

// Ghi nhận một giao dịch tiền vào. Dùng chung cho webhook thật và nút giả lập.
function applyPayment({ txId, content, amount, type }) {
  if (type !== 'in') return { success: true, ignored: 'not incoming' };
  if (db.txIds.includes(txId)) return { success: true, duplicate: true };     // SePay có thể gửi lại
  db.txIds.push(txId);
  if (db.txIds.length > 5000) db.txIds.shift();
  dirty = true;
  const match = String(content || '').toUpperCase().match(ORDER_RE);
  const o = match && db.orders[match[0]];
  if (!o) { console.warn('[pay] không khớp đơn nào:', txId, content); return { success: true, ignored: 'no order' }; }
  if (o.status === 'paid') return { success: true, duplicate: true };
  const u = db.users[o.uid];
  if (Number(amount) < o.amount || !u) {
    o.status = 'underpaid'; o.paidAmount = Number(amount);
    console.warn('[pay] chuyển thiếu tiền:', o.code, amount, '/', o.amount);
    return { success: true, underpaid: true };
  }
  o.status = 'paid'; o.paidAt = Date.now(); o.txId = txId; o.paidAmount = Number(amount);
  grant(u, PRODUCTS[o.product]);
  flush();                                       // tiền bạc: ghi xuống đĩa ngay
  console.log('[pay] đã thanh toán:', o.code, o.product, o.amount);
  return { success: true };
}

Object.assign(routes, {
  'GET /api/shop'() {
    return { products: Object.entries(PRODUCTS).map(([id, p]) => ({ id, ...p })), open: !!PAY.account || PAY.test, test: PAY.test };
  },

  'POST /api/orders'(b) {
    const u = auth(b);
    if (!u) return [401, { error: 'Sai mã đồng bộ' }];
    if (!PAY.account && !PAY.test) return [503, { error: 'Cửa hàng chưa mở' }];
    const p = PRODUCTS[b.product];
    if (!p) return [400, { error: 'Không có sản phẩm này' }];
    if (p.skin && (u.owned || []).includes(p.skin)) return [400, { error: 'Bạn đã có vật phẩm này' }];
    const now = Date.now();
    // Dùng lại đơn đang chờ của cùng sản phẩm để không sinh nhiều mã cho một lần mua
    const open = Object.values(db.orders).find((o) => o.uid === u.id && o.product === b.product && o.status === 'pending' && now - o.created < ORDER_TTL);
    if (open) return orderView(open);
    let code;
    do code = newOrderCode(); while (db.orders[code]);
    const o = db.orders[code] = { code, uid: u.id, product: b.product, amount: p.price, status: 'pending', created: now };
    dirty = true;
    return orderView(o);
  },

  'POST /api/orders/status'(b) {
    const u = auth(b);
    if (!u) return [401, { error: 'Sai mã đồng bộ' }];
    const o = db.orders[String(b.order || '')];
    if (!o || o.uid !== u.id) return [404, { error: 'Không tìm thấy đơn' }];
    return { status: o.status, paidAmount: o.paidAmount, user: selfUser(u) };
  },

  // SePay gọi vào đây khi tài khoản nhận tiền. Header: "Authorization: Apikey <SEPAY_API_KEY>"
  'POST /api/sepay/webhook'(b, req) {
    if (!PAY.apiKey) return [503, { success: false, error: 'Chưa cấu hình SEPAY_API_KEY' }];
    if (!safeEqual(req.headers.authorization || '', `Apikey ${PAY.apiKey}`)) return [401, { success: false }];
    return applyPayment({ txId: 'sepay:' + b.id, content: `${b.code || ''} ${b.content || ''} ${b.description || ''}`, amount: b.transferAmount, type: b.transferType });
  },

  // Chỉ khi PAYMENT_TEST=1: giả lập khách đã chuyển khoản đủ tiền
  'POST /api/dev/pay'(b) {
    if (!PAY.test) return [404, { error: 'Không có API này' }];
    const u = auth(b), o = db.orders[String(b.order || '')];
    if (!u || !o || o.uid !== u.id) return [404, { error: 'Không tìm thấy đơn' }];
    return applyPayment({ txId: 'test:' + o.code, content: o.code, amount: o.amount, type: 'in' });
  },
});

/* ===== Giới hạn tần suất đơn giản theo IP ===== */
const hits = new Map();
setInterval(() => hits.clear(), 60e3);
const limited = (ip) => { const n = (hits.get(ip) || 0) + 1; hits.set(ip, n); return n > 120; };

/* ===== File tĩnh ===== */
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.mp3': 'audio/mpeg' };

function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname).replace(/^\/+/, '') || 'index.html';
  const file = path.normalize(path.join(ROOT, rel));
  rel = path.relative(ROOT, file);
  const type = TYPES[path.extname(file).toLowerCase()];
  // Chặn thoát khỏi thư mục gốc và chặn lộ mã/dữ liệu máy chủ
  if (!type || rel.startsWith('..') || path.isAbsolute(rel) || rel.split(path.sep)[0] === 'server') {
    res.writeHead(404).end('Not found'); return;
  }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404).end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' }).end(data);
  });
}

function send(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }).end(JSON.stringify(obj));
}

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (!url.pathname.startsWith('/api/')) return serveStatic(req, res, url.pathname);
  const ip = (TRUST_PROXY && String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || req.socket.remoteAddress;
  if (limited(ip)) return send(res, 429, { error: 'Quá nhiều yêu cầu' });
  if (req.method === 'GET' && url.pathname === '/api/room/stream') return openStream(req, res, url.searchParams);
  const route = routes[`${req.method} ${url.pathname}`];
  if (!route) return send(res, 404, { error: 'Không có API này' });
  if (req.method === 'GET') {
    const out = route(url.searchParams);
    return Array.isArray(out) ? send(res, ...out) : send(res, 200, out);
  }
  let raw = '';
  req.on('data', (c) => { raw += c; if (raw.length > 10e3) req.destroy(); });
  req.on('end', () => {
    let body;
    try { body = JSON.parse(raw || '{}'); } catch { return send(res, 400, { error: 'JSON không hợp lệ' }); }
    const out = route(body, req);
    Array.isArray(out) ? send(res, ...out) : send(res, 200, out);
  });
}).listen(PORT, HOST, () => console.log(`Tích Đức đang chạy tại http://${HOST}:${PORT}`));
