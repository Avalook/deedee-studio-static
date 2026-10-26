# DeeDee Studio static mirror — AI handoff

Checkpoint date: 2026-10-25. The public website remains at
<https://www.deedeestudio.net/>. The existing public mirror is
<https://github.com/Avalook/deedee-studio-static> and its Pages site is
<https://avalook.github.io/deedee-studio-static/>.

## State at handoff

This is a static archive of the rendered Wix site, not the Wix Editor source. A local CMS/editor prototype is now present at `cms/grapesjs/`; it proxies the archive and stores validated per-route overrides, drafts, releases, media, and revision history on local disk. It supports editing text, image, link, basic styles, responsive size/color overrides, position offsets, insertions, preview, publish, and restore. It does not reproduce all Wix Editor capabilities and is not a production deployment.

The active checkout is on `wip/visual-parity-20261024` at `09db434`, with a
large uncommitted working tree. The latest observed `origin/main` is
`8cbb172`; this checkout is 12 commits behind it. The current working tree has
not been pushed or deployed as a whole. Preserve its existing changes while
reviewing them; do not treat the last commit as the complete site.

The route manifest contains 607 unique page entries and 5,869 asset mappings;
all 607 manifest page files are present and serve as HTTP 200 HTML locally.
There are 84 Vietnamese and 84 English project-detail folders. The manifest
still records 42 errors pending AUD-02 review. A static scan found 26,575 local
anchor references and 14,645 direct local image/media references with no
missing targets. A repair normalized 1,423 Wix-transformed asset references
across 156 pages. The latest audit also verified 3,750 unique local asset URL
references and added the localized `/freefirehack` route with its verified
video and responsive gallery. The static test suite passes 176/176. These
checks establish route/file/asset integrity and selected visual parity, not
full visual or interaction parity across the archive; see
[`ROUTE_STATUS.md`](ROUTE_STATUS.md) for measured results and remaining gaps.

The static archive runs at `http://127.0.0.1:4173/`; the local CMS proxy/admin runs at `http://127.0.0.1:4174/` and `/admin`. The local editor can move selected elements and save/publish route overrides. Its responsive preview supports 1440, 1037, 787, and 419 CSS-pixel widths. CMS tests passed 31/31 on 2026-10-25. This is local evaluation only: CMS data/session persistence is not production-grade, GitHub Pages cannot run its backend, and no public deployment has been made. Visual verification remains incomplete across 607 routes and all device classes; see `ROUTE_STATUS.md`.

## Stack and tools

- Rendered HTML/CSS and client-side JavaScript captured from Wix.
- Small native JavaScript ES modules for the local repairs.
- Node.js scripts with `parse5` for safe HTML edits and deterministic asset
  restoration; `npm test` uses Node's built-in test runner.
- `serve.py` / `Start.command` serve the static archive locally and map the
  GitHub Pages project prefix.
- GitHub Pages hosts the existing public mirror. The checkpoint does not add
  a backend or require secrets.
- Playwright/Chrome were used to inspect the source and local pages, test key
  controls, and capture visual evidence. The screenshots are in
  [`screenshots/`](screenshots/).
- The user supplied the open-source `morluto/rea` repository as the original
  capture tool reference. The CMS prototype uses the existing Node.js stack and
  GrapesJS; it is separate from the static archive source and does not change
  GitHub Pages hosting.

## Important files and directories

- `index.html`, `en/index.html`: Vietnamese and English homepages.
- `manifest.json`: captured routes, page files, source-to-local asset map, and
  known fetch errors.
- `assets/`: downloaded site assets and captured project media. Some
  project-detail images were converted to WebP at quality 90, with a maximum
  edge of 2,560 pixels, to keep the checkpoint size manageable. Visual
  comparison after that conversion is still required.
- `all-project/`, `post/`, `en/`, and the other route folders: saved static
  pages. Consult the route inventory before treating a route as complete.
- `scripts/backgrounds.mjs`, `scripts/background-layout.mjs`,
  `scripts/repair-backgrounds.mjs`: responsive background repair and
  original-image restoration.
- `scripts/restore-placeholder-assets.mjs`: restore blurred homepage images
  from the allowlisted Wix static media host.
- `scripts/shape-backgrounds.mjs`: restore known section backgrounds, update
  footer layout, normalize asset paths, and inject local runtime scripts.
- `scripts/site-controls.mjs`, `project-pages.json`: local CTA,
  testimonial-expansion, and project “show more” behavior.
