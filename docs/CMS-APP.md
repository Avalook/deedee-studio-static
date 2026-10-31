# Ứng dụng DeeDee CMS (Mac, Windows)

Đây là cách dùng CMS chính thức. Ứng dụng gói sẵn CMS và Git, không cần cài Node, không cần tài khoản GitHub, không cần máy chủ.

## Tải file cài

Vào [Releases](https://github.com/Avalook/deedee-studio-static/releases), chọn đúng máy:

| Máy | File |
|---|---|
| Mac chip Apple (M1 trở lên) | `DeeDee-CMS-<phiên bản>-arm64.dmg` |
| Mac chip Intel | `DeeDee-CMS-<phiên bản>-x64.dmg` |
| Windows | `DeeDee-CMS-<phiên bản>-x64.exe` |

## Người quản lý: tạo mã kích hoạt

Mỗi máy một mã, để lỡ mất máy thì chỉ cần xoá mã của máy đó.

1. Đăng nhập GitHub tài khoản `Avalook`, vào https://github.com/settings/personal-access-tokens/new
2. **Token name:** tên máy, ví dụ `DeeDee CMS - may A`. **Expiration:** tối đa 1 năm, ghi lịch nhắc tạo mã mới.
3. **Repository access:** chọn **Only select repositories**, rồi chọn đúng `Avalook/deedee-studio-static`.
4. **Permissions:** thêm **Contents**, chọn **Read and write**. Không thêm quyền nào khác.
5. Bấm **Generate token**, copy mã (bắt đầu bằng `github_pat_`), gửi riêng cho người dùng.

Thu hồi: vào https://github.com/settings/personal-access-tokens và xoá mã đó. Máy đó sẽ không xuất bản được nữa, các máy khác không ảnh hưởng.

Không đưa mã vào repo, tài liệu hay nhóm chat chung.

## Người dùng: cài và mở

**Mac:** mở file `.dmg`, kéo DeeDee CMS vào Applications. Lần đầu mở, Mac báo không xác minh được nhà phát triển: vào **System Settings → Privacy & Security**, kéo xuống bấm **Open Anyway**.

**Windows:** chạy file `.exe`. Nếu hiện "Windows protected your PC", bấm **More info → Run anyway**.

Lần đầu, dán mã kích hoạt rồi bấm **Kích hoạt**. App tải dữ liệu website (khoảng 300 MB) và tự mở trình sửa. Từ lần sau chỉ cần mở app.

Ô **Khoá xem form đã nhận** là khoá `service_role` của Supabase, có toàn quyền trên dữ liệu form. Cần ít nhất một máy có khoá này: thiếu khoá thì CMS không hiện form và không duyệt được bình luận, mà bình luận chưa duyệt thì không lên web. Chỉ nhập trên máy của người được phép xem form. Muốn thêm khoá sau khi đã kích hoạt, dùng menu **DeeDee CMS → Đổi mã kích hoạt** rồi nhập lại cả mã và khoá.

## Dùng hằng ngày

App không có đăng nhập, tài khoản hay phân quyền: mã kích hoạt là quyền duy nhất, ai có app đã kích hoạt là sửa và xuất bản được mọi thứ. Muốn ngừng cho một máy dùng, xoá mã của máy đó trên GitHub.

1. Sửa trang ở **trình sửa giao diện**, thêm bài ở **Bài viết & dự án**.
2. **Lưu nháp** chưa đổi gì trên web. Bấm **Xuất bản** thì web cập nhật sau khoảng 1–2 phút.
3. Sửa xong đóng app. Website vẫn chạy bình thường khi app đóng.

**Xoá một tin cũ ở trang Tin tức:** bấm vào tiêu đề tin, bấm **Chọn cả thẻ tin**, rồi **Xoá thành phần** và **Xuất bản**. Các tin sau tự dồn lên. Tin nằm ở trang sau hoặc tab khác: bật **Tương tác** để chuyển tới đó, rồi tắt đi trước khi chọn. Cách này chỉ bỏ thẻ khỏi danh sách. Trang bài viết vẫn mở được bằng link trực tiếp, và thẻ ở trang chủ phải xoá riêng.

Chỉ bản clone trên GitHub Pages được sửa. Trang Wix `deedeestudio.net` không đổi cho đến khi tên miền được trỏ sang bản này.

## Dùng nhiều máy

- App cài mới tự lấy bản đã xuất bản, nên cài lại không làm mất chỉnh sửa trên web.
- Nếu máy khác vừa xuất bản, app báo lỗi thay vì ghi đè. Đóng rồi mở lại app, các trang và bài đang nháp vẫn được giữ, rồi xuất bản lại. Cách này áp dụng cho cả sửa giao diện lẫn bài viết, dự án.
- Hai máy cùng sửa một bài: máy xuất bản sau sẽ ghi đè bản của máy trước. Nên thống nhất ai sửa bài nào.
- Bài nháp trùng đường dẫn với bài máy khác đã đăng sẽ không xuất bản được. Đổi slug rồi thử lại.
- Nháp chỉ nằm trên từng máy. Muốn chuyển nháp sang máy khác thì phải xuất bản trước.

## Lỗi thường gặp

| Hiện tượng | Xử lý |
|---|---|
| "Mã này sai, đã hết hạn hoặc không có quyền xuất bản" | Tạo mã mới theo hướng dẫn trên, dán vào ô hiện ra. |
| "Chưa mở được CMS" | Kiểm tra Internet rồi mở lại app. |
| Muốn đổi mã trước khi hết hạn | Menu **DeeDee CMS → Đổi mã kích hoạt** |

Nhật ký chạy nằm ở `logs/cms.log` trong thư mục dữ liệu của app: Mac `~/Library/Application Support/DeeDee CMS`, Windows `%APPDATA%\DeeDee CMS`. Nên sao lưu thư mục này nếu có nhiều nháp chưa xuất bản.

## Cho người phát triển

- Mã nguồn app: `cms/desktop`. Máy chủ CMS vẫn là `cms/grapesjs`, khởi động bằng `start-desktop.mjs`.
- Chạy thử: `cd cms/desktop && npm ci && npm start`. Đóng gói: `npm run dist`. Kiểm bản đóng gói: `npm run smoke`.
- Phát hành: tăng `version` trong `cms/desktop/package.json`, đẩy tag `cms-v<phiên bản>`. GitHub Actions build, chạy kiểm thử trên Mac và Windows, rồi tạo Release. App không tự cập nhật, người dùng phải cài bản mới.
- Khi xuất bản, app ghi đè `scripts/cms-runtime.js` bằng bản nó mang theo. Mọi máy nên dùng cùng phiên bản app; cần bản 1.0.1 trở lên để xoá tin cũ đúng cách.
- App không có khoá nào trong file cài. Repo được cố định trong `start-desktop.mjs`.
