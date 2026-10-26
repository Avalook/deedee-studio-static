export class HttpError extends Error {
  constructor(status, message, code = 'HTTP_ERROR', details = undefined) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function getClientIp(req) {
  return req.socket?.remoteAddress || 'unknown';
}

export function readBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const declared = Number(req.headers['content-length'] || 0);
    if (declared && declared > maxBytes) {
      reject(new HttpError(413, 'Request body is too large', 'PAYLOAD_TOO_LARGE'));
      return;
    }

    let size = 0;
    let tooLarge = false;
    const chunks = [];
    req.on('data', (chunk) => {
      if (tooLarge) return;
      size += chunk.length;
      if (size > maxBytes) {
        tooLarge = true;
        chunks.length = 0;
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (tooLarge) {
        reject(new HttpError(413, 'Request body is too large', 'PAYLOAD_TOO_LARGE'));
        return;
      }
      resolve(Buffer.concat(chunks));
    });
    req.on('error', reject);
  });
}

export async function readJson(req, maxBytes) {
  const type = String(req.headers['content-type'] || '');
  if (!type.toLowerCase().startsWith('application/json')) {
    throw new HttpError(415, 'Expected application/json', 'UNSUPPORTED_MEDIA_TYPE');
  }
  const body = await readBody(req, maxBytes);
  let parsed;
  try {
    parsed = JSON.parse(body.toString('utf8') || '{}');
  } catch {
    throw new HttpError(400, 'Invalid JSON body', 'INVALID_JSON');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new HttpError(400, 'JSON body must be an object', 'INVALID_JSON');
  }
  return parsed;
}

export function sendJson(res, status, data, headers = {}) {
  const body = Buffer.from(`${JSON.stringify(data)}\n`, 'utf8');
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': body.length,
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(body);
}

export function sendHtml(res, status, html, headers = {}) {
  const body = Buffer.from(html, 'utf8');
  res.writeHead(status, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': body.length,
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(body);
}

export function sendText(res, status, text, headers = {}) {
  const body = Buffer.from(text, 'utf8');
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': body.length,
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(body);
}

export function redirect(res, location, status = 303, headers = {}) {
  res.writeHead(status, { Location: location, 'Cache-Control': 'no-store', ...headers });
  res.end();
}

export function methodNotAllowed(res, allowed) {
  sendJson(
    res,
    405,
    { error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' } },
    { Allow: allowed.join(', ') },
  );
}
