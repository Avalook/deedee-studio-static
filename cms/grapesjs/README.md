# DeeDee Studio CMS (local MVP)

This service adds a local editing backend on top of the captured DeeDee static archive. It keeps the archive's Wix-rendered HTML, CSS, scripts, fonts, and media as the display baseline, then stores and applies validated page overrides. The archive remains available on port 4173; the CMS/editor runs on port 4174.

This remains a limited CMS, not a full Wix replacement. A single-instance hosted rollout is now provided in [docs/CMS-ONLINE.md](../../docs/CMS-ONLINE.md) and the repository root render.yaml. It has no managed accounts/MFA, multi-instance concurrency, new-article collections, or automatic external backup policy. GitHub Pages cannot run this backend.

## Run locally

From the repository's `outputs/deedee-local` folder:

```sh
cd cms/grapesjs
npm ci
npm start
```

Open <http://127.0.0.1:4174/admin>. Local demo credentials:

| Username | Password | Capability |
| --- | --- | --- |
| `editor` | `editor-demo` | Edit, save drafts, preview, restore revisions |
| `publisher` | `publisher-demo` | Editor capabilities plus publish |
| `admin` | `admin-demo` | Publisher capabilities plus account management (`/admin/users`) |

Sign in as `admin` and open **Tài khoản** to add or delete accounts, change roles, reset passwords (every session of that account is closed) and change your own password. Passwords need 12+ characters and may not be a demo password. The last admin cannot be deleted or demoted, and you cannot delete or demote yourself. In hosted mode set `POC_ADMIN_PASSWORD` (20+ characters, different from the others) for a dedicated `admin`; without it the publisher account is promoted to admin on first start.

### Edit scope and SEO

- **Phạm vi** (top bar): *Chỉ trang này* edits one page. *Mọi trang* edits are stored under the page id `*` and apply to every page that has the same component, which is how the menu and footer are changed once. The shared header has a different id on each page (`comp-<page>_r_comp-<shared>`), so site-wide edits address it as `[id$="_r_comp-<shared>"]`. The site has a few header variants (home, our-work and contact differ from the rest); a page that did not change gets the same edit by opening it and editing in site-wide scope again. On a page the page's own fields win over site-wide ones.
- **SEO & chia sẻ của trang**: title, description, share image and noindex. They are applied by the runtime and, on **Xuất bản**, written into the static page's own `<head>` (title, description, `og:*`, `twitter:*`, robots) so search engines and link previews see them. The replaced tags are kept in `seo-originals.json`; removing the SEO edit restores the page exactly. Set `CMS_SITE_ORIGIN` (for example `https://www.example.com`) so local share images become absolute URLs.
- Articles created in **Bài viết & dự án** are rendered from the site's own article page (same header, footer and layout) with their title, date, reading time, body, category and comments section; related posts are not shown. Projects still use the plain layout.

These credentials are only for local evaluation. Change them before any shared or hosted use. The editor loads the 606 routes listed in `manifest.json`; choose a route from the page picker, then select and drag elements in the preview. Text, image, visibility, size, typography, colors, and per-device position overrides are stored per route. New text, buttons, and uploaded images can be added and moved.

The first run creates ignored local data in `cms/grapesjs/data/`. Keep the archive server on `http://127.0.0.1:4173` running while using the CMS. To use another archive origin, set `POC_STATIC_SITE_ORIGIN`; to load its manifest from another directory, set `POC_STATIC_SITE_DIR`.

Useful local settings:

```sh
POC_PORT=4180 \
POC_EDITOR_PASSWORD='replace-with-a-long-password' \
POC_PUBLISHER_PASSWORD='replace-with-another-long-password' \
npm start
```

Environment variables are read directly; `.env` is not loaded automatically. Demo users are seeded once, so changing the environment passwords does not change already-created `data/users.json`. Remove the local data directory only when you intentionally want to reset all local revisions, users, uploads, and releases.

## Editing and release model

- The admin page proxies the real local archive into an editor iframe and injects the CMS runtime into HTML routes.
- Page documents are keyed by normalized local route (for example `/`, `/aboutus`, `/our-work`, or `/all-project/...`). Saving one route preserves the other route documents.
- Changes are schema-validated; arbitrary HTML and CSS are not accepted. The bridge supports text, image source, links, visibility, width/height, font size, foreground/background colors, per-device movement and basic styles for desktop, laptop, tablet, and mobile, plus inserted text/button/image elements.
- Save creates an immutable draft revision. Preview uses a signed, expiring revision token. Publisher publish creates an immutable site release containing the full route map. Restore copies an older revision into a new draft.
- The CMS proxy injects the runtime into archive HTML pages and serves non-HTML assets from the archive origin. Stop the CMS to see the untouched archive on port 4173.

