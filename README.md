# The Art of Corporate Gifting

Trang web một trang của H2Y JSC & GIVEHADA, chuyển thể từ hồ sơ Corporate Gifting Profile. Static site, không cần build.

- `/` (index.html): bản chính, phần chân là thông tin liên hệ.
- `/lien-he` (lien-he/index.html): bản nhân bản, phần chân là form để lại thông tin (họ tên, chức vụ, doanh nghiệp, số điện thoại, email).
- `assets/`: ảnh, video, 120 khung hình phim The Ritual Case, nhạc nền.

## Kết nối form /lien-he với Google Sheet

1. Mở script.google.com, tạo dự án mới, dán toàn bộ `apps-script/Code.gs`, Lưu.
2. Kiểm tra `SHEET_ID` (đang trỏ về sheet của trang bán hàng, script tự tạo tab "Liên hệ doanh nghiệp").
3. Chạy tay hàm `testNotify` một lần để cấp quyền.
4. Triển khai > Triển khai mới > Ứng dụng web, thực thi với tư cách Tôi, ai cũng có quyền truy cập > Triển khai, copy URL đuôi `/exec`.
5. Mở `lien-he/index.html`, tìm `var LEAD_ENDPOINT=''` và dán URL vào giữa hai dấu nháy, commit. Vercel tự deploy lại.
