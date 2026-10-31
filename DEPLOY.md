# Triển khai Tích Đức lên mạng

Mô hình: **1 VPS Ubuntu** chạy `node server/index.js` (giữ dữ liệu trong `server/data.json`), phía trước là **Caddy** để tự cấp HTTPS. HTTPS là bắt buộc vì service worker (cài như app, chạy offline) chỉ hoạt động trên HTTPS.

> Vì dữ liệu nằm trong một file, chỉ chạy **1 tiến trình** máy chủ. Không dùng các nền tảng không có ổ đĩa lưu trữ lâu dài (Vercel, Netlify, gói miễn phí của Render…) vì dữ liệu sẽ mất mỗi lần khởi động lại.

## 1. Chuẩn bị

| Hạng mục | Gợi ý | Chi phí tham khảo |
|---|---|---|
| Tên miền | `.io.vn` / `.vn` / `.com` — iNET, Mắt Bão, PA Vietnam, Tenten | `.io.vn` rẻ nhất |
| VPS | Ubuntu 24.04, 1 vCPU, 1 GB RAM — Viettel IDC, BizFly, VNPT (máy chủ VN) hoặc Vultr / DigitalOcean (Singapore) | ~100–150k/tháng |

Ở trang quản lý tên miền, tạo 2 bản ghi DNS trỏ về IP của VPS:

```
A   @     <IP_VPS>
A   www   <IP_VPS>
```

## 2. Cài đặt VPS (chạy trên VPS qua SSH)

```bash
ssh root@<IP_VPS>
```

```bash
apt update && apt upgrade -y
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw --force enable
```

