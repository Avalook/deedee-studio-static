# Repo media riêng cho ảnh và video

Mục đích: giữ repo web `deedee-studio-static` nhẹ. Ảnh/video khách tải lên qua CMS được commit vào một repo khác (`deedee-studio-media`), phục vụ bằng GitHub Pages của repo đó. Trang web chỉ chứa đường dẫn tuyệt đối tới file.

## Thiết lập (một lần)
1. Tạo repo công khai `Avalook/deedee-studio-media` (GitHub Pages miễn phí cần repo công khai), có sẵn thư mục `media/`, file `.nojekyll`, và bật Pages (nhánh `main`, thư mục gốc).
2. Trong `.devcontainer/devcontainer.json` cho phép Codespace ghi vào repo đó (GitHub sẽ hỏi chủ repo duyệt quyền khi tạo Codespace):
   ```json
   "remoteEnv": { "CMS_MEDIA_REPO": "Avalook/deedee-studio-media" },
   "customizations": { "codespaces": { "repositories": { "Avalook/deedee-studio-media": { "permissions": { "contents": "write" } } } } }
   ```
3. Mở lại Codespace. `start-codespace.sh` tự clone repo media và đặt `CMS_MEDIA_REPO_DIR`, `CMS_MEDIA_BASE_URL`. Nếu không clone được, nó báo cảnh báo và ảnh/video quay về `assets/cms/` của repo web.

## Khi bấm Xuất bản
1. File mới được copy vào `media/` của repo media rồi **commit + push trước**.
2. Sau đó mới commit `site-overrides.json` (hoặc bài viết) vào repo web, để trang không bao giờ trỏ tới file chưa có.
3. GitHub Pages của repo media cần khoảng 1–2 phút để phục vụ file mới.

## Giới hạn
- Ảnh ≤ 5 MB, video ≤ 50 MB mỗi file; GitHub chặn file trên 100 MB và khuyến cáo mỗi repo dưới 1 GB, Pages dưới 1 GB.
- Ảnh đã nằm trong `assets/cms/` của repo web trước khi bật repo media vẫn chạy bình thường.
- Muốn dọn file không còn dùng phải xóa tay trong repo media (CMS không tự xóa).
