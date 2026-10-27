# Dùng CMS qua GitHub Codespaces (miễn phí, không cần server riêng)

CMS là một server Node nên GitHub Pages không chạy được. Codespaces chạy nó ngay trong repo này; nút **Xuất bản** commit thẳng vào `main` bằng quyền GitHub của chính người đang dùng, nên **không cần token hay Render**.

## Điều kiện
- Có tài khoản GitHub và được mời vào `Avalook/deedee-studio-static` với quyền **Write**.
- Gói Codespaces miễn phí có hạn mức giờ mỗi tháng (xem github.com/settings/billing). Codespace tự ngưng sau 30 phút không dùng nên không tốn giờ khi để đó.

## Mở CMS
1. Vào repo → **Code** → tab **Codespaces** → **Create codespace on main**. Lần đầu mất vài phút (tải repo, `npm ci`).
2. Mở tab **Ports** (cạnh Terminal), bấm biểu tượng mở trình duyệt ở cổng **4174 · DeeDee CMS**. Cổng này riêng tư, chỉ tài khoản của bạn vào được.
3. Lần đầu, lấy mật khẩu trong terminal:
   ```bash
   cat cms/grapesjs/data/FIRST-RUN-PASSWORDS.txt
   ```
   Đăng nhập `/admin` bằng `admin`, vào **Tài khoản** để đổi mật khẩu, rồi xóa file đó.
4. Sửa trang, bấm **Xuất bản**. Trang công khai cập nhật sau 1–2 phút.

Lần sau: vào github.com/codespaces, mở lại codespace cũ (nó tự chạy CMS). Nếu CMS không lên: `bash cms/grapesjs/start-codespace.sh` (log ở `/tmp/deedee-cms.log`).

## Giới hạn cần biết
- **Nháp và tài khoản chỉ nằm trong codespace của bạn.** Mỗi người có codespace riêng, dữ liệu không chia sẻ. Nên dùng một codespace chung do một người quản.
- Codespace không dùng 30 ngày sẽ bị GitHub xóa (cài đặt được). Nội dung **đã xuất bản** an toàn trong Git; nháp và tài khoản chưa xuất bản thì mất.
- Chưa có xác thực 2 lớp, chưa có sao lưu tự động.
