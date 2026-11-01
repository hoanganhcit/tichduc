// Bộ phát TikTok LIVE cho chính điện 3D. Chạy trên máy phát: cd live && npm install && npm start
// Người xem bình luận → vào quỳ ở chính điện; tặng quà → dâng lễ, xướng tên hồi hướng; thả tim → ❤️.
// Màn hình phát: /chua.html?live (cảnh 3D 9:16). Bảng điều khiển: /live/control.html
//
// An toàn: chỉ nghe 127.0.0.1; header Host phải là localhost (chống DNS rebinding); lệnh POST phải đến từ
// chính trang này (kiểm tra Origin); chỉ phục vụ vài file trong danh sách trắng. Không dùng tài khoản TikTok —
// chỉ đọc sự kiện công khai của phòng live theo username.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '127.0.0.1';

/* ===== Chỗ quỳ: khớp SLOTS trong chua.js (4 hàng × 5) ===== */
const SLOTS = [];
for (const z of [-0.9, 0.5, 1.9, 3.3]) for (const x of [0, -1.2, 1.2, -2.4, 2.4]) SLOTS.push({ x, z });

// Thẻ # trong bình luận để tự chọn dáng, ghép được nhiều thẻ: "#nữ #búi #nâu"
const TAGS = {
  nam: { gender: 'nam' }, nu: { gender: 'nu' },
  troc: { hair: 'troc' }, ngan: { hair: 'ngan' }, bui: { hair: 'bui' }, dai: { hair: 'dai' },
  lam: { outfit: 'lam' }, nau: { outfit: 'nau' }, xam: { outfit: 'xam' },
};
const unaccent = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').toLowerCase();
function readTags(text) {
  const look = {};
  for (const [, t] of String(text).matchAll(/#([\p{L}]+)/gu)) Object.assign(look, TAGS[unaccent(t)]);
  return look;
}
const PRAYERS = ['gia đình bình an', 'cha mẹ mạnh khỏe', 'mọi người an lạc', 'chúng sinh thoát khổ', 'tâm luôn thanh tịnh'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const clean = (s, n) => String(s ?? '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);

const settings = { tts: true, ambient: true, joinOnEnter: false, readPrayer: true };
const members = new Map();      // id TikTok → người đang quỳ
const board = new Map();        // pid → { name, pts }
const clients = new Set();      // kết nối SSE (màn hình phát + bảng điều khiển)
let logs = [];

function send(event, data) {
  const line = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) res.write(line);
}
function log(text) {
  const item = { text, at: Date.now() };
  logs = [item, ...logs].slice(0, 80);
  send('log', item); console.log(text);
}
const boardTop = () => [...board.values()].sort((a, b) => b.pts - a.pts).slice(0, 10);
const pub = (m, seated = true) => ({ pid: m.pid, slot: m.slot, held: 0, kneel: seated, pos: seated ? [SLOTS[m.slot].x, SLOTS[m.slot].z] : null, ...m.profile });
function status() {
  send('status', { tiktok: tiktokState, seated: members.size, settings, bots: !!botTimer });
}

// Hình mặc định suy từ id để mỗi người xem luôn có cùng một dáng
function lookFor(id) {
  const h = crypto.createHash('sha1').update(String(id)).digest();
  return {
    gender: h[0] % 2 ? 'nu' : 'nam', hair: ['troc', 'ngan', 'bui', 'dai'][h[1] % 4],
    skin: h[2] % 5, outfit: ['lam', 'nau', 'xam'][h[3] % 3],
  };
}

/* ===== Ngồi / rời chỗ ===== */
function seat(id, name) {
  id = String(id || '');
  if (!id) return null;
  const now = Date.now();
  let m = members.get(id);
  if (m) { m.lastActive = now; return m; }
  if (members.size >= SLOTS.length) {
    // Đầy chỗ: mời người có ít điểm nhất rời đi (bằng điểm thì ai ít hoạt động gần đây hơn)
    const out = [...members.values()].sort((a, b) => a.coins - b.coins || a.lastActive - b.lastActive)[0];
    if (out.coins >= 27) return null;            // ai cũng đã thỉnh chuông trở lên: giữ nguyên chỗ
    unseat(out.id);
  }
  const used = new Set([...members.values()].map((x) => x.slot));
  let slot = 0; while (used.has(slot)) slot++;
  m = { id, pid: 'v' + crypto.createHash('sha1').update(id).digest('hex').slice(0, 10), slot,
    profile: { name: clean(name, 20) || 'Đạo hữu', ...lookFor(id) }, lastActive: now, coins: 0, prayer: '' };
  members.set(id, m);
  walkIn(m);
  status();
  return m;
}
function walkIn(m) {
  send('join', pub(m, false));
  // Vào từ cửa, đi tới đệm rồi quỳ
  setTimeout(() => {
    if (members.get(m.id) !== m) return;
    send('act', { pid: m.pid, type: 'move', x: SLOTS[m.slot].x, z: SLOTS[m.slot].z });
    send('act', { pid: m.pid, type: 'kneel' });
  }, 300);
}
function unseat(id) {
  const m = members.get(id);
  if (!m) return;
  members.delete(id);
  send('leave', { pid: m.pid });
  status();
}

/* ===== Sự kiện từ TikTok (hoặc nút thử) ===== */
function onChat(id, name, text) {
  const m = seat(id, name);
  if (!m) return;
  text = clean(text, 80);
  if (!text) return;
  const look = readTags(text);
  if (Object.keys(look).length) {                // có thẻ #: đổi dáng bằng cách rời rồi vào lại
    m.profile = { ...m.profile, ...look };
    send('leave', { pid: m.pid });
    setTimeout(() => walkIn(m), 700);
    text = clean(text.replace(/#[\p{L}]+/gu, ''), 80);
    if (!text) return;
  }
  m.prayer = text;
  send('act', { pid: m.pid, type: 'say', name: m.profile.name, text });
}

function onGift(id, name, giftName, count, diamonds) {
  const m = seat(id, name);
  if (!m) return;
  giftName = clean(giftName, 30) || 'quà';
  count = Math.max(1, Math.min(9999, Number(count) || 1));
  const coins = Math.max(1, Number(diamonds) || 1) * count;
  m.coins += coins;
  board.set(m.pid, { name: m.profile.name, pts: m.coins });
  // Bậc lễ theo giá trị quà, cùng thang điểm với thanh dâng lễ trong chua.js
  const kind = coins >= 27 ? 'chuong' : coins >= 9 ? 'sen' : coins >= 3 ? 'huong' : 'hoa';
  const wish = settings.readPrayer && m.prayer ? m.prayer : `Nguyện ${pick(PRAYERS)}`;
  const line = `Tích Đức xin ghi nhận đạo hữu ${m.profile.name} đã gửi ${count > 1 ? `${count} ` : ''}${giftName}. ${wish}. Công đức vô lượng.`;
  send('act', { pid: m.pid, type: 'offer', kind, name: m.profile.name, board: boardTop(),
    gift: { name: count > 1 ? `${giftName} ×${count}` : giftName, line: settings.tts ? line : '' } });
  log(`🎁 ${m.profile.name} tặng ${giftName} ×${count} (${coins} xu)`);
}

const lastLike = new Map();
function onLike(id) {
  const m = members.get(String(id || ''));
  if (!m || Date.now() - (lastLike.get(id) || 0) < 3000) return;   // mỗi người tối đa 1 tim / 3 giây
  lastLike.set(id, Date.now());
  send('act', { pid: m.pid, type: 'emote', e: '❤️' });
}

/* ===== Kết nối TikTok (thư viện cộng đồng tiktok-live-connector, không phải API chính thức) ===== */
let tiktok = null, tiktokState = { status: 'idle', uniqueId: '', error: '' }, TikTokLib = null;
async function connectTikTok(uniqueId) {
  uniqueId = String(uniqueId || '').trim().replace(/^.*tiktok\.com\/@?/i, '').replace(/^@/, '').replace(/[/?#].*$/, '');
  if (!/^[\w.]{2,30}$/.test(uniqueId)) { log('❌ Username TikTok không hợp lệ'); return; }
  await disconnectTikTok();
  tiktokState = { status: 'connecting', uniqueId, error: '' }; status();
  try {
    TikTokLib ||= await import('tiktok-live-connector');
    const { TikTokLiveConnection: Live, WebcastEvent: E, ControlEvent: C } = TikTokLib;
    const live = new Live(uniqueId, { enableExtendedGiftInfo: true, processInitialData: false });
    // Rút gọn thông tin người xem từ mỗi sự kiện
    const who = (d) => { const u = d?.user || {}; return { id: u.uniqueId || u.userId, name: u.nickname || u.uniqueId || 'ẩn danh' }; };
    const gift = (d) => {
      const info = { ...(d.extendedGiftInfo || {}), ...(d.giftDetails || {}) };
      const streakRunning = (info.giftType ?? info.type) === 1 && !d.repeatEnd;   // quà combo: đợi combo xong mới tính một lần
      return streakRunning ? null : { title: info.giftName || info.name, value: info.diamondCount ?? info.diamond_count ?? 1, times: d.repeatCount || 1 };
    };
    const handlers = {
      [E.CHAT]: (d) => { const u = who(d); onChat(u.id, u.name, d.comment); },
      [E.GIFT]: (d) => { const g = gift(d), u = who(d); if (g) onGift(u.id, u.name, g.title, g.times, g.value); },
      [E.LIKE]: (d) => onLike(who(d).id),
      [E.MEMBER]: (d) => { if (settings.joinOnEnter) { const u = who(d); seat(u.id, u.name); } },
      [C.DISCONNECTED]: () => { tiktokState = { ...tiktokState, status: 'disconnected' }; status(); log('TikTok: mất kết nối'); },
      [C.ERROR]: (err) => log('TikTok lỗi: ' + (err?.info || err?.message || err)),
    };
    for (const [event, fn] of Object.entries(handlers)) live.on(event, fn);
    const room = await live.connect();
    tiktok = live;
    tiktokState = { status: 'connected', uniqueId, error: '', roomId: room?.roomId || '' };
    log(`✅ Đã kết nối live @${uniqueId}`);
  } catch (e) {
    tiktokState = { status: 'error', uniqueId, error: String(e?.message || e).slice(0, 200) };
    log(`❌ Không kết nối được @${uniqueId}: ${tiktokState.error}`);
  }
  status();
}
async function disconnectTikTok() {
  if (tiktok) { try { await tiktok.disconnect(); } catch {} tiktok = null; }
  tiktokState = { status: 'idle', uniqueId: '', error: '' }; status();
}

/* ===== Người mô phỏng để thử khi chưa live ===== */
const DEMO = ['An Nhiên', 'Bảo Ngọc', 'Gia Huy', 'Hải Đăng', 'Khánh Linh', 'Lan Anh', 'Minh Khôi', 'Ngọc Hân', 'Phúc An', 'Quốc Bảo',
  'Thảo Vy', 'Thu Hà', 'Tuấn Kiệt', 'Vân Khánh', 'Yến Nhi', 'Đức Trí', 'Hoài Nam', 'Mai Chi', 'Nhật Minh', 'Thanh Tú'];
const CHANTS = ['A Di Đà Phật', 'Con xin cho cả nhà mạnh khỏe', 'Chúc mọi người một ngày an yên', 'Nguyện thi cử thuận lợi #nữ #búi',
  'Mong công việc hanh thông #nâu', 'Xin bình an cho ông bà'];
let botTimer = null;
function fill(n) {
  for (let i = 0; i < n; i++) { const name = pick(DEMO); seat('bot_' + crypto.randomBytes(3).toString('hex'), name); }
}
function botTick() {
  const all = [...members.values()];
  if (!all.length) return fill(3);
  const m = pick(all);
  const r = Math.random();
  if (r < 0.25) onGift(m.id, m.profile.name, pick(['Hoa hồng', 'Nhang', 'Hoa sen', 'Chuông vàng']), 1, pick([1, 1, 3, 9, 27]));
  else if (r < 0.75) onChat(m.id, m.profile.name, pick(CHANTS));
  else onLike(m.id);
}

/* ===== Lệnh từ bảng điều khiển ===== */
function command(c) {
  switch (c.cmd) {
    case 'connect': connectTikTok(c.uniqueId); break;
    case 'disconnect': disconnectTikTok(); log('Đã ngắt kết nối TikTok'); break;
    case 'comment': onChat('test_' + clean(c.name, 20), clean(c.name, 20) || 'Khách thử', c.text); break;
    case 'gift': onGift('test_' + clean(c.name, 20), clean(c.name, 20) || 'Khách thử', c.giftName || 'Hoa sen', 1, Math.min(10000, Number(c.diamonds) || 1)); break;
    case 'fill': fill(Math.min(20, Math.max(1, Number(c.n) || 5))); break;
    case 'bots':
      clearInterval(botTimer); botTimer = c.on ? setInterval(botTick, 2500) : null;
      log(c.on ? '🤖 Bật người mô phỏng' : 'Tắt người mô phỏng'); status(); break;
    case 'clear': [...members.keys()].forEach(unseat); board.clear(); log('Đã mời mọi người rời chính điện'); break;
    case 'settings':
      for (const k of Object.keys(settings)) if (typeof c[k] === 'boolean') settings[k] = c[k];
      send('settings', settings); status(); break;
    default: return false;
  }
  return true;
}

/* ===== HTTP ===== */
const FILES = {
  '/chua.html': 'text/html; charset=utf-8', '/chua.js': 'text/javascript; charset=utf-8', '/avatar.js': 'text/javascript; charset=utf-8',
  '/icon.svg': 'image/svg+xml', '/live/control.html': 'text/html; charset=utf-8',
};
const json = (res, code, obj) => res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' }).end(JSON.stringify(obj));

http.createServer((req, res) => {
  const host = String(req.headers.host || '');
  if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) return res.writeHead(421).end('Misdirected');
  const url = new URL(req.url, `http://${host}`);

  if (req.method === 'GET' && url.pathname === '/') return res.writeHead(302, { Location: '/live/control.html' }).end();

  if (req.method === 'GET' && url.pathname === '/live/events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
    res.write(`event: snapshot\ndata: ${JSON.stringify({ now: Date.now(), members: [...members.values()].map((m) => pub(m)), board: boardTop(), incense: [] })}\n\n`);
    res.write(`event: settings\ndata: ${JSON.stringify(settings)}\n\n`);
    clients.add(res);
    const ping = setInterval(() => res.write(': ping\n\n'), 20e3);
    req.on('close', () => { clearInterval(ping); clients.delete(res); });
    status();
    for (const l of [...logs].reverse()) res.write(`event: log\ndata: ${JSON.stringify(l)}\n\n`);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/live/cmd') {
    // Chỉ nhận lệnh từ chính trang của máy chủ này: trang web lạ mở trong cùng trình duyệt không điều khiển được
    if (req.headers.origin !== `http://${host}`) return json(res, 403, { error: 'Origin không hợp lệ' });
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > 4000) req.destroy(); });
    req.on('end', () => {
      let c; try { c = JSON.parse(raw); } catch { return json(res, 400, { error: 'JSON không hợp lệ' }); }
      json(res, command(c) ? 200 : 400, { ok: true });
    });
    return;
  }

  const type = req.method === 'GET' && FILES[url.pathname];
  if (!type) return res.writeHead(404).end('Not found');
  fs.readFile(path.join(ROOT, url.pathname), (err, data) => {
    if (err) return res.writeHead(404).end('Not found');
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' }).end(data);
  });
}).listen(PORT, HOST, () => console.log(`🛕 Bộ phát LIVE: http://localhost:${PORT}/live/control.html`));
