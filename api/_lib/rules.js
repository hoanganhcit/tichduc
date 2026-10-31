// Luật game, danh mục sản phẩm và tiện ích dùng chung cho máy chủ Node (server/) và API Vercel (api/).
// Luật cảnh giới phải khớp với game.js phía trình duyệt.
'use strict';
const crypto = require('node:crypto');

const REALMS = ['Sơ tâm', 'Định tâm', 'Tĩnh tâm', 'Tỉnh giác', 'Khai ngộ', 'An trú', 'Thiền duyệt', 'Chánh niệm', 'Giác tỉnh'];
const COSTS = [0, 100, 1000, 10000, 100000, 1e6, 1e7, 5e7, 2.5e8];
const MULTS = [1, 2, 4, 8, 16, 32, 64, 128, 256];
const MAX_TPS = 15;              // giống chống auto-click phía client
const IMPORT_CAP = 20000;        // số nhịp tối đa được mang từ máy lên khi tạo tài khoản
const PROVINCES = new Set([
  'Hà Nội', 'Huế', 'Hải Phòng', 'Đà Nẵng', 'TP Hồ Chí Minh', 'Cần Thơ',
  'Lai Châu', 'Điện Biên', 'Sơn La', 'Lạng Sơn', 'Quảng Ninh', 'Thanh Hóa', 'Nghệ An', 'Hà Tĩnh',
  'Cao Bằng', 'Tuyên Quang', 'Lào Cai', 'Thái Nguyên', 'Phú Thọ', 'Bắc Ninh', 'Hưng Yên', 'Ninh Bình',
  'Quảng Trị', 'Quảng Ngãi', 'Gia Lai', 'Khánh Hòa', 'Lâm Đồng', 'Đắk Lắk', 'Đồng Nai', 'Tây Ninh',
  'Vĩnh Long', 'Đồng Tháp', 'Cà Mau', 'An Giang',
]);

// Giá do máy chủ quyết định; client chỉ gửi mã sản phẩm. Không bán công đức — chỉ bán vật phẩm trang trí.
const PRODUCTS = {
  'skin-ngoc':    { name: 'Mõ Ngọc', price: 19000, skin: 'ngoc' },
  'skin-vang':    { name: 'Mõ Vàng', price: 29000, skin: 'vang' },
  'skin-sen':     { name: 'Mõ Sen', price: 29000, skin: 'sen' },
  'skin-kylan':   { name: 'Mõ Kỳ Lân', price: 39000, skin: 'kylan' },
  'skin-long':    { name: 'Mõ Long', price: 49000, skin: 'long' },
  'skin-thatbao': { name: 'Mõ Thất Bảo', price: 69000, skin: 'thatbao' },
  'skin-phat':    { name: 'Mõ Phật', price: 99000, skin: 'phat' },
  'member-30':    { name: 'Hội viên 1 tháng', price: 49000, days: 30 },
  'member-365':   { name: 'Hội viên 1 năm', price: 399000, days: 365 },
};
const ORDER_TTL = 15 * 60e3;
const ORDER_RE = /TD[A-HJ-NP-Z2-9]{6}/;      // mã đơn nằm trong nội dung chuyển khoản
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const today = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);   // giờ VN
const hash = (s) => crypto.createHash('sha256').update(s).digest('hex');
const randomCode = (n) => Array.from(crypto.randomBytes(n), (b) => ALPHABET[b % 32]).join('');
const newCode = () => randomCode(8);
const newOrderCode = () => 'TD' + randomCode(6);
const cleanName = (s) => String(s || '').replace(/[<>&"'`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 24);
const label = (u) => u.name + (u.province ? ` (${u.province})` : '');

// Cộng n nhịp: mỗi nhịp cộng hệ số cảnh giới hiện tại, đủ công đức thì lên cảnh giới.
// Sửa trực tiếp u (merit, taps, realm); trả về danh sách cảnh giới vừa đạt.
function stepTaps(u, n) {
  const reached = [];
  while (n > 0) {
    const m = MULTS[u.realm], next = COSTS[u.realm + 1];
    const k = next === undefined ? n : Math.min(n, Math.max(1, Math.ceil((next - u.merit) / m)));
    u.merit += k * m; u.taps += k; n -= k;
    while (u.realm < 8 && u.merit >= COSTS[u.realm + 1]) reached.push(++u.realm);
  }
  return reached;
}

function orderView(o, pay) {
  const acc = pay.account || '0000000000', bank = pay.bank || 'MBBank';
  return {
    code: o.code, product: o.product, name: PRODUCTS[o.product].name, amount: o.amount, status: o.status,
    expiresAt: o.created + ORDER_TTL, bank, account: acc, holder: pay.holder, test: pay.test,
    qr: `https://qr.sepay.vn/img?acc=${encodeURIComponent(acc)}&bank=${encodeURIComponent(bank)}&amount=${o.amount}&des=${o.code}`,
  };
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

// Cấu hình thanh toán từ biến môi trường. PAYMENT_TEST=1 bật nút giả lập — CHỈ dùng khi phát triển.
const payConfig = (env = process.env) => ({
  apiKey: env.SEPAY_API_KEY || '',
  bank: env.BANK_NAME || '',
  account: env.BANK_ACCOUNT || '',
  holder: env.ACCOUNT_NAME || '',
  test: env.PAYMENT_TEST === '1',
});

module.exports = {
  REALMS, COSTS, MULTS, MAX_TPS, IMPORT_CAP, PROVINCES, PRODUCTS, ORDER_TTL, ORDER_RE,
  today, hash, newCode, newOrderCode, cleanName, label, stepTaps, orderView, safeEqual, payConfig,
};
