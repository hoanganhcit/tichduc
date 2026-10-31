'use strict';

/* ===== Dữ liệu ===== */
const REALMS = [
  { name: 'Sơ tâm',      cost: 0,         mult: 1 },
  { name: 'Định tâm',    cost: 100,       mult: 2 },
  { name: 'Tĩnh tâm',    cost: 1000,      mult: 4 },
  { name: 'Tỉnh giác',   cost: 10000,     mult: 8 },
  { name: 'Khai ngộ',    cost: 100000,    mult: 16 },
  { name: 'An trú',      cost: 1000000,   mult: 32 },
  { name: 'Thiền duyệt', cost: 10000000,  mult: 64 },
  { name: 'Chánh niệm',  cost: 50000000,  mult: 128 },
  { name: 'Giác tỉnh',   cost: 250000000, mult: 256 },
];

const STREAK_TIERS = [
  { days: 1, name: 'Nhóm Lửa' }, { days: 3, name: 'Lá Sen' }, { days: 7, name: 'Hoa Sen' },
  { days: 21, name: 'Đèn Tâm' }, { days: 49, name: 'Bồ Đề' }, { days: 108, name: 'Kim Cang' },
];

// c: [sáng, giữa, tối, viền, nét mặt, lòng mõ] · realm: cảnh giới cần để mở · pitch: cao độ tiếng gõ
const SKINS = [
  { id: 'son',  name: 'Mõ Son',    realm: 0, pitch: 1,    c: ['#ff9a6a', '#d23c2e', '#8a1a18', '#f2b53a', '#ffe39a', '#4a0c0c'] },
  { id: 'tre',  name: 'Mõ Tre',    realm: 0, pitch: 1.15, c: ['#f2e08a', '#b8b040', '#6a7a1a', '#e8d070', '#fffbe0', '#3a4208'] },
  { id: 'go',   name: 'Mõ Gỗ',     realm: 1, pitch: 0.9,  c: ['#e0a878', '#a06a3a', '#5a3519', '#c8935e', '#ffe7c0', '#2a160a'] },
  { id: 'dong', name: 'Mõ Đồng',   realm: 2, pitch: 0.8,  c: ['#f0c088', '#b87333', '#6a3a14', '#ffd9a0', '#fff1d8', '#3a1a06'] },
  { id: 'ngoc', name: 'Mõ Ngọc',   realm: 3, pitch: 1.25, c: ['#b8f0d0', '#3aa878', '#14603e', '#e8fff0', '#f0fff6', '#0a3020'] },
  { id: 'vang', name: 'Mõ Vàng',   realm: 4, pitch: 1.05, c: ['#fff1b0', '#f2b53a', '#a8701a', '#fff8d0', '#7a4a08', '#5a3604'] },
  { id: 'sen',  name: 'Mõ Sen',    realm: 5, pitch: 1.1,  c: ['#ffd0e0', '#ec5f92', '#9a2252', '#ffe6ef', '#fff4f8', '#5a0c2a'] },
  { id: 'long', name: 'Mõ Long',   realm: 6, pitch: 0.75, c: ['#8ab8ff', '#2a4ab8', '#141e5a', '#f2b53a', '#ffe39a', '#0a0e30'] },
  { id: 'phat', name: 'Mõ Phật',   realm: 8, pitch: 0.95, c: ['#ffffff', '#ffe9a8', '#e8b33a', '#fff', '#c8902a', '#a8701a'] },
  // Chỉ có ở cửa hàng (realm 99 = không mở bằng cảnh giới)
  { id: 'kylan',   name: 'Mõ Kỳ Lân',   realm: 99, pitch: 1.2, c: ['#a8f0e8', '#1fa898', '#0c5a52', '#f2b53a', '#fff4c8', '#06302c'] },
  { id: 'thatbao', name: 'Mõ Thất Bảo', realm: 99, pitch: 0.85, c: ['#e8c8ff', '#8a4ad2', '#3a1470', '#ffd970', '#fff1b0', '#1e0840'] },
];

const QUOTES = [
  ['Ở hiền thì lại gặp lành,\nNhững người nhân đức trời dành phúc cho.', 'Ca dao'],
  ['Một điều nhịn, chín điều lành.', 'Tục ngữ'],
  ['Công cha như núi Thái Sơn,\nNghĩa mẹ như nước trong nguồn chảy ra.', 'Ca dao'],
  ['Ăn quả nhớ kẻ trồng cây.', 'Tục ngữ'],
  ['Thương người như thể thương thân.', 'Tục ngữ'],
  ['Lời nói chẳng mất tiền mua,\nLựa lời mà nói cho vừa lòng nhau.', 'Ca dao'],
  ['Một cây làm chẳng nên non,\nBa cây chụm lại nên hòn núi cao.', 'Ca dao'],
  ['Lá lành đùm lá rách.', 'Tục ngữ'],
  ['Tâm an thì cảnh an.', 'Lời Phật dạy'],
  ['Hơi thở vào, tâm tĩnh lặng.\nHơi thở ra, miệng mỉm cười.', 'Lời thiền'],
  ['Gieo nhân nào, gặt quả nấy.', 'Lời Phật dạy'],
  ['Uống nước nhớ nguồn.', 'Tục ngữ'],
];

