# DeeDee Studio — website clone và CMS nội dung

Nguồn: https://www.deedeestudio.net/

## Tạo bài viết và dự án — CMS local

Nhấp đúp `Start-CMS.command` trên Mac hoặc `Start-CMS.cmd` trên Windows (cần Node.js 22.12+, khuyến nghị 24 LTS). Mở http://127.0.0.1:4174/admin/content sau khi server sẵn sàng. CMS dùng website trên GitHub Pages làm nguồn xem trước, nên không cần chạy thêm server Python. Cần Internet.

Tạo bài/dự án, chọn ảnh, lưu nháp, xem trước và xuất bản. Mặc định nút **Xuất bản** tự ghi file, commit và push lên GitHub để website cập nhật. Cần repo ở nhánh `main` sạch và tài khoản GitHub trên máy có quyền ghi repo. Mở launcher không tự xuất bản. Đặt `CMS_GIT_PUSH=0` nếu chỉ muốn xuất file local.

[Hướng dẫn vận hành, dữ liệu form và giới hạn](docs/CONTENT-CMS.md). Đây là script mở CMS local, chưa phải bộ cài ứng dụng `.app`.

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

Nền website là bản lưu giao diện tĩnh của Wix, kèm CMS Node riêng để sửa trang và tạo nội dung mới; không phải mã nguồn Wix Editor. Các trang công khai đã liên kết tới (kể cả bài viết lưu trữ)
được chuyển sang local nếu lấy được từ nguồn. Các tab portfolio và các CTA
liên hệ đã có điều hướng local. Phân trang tin tức mà Wix không xuất nội dung
riêng được đánh dấu không khả dụng để tránh bấm rồi tải lại cùng trang.
Form liên hệ dùng kết nối Supabase được cấu hình riêng; tìm kiếm và các tích hợp Wix chưa có backend thay thế đầy đủ. Một số slider và animation điều khiển bằng runtime Wix cũng có thể
khác bản trực tiếp.
Video nhúng từ dịch vụ ngoài và các liên kết mạng xã hội vẫn cần Internet.
Chỉ thông báo gửi thành công sau khi dịch vụ nhận dữ liệu xác nhận lưu thành công.

Bản desktop được chụp ở chiều rộng 1440px; đây không phải dự án frontend
đã được viết lại để chỉnh sửa bằng React hay môi trường Wix gốc.

## Sửa nền và ảnh responsive — 24/10/2026

Ảnh nền đã chụp trước đây giữ chiều rộng 1425px và ảnh cắt sẵn theo viewport,
nên hở bên phải trên màn lớn. Nền đường cong nay dùng ảnh gốc, phủ khung chứa
và tính lại vị trí cắt theo focal point khi khung thay đổi kích thước.
Các ảnh xem trước mờ trên trang chủ VI/EN được thay bằng 25 ảnh gốc tương ứng.
Đây là ghi chú sửa bản mirror ngày 24/10; CMS quản trị được bổ sung sau đó như hướng dẫn ở đầu tài liệu.

Công cụ bảo trì yêu cầu Node.js 24+:

```sh
npm ci
npm test
npm run repair:backgrounds
npm run restore:images
npm run restore:news-images   # 16:9 card images for the News tabs (needs network; --dry-run to preview)
```

Các lệnh sửa chạy lại không thay đổi kết quả khi tài nguyên đã được phục hồi.
Server xem local vẫn dùng Python qua `Start.command` hoặc `python3 serve.py`.
Không coi `validation.json` của bản chụp cũ là bằng chứng toàn trang giống bản gốc.

## Form liên hệ gửi dữ liệu vào Supabase

Các form `contact-short-form` / `contact-long-form` (VI và EN) kiểm tra dữ liệu rồi gửi thẳng tới Supabase bằng khóa `anon` công khai (`scripts/form-submit.mjs`). Chưa cấu hình thì form báo rõ "chưa được kết nối nơi nhận dữ liệu" chứ không giả vờ đã gửi.

1. Tạo project Supabase, mở SQL Editor và chạy [docs/supabase-form-schema.sql](docs/supabase-form-schema.sql). Khóa `anon` chỉ được INSERT, không đọc được dữ liệu của ai.
2. Điền `url` (dạng `https://<id>.supabase.co`) và `anonKey` (khóa public, **không** dùng `service_role`) vào [supabase-config.json](supabase-config.json), commit và push.
3. Xem các lượt gửi trong Supabase → Table editor → `form_submissions`. Muốn nhận email thì thêm Database Webhook hoặc Edge Function khi có dòng mới.

Form có ô ẩn chống bot và giãn cách 15 giây mỗi trình duyệt; nếu có spam thì thêm Turnstile/hCaptcha.

## Chỉnh sửa nội dung bằng CMS

`cms/grapesjs` là trình chỉnh sửa chạy trên máy: sửa chữ, ảnh, liên kết, kích thước, màu, vị trí từng khổ màn hình và thêm khối mới. Nhấn **Xuất bản** sẽ ghi `site-overrides.json` (cùng ảnh đã tải lên và `scripts/cms-runtime.js`); các trang tĩnh tự áp dụng khi tải, HTML gốc không bị sửa. Khi chạy bằng `Start-CMS`, nút Xuất bản tự commit/push các file đã xuất từ nhánh `main` sạch; chạy server trực tiếp thì cần bật `CMS_GIT_PUSH=1` hoặc tự commit/push. Cách chạy, biến môi trường và lưu ý bảo mật: [cms/grapesjs/README.md](cms/grapesjs/README.md#publishing-to-the-clone-site-github-pages).

Yêu cầu editor kéo thả tự do và tiêu chí triển khai được ghi trong
[đề xuất thiết kế editor](docs/editor-design.md); tài liệu này chưa phải tính năng đã triển khai.