Cài Node.js 22:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt install -y nodejs
```

Cài Caddy:

```bash
apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
apt update && apt install -y caddy
```

Tạo user riêng để chạy ứng dụng (không chạy bằng root):

```bash
useradd --system --create-home --shell /usr/sbin/nologin tichduc
mkdir -p /opt/tichduc && chown tichduc:tichduc /opt/tichduc
```

## 3. Tải mã lên (chạy trên máy Windows, trong `E:\Projects\ClaudeAI`)

```bash
scp -r tichduc/* root@<IP_VPS>:/opt/tichduc/
```

Trên VPS, xoá dữ liệu thử nghiệm (nếu có) và trả quyền cho user `tichduc`:

```bash
rm -f /opt/tichduc/server/data.json && chown -R tichduc:tichduc /opt/tichduc
```

## 4. Chạy nền bằng systemd

Tạo file `/etc/systemd/system/tichduc.service`:

```ini
[Unit]
Description=Tich Duc
After=network.target

[Service]
User=tichduc
WorkingDirectory=/opt/tichduc
ExecStart=/usr/bin/node server/index.js
Environment=PORT=3000
Environment=HOST=127.0.0.1
Environment=TRUST_PROXY=1
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload && systemctl enable --now tichduc && systemctl status tichduc
```

- `HOST=127.0.0.1`: chỉ Caddy truy cập được cổng 3000, người ngoài không gọi thẳng vào được.
- `TRUST_PROXY=1`: lấy IP thật của người dùng để giới hạn tần suất đúng. **Thiếu dòng này**, mọi người dùng chung một IP và sẽ bị chặn nhầm.

## 5. HTTPS với Caddy

Sửa `/etc/caddy/Caddyfile` (thay `tichduc.io.vn` bằng tên miền của bạn):

```
tichduc.io.vn {
    encode gzip
    reverse_proxy 127.0.0.1:3000
}

www.tichduc.io.vn {
    redir https://tichduc.io.vn{uri} permanent
}
```

```bash
systemctl reload caddy
```

Caddy tự xin và gia hạn chứng chỉ HTTPS. Mở `https://tichduc.io.vn` để kiểm tra (DNS mới có thể mất vài phút đến vài giờ).

## 6. Sao lưu dữ liệu hằng ngày

```bash
mkdir -p /var/backups/tichduc
(crontab -l 2>/dev/null; echo '0 3 * * * cp /opt/tichduc/server/data.json /var/backups/tichduc/data-$(date +\%F).json && find /var/backups/tichduc -mtime +14 -delete') | crontab -
```

Mỗi ngày lúc 3 giờ sáng sao một bản, giữ 14 ngày gần nhất. Nên định kỳ tải một bản về máy:

```bash
scp root@<IP_VPS>:/opt/tichduc/server/data.json ./backup-data.json
```

## 7. Cập nhật phiên bản mới

1. Trên máy: tăng `VERSION` trong `sw.js` (ví dụ `tichduc-v5`) để máy người dùng tải bản mới.
2. Tải lên — **không ghi đè `server/data.json`**:

```bash
scp index.html styles.css game.js chua.html chua.js avatar.js sw.js manifest.json icon.svg bg-chinh-dien.png root@<IP_VPS>:/opt/tichduc/
```

```bash
scp server/index.js root@<IP_VPS>:/opt/tichduc/server/
```

(chạy hai lệnh trên từ trong thư mục `tichduc`)

3. Trên VPS:

```bash
chown -R tichduc:tichduc /opt/tichduc && systemctl restart tichduc
```

## 8. Thu tiền qua SePay (bán mõ & gói Hội viên)

Cách hoạt động: khách bấm mua → máy chủ tạo đơn có mã `TDxxxxxx` → khách quét VietQR chuyển khoản (nội dung là mã đơn) → SePay thấy tiền vào tài khoản và gọi webhook → máy chủ đối chiếu mã + số tiền → tự mở khoá vật phẩm.

1. Đăng ký tại [my.sepay.vn](https://my.sepay.vn), liên kết tài khoản ngân hàng nhận tiền.
2. Trong SePay, tạo **Webhook**:
   - URL: `https://tichduc.io.vn/api/sepay/webhook`
   - Sự kiện: chỉ **tiền vào**
   - Xác thực: **API Key** — tự đặt một chuỗi ngẫu nhiên dài, ví dụ tạo bằng `openssl rand -hex 24`
3. Thêm vào `/etc/systemd/system/tichduc.service`, dưới các dòng `Environment` sẵn có:

```ini
Environment=SEPAY_API_KEY=<chuỗi API Key ở bước 2>
Environment=BANK_NAME=MBBank
Environment=BANK_ACCOUNT=<số tài khoản>
Environment="ACCOUNT_NAME=NGUYEN VAN A"
```

   `BANK_NAME` dùng đúng tên ngân hàng SePay hỗ trợ cho ảnh QR (`qr.sepay.vn`), ví dụ `MBBank`, `Vietcombank`, `ACB`, `TPBank`. **Không** đặt `PAYMENT_TEST` trên máy chủ thật — biến này bật nút "giả lập đã chuyển khoản".

```bash
systemctl daemon-reload && systemctl restart tichduc
```

4. Thử thật: mua món rẻ nhất (Mõ Ngọc 19.000đ) bằng tài khoản của bạn, xem mõ tự mở khoá trong vài giây. Kiểm tra nhật ký:

```bash
journalctl -u tichduc -n 50 | grep '\[pay\]'
```

5. **Giá sản phẩm** sửa trong `PRODUCTS` ở `server/index.js` rồi khởi động lại.
6. **Đối soát:** mọi đơn nằm trong `server/data.json` (mục `orders`): `pending` = chưa trả, `paid` = đã trả, `underpaid` = chuyển thiếu (cần xử lý tay). Khách ghi sai nội dung chuyển khoản thì nhật ký báo `không khớp đơn nào` — đối chiếu và cấp tay.

> Tên trường webhook (`id`, `transferType`, `transferAmount`, `content`, `code`) theo tài liệu SePay tại thời điểm viết. Nếu SePay thay đổi, sửa trong route `POST /api/sepay/webhook`.

**Pháp lý:** thu tiền bán vật phẩm số là hoạt động kinh doanh — cần đăng ký hộ kinh doanh/doanh nghiệp, kê khai thuế, có trang Điều khoản & Chính sách hoàn tiền, và xuất hoá đơn điện tử khi được yêu cầu. Nên hỏi kế toán trước khi mở bán.

## 9. Xử lý sự cố

| Triệu chứng | Kiểm tra |
|---|---|
| Trang không mở | `systemctl status tichduc` và `journalctl -u tichduc -n 50` |
| Lỗi HTTPS | `journalctl -u caddy -n 50` — thường do DNS chưa trỏ đúng IP |
| BXH báo "Không kết nối được máy chủ" | `curl http://127.0.0.1:3000/api/live-stats` trên VPS |
| Người dùng thấy bản cũ | Quên tăng `VERSION` trong `sw.js` |

## 10. Lưu ý

- **Khi đông người dùng** (hàng nghìn người cùng lúc): chuyển `data.json` sang SQLite/Postgres trước khi mở rộng.
- **Chính điện nhiều người** dùng kết nối giữ mở (Server-Sent Events, `/api/room/stream`). Caddy hỗ trợ sẵn, không cần cấu hình thêm. Trạng thái phòng nằm trong bộ nhớ máy chủ, nên khởi động lại máy chủ thì mọi người tự vào lại phòng sau vài giây. Đây cũng là lý do không chạy được phần này trên Vercel.
- **Quy định:** trang có bảng xếp hạng, tên người dùng và thanh toán có thể thuộc diện phải thông báo/đăng ký với cơ quan quản lý Internet tại Việt Nam. Nên kiểm tra quy định hiện hành trước khi quảng bá rộng hoặc bật thanh toán.
- **Giám sát miễn phí:** UptimeRobot hoặc Better Stack báo cho bạn khi trang ngừng hoạt động.