## Publishing to the clone site (GitHub Pages)

GitHub Pages is static and cannot run this server, so **Publish** also writes the files the static pages read:

| File | What it is |
| --- | --- |
| `site-overrides.json` | Every approved edit, per route. Replaced on each publish (publishing an older revision restores it). |
| `assets/cms/<uuid>.<ext>` | Images uploaded in the editor that those edits use. |
| `scripts/cms-runtime.js` | The same runtime the editor preview uses; the static pages load it from `scripts/site-controls.mjs`. |

The archived HTML is never edited. Each page fetches `site-overrides.json` on load and applies the edits for its route (text, image, link, visibility, size, colours, per-device position, inserted blocks).

Day-to-day flow, run on your own computer:

```sh
python3 serve.py                       # terminal 1, from the repository root: the archive on :4173
cd cms/grapesjs && npm start           # terminal 2: the editor on :4174, open /admin
```

1. Sign in as an editor, pick a page, edit, **Save draft**, check the preview.
2. Sign in as a publisher and press **Xuất bản**. The toast lists the files written to the repository.
3. Commit and push those files (`site-overrides.json`, `assets/cms/`, `scripts/cms-runtime.js`). Pages updates about a minute later.

To skip step 3, start the server with `CMS_GIT_PUSH=1`: after a publish it runs `git add` for only those files, `git commit` and `git push origin HEAD` from the repository root, using the git credentials of the account running the server. Review that before enabling it and use a branch that Pages builds.

Settings (environment variables):

| Variable | Default | Meaning |
| --- | --- | --- |
| `CMS_EXPORT` | on | `0` stops publish from writing static-site files. |
| `CMS_EXPORT_DIR` | repository root | Where the files are written (tests use a temp folder). |
| `CMS_GIT_PUSH` | off | `1` commits and pushes the exported files after each publish. |

Change `POC_EDITOR_PASSWORD` and `POC_PUBLISHER_PASSWORD` (see above) before using this on real content; anyone who can sign in as a publisher can change what the public site shows.

## Verify

```sh
node --check server.mjs
node --check public/cms-runtime.js
node --check public/admin/site-editor.js
npm test
```

The Node test suite covers authentication and CSRF, validation/sanitization, immutable revisions, uploads, route normalization, route-isolated drafts/releases, preview, and archive proxy behavior. Browser checks should still be performed at desktop, tablet, and mobile sizes before using edits for live business content.

## Remaining production work

- Replace demo credentials with managed accounts, secure password reset/MFA, persistent sessions, HTTPS-only cookies, and deployment-grade rate limits.
- For broader use, move revisions and uploads to a backed-up database/object store with multi-instance concurrency controls. The hosted rollout currently uses one persistent disk; sessions intentionally expire on restart. Test external backups and restore before business use.
- To let staff edit from anywhere, host this server (it can stay off the public internet and push to the repository with `CMS_GIT_PUSH=1`). The public clone itself stays on GitHub Pages.
- Add staff usability/accessibility review, full responsive visual checks, SEO controls, localized route/content support, media rights tracking, upload scanning, monitoring, and a formal security review.
- The editor can move selected elements within the archived page and preview four preset widths; it is not an unrestricted Wix canvas and does not yet provide reusable CMS collections, animation editing, custom breakpoint rules, page SEO, menus, forms, app integrations, or collaborative editing.

## Chạy trong GitHub Codespaces

Cách miễn phí cho khách dùng CMS mà không cần server riêng: xem `docs/CMS-CODESPACES.md`. Cấu hình ở `.devcontainer/devcontainer.json` và `cms/grapesjs/start-codespace.sh`.

## Ảnh, video, form và bình luận

- Tải lên ảnh ≤ 5 MB và video MP4/WebM ≤ 50 MB; tùy chọn repo media riêng: `docs/CMS-MEDIA.md`.
- `/admin/submissions`: xem form đã gửi, duyệt bình luận, tải CSV (cần `SUPABASE_SERVICE_ROLE_KEY`): `docs/CMS-CODESPACES.md`.
- Email báo khi có form/bình luận mới: `docs/SUPABASE-NOTIFY.md`.
