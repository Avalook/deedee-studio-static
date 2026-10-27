# CMS bài viết, dự án và form DeeDee (27/10/2026)

## Goal and scope

Keep the captured DeeDee pages and their existing layout. Add a local CMS workflow for creating articles and projects with title, cover, body, slug, language and category; publish static detail pages and automatic cards. Connect contact forms to the selected free Supabase project. The existing page editor, drafts and overrides remain supported. No paid hosting or DNS change is part of this implementation; an always-on online CMS remains a separate deployment step.

## Decisions

1. **Structured content separate from page overrides.** Store drafts and published snapshots below the private CMS data directory. Each item has an immutable id and a draft entity with fields `{id,type,language,slug,title,summary,cover,bodyHtml,category,featured,author,publishedAt,client,year,services,videoUrl,gallery:[]}`. Types are `article|project`; languages are `vi|en`. A separately persisted published snapshot is the only public source; editing/saving a draft never modifies that snapshot. The server validates lengths, enums, image references and a conservative slug. Slug/type/language determine the route; reject collisions with archived pages and other items. Once published, prevent route changes in this first version to avoid orphaned links.
2. **Publish static snapshots.** Generate `content.json`, new detail-page HTML, required runtime assets and referenced uploads. The catalog includes only published records. Images use existing authenticated upload APIs and are rewritten to `assets/cms/` on export. Validate all dependencies before changing export files. Keep local data, passwords and form submissions out of exports and Git. Reuse the serialized Git publishing flow and return deployment failures explicitly.
3. **Preserve archive galleries.** The common `scripts/site-controls.mjs` initializer loads the catalog and mounts new cards in scoped grids inside the relevant homepage/news/project sections. Existing news pagination calls `replaceChildren` repeatedly; placing cards directly into that gallery without extending its renderer would lose the cards. Use isolated grids or integrate into the pagination data model, and test tab changes, resize and load-more behavior. Empty catalogs must leave the captured page unchanged.
4. **Safe body rendering.** Sanitize `bodyHtml` to a constrained rich-text subset with no arbitrary scripts, styles, event handlers, iframes or unsafe links. Media fields accept uploaded/local image paths or explicitly safe HTTPS resources; `videoUrl` is validated separately and rendered as a safe link or approved provider embed. Generated HTML includes escaped titles, metadata and safe cover URLs. Detail pages preserve the site's navigation and responsive visual language.
5. **Real contact storage in Supabase.** Use the selected free project `eyecmmwnvlhubzvijktf` in Avalook. Public forms submit to its protected table under insert-only RLS with validated fields. Anonymous reads and modifications must fail. The authenticated CMS inbox must use a server-side credential or approved authenticated access, never expose a privileged key in public JavaScript. No contact record or personal data is exported to the repository. Return success only after successful storage. Parent owns provisioning, SQL, frontend config and form verification; do not introduce a local-only endpoint as a substitute for online receiving.

## Integration points and ownership

- Backend content: `content-store.mjs`, `content-schema.mjs`, `content-export.mjs`, `content-routes.mjs`; reuse existing session, CSRF, role and upload facilities.
- Static rendering: pure `renderContentPage(item, {basePath})` renderer returns HTML; catalog/detail export returns exact generated files for Git publishing. Existing canonical routes are `/post/<slug>` and `/all-project/<slug>` with `/en` prefix for English.
- Public cards: new focused browser module initialized by `installSiteControls`; adapters for VI/EN homepage, news and project listings. Preserve old items and their pagination.
- Admin interface: `/admin/content` library and create/edit form, upload picker, draft/preview/publish state; keep site editor reachable. Inbox integration belongs to parent.
- Forms: Supabase schema/RLS and frontend configuration owned by parent; preserve existing client validation and translated feedback.
- Integration owner: server routing, Git allowlist/checkout paths, local startup, docs, broad tests and security review. Other modules should expose narrow callable interfaces to avoid concurrent edits to server/export.

## API contracts