const FORTUNES = [
  ['Thượng thượng', 'Phúc Đáo Môn Đình', 'Phúc lành gõ cửa. Việc đang mong sẽ có tin vui, nhớ giữ lòng khiêm nhường.'],
  ['Thượng', 'Thuận Phong Thuận Thủy', 'Mọi việc trôi chảy như thuyền xuôi gió. Hãy mạnh dạn bắt đầu điều đã định.'],
  ['Thượng', 'Hoa Khai Kiến Phật', 'Hoa nở thấy Phật. Kiên nhẫn chờ, kết quả tốt đến đúng lúc.'],
  ['Trung', 'Nguyệt Ẩn Vân Trung', 'Trăng ẩn trong mây. Tạm thời chưa rõ ràng, đừng vội quyết định lớn.'],
  ['Trung', 'Thủy Tích Thạch Xuyên', 'Nước chảy đá mòn. Bền bỉ từng chút một sẽ thành công.'],
  ['Trung', 'Cổ Thụ Phùng Xuân', 'Cây già gặp xuân. Việc cũ có cơ hội hồi sinh nếu chịu làm mới.'],
  ['Thượng', 'Kim Liên Xuất Thủy', 'Sen vàng vươn khỏi nước. Vượt qua khó khăn, danh tiếng tỏa sáng.'],
  ['Trung', 'Lộ Viễn Tri Mã Lực', 'Đường xa mới biết sức ngựa. Thử thách hiện tại chứng minh năng lực bạn.'],
  ['Hạ', 'Phong Vũ Đình Tiền', 'Mưa gió trước sân. Cẩn trọng lời nói, tránh tranh cãi trong vài ngày tới.'],
  ['Trung', 'Tĩnh Thủy Lưu Thâm', 'Nước lặng chảy sâu. Lắng nghe nhiều hơn nói, câu trả lời sẽ tự đến.'],
  ['Thượng', 'Song Hỷ Lâm Môn', 'Hai niềm vui cùng đến. Tình cảm và công việc đều có khởi sắc.'],
  ['Hạ', 'Khô Mộc Đãi Vũ', 'Cây khô đợi mưa. Thời chưa tới, hãy tích lũy và chăm sóc bản thân.'],
];

/* ===== State ===== */
const KEY = 'tichduc_state_v1';
const today = () => new Date().toLocaleDateString('sv');  // YYYY-MM-DD
const defaults = { merit: 0, taps: 0, seconds: 0, realm: 0, todayTaps: 0, day: today(),
  streak: 0, lastDay: null, sound: true, music: false, skin: 'son', quoteSeen: null, fortune: null,
  owned: [], memberUntil: 0,
  uid: null, code: null, name: '', province: '', pending: 0 };
let S;
try { S = { ...defaults, ...JSON.parse(localStorage.getItem(KEY)) }; } catch { S = { ...defaults }; }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {} };

function rollDay() {
  const d = today();
  if (S.day !== d) { S.day = d; S.todayTaps = 0; }
}
function touchStreak() {
  const d = today();
  if (S.lastDay === d) return;
  const y = new Date(); y.setDate(y.getDate() - 1);
  S.streak = S.lastDay === y.toLocaleDateString('sv') ? S.streak + 1 : 1;
  S.lastDay = d;
}

/* ===== DOM helpers ===== */
const $ = (id) => document.getElementById(id);
const fmt = (n) => n >= 1e9 ? (n / 1e9).toFixed(1) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n.toLocaleString('vi-VN');
const fmtTime = (s) => s < 60 ? s + 's' : s < 3600 ? Math.floor(s / 60) + 'p' : (s / 3600).toFixed(1) + 'h';
let toastTimer;
function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

/* ===== Âm thanh (Web Audio, tổng hợp — không cần file) ===== */
let ctx;
function audio() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
function knock() {
  if (!S.sound) return;
  const a = audio(), t = a.currentTime, p = skin().pitch;
  // thân gỗ: sine trầm tắt nhanh
  const o = a.createOscillator(), g = a.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(720 * p * (0.97 + Math.random() * 0.06), t);
  o.frequency.exponentialRampToValueAtTime(380 * p, t + 0.12);
  g.gain.setValueAtTime(0.9, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + 0.2);
  // tiếng "cốc": nhiễu qua bandpass
  const len = a.sampleRate * 0.03, buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const n = a.createBufferSource(), f = a.createBiquadFilter(), ng = a.createGain();
  n.buffer = buf; f.type = 'bandpass'; f.frequency.value = 1800 * p; f.Q.value = 3; ng.gain.value = 0.6;
  n.connect(f).connect(ng).connect(a.destination); n.start(t);
}
function bell() {
  if (!S.sound) return;
  const a = audio(), t = a.currentTime;
  [[220, 0.5, 6], [440, 0.3, 4.5], [556, 0.2, 3.5], [663, 0.15, 3], [881, 0.08, 2]].forEach(([fq, v, dur]) => {
    const o = a.createOscillator(), g = a.createGain();
    o.frequency.value = fq;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur);
  });
}

/* ===== Nhạc thiền nền: drone ngũ cung + tiếng suối (tổng hợp, không cần file) ===== */
let music = null;
function startMusic() {
  if (music) return;
  const a = audio(), out = a.createGain();
  out.gain.setValueAtTime(0, a.currentTime);
  out.gain.linearRampToValueAtTime(1, a.currentTime + 3);
  out.connect(a.destination);
  const nodes = [];
  // Drone: các nốt D-A-D-E (ngũ cung), mỗi nốt "thở" chậm với LFO riêng
  [[146.8, .05], [220, .035], [293.7, .025], [329.6, .015]].forEach(([fq, v], i) => {
    const o = a.createOscillator(), g = a.createGain(), lfo = a.createOscillator(), lg = a.createGain();
    o.type = 'sine'; o.frequency.value = fq; o.detune.value = (i - 1.5) * 4;
    g.gain.value = v;
    lfo.frequency.value = 0.05 + i * 0.03; lg.gain.value = v * 0.8;
    lfo.connect(lg).connect(g.gain);
    o.connect(g).connect(out); o.start(); lfo.start();
    nodes.push(o, lfo);
  });
  // Suối: nhiễu nâu qua lowpass, cường độ dao động nhẹ
  const len = a.sampleRate * 4, buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
  const n = a.createBufferSource(), f = a.createBiquadFilter(), ng = a.createGain(), lfo = a.createOscillator(), lg = a.createGain();
  n.buffer = buf; n.loop = true; f.type = 'lowpass'; f.frequency.value = 900; ng.gain.value = 0.12;
  lfo.frequency.value = 0.15; lg.gain.value = 0.05; lfo.connect(lg).connect(ng.gain);
  n.connect(f).connect(ng).connect(out); n.start(); lfo.start();
  nodes.push(n, lfo);
  music = { out, nodes };
}
function stopMusic() {
  if (!music) return;
  const { out, nodes } = music, t = ctx.currentTime;
  out.gain.setValueAtTime(out.gain.value, t); out.gain.linearRampToValueAtTime(0, t + 1.5);
  nodes.forEach((n) => n.stop(t + 1.6));
  music = null;
}

