import http from 'node:http';
import https from 'node:https';

export function createArchiveProxy({
  staticSiteOrigin,
  host,
  port,
  verifyPreviewToken,
  secret,
  serializePreviewCookie,
  HttpError,
}) {
  return async function proxyArchive(req, res, { previewToken = '' } = {}) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      throw new HttpError(405, 'Method not allowed', 'METHOD_NOT_ALLOWED');
    }
    const origin = new URL(staticSiteOrigin);
    const reqUrl = new URL(req.url, `http://${host}:${port}`);
    let upstreamUrl;
    try {
      upstreamUrl = resolveArchiveUrl(req.url, origin);
    } catch {
      throw new HttpError(400, 'Invalid archive path', 'INVALID_ARCHIVE_PATH');
    }
    const isPreview = reqUrl.pathname === '/preview';
    if (!isPreview && reqUrl.pathname !== '/' && !reqUrl.pathname.endsWith('/') && !originPathHasExtension(reqUrl.pathname)) {
      upstreamUrl.pathname = `${upstreamUrl.pathname}/`;
    }
    if (isPreview) {
      const previewRoute = reqUrl.searchParams.get('pageId') || '/';
      upstreamUrl.pathname = previewRoute === '/' ? '/' : `${previewRoute}/`;
      upstreamUrl.search = '';
    }
    upstreamUrl.searchParams.delete('cms-editor');
    upstreamUrl.searchParams.delete('cmsPreviewToken');
    if (isPreview) upstreamUrl.searchParams.delete('pageId');

    const transport = origin.protocol === 'https:' ? https : http;
    const requestHeaders = {};
    for (const name of ['accept', 'accept-language', 'range', 'if-none-match', 'if-modified-since']) {
      if (req.headers[name]) requestHeaders[name] = req.headers[name];
    }

    await new Promise((resolve) => {
      const upstreamRequest = transport.request(upstreamUrl, { method: req.method, headers: requestHeaders }, (upstream) => {
        const headers = {};
        for (const name of ['content-type', 'cache-control', 'last-modified', 'content-range', 'accept-ranges', 'etag']) {
          const value = upstream.headers[name];
          if (value) headers[name] = value;
        }
        if (upstream.headers['content-length']) headers['content-length'] = upstream.headers['content-length'];
        headers['X-Frame-Options'] = 'SAMEORIGIN';
        if (previewToken) {
          const preview = verifyPreviewToken(previewToken, secret);
          if (preview) {
            const maxAge = Math.max(1, Math.floor((preview.expiresAt - Date.now()) / 1000));
            headers['Set-Cookie'] = serializePreviewCookie(previewToken, maxAge);
          }
        }

        const isHtml = String(upstream.headers['content-type'] || '').includes('text/html');
        if (req.method === 'GET' && isHtml) {
          const chunks = [];
          upstream.on('data', (chunk) => chunks.push(chunk));
          upstream.on('end', () => {
            let html = Buffer.concat(chunks).toString('utf8');
            if (!html.includes('src="/cms-runtime.js"')) {
              html = html.replace(/<\/body\s*>/i, '<script defer src="/cms-runtime.js"></script></body>');
            }
            const output = Buffer.from(html);
            headers['content-length'] = String(output.length);
            res.writeHead(upstream.statusCode || 502, headers);
            res.end(output);
            resolve();
          });
        } else {
          res.writeHead(upstream.statusCode || 502, headers);
          upstream.pipe(res);
          upstream.on('end', resolve);
        }
        upstream.on('error', () => {
          if (!res.headersSent) {
            res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
            res.end('Unable to read the local DeeDee archive.');
          } else {
            res.destroy();
          }
          resolve();
        });
      });
      upstreamRequest.setTimeout(20_000, () => upstreamRequest.destroy(new Error('Archive request timed out')));
      upstreamRequest.on('error', () => {
        if (!res.headersSent) {
          res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
          res.end('The local static DeeDee site is unavailable.');
        } else {
          res.destroy();
        }
        resolve();
      });
      upstreamRequest.end();
    });
  };
}

export function resolveArchiveUrl(requestTarget, archiveOrigin) {
  if (typeof requestTarget !== 'string' || !requestTarget.startsWith('/') || requestTarget.startsWith('//') ||
      requestTarget.includes(String.fromCharCode(92)) || /[\u0000-\u001f\u007f]/.test(requestTarget)) {
    throw new TypeError('Archive request must be a safe origin-relative path');
  }
  const origin = new URL(archiveOrigin);
  const upstreamUrl = new URL(requestTarget, origin);
  if (upstreamUrl.origin !== origin.origin) throw new TypeError('Archive request cannot change origins');
  return upstreamUrl;
}

function originPathHasExtension(pathname) {
  return /\.[A-Za-z0-9]{1,12}$/.test(pathname);
}
