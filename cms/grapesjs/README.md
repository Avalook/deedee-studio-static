# DeeDee Studio CMS (local MVP)

This service adds a local editing backend on top of the captured DeeDee static archive. It keeps the archive's Wix-rendered HTML, CSS, scripts, fonts, and media as the display baseline, then stores and applies validated page overrides. The archive remains available on port 4173; the CMS/editor runs on port 4174.

This is a local MVP, not a hosted production CMS or a full Wix replacement. It has no live database, multi-user session persistence, production authentication, backup policy, or deployment configuration. GitHub Pages cannot run this backend.

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
- Move revisions, uploads, and sessions to a backed-up database/object store with multi-instance concurrency controls and a tested restore process.
- Deploy the backend and CMS proxy to a server-capable host; configure a real DeeDee domain and rollback plan. GitHub Pages remains a static mirror only.
- Add staff usability/accessibility review, full responsive visual checks, SEO controls, localized route/content support, media rights tracking, upload scanning, monitoring, and a formal security review.
- The editor can move selected elements within the archived page and preview four preset widths; it is not an unrestricted Wix canvas and does not yet provide reusable CMS collections, animation editing, custom breakpoint rules, page SEO, menus, forms, app integrations, or collaborative editing.