- `scripts/media-motion.mjs`, `media-sources.json`: allowlisted video playback
  and media helpers.
- `tests/`: Node unit tests for the standalone repair and runtime helpers.
- `validation.json`: an earlier archive validation; it is not proof that this
  newer checkpoint is fully verified.

## Work completed and known gaps

- The homepage background images now use the original uncropped assets and a
  responsive `cover` layout that recalculates the focal crop on resize. The
  visual comparison at six viewport widths found the same horizontal overflow
  in source and local pages. A 1,885-pixel side-by-side evidence pair is saved
  in `screenshots/`.
- Missing or blurred homepage cards were restored from original Wix media.
- Localized “Check out our work” links point to the contact page.
- The testimonial “Show More” control expands and collapses the original text.
- The project list runtime reproduces the observed 6/9-card increments using
  captured project cards. Image files for these cards are local.
- The France Link article video was observed playing locally with a real MP4
  player. A video manifest was prepared for other captured articles.
- Desktop footer fixes keep the six navigation labels on one row and reduce
  the large gap above privacy/copyright text.
- Many routes are still only static captures. The source depends on Wix
  runtime for some carousels, gallery movement, search, forms, and other
  controls. Those need independent review.
- **Forms do not submit to a backend.** No receiver, database, or delivery
  service is configured, so successful submission cannot be claimed.
- **The local CMS is limited.** Staff can edit selected existing content and
  links, replace images, apply basic per-device sizing/color and position
  changes, add simple text/button/image elements, preview drafts, publish a
  local release, and restore a prior revision. It does not yet provide
  unrestricted Wix-style canvas editing, reusable content collections, forms,
  SEO editing, animation authoring, or hosted multi-user operations.
- The missing project-detail capture batch was stopped at the user's request.
  Verify every added detail page, asset, internal link, and compressed image
  before publishing this snapshot.
- Notion connector access was unavailable. The user opened the native Notion
  page, and its visible feedback was read in the app. Do not claim the
  Notion integration connector fetched it.

## Install, serve, and verify

Requirements: Node.js 24 or newer for the checked-in CI workflow, and Python 3
for the local mirror server.

```sh
npm ci
npm test
npm run repair:backgrounds
npm run restore:images
npm run repair:shapes
python3 serve.py
```

CMS local evaluation is separate from the static site. In `cms/grapesjs`, run `npm test` and then `npm start`; open `http://127.0.0.1:4174/admin`. Keep the archive server on port 4173 running. Read `cms/grapesjs/README.md` for local demo credentials and production limitations.

On 2026-10-25, the static-site `npm test` ran 161 tests successfully, but the command exits
with a coverage-gate failure: 69.65% lines, 77.91% branches, and 74.53%
functions versus the configured 80% thresholds. Focused layout and behavior
suites pass; coverage remains below the project threshold. Visual checks now
cover the homepage, `/activities`, three blog category routes, and a
representative project detail page at selected desktop/mobile widths; the rest
of the 607-route archive still needs browser comparison before publishing. The
new mobile project-detail stylesheet is available locally, but has not been
deployed to GitHub Pages. Use
`http://127.0.0.1:4173/` if the local server is running.

## Decisions to preserve

- Preserve the current static archive as a visual reference; do not replace it
  with a newly imagined React/Tailwind recreation.
- Keep the GitHub Pages base path working. Paths must include
  `/deedee-studio-static` on GitHub Pages.
- Keep background repairs restricted to known Wix `wow-image.bgImage`
  elements with authored fill metadata. Do not apply a global image rule that
  changes posters, logos, or card thumbnails.
- Keep external media URL validation allowlisted. Never execute captured Wix
  scripts or arbitrary HTML from project data.
- Keep form behavior honest until a real destination, backend, and deployment
  environment are selected.
- Treat `editor-design.md` as a proposal for later review, not an instruction
  to implement the editor during this audit checkpoint.

## Suggested audit order

1. Compare this commit against the existing public `main` and inspect the
   complete file list before accepting the checkpoint.
2. Review `ROUTE_STATUS.md`, then audit broken internal links and project
   detail assets.
3. Recheck the screenshots and compressions at desktop, laptop, tablet, and
   mobile sizes; compare both locales against the source.
4. Test every visible control in the route groups: navigation, tabs,
   testimonials, carousel, “show more”, article media, footer, and forms.
5. Decide whether to retain the static archive, add a CMS/backend, and build a
   separate editor only after the audit establishes concrete requirements.
