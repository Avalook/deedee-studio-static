import sanitizeHtml from 'sanitize-html';
import { renderArticleFromTemplate } from './article-template.mjs';

const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const baseFor = value => /^\/[a-zA-Z0-9/_-]*$/.test(value || '') ? String(value || '').replace(/\/$/, '') : '';

function assetUrl(value, base = '') {
  const url = String(value || '');
  if (/^\/(?!\/)[^\s<>"\\]*$/.test(url)) return base && !url.startsWith(`${base}/`) && url !== base ? `${base}${url}` : url;
  try { const parsed = new URL(url); return parsed.protocol === 'https:' && !parsed.username && !parsed.password ? parsed.href : ''; } catch { return ''; }
}

function bodyMarkup(value, base) {
  return sanitizeHtml(String(value || ''), {
    allowedTags: ['p', 'br', 'h2', 'h3', 'h4', 'strong', 'em', 'u', 's', 'ul', 'ol', 'li', 'blockquote', 'a', 'img', 'figure', 'figcaption', 'hr'],
    allowedAttributes: { a: ['href', 'title', 'rel'], img: ['src', 'alt', 'title', 'loading'] },
    allowedSchemes: ['https', 'mailto', 'tel'], allowProtocolRelative: false,
    transformTags: {
      img: (_tag, attrs) => ({ tagName: 'img', attribs: { src: assetUrl(attrs.src, base), alt: attrs.alt || '', loading: 'lazy' } }),
      a: (_tag, attrs) => ({ tagName: 'a', attribs: { ...attrs, href: attrs.href?.startsWith('/') ? assetUrl(attrs.href, base) : attrs.href, rel: 'noopener noreferrer' } }),
    },
  });
}

function videoEmbed(value) {
  try {
    const url = new URL(value); if (url.protocol !== 'https:') return '';
    let id = '';
    if (url.hostname === 'youtu.be') id = url.pathname.slice(1);
    if (['youtube.com', 'www.youtube.com'].includes(url.hostname)) id = url.pathname === '/watch' ? url.searchParams.get('v') : url.pathname.match(/^\/embed\/([^/]+)$/)?.[1];
    if (/^[\w-]{11}$/.test(id || '')) return `https://www.youtube-nocookie.com/embed/${id}`;
    if (['vimeo.com', 'www.vimeo.com', 'player.vimeo.com'].includes(url.hostname)) {
      const match = url.pathname.match(/^\/(?:video\/)?(\d+)$/); if (match) return `https://player.vimeo.com/video/${match[1]}`;
    }
  } catch { return ''; }
  return '';
}

const STYLES = `*{box-sizing:border-box}body{margin:0;color:#211333;background:#fff;font:17px/1.7 Arial,Helvetica,sans-serif}a{color:#c00087}header,footer{background:#24113c;color:#fff}header{display:flex;align-items:center;justify-content:space-between;gap:24px;padding:22px max(5vw,20px)}header a,footer a{color:inherit;text-decoration:none}.brand{font-size:27px;font-weight:800;letter-spacing:-1px}.brand span{color:#ef27ba}nav{display:flex;flex-wrap:wrap;gap:24px}main{max-width:1120px;margin:auto;padding:48px 24px 80px}.eyebrow{color:#ae0087;font-weight:700;text-transform:uppercase;letter-spacing:.1em;font-size:13px}h1{font-size:clamp(32px,5vw,64px);line-height:1.12;margin:16px 0 24px;overflow-wrap:anywhere}.summary{font-size:clamp(19px,2.5vw,25px);max-width:850px;color:#5b4d65}.byline{color:#706378;font-size:14px}.cover{width:100%;max-height:650px;object-fit:contain;background:#f7f3fa;margin:24px 0 36px;border-radius:4px}.body{max-width:820px;margin:32px auto;overflow-wrap:anywhere}.body h2{line-height:1.3;margin-top:40px}.body img{max-width:100%;height:auto}.body a{text-decoration:underline}.body blockquote{border-left:4px solid #c00087;margin-left:0;padding-left:24px}.meta{display:flex;flex-wrap:wrap;gap:24px;margin:24px 0}.meta div{min-width:140px}.meta dt{font-size:12px;text-transform:uppercase;letter-spacing:.1em;color:#7b668b}.meta dd{margin:4px 0;font-weight:700}.video{aspect-ratio:16/9;margin:36px 0;background:#191021}.video iframe{width:100%;height:100%;border:0}.gallery{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}.gallery img{width:100%;height:auto;align-self:start}.back{display:inline-block;margin:32px 0}footer{padding:40px max(5vw,24px);font-size:14px}footer p{margin:8px 0}a:focus-visible{outline:3px solid #ef27ba;outline-offset:5px}@media(max-width:600px){header{display:block}nav{gap:14px;margin-top:12px;font-size:14px}main{padding:30px 18px 56px}.gallery{grid-template-columns:1fr}.meta{gap:18px}.cover{margin-top:16px}}`;

/** Render one sanitized published snapshot as an independent static detail page. */
export function renderContentPage(item, { basePath = '', siteOrigin = '', templates = null } = {}) {
  // Articles use the site's own article page as their template; projects (and a missing template) use the plain layout below.
  const template = item.type === 'article' ? templates?.[item.language === 'en' ? 'en' : 'vi'] : null;
  if (template) return renderArticleFromTemplate(item, { template, basePath, siteOrigin });
  const base = baseFor(basePath); const en = item.language === 'en'; const locale = en ? '/en' : '';
  const project = item.type === 'project'; const list = project ? '/our-work/' : '/news/';
  const cover = assetUrl(item.cover, base); const video = videoEmbed(item.videoUrl);
  const gallery = (Array.isArray(item.gallery) ? item.gallery : []).map(value => assetUrl(typeof value === 'string' ? value : value?.src, base)).filter(Boolean);
  const services = Array.isArray(item.services) ? item.services.join(', ') : item.services;
  const metadata = project ? [[en ? 'Client' : 'Khách hàng', item.client], [en ? 'Year' : 'Năm', item.year], [en ? 'Services' : 'Dịch vụ', services]].filter(([, value]) => value).map(([label, value]) => `<div><dt>${escape(label)}</dt><dd>${escape(value)}</dd></div>`).join('') : '';
  let canonical = '';
  try { const origin = new URL(siteOrigin); const route = assetUrl(item.route, base); if (origin.protocol === 'https:' && route.startsWith('/')) canonical = `<link rel="canonical" href="${escape(origin.origin + route)}">`; } catch { /* Origin is optional until the site domain is configured. */ }
  return `<!doctype html><html lang="${en ? 'en' : 'vi'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(item.title)} | DeeDee Studio</title><meta name="description" content="${escape(item.summary)}">${canonical}<style>${STYLES}</style></head><body><header><a class="brand" href="${base}${locale}/">DeeDee<span> Studio</span></a><nav aria-label="${en ? 'Main navigation' : 'Điều hướng chính'}"><a href="${base}${locale}/our-work/">${en ? 'Our work' : 'Dự án'}</a><a href="${base}${locale}/news/">${en ? 'News' : 'Tin tức'}</a><a href="${base}${locale}/aboutus/">${en ? 'About us' : 'Giới thiệu'}</a><a href="${base}${locale}/contact-us/">${en ? 'Contact' : 'Liên hệ'}</a></nav></header><main><article><p class="eyebrow">${escape(item.category || (project ? (en ? 'Our work' : 'Dự án') : (en ? 'News' : 'Tin tức')))}</p><h1>${escape(item.title)}</h1><p class="summary">${escape(item.summary)}</p><p class="byline">${escape(item.author || 'DeeDee Studio')}${item.publishedAt ? ` · <time datetime="${escape(item.publishedAt)}">${escape(String(item.publishedAt).slice(0, 10))}</time>` : ''}</p>${cover ? `<img class="cover" src="${escape(cover)}" alt="${escape(item.title)}">` : ''}${metadata ? `<dl class="meta">${metadata}</dl>` : ''}<div class="body">${bodyMarkup(item.bodyHtml, base)}</div>${video ? `<div class="video"><iframe src="${escape(video)}" title="${escape(item.title)}" loading="lazy" allow="fullscreen; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>` : ''}${gallery.length ? `<section class="gallery" aria-label="${en ? 'Project gallery' : 'Thư viện ảnh'}">${gallery.map((url, i) => `<img src="${escape(url)}" alt="${escape(item.title)} — ${i + 1}" loading="lazy">`).join('')}</section>` : ''}<a class="back" href="${base}${locale}${list}">← ${en ? (project ? 'All projects' : 'All news') : (project ? 'Tất cả dự án' : 'Tất cả bài viết')}</a></article></main><footer><strong>DeeDee Animation Studio</strong><p><a href="mailto:contact@deedeestudio.net">contact@deedeestudio.net</a> · (+84) 903 415 890</p><p>© ${new Date().getUTCFullYear()} DeeDee Animation Studio</p></footer></body></html>`;
}