- `GET /api/content` → `{items}`; `POST /api/content` → `{item}`.
- `GET /api/content/:id` → `{item}`; `PUT /api/content/:id` → `{item}`.
- `POST /api/content/:id/publish` → `{item,export}`; `POST /api/content/:id/unpublish` removes the public snapshot and its owned outputs.
- `GET /admin/content/:id/preview` is authenticated; a bare item id never exposes a draft anonymously.
- All content APIs require login; mutations require CSRF; publish/unpublish require publisher role.
- Public `content.json` has `{version:1,items:[published entities with route]}` and no drafts or private CMS metadata.

## Route and export ownership

Require conservative normalized slugs with no slash, percent escape, dot traversal, query or fragment. Reject duplicate `(type,language,slug)` and collisions with all archive manifest routes, existing files and another generated record. Routes are `/post/<slug>` or `/all-project/<slug>`, prefixed by `/en` for English. Do not allow a published route to change silently: reject the change or explicitly remove its old owned path in the same publication. Do not accept client-supplied output paths.

Export allowlist consists of `content.json`, agreed content renderer/runtime assets, `assets/cms/<validated-upload-filename>` and only the exact generated `<route>/index.html` paths derived by the server from validated items. Preserve the existing override/runtime allowlist. Git publishing must receive the precise union of generated paths; no broad staging of `cms/`, `.git/`, data, secret files or form submissions. Unpublish may delete only paths proven owned by this content system from the previous published catalog; never delete archived page paths. The checkout/partial-clone sparse paths must include the catalog and generated detail directories before export.
## Local and online distinction

The local Node CMS supports authoring and publishing while running. GitHub Pages serves the published website; it cannot run the CMS backend. A correctly configured public Supabase endpoint lets the public Pages forms receive requests independently of the local machine. Local authoring and GitHub publication do not imply an always-on hosted CMS.
## Acceptance and validation

- Tests first for invalid input, unsafe URLs/body, reserved/duplicate slugs, route collisions, missing media, draft/public isolation, role checks, CSRF, restart persistence and exact export allowlist.
- Create one article and one project, upload covers, save, preview and publish. Confirm new detail URLs and homepage/news/project cards, no duplicates on reinitialization, correct language/category and responsive layouts.
- Confirm drafts do not appear on public pages, existing captured pages still render, and news resize/tab switches retain new cards.
- Submit a contact form with a unique marker to real Supabase, verify the stored row and anonymous read denial; export/Git contain no submission data or privileged keys.
- Run existing CMS and root checks; report pre-existing coverage failures separately from test regressions. Browser-check critical desktop and phone workflows before claiming completion.


## Mở và dùng CMS trên máy

1. Cài Node.js tối thiểu 22.12 (khuyến nghị 24 LTS, kèm npm).
2. Mac: nhấp đúp `Start-CMS.command`. Windows: mở `Start-CMS.cmd`. Lần đầu script cài dependencies nếu thiếu; cần Internet. Script không xóa hay đặt lại dữ liệu hiện có.
3. Mở `http://127.0.0.1:4174/admin/content` sau khi server báo sẵn sàng. Mac tự mở trình duyệt khi health check thành công. Giữ cửa sổ Terminal/cmd mở; Ctrl+C để dừng.
4. Đăng nhập tài khoản CMS hiện có. Ở lần khởi tạo local mặc định: `editor` / `editor-demo` để soạn nháp, `publisher` / `publisher-demo` để xuất bản. Chỉ dùng trên máy cá nhân; đổi mật khẩu trước khi chia sẻ. Biến mật khẩu chỉ seed tài khoản khi tạo data lần đầu, không đổi tài khoản đã tồn tại.
5. Tạo bài viết hoặc dự án, chọn VI/EN, điền tiêu đề, slug, ảnh bìa, tóm tắt, nội dung và trường liên quan. Lưu nháp, xem trước, rồi đăng nhập publisher để xuất bản. Dữ liệu nháp nằm riêng trong `cms/grapesjs/data/`; không đưa thư mục này lên GitHub.

