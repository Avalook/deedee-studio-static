# Bàn giao website DeeDee Studio (bản clone)

## Cập nhật 31/10/2026: CMS chuyển sang ứng dụng

CMS giờ là ứng dụng cho Mac và Windows, xem `docs/CMS-APP.md`. Đây là cách dùng duy nhất khi bàn giao; các mục Codespaces, Render và `Start-CMS` bên dưới là cách cũ, không dùng cho khách. Những mục bên dưới có số liệu cũ, số mới nhất nằm trong báo cáo bàn giao ngày 31/10.

Cập nhật 26/10/2026 · commit `f6682c68`

## Sửa footer và xoá thành phần CMS (27/10/2026)

- Sửa footer Liên hệ VI/EN: bản footer điện thoại chỉ hiện đến 750px, tránh lặp footer và khoảng trống lớn trên desktop.
- CMS sửa giao diện có nút **Xoá thành phần**; chọn phần tử rồi bấm nút hoặc Delete/Backspace khi không gõ trong ô nhập. **Hoàn tác** khôi phục trước khi lưu. Xoá trang gốc được lưu trong override; HTML gốc không bị ghi đè. Khối chèn mới bị gỡ khỏi danh sách chèn.
- Lưu nháp/xem trước/xuất bản dùng cùng trạng thái xoá; các vùng cấu trúc trang và điều hướng được bảo vệ.
- Bộ kiểm tra footer toàn bộ route: `node tools/visual-diff/footer-audit.mjs` (cần Chrome và server local4173). Kiểm tra desktop1440 và điện thoại390 sau khi CSS tải xong.

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

## Cập nhật 27/10/2026 (tối): media, form, bình luận

- Ảnh ≤ 5 MB và video MP4/WebM ≤ 50 MB tải lên trong trình sửa trang; có tùy chọn repo media riêng (`docs/CMS-MEDIA.md`).
- `/admin/submissions`: xem form đã gửi, duyệt hoặc xóa bình luận, tải CSV; cần biến `SUPABASE_SERVICE_ROLE_KEY` (`docs/CMS-CODESPACES.md`).
- Email báo khi có form/bình luận mới: code Edge Function đã viết, **chưa triển khai** (`docs/SUPABASE-NOTIFY.md`).

## 3. Phần "backend": form liên hệ → Supabase

Form liên hệ (VI/EN) kiểm tra dữ liệu rồi gửi vào Supabase (`supabase-config.json` đã có project). Có ô ẩn chống bot và giãn cách 15 giây; nếu bị spam thì thêm Turnstile/hCaptcha. Xem dữ liệu trong Supabase → Table editor → `form_submissions` (liên kết có sẵn trong thanh CMS). Muốn nhận email khi có form mới thì thêm Database Webhook.
Mục **Bình luận** dưới bài viết (cập nhật 27/10): khách để lại tên và nội dung, bình luận lưu vào bảng `comments` ở Supabase ở trạng thái chờ duyệt và chỉ hiện sau khi publisher duyệt ở `/admin/submissions` (khóa public chỉ thêm được bình luận chờ duyệt, không đọc được bình luận chưa duyệt). Bảng đã tạo bằng `docs/supabase-comments-schema.sql`.

## 4. CMS: tự sửa nội dung bản clone

Chạy trên máy của người quản trị (GitHub Pages không chạy được server):

```sh
python3 serve.py                 # cửa sổ 1, trong thư mục dự án (cổng 4173)
cd cms/grapesjs && npm ci && npm start    # cửa sổ 2 (cổng 4174), mở http://127.0.0.1:4174/admin
```

**Tài khoản và quyền** (mật khẩu mẫu: `admin-demo`, `publisher-demo`, `editor-demo` — đổi ngay ở mục *Tài khoản*)
- `editor`: sửa, lưu nháp, xem trước, khôi phục phiên bản. `publisher`: thêm quyền xuất bản. `admin`: thêm quyền quản lý tài khoản.
- Admin tạo/xóa tài khoản, đổi vai trò, đặt lại mật khẩu (đóng mọi phiên của tài khoản đó); ai cũng đổi được mật khẩu của mình. Luôn còn ít nhất một admin.

**Sửa giao diện** (`/admin`)
- Chọn trang (606 đường dẫn), sửa chữ, ảnh, liên kết, kích thước, cỡ chữ, màu, vị trí từng khổ màn hình; ẩn/xóa khối (có hoàn tác); thêm khối chữ, nút, ảnh; tải ảnh lên (tối đa 2 MB).
- **Phạm vi "Mọi trang"**: sửa menu, chân trang một lần cho mọi trang cùng kiểu (site có vài kiểu menu; trang nào chưa đổi thì mở trang đó và sửa tiếp).
- **SEO từng trang**: tiêu đề, mô tả, ảnh chia sẻ, noindex. Khi xuất bản được ghi vào đầu trang để Google/Facebook/Zalo đọc được; xóa SEO thì trang trở lại như bản gốc.
- Lưu nháp có lịch sử phiên bản, khôi phục bản cũ, xem trước, nhật ký thao tác.

**Bài viết và dự án mới** (`/admin/content`): tạo, đăng, gỡ bài viết/dự án tiếng Việt hoặc tiếng Anh (ảnh bìa, thư viện ảnh, video, nội dung có định dạng, mục nổi bật). Bài viết dùng đúng giao diện các bài hiện có (đầu/chân trang, bố cục, bình luận); dự án dùng bố cục đơn giản của CMS.

**Xuất bản**: ghi `site-overrides.json`, ảnh vào `assets/cms/`, `scripts/cms-runtime.js`, các trang bài mới và (nếu có SEO) sửa phần đầu các trang tĩnh. Commit và push (hoặc chạy với `CMS_GIT_PUSH=1`) để GitHub Pages cập nhật sau khoảng 1 phút. Đặt `CMS_SITE_ORIGIN` = địa chỉ trang thật để ảnh chia sẻ có đường dẫn đầy đủ.

**Giới hạn còn lại**
- Bài viết và dự án **đã có sẵn** (khoảng 120 bài) sửa qua trình sửa từng trang (chữ, ảnh, liên kết), chưa đưa được vào trình quản lý nội dung.
- Trang dự án mới chưa có giao diện giống các trang dự án cũ; chưa tạo được trang tự do mới ngoài bài viết/dự án.
- Không chèn HTML/CSS tự do (cố ý), không sửa hiệu ứng, chưa có thư viện ảnh chung, chưa có xác thực 2 lớp, chưa có sao lưu tự động ra ngoài, chỉ một người đăng cùng lúc.

## 5. Kiểm tra và bảo trì

- `npm test` (356 test) và `cd cms/grapesjs && npm test` (95 test). Ngưỡng coverage 80% hiện chưa đạt (khoảng 76%), lệnh vẫn báo lỗi dù mọi test đạt.
- `node tools/visual-diff/run.mjs --routes /,/news --widths 1440,419` so ảnh với trang gốc; `node tools/visual-diff/functional.mjs --pages` kiểm chức năng trên trang công khai (26 kiểm tra).
- Ảnh và nội dung sao chép từ trang Wix gốc; nếu Wix gốc đổi nội dung thì bản clone **không tự cập nhật**.
