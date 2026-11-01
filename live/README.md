# Bộ phát TikTok LIVE — Chính điện 3D

Chạy trên **máy phát** (máy tính bạn dùng để livestream). Người xem bình luận là vào quỳ trong chính điện 3D, tặng quà được xướng tên hồi hướng, thả tim thì tim bay trên đầu nhân vật.

## Chạy

Cần Node.js 20 trở lên và Internet (cảnh 3D tải thư viện Three.js từ jsDelivr).

```bash
cd live && npm install && npm start
```

1. Mở `http://localhost:3000` (bảng điều khiển).
2. Bấm **Mở màn hình chính điện 9:16**, rồi bấm **Bật âm thanh** trong cửa sổ đó.
3. TikTok LIVE Studio: *Add source → Window capture* → chọn cửa sổ chính điện. OBS: *Browser source* trỏ tới `http://localhost:3000/chua.html?live`, kích thước 1080×1920.
4. Bật LIVE, nhập `@username` vào bảng điều khiển, bấm **Kết nối**.

Chưa live vẫn thử được bằng mục **Thử khi chưa live**: gửi bình luận, tặng quà 1/3/9/27 xu, đổ 5/10/20 người mẫu, bật người mô phỏng.

## Người xem làm được gì

| Hành động | Trong chính điện |
|---|---|
| Bình luận bất kỳ | Vào từ cửa, đi tới đệm và quỳ (20 chỗ). Câu bình luận nổi trên đầu, nhân vật cúi lạy. Đầy chỗ thì người ít điểm nhất (bằng điểm thì ít hoạt động hơn) nhường chỗ; ai đã đạt từ 27 điểm được giữ chỗ. |
| Thêm thẻ `#nam` `#nữ`, `#trọc` `#ngắn` `#búi` `#dài`, `#lam` `#nâu` `#xám` vào bình luận (VD "Chúc cả nhà an yên #nữ #búi") | Chọn dáng nhân vật, ghép được nhiều thẻ |
| Tặng quà | Dâng lễ theo giá trị quà: 1 xu hoa, 3+ hương, 9+ hoa sen, 27+ chuông. Banner xướng tên, giọng đọc hồi hướng (lấy lời nguyện từ bình luận gần nhất nếu bật), cộng điểm Bảng Công Đức |
| Thả tim | ❤️ bay trên đầu nhân vật (tối đa 1 lần / 3 giây mỗi người) |

Giọng đọc dùng giọng tiếng Việt có sẵn của trình duyệt. Microsoft Edge trên Windows có giọng tự nhiên (Hoài My, Nam Minh), nên mở màn hình phát bằng Edge rồi dùng *Window capture*. Browser source của OBS thường không có giọng tiếng Việt.

## Bảo mật

- Không dùng tài khoản TikTok: chỉ đọc sự kiện công khai của phòng live theo username. Không hỏi mật khẩu, cookie hay phiên đăng nhập.
- Chỉ nghe `127.0.0.1`. Header `Host` phải là localhost (chặn DNS rebinding, trả 421).
- Lệnh điều khiển (`POST /live/cmd`) chỉ nhận từ chính trang của bộ phát (kiểm tra `Origin`, trả 403) — trang web lạ mở cùng trình duyệt không điều khiển được.
- Chỉ phục vụ 5 file trong danh sách trắng; mã nguồn, dữ liệu và `../` đều trả 404.
- Tên, bình luận, tên quà bị cắt độ dài và lọc ký tự điều khiển; trên màn hình chỉ vẽ bằng `textContent`/canvas, không chèn HTML.

## Lưu ý

- `tiktok-live-connector` là thư viện cộng đồng, không phải API chính thức của TikTok; có thể ngừng chạy khi TikTok thay đổi, và việc dùng nó có thể trái điều khoản TikTok. Bạn tự chịu trách nhiệm với kênh của mình.
- Bình luận người xem hiện trực tiếp trên màn hình phát và có thể được đọc to (khi bật "Đọc lời nguyện từ bình luận"). Hãy theo dõi và tắt tuỳ chọn này nếu có bình luận không phù hợp.
- Nhận quà TikTok là thu nhập: tuân thủ quy định về thuế và hoạt động tôn giáo nơi bạn sinh sống.
