import { escapeHtml } from './http.mjs';

const BASE_CSS = `
  :root { color-scheme: light; }
  html, body { min-height: 100%; }
  body { margin: 0; }
  .poc-demo-banner {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px 20px;
    padding: 10px 20px;
    background: #17202a;
    color: #f8fafc;
    font: 600 13px/1.4 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    letter-spacing: 0.02em;
  }
  .poc-demo-banner span { font-weight: 500; opacity: 0.82; }
  .poc-demo-banner a { color: #fbbf24; }
  .poc-error {
    max-width: 720px;
    margin: 12vh auto;
    padding: 32px;
    border: 1px solid #e2e8f0;
    border-radius: 20px;
    background: #ffffff;
    color: #17202a;
    font: 16px/1.6 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }
  .poc-error h1 { margin-top: 0; font-family: Georgia, serif; font-weight: 500; }
`;

export function renderDocument({ title, html = '', css = '', banner = '', robots = 'noindex, nofollow' }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="${escapeHtml(robots)}">
<meta name="generator" content="DeeDee CMS POC (GrapesJS spike)">
<title>${escapeHtml(title)}</title>
<style>${BASE_CSS}</style>
<style>${css}</style>
</head>
<body>
${banner ? `<div class="poc-demo-banner">${banner}</div>` : ''}
${html}
</body>
</html>`;
}

export function renderPublicPage(release) {
  return renderDocument({
    title: 'DeeDee Studio — CMS POC demo',
    html: release.html,
    css: release.css,
    banner:
      '<strong>Local CMS spike · demo data only</strong><span>Published release ' +
      `${escapeHtml(release.id.slice(0, 16))} · <a href="/admin">Admin</a></span>`,
  });
}

export function renderPreviewPage(revision, expiresAt) {
  return renderDocument({
    title: `Draft preview — ${revision.label}`,
    html: revision.html,
    css: revision.css,
    banner:
      '<strong>Draft preview · not public</strong><span>' +
      `Expires ${escapeHtml(new Date(expiresAt).toISOString())} · revision ${escapeHtml(revision.id.slice(0, 16))}</span>`,
  });
}

export function renderErrorPage({ title = 'Not available', message = 'The page is not available.' }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${escapeHtml(title)}</title>
<style>${BASE_CSS}</style>
</head>
<body>
<main class="poc-error">
<h1>${escapeHtml(title)}</h1>
<p>${escapeHtml(message)}</p>
<p><a href="/">Return to the demo page</a></p>
</main>
</body>
</html>`;
}
