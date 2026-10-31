// Vercel Function: mọi /api/* được vercel.json chuyển về đây. Dữ liệu lưu ở Upstash Redis.
'use strict';
const { Redis } = require('@upstash/redis');
const { createApi } = require('./_lib/api.js');

// Upstash qua Vercel Marketplace có thể đặt tên biến theo kiểu KV_* hoặc UPSTASH_REDIS_*
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN,
});
const api = createApi(redis);

function readBody(req) {
  try {
    const b = req.body;                         // Vercel tự đọc JSON; sendBeacon gửi text/plain nên còn là chuỗi
    if (typeof b === 'string') return JSON.parse(b || '{}');
    if (Buffer.isBuffer(b)) return JSON.parse(b.toString('utf8') || '{}');
    return b || {};
  } catch { return null; }
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  const url = new URL(req.url, 'http://x');
  // vercel.json gửi kèm đường dẫn gốc trong ?__path= phòng khi req.url đã bị đổi thành /api/index
  if (url.pathname === '/api/index' && url.searchParams.has('__path')) url.pathname = '/api/' + url.searchParams.get('__path');
  url.searchParams.delete('__path');
  const body = req.method === 'GET' ? {} : readBody(req);
  if (body === null) { res.statusCode = 400; return res.end(JSON.stringify({ error: 'JSON không hợp lệ' })); }
  try {
    const { status, data } = await api.handle(req.method, url.pathname, url.searchParams, body, req.headers);
    res.statusCode = status;
    res.end(JSON.stringify(data));
  } catch (e) {
    console.error('[api]', req.method, url.pathname, e);
    res.statusCode = 500;
    res.end(JSON.stringify({ error: 'Lỗi máy chủ' }));
  }
};
