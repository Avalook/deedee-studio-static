# DeeDee Studio static mirror — AI handoff

Checkpoint date: 2026-10-24. The public website remains at
<https://www.deedeestudio.net/>. The existing public mirror is
<https://github.com/Avalook/deedee-studio-static> and its Pages site is
<https://avalook.github.io/deedee-studio-static/>.

## State at handoff

This is a static archive of the rendered Wix site, not the Wix Editor source.
There is no application framework, CMS, API server, database, authentication,
or editable content model in this checkout. The proposal in
[`editor-design.md`](editor-design.md) is design guidance only; a Wix-like
free-positioning editor has not been built.

The last known pushed commit before this checkpoint was `e291cc6` on `main`
(`fix: restore responsive background crops and sharp homepage images`). The
local checkout now includes uncommitted website, runtime, media, manifest,
documentation, and route-archive changes. Keep them as a checkpoint; do not
assume every changed route has received a final browser review.

The route manifest currently contains 536 page entries and 5,561 asset
mappings. The 42 manifest errors need a route-by-route review. The project
archive was interrupted while capturing newly discovered project detail
pages; see [`ROUTE_STATUS.md`](ROUTE_STATUS.md) for the present inventory and
missing routes. No final publish of this checkpoint has been verified.

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
  capture tool reference. No framework, CMS, or new skill was installed.

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
- **There is no visual drag-and-drop editor or CMS.** Content edits currently
  require source changes and republishing the static site.
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

The last known test run before the capture was halted reported 37 passing
tests and 81.02% line coverage across the test suite. Rerun tests and visual
checks against the exact checkpoint before publishing. Use
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