/* ===== Skin mõ ===== */
const skin = () => SKINS.find((s) => s.id === S.skin) || SKINS[0];
const isMember = () => S.memberUntil > Date.now();
// Có mõ khi: đủ cảnh giới, đã mua, hoặc đang là Hội viên
const hasSkin = (s) => S.realm >= s.realm || S.owned.includes(s.id) || isMember();
function applySkin() {
  if (!hasSkin(skin())) S.skin = 'son';          // hết hạn Hội viên: quay về mõ mặc định
  const [hi, mid, lo, stroke, line, hole] = skin().c;
  const stops = document.querySelectorAll('#gM stop');
  [hi, mid, lo].forEach((c, i) => stops[i].setAttribute('stop-color', c));
  document.querySelectorAll('#gHole stop').forEach((s, i) => s.setAttribute('stop-color', i ? lo : hole));
  $('mo-body').setAttribute('stroke', stroke);
  document.querySelectorAll('.mo-line').forEach((l) => l.setAttribute('stroke', line));
}
const money = (n) => n.toLocaleString('vi-VN') + 'đ';
let shop = null;   // { products, open, test } từ máy chủ
async function loadShop() {
  if (!shop) try { shop = await api('/api/shop'); } catch { shop = { products: [], open: false }; }
  return shop;
}
const productOf = (skinId) => shop?.products.find((p) => p.skin === skinId);

function renderSkins() {
  const plans = (shop?.open ? shop.products.filter((p) => p.days) : []);
  $('member-box').innerHTML = isMember()
    ? `<b>👑 Bạn là Hội viên</b><small>Đến ${new Date(S.memberUntil).toLocaleDateString('vi-VN')} · dùng mọi loại mõ, có huy hiệu trên BXH</small>`
    : plans.length
      ? `<b>👑 Hội viên</b><small>Mở tất cả mõ + huy hiệu trên bảng xếp hạng</small>
         <div class="plan-row">${plans.map((p) => `<button class="btn-mini" data-buy="${p.id}">${p.name.replace('Hội viên ', '')} · ${money(p.price)}</button>`).join('')}</div>`
      : '';
  $('member-box').hidden = !$('member-box').innerHTML;
  $('skin-grid').innerHTML = SKINS.map((s) => {
    const locked = !hasSkin(s), p = locked && shop?.open ? productOf(s.id) : null;
    const note = !locked ? (s.id === S.skin ? 'Đang dùng' : 'Chạm để dùng')
      : p ? `<span class="price">${money(p.price)}</span>`
      : s.realm > 8 ? 'Chỉ có ở cửa hàng' : 'Mở ở ' + REALMS[s.realm].name;
    return `<button class="skin ${s.id === S.skin ? 'on' : ''} ${locked && !p ? 'locked' : ''} ${p ? 'forsale' : ''}" data-skin="${s.id}">
      ${locked ? '<span class="lock">🔒</span>' : ''}
      <svg viewBox="0 0 60 44"><ellipse cx="30" cy="22" rx="27" ry="19" fill="${s.c[1]}" stroke="${s.c[3]}" stroke-width="2"/>
        <ellipse cx="22" cy="15" rx="9" ry="5" fill="${s.c[0]}" opacity=".7"/>
        <path d="M14 29q16 9 32 0q-16 4 -32 0Z" fill="${s.c[5]}"/></svg>
      ${s.name}<small>${note}</small></button>`;
  }).join('');
}

