# File mẫu cho test tự động (TC_TBT_029/031/032/033)

Từ 2026-09-24 (chỉ đạo trực tiếp từ user), `06-question-media-upload.spec.js` **tự động chọn file**
qua `attachMediaFile()` (bắt sự kiện native file chooser + `setFiles()`) - KHÔNG còn dừng lại
(`page.pause()`) chờ người test tự chọn file nữa. Test tự ánh xạ đúng loại file cần (Audio/Ảnh/
Video/sai định dạng/quá khổ) sang file tương ứng trong thư mục này qua hằng số `FIXTURES` trong
file spec - đổi/thêm file trong thư mục này thì cập nhật `FIXTURES` tương ứng.

| File | Dùng cho | Ghi chú |
|---|---|---|
| `sample-audio.wav` | TC_029/031/033 - đính kèm Audio hợp lệ | WAV PCM thật, 0.5s im lặng |
| `sample-image.jpg` | TC_029/031/033 - đính kèm Ảnh hợp lệ | JPEG thật 200x200 |
| `sample-video.mp4` | TC_029/031/033 - đính kèm Video hợp lệ | **PLACEHOLDER** - môi trường tạo file không có `ffmpeg` nên đây KHÔNG phải video phát được thật, chỉ đủ để hệ thống "đính kèm" (do bug 032 - hệ thống hiện không validate định dạng). Nếu cần preview phát được thật, thay bằng 1 file `.mp4` ngắn thật rồi trỏ `FIXTURES.video` sang file đó. |
| `oversized-image.jpg` | TC_032 (vượt kích thước) + TC_033 (đóng vai "1 file KHÁC" khi đính kèm lại) | JPEG thật nhưng ~12MB (chưa xác nhận đúng ngưỡng giới hạn thật của hệ thống - dùng tạm để thử) |
| `invalid-format.exe` | TC_032 - sai định dạng | 2KB, không phải file thật hợp lệ |

Nếu 1 file trong bảng trên bị xoá/hỏng, test sẽ throw lỗi rõ ràng ngay khi load file (không chạy
âm thầm sai) - bổ sung lại file đúng tên hoặc sửa `FIXTURES` trong `06-question-media-upload.spec.js`.

Chạy (không cần `--headed` nữa, chạy được thẳng headless/CI):
`SOURCE_BASE_URL=... SOURCE_USERNAME=... SOURCE_PASSWORD=... npx playwright test --config=playwright.them-bai-thuc-hanh.config.js 06-question-media-upload.spec.js`
