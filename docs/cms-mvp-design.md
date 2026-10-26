# DeeDee CMS MVP design

## Goal

Add an authenticated editing backend for the real local DeeDee archive while
keeping the captured Wix HTML, CSS, scripts, fonts, and media as the render
baseline. Editors save a revision; publishers publish an immutable release;
restoring an older revision creates a new draft. The editor manages all local
archive routes listed in `manifest.json` (606 at this checkpoint). Each
normalized route has its own document; publishing snapshots the full route map.

## Decision

Use the existing GrapesJS POC's Node HTTP server, authentication, CSRF,
revision, preview-token, publish, restore, and media-upload services. Add a
small schema-validated page-override model and an editing bridge injected into
the static archive. Do not parse the full Wix document into GrapesJS: its
multi-megabyte DOM, Wix runtime, inline styles, and responsive duplicate
elements make a lossy import unsafe. The bridge applies only explicit text,
image, visibility, size, color, and per-viewport position overrides over the
unchanged archive.

The CMS server proxies the configured local archive origin and serves the
editor and API from that same origin. This keeps source media paths functional
and allows the editor iframe and editing bridge to communicate same-origin.
The archive's own server and files remain the fallback when the CMS is stopped.

## Data and API

The document schema is version 1 with a normalized route page id (for example
`/`, `/aboutus`, or `/all-project/...`) and an allowlisted set of operations
keyed by a constrained CSS selector. Values are validated server-side;
arbitrary HTML/CSS is not accepted. Immutable revisions store a map of route
documents, so saving one route preserves the others. A release snapshots that
map, and only the public-state endpoint exposes released changes. Preview data
is available only with a valid signed expiring preview token.

## Security boundaries

- Keep the service bound to loopback by default; don't expose it to a network
  until production authentication, HTTPS cookies, persistent sessions, rate
  limits, backup, and deployment configuration are completed.
- Keep editor and publisher checks server-side. Require CSRF on writes.
- Reject unknown model fields, unsafe selectors, invalid image URLs, oversized
  values, and unbounded operations.
- Never change the original static HTML during editor saves or publishing.

## Acceptance for this slice

1. Admin can select a route from the local manifest, open its archived page in
   an iframe, and move, resize, hide, edit leaf text, and replace images
   without changing the archived files.
2. A draft survives editor reload, is visible through an authenticated preview
   token, and is not visible to public readers before publish.
3. Publisher publish changes the CMS-proxied public routes; rollback creates
   a new draft and publishing that revision restores the previous appearance.
4. The original static archive still serves unchanged on port 4173.
5. Desktop/mobile editing values are independent. Editing one viewport leaves
   the other viewport's override intact.

This route editing bridge is a local MVP, not a production CMS deployment or a
claim of feature parity with Wix. GitHub Pages cannot execute this backend.