/* ===== Thanh toán: chuyển khoản VietQR, máy chủ nhận xác nhận từ SePay ===== */
let payTimer = null, payOrder = null;
function closePay() { clearInterval(payTimer); payTimer = null; payOrder = null; }
async function buy(productId) {
  if (!S.uid) await sync(true);
  if (!S.uid) return toast('Cần kết nối mạng để mua');
  let o;
  try { o = await api('/api/orders', { uid: S.uid, code: S.code, product: productId }); }
  catch (e) { return toast(e.message === 'Failed to fetch' ? 'Không kết nối được máy chủ' : e.message); }
  payOrder = o;
  $('pay-name').textContent = o.name;
  $('pay-amount').textContent = money(o.amount);
  $('pay-qr').src = o.qr;
  $('pay-bank').textContent = o.bank;
  $('pay-acc').textContent = o.account;
  $('pay-holder').textContent = o.holder || '—';
  $('pay-code').textContent = o.code;
  $('pay-test').hidden = !o.test;
  $('pay-status').className = 'pay-status';
  $('pay-status').textContent = 'Đang chờ chuyển khoản…';
  $('modal-skin').hidden = true;
  openModal('modal-pay');
  clearInterval(payTimer);
  payTimer = setInterval(() => checkPay(), 3000);
  tickPay();
}
function tickPay() {
  if (!payOrder) return;
  const left = Math.max(0, payOrder.expiresAt - Date.now());
  $('pay-timer').textContent = left
    ? `Mã có hiệu lực ${Math.floor(left / 60e3)}:${String(Math.floor(left / 1e3) % 60).padStart(2, '0')}`
    : 'Đã quá 15 phút — nếu bạn đã chuyển khoản, hệ thống vẫn ghi nhận.';
}
async function checkPay() {
  if (!payOrder) return;
  tickPay();
  if ($('modal-pay').hidden) return closePay();
  try {
    const r = await api('/api/orders/status', { uid: S.uid, code: S.code, order: payOrder.code });
    if (r.status === 'underpaid') {
      $('pay-status').className = 'pay-status warn';
      $('pay-status').textContent = `Đã nhận ${money(r.paidAmount)}, chưa đủ ${money(payOrder.amount)}. Vui lòng liên hệ admin.`;
    }
    if (r.status !== 'paid') return;
    const name = payOrder.name;
    closePay();
    S.owned = r.user.owned; S.memberUntil = r.user.memberUntil;
    const sk = PRODUCT_SKIN(r.user.owned);
    if (sk) S.skin = sk;
    save(); applySkin(); renderSkins(); render();
    $('pay-status').className = 'pay-status ok';
    $('pay-status').textContent = `✅ Đã nhận thanh toán — ${name} đã được mở khoá!`;
    bell();
    setTimeout(() => { $('modal-pay').hidden = true; }, 2200);
  } catch {}
}
let lastOwned = [];
// Mõ vừa mua (mới xuất hiện trong danh sách) thì chuyển sang dùng luôn
const PRODUCT_SKIN = (owned) => { const n = owned.find((id) => !lastOwned.includes(id)); lastOwned = [...owned]; return n; };

/* ===== Gõ mõ ===== */
const recent = [];          // timestamps để chống auto-click
const MAX_TPS = 15;
let lastTap = 0;

function tap(x, y) {
  const now = performance.now();
  while (recent.length && now - recent[0] > 1000) recent.shift();
  if (recent.length >= MAX_TPS) { if (recent.length === MAX_TPS) toast('🙏 Chậm lại một chút, gõ bằng tâm'); recent.push(now); return; }
  recent.push(now);

  rollDay(); touchStreak();
  const gain = REALMS[S.realm].mult;
  S.merit += gain; S.taps++; S.todayTaps++; S.pending++;
  if (now - lastTap < 5000) S.seconds += Math.min(5, (now - lastTap) / 1000);
  lastTap = now;

  knock();
  if (navigator.vibrate && navigator.userActivation?.hasBeenActive) navigator.vibrate(12);
  animateStrike(x, y, gain);
  checkRealm();
  render();
}

function animateStrike(x, y, gain) {
  const mo = $('mo'), dui = $('dui'), layer = $('float-layer');
  mo.classList.remove('struck'); dui.classList.remove('strike');
  void mo.offsetWidth;
  mo.classList.add('struck'); dui.classList.add('strike');
  setTimeout(() => { mo.classList.remove('struck'); dui.classList.remove('strike'); }, 110);

  if (!x) {
    const m = mo.getBoundingClientRect();
    x = m.left + m.width / 2 + (Math.random() * 80 - 40); y = m.top + m.height * 0.35;
  }
  const f = document.createElement('div');
  f.className = 'float'; f.textContent = '+' + fmt(gain);
  f.style.left = x - 16 + 'px';
  f.style.top = y - 30 + 'px';
  layer.append(f);
  setTimeout(() => f.remove(), 900);

  const big = $('s-merit'); big.classList.remove('bump'); void big.offsetWidth; big.classList.add('bump');
}

function checkRealm() {
  let up = false;
  while (S.realm < REALMS.length - 1 && S.merit >= REALMS[S.realm + 1].cost) { S.realm++; up = true; }
  if (up) {
    bell();
    const unlocked = SKINS.filter((s) => s.realm === S.realm).map((s) => s.name);
    toast(`✨ Đột phá ${REALMS[S.realm].name} — x${REALMS[S.realm].mult} mỗi nhịp` + (unlocked.length ? ` · Mở khoá ${unlocked.join(', ')}` : ''));
  }
}

/* ===== Render ===== */
let saveTimer;
function render() {
  const r = REALMS[S.realm], next = REALMS[S.realm + 1];
  $('s-merit').textContent = fmt(S.merit);
  $('s-mult').textContent = `x${r.mult} mỗi nhịp`;
  $('s-realm').textContent = r.name;
  if (next) {
    const pct = Math.min(100, ((S.merit - r.cost) / (next.cost - r.cost)) * 100);
    $('s-bar').style.setProperty('--p', pct);
    $('s-next').textContent = `Còn ${fmt(next.cost - S.merit)} công đức để lên ${next.name}`;
  } else {
    $('s-bar').style.setProperty('--p', 100);
    $('s-next').textContent = 'Đã đạt cảnh giới tối thượng';
  }
  $('s-taps').textContent = fmt(S.taps);
  $('s-today').textContent = fmt(S.todayTaps);
  $('s-time').textContent = fmtTime(Math.floor(S.seconds));

  const days = Math.max(1, S.streak);
  const tier = [...STREAK_TIERS].reverse().find((t) => days >= t.days);
  const nextTier = STREAK_TIERS.find((t) => t.days > days);
  $('st-days').textContent = `${days} ngày tinh tấn · ${tier.name}`;
  $('st-count').textContent = days;
  $('st-next').textContent = nextTier ? `Còn ${nextTier.days - days} ngày → ${nextTier.name}` : 'Đã đạt bậc cao nhất';
  $('btn-sound').querySelector('i').textContent = S.sound ? '🔊' : '🔇';
  $('btn-music').setAttribute('aria-pressed', S.music);
  $('pf-name').textContent = (S.name || 'Chưa đặt pháp danh') + (S.province ? ` · ${S.province}` : '');

  clearTimeout(saveTimer); saveTimer = setTimeout(save, 400);
}

