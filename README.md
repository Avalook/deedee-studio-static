# DeeDee Studio — bản lưu local

Nguồn: https://www.deedeestudio.net/

## Mở website

Nhấp đúp `Start.command`, sau đó mở http://127.0.0.1:4173.
Máy cần có Python 3. Nếu cổng đang được dùng, bản local có thể đã chạy.

Hoặc chạy `python3 serve.py` trong thư mục này để ánh xạ tiền tố đường dẫn GitHub Pages khi xem local.

## Nội dung

- Các trang HTML đã render và tài nguyên giao diện tải từ website công khai.
- `assets/`: ảnh, font, CSS và tài nguyên media tải được.
- `original/`: phản hồi HTML gốc của từng trang, dùng để đối chiếu.
- `manifest.json`: danh sách trang, ánh xạ tài nguyên và lỗi tải.
- `evidence/`: kết quả quan sát bằng REA và thông tin phiên bản repo.
- `validation.json`: kết quả kiểm tra 494 route, tài nguyên mẫu và điều hướng.
- Menu mobile, bộ chọn VI/EN và các tab Tin tức hoạt động trong bản local.

## Phạm vi

Đây là bản lưu giao diện tĩnh của website Wix, không phải mã nguồn Wix Editor,
CMS hoặc backend. Các trang công khai đã liên kết tới (kể cả bài viết lưu trữ)
được chuyển sang local nếu lấy được từ nguồn. Các tab portfolio và các CTA
liên hệ đã có điều hướng local. Phân trang tin tức mà Wix không xuất nội dung
riêng được đánh dấu không khả dụng để tránh bấm rồi tải lại cùng trang.
Form liên hệ/tuyển dụng và tìm kiếm cần backend Wix nên không gửi dữ liệu từ
bản tĩnh. Một số slider và animation điều khiển bằng runtime Wix cũng có thể
khác bản trực tiếp.
Video nhúng từ dịch vụ ngoài và các liên kết mạng xã hội vẫn cần Internet.
Không nhập dữ liệu để kỳ vọng form gửi thành công trên bản tĩnh.

Bản desktop được chụp ở chiều rộng 1440px; đây không phải dự án frontend
đã được viết lại để chỉnh sửa bằng React hay môi trường Wix gốc.

## Sửa nền và ảnh responsive — 24/10/2026

Ảnh nền đã chụp trước đây giữ chiều rộng 1425px và ảnh cắt sẵn theo viewport,
nên hở bên phải trên màn lớn. Nền đường cong nay dùng ảnh gốc, phủ khung chứa
và tính lại vị trí cắt theo focal point khi khung thay đổi kích thước.
Các ảnh xem trước mờ trên trang chủ VI/EN được thay bằng 25 ảnh gốc tương ứng.
Đây là sửa bản mirror; chưa có trình kéo thả hay backend quản trị.

Công cụ bảo trì yêu cầu Node.js 24+:

```sh
npm ci
npm test
npm run repair:backgrounds
npm run restore:images
```

Các lệnh sửa chạy lại không thay đổi kết quả khi tài nguyên đã được phục hồi.
Server xem local vẫn dùng Python qua `Start.command` hoặc `python3 serve.py`.
Không coi `validation.json` của bản chụp cũ là bằng chứng toàn trang giống bản gốc.

Yêu cầu editor kéo thả tự do và tiêu chí triển khai được ghi trong
[đề xuất thiết kế editor](docs/editor-design.md); tài liệu này chưa phải tính năng đã triển khai.
