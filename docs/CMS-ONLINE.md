# CMS online trên Render

## Quyết định (27/10/2026)

Giữ trang công khai ở GitHub Pages, chạy một CMS Node trên Render có persistent disk. CMS dùng Pages làm archive upstream qua proxy cùng origin, giữ prefix `/deedee-studio-static`. Không chạy `serve.py` công khai và không phục vụ thư mục Git hoặc dữ liệu CMS.

Nháp, users, uploads và khóa ký nằm ở `/var/data/cms`. Một Git checkout ghi được ở `/var/data/publish` dùng riêng để xuất bản vào `main`; chỉ lấy overrides/runtime/ảnh CMS. Credential chỉ ở biến môi trường của hosting. Phiên đăng nhập trong RAM, nên khởi động lại yêu cầu đăng nhập lại; dữ liệu đã lưu vẫn còn.

Luồng xuất bản được tuần tự hóa: đồng bộ Git fast-forward → ghi overrides/ảnh/runtime → commit các file được phép → push main. Không force push; xung đột hoặc lỗi mạng phải báo chưa xuất bản. Có thể thử lại push sau khi đã commit nhưng mạng lỗi. Website vẫn cần chờ Pages build.

Trước khi mở Internet phải từ chối mật khẩu demo (kể cả đã lưu trong users.json), dùng cookie Secure, kiểm tra origin HTTPS và chỉ dùng một instance. Đây là rollout nhỏ cho người quản trị, chưa có MFA/reset mật khẩu, cộng tác nhiều máy hay quy trình bài viết mới.

## Phụ thuộc

Cần tài khoản Render, dịch vụ trả phí có persistent disk và GitHub fine-grained token chỉ cho repo Avalook/deedee-studio-static với Contents: read/write. Không đưa token/mật khẩu vào Git, URL hoặc chat. Tạo credential trên giao diện tài khoản và điền thẳng vào secret Render.

## Kiểm thử trước bàn giao

Đăng nhập, tải ảnh, sửa trang, lưu nháp, xuất bản lên repo thử nghiệm, xem thay đổi trên Pages; khởi động lại và kiểm tra nháp/ảnh; thử lỗi push và retry. Sao lưu `/var/data/cms` ngoài Render và thử phục hồi. Chưa đổi DNS/Wix; tạo bài mới, video và form nằm ngoài đợt này.

## Cấu hình Render cụ thể

- Source: repo công khai, branch `codex/cms-online-20261027` (mã chạy CMS); nhánh nhận nội dung xuất bản vẫn là `main`.
- Runtime Node, `NODE_VERSION=24`, vùng Singapore, Starter, một instance.
- Build: `npm --prefix cms/grapesjs ci --ignore-scripts`.
- Start: `node cms/grapesjs/start-hosted.mjs`.
- Health check: `/healthz`; admin: `/admin`.
- Disk 1 GB, mount `/var/data`. Git checkout dùng partial clone blobless và sparse paths, không chép kho ảnh gốc vào disk. Ảnh mới và lịch sử nháp vẫn tăng dần, cần theo dõi dung lượng và tăng disk khi cần.
- Secrets: `POC_EDITOR_PASSWORD`, `POC_PUBLISHER_PASSWORD` (hai mật khẩu khác nhau, tối thiểu 20 ký tự), `CMS_GITHUB_TOKEN` (fine-grained PAT cho đúng repo, Contents read/write). Không dùng token CLI của máy hay đưa secret vào URL.
- Script tự dùng `RENDER_EXTERNAL_URL` làm origin HTTPS, `PORT` của Render, Pages làm nguồn trang gốc. Có thể đặt `POC_ORIGIN` để ghi đè khi đã đổi domain CMS (không có slash cuối).
- Auto-deploy tắt: xuất bản nội dung không được tự khởi động lại CMS. Triển khai mã CMS mới thủ công sau kiểm thử.

Giá cần xác nhận trên màn hình Render trước khi tạo dịch vụ. Chưa tạo service hoặc phát sinh chi phí bằng tài liệu này.

## Sao lưu và xử lý lỗi

Sao lưu `/var/data/cms` ngoài dịch vụ: users.json chứa hash mật khẩu, secret.key, revisions, releases, uploads và audit.log cần được giữ riêng tư. Sessions không được sao lưu; đăng nhập lại sau restart là hành vi dự kiến. Không chép các file này lên GitHub public.

Nếu push lỗi sau commit, sửa credential hoặc kết nối rồi nhấn xuất bản lại; không dùng force push. Nếu có xung đột nhánh hoặc checkout còn file chưa commit, hệ thống dừng xuất bản thay vì ghi đè. Quản trị viên cần sao lưu checkout, đối chiếu `git status`, chỉ sửa các file xuất bản `site-overrides.json`, `scripts/cms-runtime.js`, `assets/cms/` và hòa giải với main trước khi thử lại. Không chạy `git reset --hard` để xử lý chung. Nếu khởi tạo clone bị gián đoạn, sao lưu phần cần giữ rồi tạo lại riêng `/var/data/publish`; không xóa `/var/data/cms`.

CMS mới không tự nhập dữ liệu nháp cũ trên máy. Nếu có nháp/uploads muốn giữ, sao lưu và chuyển nguyên bộ data local vào persistent disk trước lần chạy đầu; nếu có tài khoản demo, phải di chuyển tài khoản an toàn trước khi server hosted chấp nhận khởi động. Đổi biến môi trường không tự đổi hash trong users.json.

Rate limit hiện tính theo địa chỉ socket của reverse proxy và có thể gộp người dùng chung; chưa tin `X-Forwarded-For` do client cung cấp. Đây là giới hạn của rollout quản trị nhỏ; trước khi mở cho nhiều nhân sự cần giới hạn theo tài khoản/proxy đáng tin và MFA.