/* ===== Lịch âm (thuật toán Hồ Ngọc Đức, múi giờ +7) ===== */
const Lunar = (() => {
  const PI = Math.PI, INT = Math.floor;
  function jd(d, m, y) {
    const a = INT((14 - m) / 12), yy = y + 4800 - a, mm = m + 12 * a - 3;
    return d + INT((153 * mm + 2) / 5) + 365 * yy + INT(yy / 4) - INT(yy / 100) + INT(yy / 400) - 32045;
  }
  function newMoon(k) {
    const T = k / 1236.85, T2 = T * T, T3 = T2 * T, dr = PI / 180;
    let J = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3;
    J += 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr);
    const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3;
    const Mp = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3;
    const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3;
    let C = (0.1734 - 0.000393 * T) * Math.sin(M * dr) + 0.0021 * Math.sin(2 * dr * M);
    C -= 0.4068 * Math.sin(Mp * dr) - 0.0161 * Math.sin(dr * 2 * Mp);
    C -= 0.0004 * Math.sin(dr * 3 * Mp);
    C += 0.0104 * Math.sin(dr * 2 * F) - 0.0051 * Math.sin(dr * (M + Mp));
    C -= 0.0074 * Math.sin(dr * (M - Mp)) + 0.0004 * Math.sin(dr * (2 * F + M));
    C -= 0.0004 * Math.sin(dr * (2 * F - M)) - 0.0006 * Math.sin(dr * (2 * F + Mp));
    C += 0.0010 * Math.sin(dr * (2 * F - Mp)) + 0.0005 * Math.sin(dr * (2 * Mp + M));
    const dt = T < -11 ? 0.001 + 0.000839 * T + 0.0002261 * T2 - 0.00000845 * T3 - 0.000000081 * T * T3
                       : -0.000278 + 0.000265 * T + 0.000262 * T2;
    return J + C - dt;
  }
  const nmDay = (k) => INT(newMoon(k) + 0.5 + 7 / 24);
  function sunLong(dn) {
    const T = (dn - 0.5 - 7 / 24 - 2451545.0) / 36525, T2 = T * T, dr = PI / 180;
    const M = 357.52910 + 35999.05030 * T - 0.0001559 * T2 - 0.00000048 * T * T2;
    const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2;
    let DL = (1.914600 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M);
    DL += (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M) + 0.000290 * Math.sin(dr * 3 * M);
    let L = (L0 + DL) * dr; L -= PI * 2 * INT(L / (PI * 2));
    return INT(L / PI * 6);
  }
  function month11(y) {
    const k = INT((jd(31, 12, y) - 2415021) / 29.530588853);
    let nm = nmDay(k);
    if (sunLong(nm) >= 9) nm = nmDay(k - 1);
    return nm;
  }
  function leapOffset(a11) {
    const k = INT((a11 - 2415021.076998695) / 29.530588853 + 0.5);
    let last, i = 1, arc = sunLong(nmDay(k + i));
    do { last = arc; i++; arc = sunLong(nmDay(k + i)); } while (arc !== last && i < 14);
    return i - 1;
  }
  function fromSolar(d, m, y) {
    const dn = jd(d, m, y), k = INT((dn - 2415021.076998695) / 29.530588853);
    let start = nmDay(k + 1);
    if (start > dn) start = nmDay(k);
    let a11 = month11(y), b11 = a11, ly;
    if (a11 >= start) { ly = y; a11 = month11(y - 1); } else { ly = y + 1; b11 = month11(y + 1); }
    const diff = INT((start - a11) / 29);
    let leap = false, lm = diff + 11;
    if (b11 - a11 > 365) {
      const lo = leapOffset(a11);
      if (diff >= lo) { lm = diff + 10; leap = diff === lo; }
    }
    if (lm > 12) lm -= 12;
    if (lm >= 11 && diff < 4) ly -= 1;
    return { d: dn - start + 1, m: lm, y: ly, leap, jd: dn };
  }
  return { fromSolar };
})();

const CAN = ['Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ', 'Canh', 'Tân', 'Nhâm', 'Quý'];
const CHI = ['Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi', 'Thân', 'Dậu', 'Tuất', 'Hợi'];
const GODS = [['Thanh Long', 1], ['Minh Đường', 1], ['Thiên Hình', 0], ['Chu Tước', 0], ['Kim Quỹ', 1], ['Bảo Quang', 1],
              ['Bạch Hổ', 0], ['Ngọc Đường', 1], ['Thiên Lao', 0], ['Huyền Vũ', 0], ['Tư Mệnh', 1], ['Câu Trần', 0]];
const WEEKDAYS = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

function lunarInfo(date = new Date()) {
  const L = Lunar.fromSolar(date.getDate(), date.getMonth() + 1, date.getFullYear());
  const dayChi = (L.jd + 1) % 12;
  const god = GODS[(dayChi - ((L.m - 1) % 6) * 2 + 24) % 12];
  // Giờ hoàng đạo: 6 giờ tốt, bắt đầu theo chi ngày
  const hourStart = ((dayChi % 6) * 2 + 8) % 12;
  const goodHours = GODS.map((g, i) => g[1] ? CHI[(hourStart + i) % 12] : null).filter(Boolean);
  return {
    ...L,
    dayName: `${CAN[(L.jd + 9) % 10]} ${CHI[dayChi]}`,
    monthName: `${CAN[(L.y * 12 + L.m + 3) % 10]} ${CHI[(L.m + 1) % 12]}`,
    yearName: `${CAN[(L.y + 6) % 10]} ${CHI[(L.y + 8) % 12]}`,
    god: god[0], good: !!god[1], goodHours,
  };
}
const lunarDayText = (L) => (L.d <= 10 ? `Mùng ${L.d}` : `Ngày ${L.d}`) + ` tháng ${L.m}${L.leap ? ' nhuận' : ''}`;

