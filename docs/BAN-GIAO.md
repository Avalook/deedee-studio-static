# Bàn giao website DeeDee Studio (bản clone)

Cập nhật 26/10/2026 · commit `f6682c68`

## Cập nhật 27/10/2026: CMS nội dung mới và nhận form

- Mở `Start-CMS.command` (Mac) hoặc `Start-CMS.cmd` (Windows), vào `/admin/content`. Cần Node.js >=22.12; lần đầu cần Internet để cài dependency.
- Tạo bài viết hoặc dự án VI/EN với tiêu đề, đường dẫn, ảnh bìa, nội dung định dạng, chuyên mục và lựa chọn nổi bật trên trang chủ. Dự án có khách hàng/năm/dịch vụ/thư viện ảnh và video YouTube/Vimeo.
- Lưu nháp không đổi trang công khai. Xem trước yêu cầu đăng nhập. Publisher có thể xuất bản/gỡ; xuất bản tạo trang chi tiết và thẻ ở Tin tức/Dự án/trang chủ theo lựa chọn. Không ghi đè trang đã clone.
- Khi mở bằng `Start-CMS`, nút “Xuất bản” mặc định tự ghi file, commit và push lên nhánh `main` để GitHub Pages cập nhật. Cần nhánh `main` sạch và tài khoản GitHub trên máy có quyền ghi repo; mở app hoặc lưu nháp không tự push. Đặt `CMS_GIT_PUSH=0` để chỉ xuất local. Không đưa khóa GitHub vào app chia sẻ cho người khác.
- Form đã nối Supabase project `deedee-forms` (`eyecmmwnvlhubzvijktf`) trong Avalook, được báo giá 0 USD khi tạo. Khóa public chỉ được chèn các cột form; không đọc/sửa/xóa dữ liệu. Dữ liệu không lưu trên GitHub. Xem qua nút “Biểu mẫu đã nhận” trong CMS bằng tài khoản Supabase có quyền.
- Đã gửi thử REST thật thành công; đọc bằng khóa public bị từ chối, dữ liệu sai bị từ chối. Có bản ghi kiểm thử nhãn `DeeDee integration test 2026-10-27` để phân biệt dữ liệu khách.
- Không tạo dịch vụ trả phí Render, không đổi DNS/Wix. Đây là CMS chạy local qua trình duyệt; chưa phải file cài đặt `.app`/`.exe`. Máy khác cần clone repo, cài Node và quyền GitHub riêng để xuất bản. Dữ liệu nháp riêng cần sao lưu thư mục CMS data; published catalog được đồng bộ khi khởi tạo máy mới, stale catalog bị chặn để tránh ghi đè.
- Gói Supabase Free có thể tạm dừng sau một tuần không hoạt động; xem dashboard nếu form ngừng nhận. Không có email thông báo tự động trong lần bàn giao này.
- Ghi chú chi tiết: `docs/CONTENT-CMS.md`. Các mục cũ bên dưới mô tả trạng thái ngày26/10; phần cấu hình form trống trước đó đã được thay thế bởi cập nhật này.

## 1. Đây là gì

- **Trang chạy công khai:** https://avalook.github.io/deedee-studio-static/ (GitHub Pages, tự cập nhật khi push vào nhánh `main`).
- **Mã nguồn:** https://github.com/Avalook/deedee-studio-static
- Đây là **bản sao tĩnh** của https://www.deedeestudio.net/ (Wix). Trang Wix gốc **không bị thay đổi** và vẫn chạy bình thường. Muốn khách dùng bản này làm trang thật thì phải trỏ tên miền sang GitHub Pages (hoặc chép lên hosting riêng); việc đó chưa làm.
- 606 đường dẫn (tiếng Việt và tiếng Anh): trang chủ, dự án, giới thiệu, dịch vụ, studio, testimonials, tin tức, tuyển dụng, liên hệ, blog, bài viết.

## 2. Độ giống bản gốc

Đo bằng bộ so ảnh tự động (`tools/visual-diff`, so từng khổ 1920/1440/1037/787/419px; đạt khi lệch dưới 3%).

