# Dùng CMS qua GitHub Codespaces (miễn phí, không cần server riêng)

CMS là một server Node nên GitHub Pages không chạy được. Codespaces chạy nó ngay trong repo này; nút **Xuất bản** commit thẳng vào `main` bằng quyền GitHub của chính người đang dùng, nên **không cần token hay Render**.

## Điều kiện
- Có tài khoản GitHub và được mời vào `Avalook/deedee-studio-static` với quyền **Write**.
- Gói Codespaces miễn phí có hạn mức giờ mỗi tháng (xem github.com/settings/billing). Codespace tự ngưng sau 30 phút không dùng nên không tốn giờ khi để đó.

## Mở CMS
1. Vào repo → **Code** → tab **Codespaces** → **Create codespace on main**. Lần đầu mất khoảng 5–8 phút (tải repo ~1,3 GB, dựng container, `npm ci`). Nếu giao diện đứng ở "Setting up remote connection" quá lâu, tải lại trang (F5). Khi VS Code hỏi tin cậy thư mục, chọn **Tin cậy thư mục và tiếp tục**.
2. CMS tự chạy khi terminal đầu tiên mở (vài giây). Mở tab **Ports** (cạnh Terminal), bấm biểu tượng mở trình duyệt ở cổng **4174 · DeeDee CMS**. Cổng này riêng tư, chỉ tài khoản của bạn vào được.
3. Lần đầu, lấy mật khẩu trong terminal:
   ```bash
   cat cms/grapesjs/data/FIRST-RUN-PASSWORDS.txt
   ```
   Đăng nhập `/admin` bằng `admin`, vào **Tài khoản** để đổi mật khẩu, rồi xóa file đó.
4. Sửa trang, bấm **Xuất bản**. Trang công khai cập nhật sau 1–2 phút.

Lần sau: vào github.com/codespaces, mở lại codespace cũ (nó tự chạy CMS). Nếu CMS không lên, chạy `bash cms/grapesjs/start-codespace.sh` (log ở `/tmp/deedee-cms.log`).

## Ảnh và video
- Ảnh PNG/JPEG/WebP/GIF tối đa **5 MB**, video MP4/WebM tối đa **50 MB** (nút "＋ Thêm video" ở trình sửa trang). Loại file được nhận diện từ nội dung, không theo tên file.
- Nếu đặt `CMS_MEDIA_REPO=owner/tên-repo` (xem `docs/CMS-MEDIA.md`), ảnh và video được đưa vào **repo media riêng** để repo web nhẹ; không đặt thì chúng nằm trong `assets/cms/` của repo web.
- Video dài nên đưa lên YouTube/Vimeo rồi dán liên kết, đừng lưu trên GitHub (khuyến cáo repo dưới 1 GB).

## Form liên hệ và bình luận
Mục **Form & bình luận** trong CMS (`/admin/submissions`, chỉ publisher/admin) hiện các form khách đã gửi và bình luận chờ duyệt: đánh dấu đã xử lý, duyệt hoặc xóa bình luận, tải CSV.
1. Tạo bảng bình luận một lần: dán `docs/supabase-comments-schema.sql` vào Supabase → SQL Editor → Run. (Bảng form đã có từ `docs/supabase-form-schema.sql`.)
2. Cho CMS đọc được dữ liệu: vào github.com/settings/codespaces → **New secret** → tên `SUPABASE_SERVICE_ROLE_KEY`, giá trị là khóa **service_role** (Supabase → Project Settings → API Keys), chọn repo `Avalook/deedee-studio-static`. Khóa này chỉ nằm trong Codespace của bạn, không đưa vào repo, không gửi cho ai. Sau đó dừng và mở lại Codespace.
3. Bình luận của khách chỉ hiện trên bài **sau khi bạn duyệt**; mỗi người gửi cách nhau tối thiểu 30 giây, mỗi phút toàn site tối đa 20 bình luận.

Email báo khi có form hoặc bình luận mới: xem `docs/SUPABASE-NOTIFY.md` (cần tài khoản dịch vụ gửi mail).

## Giới hạn cần biết
- **Nháp và tài khoản chỉ nằm trong codespace của bạn.** Mỗi người có codespace riêng, dữ liệu không chia sẻ. Nên dùng một codespace chung do một người quản.
- Codespace không dùng 30 ngày sẽ bị GitHub xóa (cài đặt được). Nội dung **đã xuất bản** an toàn trong Git; nháp và tài khoản chưa xuất bản thì mất.
- Chưa có xác thực 2 lớp, chưa có sao lưu tự động.

## Đã kiểm tra thật (27/10/2026)
Tạo Codespace mới từ `main`: CMS tự chạy, cổng 4174 mở được trang đăng nhập (không hiện mật khẩu demo), đăng nhập bằng mật khẩu sinh ra thành công, mật khẩu demo bị từ chối, Git trong codespace dùng được. **Chưa thử bấm Xuất bản thật** (sẽ commit lên `main`).

**Kiểm tra thật lần 2 (27/10/2026, tối):** tạo Codespace mới, repo media tự clone; tải ảnh PNG và video MP4 qua API CMS, thêm vào trang `/privacy-policy`, xuất bản: media được commit vào `Avalook/deedee-studio-media` trước, rồi `site-overrides.json` vào repo web (không chứa media). Trên trang thật, ảnh và thẻ `<video controls>` trỏ tới `https://avalook.github.io/deedee-studio-media/media/…`, file trả 200 đúng loại. Hai bản khởi động chạy cùng lúc chỉ sinh một bộ mật khẩu (có khóa). Sau đó đã hoàn lại cả hai repo. Video thử chỉ là file mẫu 2 KB (không phát được), chưa thử file 50 MB thật.