function renderLich() {
  const now = new Date(), L = lunarInfo(now);
  $('chip-date').textContent = `${L.d}/${L.m} Âm`;
  $('cal-solar').textContent = `${WEEKDAYS[now.getDay()]}, ${now.toLocaleDateString('vi-VN')}`;
  $('cal-day').textContent = L.d;
  $('lich-am').textContent = `Tháng ${L.m}${L.leap ? ' nhuận' : ''} năm ${L.yearName}`;
  $('lich-sub').innerHTML = `Ngày ${L.dayName} · <span class="${L.good ? 'good' : 'bad'}">${L.good ? 'Hoàng đạo — ngày tốt' : 'Hắc đạo — nên cẩn trọng'}</span>`;
  $('lich-body').innerHTML = `<dl class="rows">
    <dt>Ngày</dt><dd>${L.dayName}</dd>
    <dt>Tháng</dt><dd>${L.monthName}</dd>
    <dt>Năm</dt><dd>${L.yearName}</dd>
    <dt>Trực thần</dt><dd>${L.god}</dd></dl>
    <div class="hours"><small>Giờ hoàng đạo</small>${L.goodHours.map((h) => `<span>${h}</span>`).join('')}</div>`;
}

/* ===== Modals ===== */
function openModal(id) { $(id).hidden = false; }
function closeModal(el) { el.closest('.modal').hidden = true; }

function showQuote() {
  const now = new Date(), L = lunarInfo(now);
  const idx = Math.floor(now.getTime() / 864e5) % QUOTES.length;
  const [text, src] = QUOTES[idx];
  $('q-date').textContent = `${WEEKDAYS[now.getDay()]}, ${now.toLocaleDateString('vi-VN')} · ${lunarDayText(L)} Âm lịch`;
  $('q-streak').textContent = `🔥 Chuỗi ${Math.max(1, S.streak)} ngày tinh tấn`;
  $('q-text').innerHTML = text.replace(/\n/g, '<br>');
  $('q-src').textContent = '— ' + src;
  openModal('modal-quote');
  S.quoteSeen = today(); save();
}

function renderFortune() {
  if (S.fortune?.day !== today()) return;
  const [tag, name, msg] = FORTUNES[S.fortune.idx];
  $('f-body').innerHTML = `<span class="que-tag">QUẺ ${tag.toUpperCase()}</span>
    <div class="que-name">${name}</div><p class="muted">${msg}</p>
    <p class="note">Mỗi ngày chỉ rút một quẻ. Quẻ chỉ để tham khảo — mọi việc do tâm.</p>`;
}
function drawFortune() {
  const ong = $('ong-que');
  ong.classList.add('shake');
  bell();
  setTimeout(() => {
    S.fortune = { day: today(), idx: Math.floor(Math.random() * FORTUNES.length) };
    save(); renderFortune();
  }, 1000);
}

function renderRealms() {
  $('realm-list').innerHTML = REALMS.map((r, i) =>
    `<li class="${i < S.realm ? 'done' : i === S.realm ? 'cur' : ''}">${r.name}
     <span>${i === 0 ? 'Khởi đầu' : fmt(r.cost)} · x${r.mult}</span></li>`).join('');
}

/* ===== Khoe công đức (canvas → PNG) ===== */
async function share() {
  const c = document.createElement('canvas'); c.width = 1080; c.height = 1080;
  const g = c.getContext('2d');
  const bg = g.createRadialGradient(540, 380, 50, 540, 540, 760);
  bg.addColorStop(0, '#fff3d6'); bg.addColorStop(1, '#ffd99a');
  g.fillStyle = bg; g.fillRect(0, 0, 1080, 1080);
  g.strokeStyle = '#e8b33a'; g.lineWidth = 6; g.strokeRect(50, 50, 980, 980);
  g.textAlign = 'center';
  g.fillStyle = '#8a6446'; g.font = '32px Inter'; g.fillText('C Ô N G   Đ Ứ C', 540, 300);
  g.fillStyle = '#d9620f'; g.font = '700 150px "Noto Serif"'; g.fillText(fmt(S.merit), 540, 470);
  g.fillStyle = '#9a2232'; g.font = 'italic 600 80px "Noto Serif"'; g.fillText(REALMS[S.realm].name, 540, 620);
  g.fillStyle = '#8a6446'; g.font = '34px Inter';
  g.fillText(`${fmt(S.taps)} lần gõ · ${Math.max(1, S.streak)} ngày tinh tấn`, 540, 710);
  g.fillStyle = '#ee6a9a'; g.font = 'italic 44px "Noto Serif"'; g.fillText('Mỗi nhịp gõ, một niệm an.', 540, 880);
  const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
  const file = new File([blob], 'cong-duc.png', { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], text: 'Công đức của tôi hôm nay 🙏' }); return; } catch { return; }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name; a.click();
  toast('📤 Đã lưu ảnh công đức');
}

/* ===== Máy chủ: đồng bộ, bảng xếp hạng, trực tiếp ===== */
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

async function api(url, body) {
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 8000);
  try {
    const res = await fetch(url, body
      ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctl.signal }
      : { signal: ctl.signal });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Lỗi máy chủ');
    return data;
  } finally { clearTimeout(timer); }
}

// Máy chủ là nguồn chuẩn cho công đức; giữ thêm phần đã gõ trong lúc chờ phản hồi
function adopt(user, meritAtSend) {
  S.merit = user.merit + (S.merit - meritAtSend);
  S.realm = 0;
  while (S.realm < REALMS.length - 1 && S.merit >= REALMS[S.realm + 1].cost) S.realm++;
  S.name = user.name; S.province = user.province;
  if (user.owned) { S.owned = user.owned; S.memberUntil = user.memberUntil; lastOwned = [...user.owned]; }
  render();
}

