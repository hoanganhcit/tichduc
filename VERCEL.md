# Đưa Tích Đức lên Vercel

Trên Vercel: giao diện là file tĩnh, API chạy bằng Vercel Function (`api/index.js`), dữ liệu lưu ở **Upstash Redis**.

| Tính năng | Vercel | VPS (`DEPLOY.md`) |
|---|---|---|
| Gõ mõ, lịch âm, quẻ, cài như app | ✅ | ✅ |
| Đồng bộ, mã khôi phục, BXH cá nhân & tỉnh, thanh trực tiếp | ✅ (Redis) | ✅ (file JSON) |
| Cửa hàng SePay | ✅ | ✅ |
| Chính điện 3D | ✅ một mình | ✅ nhiều người |

Thư mục `tichduc/` là gốc dự án. `server/`, `scripts/` và các file `.md` không được đưa lên (xem `.vercelignore`).

## 1. Đưa mã lên GitHub

Trong thư mục `E:\Projects\ClaudeAI\tichduc`:

```bash
git init && git add . && git commit -m "Tích Đức"
```

Tạo repo trống trên GitHub rồi:

```bash
git branch -M main && git remote add origin https://github.com/<tài-khoản>/tichduc.git && git push -u origin main
```

`server/data.json` (dữ liệu thử trên máy) đã nằm trong `.gitignore`, sẽ không bị đẩy lên.

## 2. Tạo dự án trên Vercel

1. [vercel.com/new](https://vercel.com/new) → **Import** repo vừa đẩy.
2. **Framework Preset:** `Other`. Không cần Build Command, để trống Output Directory.
3. Bấm **Deploy** (lần đầu API sẽ lỗi vì chưa có Redis — làm tiếp bước 3).

## 3. Kết nối Upstash Redis

1. Trong dự án Vercel → **Storage** → **Create** → chọn **Upstash** (Redis) trong Marketplace → chọn vùng **Singapore** cho gần Việt Nam.
2. **Connect** vào dự án. Vercel tự thêm biến môi trường (`KV_REST_API_URL`/`KV_REST_API_TOKEN` hoặc `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` — mã nhận được cả hai kiểu).
3. **Deployments** → **Redeploy**.

Kiểm tra: mở `https://<dự-án>.vercel.app/api/live-stats` thấy `{"online":0,...}` là xong.

## 4. Thanh toán SePay

**Settings → Environment Variables**, môi trường **Production**:

| Biến | Giá trị |
|---|---|
| `SEPAY_API_KEY` | chuỗi ngẫu nhiên dài, trùng với API Key khai trong webhook SePay |
| `BANK_NAME` | tên ngân hàng theo SePay, VD `MBBank` |
| `BANK_ACCOUNT` | số tài khoản nhận tiền |
| `ACCOUNT_NAME` | tên chủ tài khoản |

Trong SePay tạo webhook: URL `https://<tên-miền>/api/sepay/webhook`, chỉ **tiền vào**, xác thực **API Key**. Redeploy sau khi thêm biến.

> **Không** đặt `PAYMENT_TEST=1` ở Production — biến này bật nút "giả lập đã chuyển khoản" cho mọi người. Có thể đặt riêng cho môi trường **Preview** để thử.

## 5. Tên miền

**Settings → Domains** → thêm `tichduc.io.vn`, làm theo bản ghi DNS Vercel hướng dẫn. HTTPS tự có.

## 6. Cập nhật phiên bản

Tăng `VERSION` trong `sw.js`, rồi:

```bash
git add . && git commit -m "Cập nhật" && git push
```

Vercel tự deploy lại.

## 7. Chi phí & giới hạn — đọc trước khi mở bán

- **Vercel Hobby (miễn phí) chỉ cho dự án phi thương mại.** Có cửa hàng thu tiền thì cần gói **Pro** (~20 USD/tháng).
- **Upstash miễn phí ~500.000 lệnh/tháng.** Mỗi lần đồng bộ (10–25 giây/lần khi đang gõ) tốn khoảng 10 lệnh, tức ~3.600 lệnh cho một người gõ liên tục một giờ — gói miễn phí đủ cho khoảng 140 giờ-người mỗi tháng. Đông hơn thì chuyển gói trả theo dùng (khoảng 0,2 USD mỗi 100.000 lệnh).
- Dữ liệu trên Vercel (Redis) và trên VPS (`data.json`) là **hai nơi riêng**, không tự chuyển qua lại.
- Không có giới hạn tần suất theo IP như bản VPS; giới hạn nhịp gõ mỗi tài khoản vẫn còn. Có thể bật **Vercel Firewall** nếu bị spam.

## 8. Kiểm thử trên máy

```bash
npm run test:api
```

Chạy toàn bộ API Vercel với Redis giả lập trong bộ nhớ (không cần tài khoản Upstash).