| Nhóm | Tình trạng |
| --- | --- |
| Trang chủ, Dự án, Dịch vụ, Giới thiệu (VI/EN), Studio, Testimonials, Liên hệ, Chính sách | Đạt ở hầu hết khổ màn hình |
| Blog "Hoạt động" | Đạt cả 5 khổ |
| Tin tức (VI/EN) | Đạt ở khổ lớn; khổ tablet/phone lệch 3–5% (cách thu nhỏ ảnh) |
| Bài viết (desktop, tablet) | Đạt; **phone lệch 11–26%** |
| Trang dự án trên phone | Đạt (thư viện ảnh 2 cột) |
| Tuyển dụng VI | Đạt desktop/tablet, phone lệch 4,5% |

**Chưa giống:** `/en/careers` (còn ảnh mờ), `/carrers` và `/en/carrers` (đường dẫn gõ sai), bài viết trên điện thoại, ảnh bìa thẻ tin ở trang chủ phone (cắt khác), 5 ảnh chưa tìm được địa chỉ. Một số trang (Our work, Service, Contact, Studio) chưa đo lại sau đợt sửa cuối.
Video YouTube của 3 trang dự án báo "Video unavailable" vì YouTube chặn nhúng bài VEVO ngoài tên miền gốc.
Chưa thử trên điện thoại thật.

## 3. Phần "backend": form liên hệ → Supabase

Form liên hệ (VI/EN) kiểm tra dữ liệu rồi gửi vào Supabase. **Chưa cấu hình nên hiện form báo "chưa được kết nối nơi nhận dữ liệu"** (không giả vờ đã gửi).
Để bật:
1. Tạo project Supabase (miễn phí), vào SQL Editor chạy `docs/supabase-form-schema.sql`.
2. Điền `url` và `anonKey` (khóa public, **không** dùng `service_role`) vào `supabase-config.json`, commit và push.
3. Xem dữ liệu ở Supabase → Table editor → `form_submissions`. Muốn nhận email thì thêm Database Webhook.
Có ô ẩn chống bot và giãn cách 15 giây; nếu bị spam thì thêm Turnstile/hCaptcha.

Mục **Bình luận** dưới bài viết chỉ để hiển thị giống bản gốc, **không đăng được bình luận**.

## 4. CMS: tự sửa nội dung bản clone

Chạy trên máy của người quản trị (GitHub Pages không chạy được server):

```sh
python3 serve.py                 # cửa sổ 1, trong thư mục dự án (cổng 4173)
cd cms/grapesjs && npm ci && npm start    # cửa sổ 2 (cổng 4174), mở http://127.0.0.1:4174/admin
```

1. Đăng nhập `editor` / `editor-demo` để sửa và lưu nháp; `publisher` / `publisher-demo` để **Xuất bản**.
   **Đổi mật khẩu trước khi dùng thật** (`POC_EDITOR_PASSWORD`, `POC_PUBLISHER_PASSWORD`, xem `cms/grapesjs/README.md`).
2. Chọn trang, sửa chữ, ảnh, liên kết, kích thước, màu, vị trí từng khổ màn hình, thêm khối chữ/nút/ảnh. Lưu nháp, xem trước.
3. Nhấn **Xuất bản**: CMS ghi `site-overrides.json`, ảnh tải lên vào `assets/cms/` và `scripts/cms-runtime.js`.
4. Nếu mở bằng `Start-CMS`, nút Xuất bản mặc định tự commit/push từ nhánh `main` sạch. Chạy server trực tiếp thì bật `CMS_GIT_PUSH=1` để tự đẩy, hoặc tự commit/push. Chờ Pages build xong rồi kiểm tra trang công khai.

Giới hạn: không sửa được HTML tự do, menu, SEO từng trang, hiệu ứng; không phải bản thay thế đầy đủ cho Wix Editor. Mỗi lần sửa phải kiểm tra lại ở khổ desktop, tablet, phone.

## 5. Kiểm tra và bảo trì

- `npm test` (329 test) và `cd cms/grapesjs && npm test` (38 test). Ngưỡng coverage 80% hiện chưa đạt (khoảng 76%), lệnh vẫn báo lỗi dù mọi test đạt.
- `node tools/visual-diff/run.mjs --routes /,/news --widths 1440,419` so ảnh với trang gốc; `node tools/visual-diff/functional.mjs --pages` kiểm chức năng trên trang công khai (26 kiểm tra).
- Ảnh và nội dung sao chép từ trang Wix gốc; nếu Wix gốc đổi nội dung thì bản clone **không tự cập nhật**.