let syncing = false, lastSync = 0;
async function sync(force) {
  if (syncing || !navigator.onLine) return;
  if (!force && !S.pending && Date.now() - lastSync < 25e3) return;   // 25s gửi 1 nhịp tim để tính "đang online"
  syncing = true;
  const sent = S.pending, meritAtSend = S.merit;
  try {
    let r;
    if (!S.uid) {
      r = await api('/api/id', { name: S.name, province: S.province, taps: S.taps, todayTaps: S.todayTaps });
      S.uid = r.uid; S.code = r.code;
    } else {
      r = await api('/api/sync', { uid: S.uid, code: S.code, pending: sent });
      if (r.capped) toast('🙏 Một phần nhịp gõ quá nhanh không được ghi nhận');
    }
    S.pending -= sent;
    adopt(r.user, meritAtSend);
    lastSync = Date.now(); save();
  } catch (e) {
    if (/mã đồng bộ/.test(e.message)) { S.uid = S.code = null; save(); }   // tài khoản không còn: tạo lại ở lần sau
  } finally { syncing = false; }
}

async function loadLive() {
  try {
    const r = await api('/api/live-stats');
    $('live-online').textContent = fmt(Math.max(1, r.online));
    $('live-taps').textContent = fmt(r.todayTaps);
    const items = r.events.map((e) => `<span>${esc(e.text)}</span>`).join('');
    $('live-events').innerHTML = items + items;   // nhân đôi để chữ chạy vòng liền mạch
    $('live-events').style.setProperty('--dur', Math.max(15, r.events.length * 5) + 's');
    $('live').hidden = false;
  } catch { $('live').hidden = true; }
}

let lbTab = 'today';
const medal = (i) => ['🥇', '🥈', '🥉'][i] || i + 1;
const emptyRow = (msg) => `<li class="muted">${msg}</li>`;
function renderMe(me, unit) {
  $('lb-me').innerHTML = `<span class="rk">${me ? '#' + me.rank : '—'}</span>
    <div><b>${esc(lbTab === 'province' ? S.province || 'Tỉnh của bạn' : S.name || 'Bạn')}</b>
    <small>${me ? fmt(me.score) + ' ' + unit + ' · ' : ''}${S.province ? 'Chạm để sửa hồ sơ' : 'Chạm để chọn tỉnh thành'}</small></div><i>✎</i>`;
}
async function loadLB() {
  const list = $('lb-list');
  try {
    if (lbTab === 'province') {
      const { top } = await api('/api/leaderboard/province');
      const mine = top.findIndex((p) => p.province === S.province);
      renderMe(mine >= 0 ? { rank: mine + 1, score: top[mine].merit } : null, 'công đức');
      list.innerHTML = top.map((p, i) => `<li class="top${i + 1} ${i === mine ? 'me' : ''}"><span class="rk">${medal(i)}</span>
        <div class="who"><b>${esc(p.province)}</b><small>${p.members} đạo hữu · hôm nay ${fmt(p.today)} nhịp</small></div>
        <div class="sc">${fmt(p.merit)}<small>công đức</small></div></li>`).join('') || emptyRow('Chưa có tỉnh nào — chọn tỉnh của bạn để mở màn!');
    } else {
      const r = await api(`/api/leaderboard?tab=${lbTab}&uid=${encodeURIComponent(S.uid || '')}`);
      const unit = lbTab === 'today' ? 'nhịp' : 'công đức';
      renderMe(r.me, unit);
      list.innerHTML = r.top.map((u, i) => `<li class="top${i + 1} ${u.me ? 'me' : ''}"><span class="rk">${medal(i)}</span>
        <div class="who"><b>${u.member ? '<span title="Hội viên">👑</span> ' : ''}${esc(u.name)}</b><small>${esc(u.province || 'Chưa chọn tỉnh')} · ${REALMS[u.realm].name}</small></div>
        <div class="sc">${fmt(u.score)}<small>${unit}</small></div></li>`).join('') || emptyRow('Chưa có ai — hãy là người gõ đầu tiên!');
    }
  } catch {
    renderMe(null, '');
    list.innerHTML = emptyRow('Không kết nối được máy chủ. Thử lại sau.');
  }
}

let provincesLoaded = false;
async function openProfile() {
  $('pf-input').value = S.name;
  $('pf-code').textContent = S.code || 'Chưa có — cần kết nối mạng';
  if (!provincesLoaded) {
    try {
      const { provinces } = await api('/api/provinces');
      $('pf-province').insertAdjacentHTML('beforeend', provinces.map((p) => `<option>${esc(p)}</option>`).join(''));
      provincesLoaded = true;
    } catch {}
  }
  $('pf-province').value = S.province;
}