Launcher chỉ mở server trên `127.0.0.1`; đây là script mở ứng dụng local, chưa phải bộ cài `.app`. Website nguồn xem trước mặc định là GitHub Pages nên không cần cửa sổ Python thứ hai, nhưng cần Internet. Có thể đặt `POC_STATIC_SITE_ORIGIN=http://127.0.0.1:4173` nếu muốn dùng archive server local. `POC_PORT` mặc định 4174.

## Đưa nội dung đã xuất bản lên website

Mặc định launcher đặt `CMS_GIT_PUSH=1`: nút **Xuất bản** ghi các file website, commit và push lên GitHub. Mở launcher, đăng nhập hoặc lưu nháp không tự push. Cần Internet, Git, repo ở nhánh `main` sạch và tài khoản GitHub có quyền ghi `Avalook/deedee-studio-static`. Nếu chưa đăng nhập, dùng `gh auth login` và `gh auth setup-git`, hoặc đăng nhập GitHub Desktop và bảo đảm Git trong Terminal có quyền push repo này. Không đưa token vào file source hoặc chia sẻ khóa cho người khác.

Sau khi xuất bản, chờ GitHub Pages build rồi kiểm tra URL bài/dự án và thẻ mới trên website. Thông báo lỗi push nghĩa là chưa đưa lên website; xử lý quyền Git/kết nối hoặc nhánh trước khi thử lại. Không force push. CMS không lấy token hay tự thay cấu hình Git, không stage dữ liệu nháp/credentials/form và không xóa thay đổi của người dùng để ép repo sạch.

Nếu muốn chỉ xuất file local, chạy từ Terminal:

```sh
CMS_GIT_PUSH=0 ./Start-CMS.command
```

Trên Windows cmd:

```bat
set CMS_GIT_PUSH=0
Start-CMS.cmd
```

Ở chế độ này website chưa đổi cho đến khi các file xuất bản được commit/push đúng nhánh. Không stage `cms/grapesjs/data/`, credentials hoặc dữ liệu khách gửi form.

## Xem khách gửi biểu mẫu

Chủ tài khoản mở [Supabase Table Editor của DeeDee](https://supabase.com/dashboard/project/eyecmmwnvlhubzvijktf/editor), chọn bảng `form_submissions`. Cần đăng nhập tài khoản có quyền trong dự án. Website công khai chỉ được gửi dữ liệu; không đọc danh sách khách gửi. Không đặt `service_role` trong file cấu hình công khai hoặc chat.

Form dùng Supabase online nên vẫn nhận dữ liệu khi máy chạy CMS đang tắt, miễn endpoint/cấu hình và quyền insert đang hoạt động. Việc nhận email tự động là tích hợp riêng. CMS local chỉ chỉnh nội dung khi máy và cửa sổ server đang chạy; hiện chưa triển khai CMS thường trực lên hosting trả phí.

## Sharing the local CMS safely

On a machine with no private `content-store.json`, startup imports the existing published `content.json` into drafts and published snapshots. Published images already in `assets/cms` remain usable. Private drafts/uploads are never committed automatically; move them separately if editors need to retain unpublished work.

Before Git publication the content workflow requires a clean checkout of `main` and synchronizes it without force push. A catalog newer than the machine's private published snapshot returns `CONTENT_STALE` (409) instead of overwriting the other editor's work. This first version does not merge simultaneous edits: back up local drafts and reconcile the newer published catalog before retrying. Serialize handoffs between editors; it is not a live collaborative CMS.

Published routes remain reserved after unpublish. Unpublish removes only that item's generated page and catalog entry; media stays available for reuse. Existing captured pages and page-overrides are preserved. A first-publication route update racing a Git operation is serialized and rejected once the route is locked.

## Backend verification

CMS tests enforce at least 80% line, branch and function coverage. HTTP integration uses a disposable bare Git remote and verifies roles/CSRF, private previews, upload visibility, article/project detail output, draft isolation after restart, failed-push retry, route-race protection, unpublish deletion, and prefix-aware media access. No test submissions or article fixtures are published to the real repository by these tests.
