# File mẫu cho test bán tự động (TC_TBT_029/031/032/033)

Theo `Ke_hoach_Automation_Them_Bai_Thuc_Hanh.docx` mục 6.3: automation KHÔNG dùng
`setInputFiles()` để tự nạp file, chỉ bấm "+ Audio"/"+ Ảnh"/"+ Video" để mở hộp thoại chọn file
của hệ điều hành rồi **dừng lại** (`page.pause()`). Người test tự chọn 1 file trong thư mục này
(hoặc file khác) khi hộp thoại hiện ra, rồi bấm Resume trong Playwright Inspector.

| File | Dùng cho | Ghi chú |
|---|---|---|
| `sample-audio.wav` | TC_029/031/033 - đính kèm Audio hợp lệ | WAV PCM thật, 0.5s im lặng |
| `sample-image.jpg` | TC_029/031/033 - đính kèm Ảnh hợp lệ | JPEG thật 200x200 |
| `sample-video.mp4` | TC_029/031/033 - đính kèm Video hợp lệ | **PLACEHOLDER** - môi trường tạo file không có `ffmpeg` nên đây KHÔNG phải video phát được thật, chỉ đủ để hệ thống "đính kèm" (do bug 032 - hệ thống hiện không validate định dạng). Nếu cần preview phát được thật, thay bằng 1 file `.mp4` ngắn thật trước khi test. |
| `invalid-format.exe` | TC_032 - sai định dạng | 2KB, không phải file thật hợp lệ |
| `oversized-image.jpg` | TC_032 - vượt kích thước | JPEG thật nhưng ~12MB (chưa xác nhận đúng ngưỡng giới hạn thật của hệ thống - dùng tạm để thử) |

Chạy: `SOURCE_BASE_URL=... SOURCE_USERNAME=... SOURCE_PASSWORD=... npx playwright test --config=playwright.them-bai-thuc-hanh.config.js 06-question-media-upload.spec.js --headed`