/* ===== Sự kiện ===== */
$('mo').addEventListener('pointerdown', (e) => { e.preventDefault(); tap(e.clientX, e.clientY); });
document.addEventListener('keydown', (e) => {
  if (document.body.dataset.view === 'home' && (e.code === 'Space' || e.code === 'Enter') && !e.repeat
      && !e.target.closest('input,button:not(#mo)') && !document.querySelector('.modal:not([hidden])')) {
    e.preventDefault(); tap();
  }
  if (e.key === 'Escape') document.querySelectorAll('.modal:not([hidden])').forEach((m) => (m.hidden = true));
});
$('btn-bell').addEventListener('click', (e) => {
  const btn = e.currentTarget;   // currentTarget sẽ là null khi setTimeout chạy
  bell(); btn.disabled = true;
  setTimeout(() => (btn.disabled = false), 4000);
});
$('btn-sound').addEventListener('click', () => { S.sound = !S.sound; render(); toast(S.sound ? '🔊 Đã bật âm thanh' : '🔇 Đã tắt âm thanh'); });
function go(view) {
  document.body.dataset.view = view;
  document.querySelectorAll('.view').forEach((v) => (v.hidden = v.id !== 'view-' + view));
  document.querySelectorAll('.tabbar [data-go]').forEach((b) => b.classList.toggle('active', b.dataset.go === view));
  if (view === 'tu') renderRealms();
  if (view === 'que') renderFortune();
  if (view === 'bxh') sync(true).then(loadLB);
  scrollTo({ top: 0 });
}
document.querySelectorAll('[data-lb]').forEach((b) => b.addEventListener('click', () => {
  lbTab = b.dataset.lb;
  document.querySelectorAll('[data-lb]').forEach((x) => x.classList.toggle('on', x === b));
  loadLB();
}));
$('btn-profile').addEventListener('click', async (e) => {
  const name = $('pf-input').value.trim(), province = $('pf-province').value;
  if (name) S.name = name;
  S.province = province; save(); render();
  closeModal(e.target);
  try {
    if (!S.uid) await sync(true);
    else {
      const r = await api('/api/profile', { uid: S.uid, code: S.code, name, province });
      S.name = r.user.name; S.province = r.user.province; save(); render();
    }
    toast('✅ Đã lưu hồ sơ');
  } catch { toast('Đã lưu trên máy, chưa gửi được lên máy chủ'); }
  if (document.body.dataset.view === 'bxh') loadLB();
});
$('btn-copy').addEventListener('click', () => {
  if (!S.code) return;
  navigator.clipboard?.writeText(S.code).then(() => toast('📋 Đã sao chép mã khôi phục'), () => toast(S.code));
});
$('btn-restore').addEventListener('click', async (e) => {
  const code = $('rs-input').value.trim().toUpperCase();
  if (code.length !== 8) return toast('Mã khôi phục gồm 8 ký tự');
  try {
    const { uid, user } = await api('/api/restore', { code });
    Object.assign(S, { uid, code, merit: user.merit, taps: user.taps, realm: user.realm, todayTaps: user.todayTaps,
      name: user.name, province: user.province, pending: 0, owned: user.owned || [], memberUntil: user.memberUntil || 0 });
    applySkin();
    save(); render(); closeModal(e.target); $('rs-input').value = '';
    toast('🪷 Đã khôi phục tiến trình');
  } catch (err) { toast(err.message === 'Failed to fetch' ? 'Không kết nối được máy chủ' : err.message); }
});
setInterval(sync, 10e3);
setInterval(() => { if (document.body.dataset.view === 'home' && !document.hidden) loadLive(); }, 20e3);
document.addEventListener('visibilitychange', () => {
  // Rời trang: gửi nốt phần chưa đồng bộ
  if (document.hidden && S.uid && S.pending && !syncing
      && navigator.sendBeacon('/api/sync', JSON.stringify({ uid: S.uid, code: S.code, pending: S.pending }))) {
    S.pending = 0; save();
  }
});
document.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => go(b.dataset.go)));
document.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => {
  const id = b.dataset.open;
  if (id === 'modal-quote') return showQuote();
  if (id === 'modal-skin') { renderSkins(); loadShop().then(renderSkins); }
  if (id === 'modal-profile') openProfile();
  openModal(id);
}));
$('skin-grid').addEventListener('click', (e) => {
  const b = e.target.closest('[data-skin]');
  if (!b) return;
  const s = SKINS.find((k) => k.id === b.dataset.skin);
  if (!hasSkin(s)) {
    const p = shop?.open && productOf(s.id);
    if (p) return buy(p.id);
    return toast(s.realm > 8 ? '🔒 Cửa hàng đang tạm đóng' : `🔒 Đạt cảnh giới ${REALMS[s.realm].name} để mở ${s.name}`);
  }
  S.skin = s.id; applySkin(); renderSkins(); render(); knock();
});
$('member-box').addEventListener('click', (e) => { const b = e.target.closest('[data-buy]'); if (b) buy(b.dataset.buy); });
document.querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', () => {
  const text = $(b.dataset.copy).textContent;
  navigator.clipboard?.writeText(text).then(() => toast('📋 Đã sao chép ' + text), () => toast(text));
}));
$('pay-test').addEventListener('click', async () => {
  try { await api('/api/dev/pay', { uid: S.uid, code: S.code, order: payOrder.code }); checkPay(); } catch (e) { toast(e.message); }
});
$('btn-music').addEventListener('click', () => {
  S.music = !S.music;
  S.music ? startMusic() : stopMusic();
  render(); toast(S.music ? '🎶 Nhạc thiền & tiếng suối' : 'Đã tắt nhạc thiền');
});
// Trình duyệt chỉ cho phát âm thanh sau lần chạm đầu tiên
document.addEventListener('pointerdown', () => { if (S.music) startMusic(); }, { once: true });
document.addEventListener('click', (e) => {
  if (e.target.matches('[data-close]') || e.target.classList.contains('modal')) closeModal(e.target);
  if (e.target.id === 'btn-draw') drawFortune();
});
$('btn-share').addEventListener('click', share);
$('btn-hh').addEventListener('click', (e) => {
  const name = $('hh-name').value.trim();
  bell(); closeModal(e.target);
  toast(`🪷 Đã hồi hướng công đức${name ? ' cho ' + name : ''}`);
  $('hh-name').value = '';
});

/* ===== Khởi động ===== */
rollDay(); touchStreak(); renderLich(); applySkin(); render(); save();
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
if (location.protocol !== 'file:') sync(true).then(loadLive);
setTimeout(() => {
  $('splash')?.classList.add('hide');
  setTimeout(() => $('splash')?.remove(), 900);
  if (S.quoteSeen !== today()) setTimeout(showQuote, 500);
}, 1800);
