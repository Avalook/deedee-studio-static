# Đề xuất trình chỉnh sửa website DeeDee

Ngày: 24/10/2026. Trạng thái: **đề xuất kiến trúc; chưa triển khai editor hoặc backend**.

## Mục tiêu đã xác nhận

Nhân sự có thể kéo thả tự do **từng thành phần** như chữ, ảnh, nút và video;
đổi kích thước, sắp xếp lớp, nhóm, nhân bản, thêm/xóa thành phần và sửa giao
diện theo desktop/tablet/mobile. Phạm vi còn gồm đăng nhập, lưu nháp, mở lại,
undo/redo, xem trước, xuất bản, khôi phục phiên bản, quản lý nội dung VI/EN
và form hoạt động thật. Đây là trình dựng riêng cho website công ty; chưa có
cơ sở cam kết tái tạo mọi khả năng của nền tảng Wix.

## Hiện trạng và lỗi cần làm chuẩn trước

Bản hiện tại là mirror tĩnh có **494 route được ghi trong manifest**, không
phải 494 mẫu thiết kế độc lập. Không có editor, CMS hoặc backend vận hành.
Các bản sửa nền hiện tại chỉ sửa mirror; không tạo khả năng chỉnh sửa kéo thả.

Kiểm tra giao diện phát hiện ảnh nền lưu kích thước inline theo lần capture
(ví dụ rộng **1425px**) nên không phủ hết container rộng hơn. Ngoài ra có ảnh
đang dùng bản xem trước chất lượng thấp (LQIP) thay vì tài nguyên gốc. Hai lỗi
này phải được kiểm tra theo hình gốc, không thể suy ra độ giống chỉ từ HTTP
200, số ảnh tải được hoặc số route. Cần đối chiếu cùng viewport, font đã tải,
vị trí cuộn và trạng thái animation/video.

## Quyết định kiến trúc đề xuất

**GrapesJS OSS core** là nền editor. Xây UI riêng cho trang/layer/style/asset,
không tự viết lại toàn bộ cơ chế canvas. Core có `setDragMode('absolute')` và
`translate`; hỗ trợ này là nền để phát triển thao tác kéo tự do, không tự
động cung cấp toàn bộ trải nghiệm Wix. Plugin Absolute Mode nâng cao của
Studio SDK có điều kiện cấp phép riêng, không mặc định là OSS miễn phí.

Nguồn dữ liệu chuẩn là **project JSON có phiên bản schema**, gồm cây component,
style, overrides theo breakpoint, tham chiếu asset và binding nội dung. HTML/CSS
là kết quả xuất bản. Không lấy HTML đã xuất rồi parse lại cho mỗi lần mở editor.
Không nhập toàn bộ archive Wix và coi đó là model có thể chỉnh sửa an toàn:
các DOM trùng theo breakpoint, CSS nội bộ và runtime Wix cần được thay bằng
component có hành vi rõ ràng. Ảnh, font, nội dung và số đo gốc được tái sử dụng.

Layout có container/grid/flex, anchor và constraints; cho phép vị trí tự do
khi cần. Desktop là cơ sở, tablet/mobile có override riêng và khả năng bỏ
override. Kéo ở một breakpoint không được âm thầm phá bố cục breakpoint khác.
Các hành vi slider/menu/video/form có cấu hình và runtime do dự án quản lý.

Backend khởi đầu là **modular monolith**, Postgres lưu dữ liệu và revision,
object storage lưu ảnh/video. Chưa chốt nhà cung cấp cloud hoặc dịch vụ trả phí.
Các phần chính:

- Editor và API: đăng nhập; phân quyền editor/publisher; kiểm tra quyền phía
  server; tải/lưu draft với revision để phát hiện ghi đè; thông báo lỗi rõ.
- Nội dung: projects, posts, jobs, testimonials và bản dịch VI/EN; dùng mẫu
  trang cho nội dung lặp lại, vẫn có thể chỉnh bố cục mẫu và các trang riêng.
- Media: upload có giới hạn loại/kích thước; asset ID ổn định; không ghi đè
  file mà release cũ vẫn sử dụng.
- Phiên bản: lịch sử bất biến, undo/redo trong editor, autosave có trạng thái
  thành công/thất bại và khôi phục revision đã lưu.
- Forms: endpoint nhận dữ liệu thật, validate/chống spam/giới hạn tần suất,
  màn hình xem submission; thông tin khách hàng chỉ lưu ở backend riêng.

Xuất bản lấy **một revision cụ thể**, tạo release và kiểm tra trên staging.
Chỉ đổi con trỏ release public sau khi build/kiểm tra thành công; publish lỗi
giữ release đang hoạt động. Restore tạo release từ revision cũ, không xóa lịch
sử. Draft/preview có kiểm soát truy cập, không lọt nội dung chưa xuất bản.
Mọi thao tác ghi kiểm tra quyền và dữ liệu tại server; secret không nằm trong
frontend/GitHub công khai. Chưa có API hay dịch vụ nào trong đề xuất này được tạo.

## Các chặng triển khai và tiêu chí nghiệm thu

1. **Làm chuẩn render.** Sửa các sai lệch đã đo, lập danh mục route, template,
   ngôn ngữ, tài nguyên và hành vi; xác định nơi còn thiếu dữ liệu CMS gốc.
2. **Trang chủ có editor thật làm chặng chứng minh.** Chuyển trang chủ thành
   component model, dựng kéo/resize, style, asset, breakpoint và lưu draft.
   Trang chủ là chặng kiểm chứng kiến trúc, không phải thu hẹp mục tiêu cuối.
3. **Backend và xuất bản.** Kết nối đăng nhập, quyền, revision, preview, publish,
   restore và form; kiểm tra lỗi upload/save/build, xung đột và mất mạng.
4. **Di chuyển toàn bộ website công khai.** Nhập nội dung dự án/tin tức/tuyển
   dụng và VI/EN, tái tạo mọi template/trang riêng, link và hành vi thuộc phạm
   vi gốc. Đối chiếu đủ danh mục route (494 route trong archive hiện tại và
   thay đổi được phát hiện ở site gốc), gồm redirect/alias; không bỏ trang
   âm thầm. Dữ liệu không có trong archive cần lấy qua quyền CMS/export phù hợp.
5. **Nghiệm thu vận hành.** Đối chiếu toàn bộ template và trang đặc thù ở các
   viewport đã thống nhất; bàn giao thao tác quản trị, backup và restore.

Các kiểm tra bắt buộc trước khi coi chặng editor chạy được:

- Mở → lưu không thay đổi → mở lại → export không làm lệch ảnh/font/nền/layout
  so với baseline; visual diff có ngưỡng và phần động được ghi nhận rõ.
- Dùng chuột kéo và resize từng thành phần, sửa chữ, undo/redo, lưu rồi reload:
  nội dung và hình học còn đúng; không chỉ thử qua lệnh API nội bộ.
- Mobile override tồn tại sau reload, không đổi desktop; các mức 390, 768,
  1366, 1885 và 1920px không tạo khoảng trống nền/cắt khối ngoài dự kiến.
- Publish tạo frontend đúng preview; build/staging thất bại không thay website
  public; restore trả lại nội dung và bố cục đã chọn.
- Người chưa đăng nhập không đọc draft hoặc ghi dữ liệu; editor không tự
  nâng quyền publish; thử ghi đè revision phải có thông báo xung đột.
- Form thành công tạo bản ghi backend; dữ liệu sai bị từ chối; lỗi backend
  hiện thông báo, không báo gửi thành công giả.

## Nguồn tham khảo chính thức

- [GrapesJS OSS](https://github.com/GrapesJS/grapesjs)
- [Core drag mode](https://grapesjs.com/docs/api/editor.html#setdragmode)
- [Project JSON và lưu trữ](https://grapesjs.com/docs/modules/Storage.html#project-data)
- [Trang và export](https://grapesjs.com/docs/modules/Pages.html)
- [Thiết bị và responsive](https://grapesjs.com/docs/getting-started.html#responsive-templates)
- [Giới hạn import HTML/CSS](https://grapesjs.com/docs/guides/Custom-CSS-parser.html#import-html-css)
- [Studio SDK Absolute Mode và cấp phép](https://app.grapesjs.com/docs-sdk/plugins/canvas/absolute-mode)

Các tài liệu được kiểm tra ngày 24/10/2026. Lựa chọn GrapesJS là đề xuất cần
được chứng minh bằng các kiểm tra trên trước khi di chuyển toàn website.
