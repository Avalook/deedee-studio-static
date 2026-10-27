/** Authorable fields are explicit so API metadata is never written back. */
const FIELDS = ['type', 'language', 'slug', 'title', 'summary', 'cover', 'bodyHtml', 'category', 'featured', 'author', 'publishedAt', 'client', 'year', 'services', 'videoUrl', 'gallery'];

/** Return an independent unsaved document. */
export function blankContent(type = 'article', language = 'vi') {
  return { type, language, slug: '', title: '', summary: '', cover: '', bodyHtml: '', category: '', featured: false, author: '', publishedAt: '', client: '', year: '', services: '', videoUrl: '', gallery: [] };
}

/** Make a portable ASCII slug from a Vietnamese title. */
export function slugify(value) {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100).replace(/-+$/g, '');
}

/** Strip status/revision fields without changing the source draft. */
export function contentPayload(item) {
  return Object.fromEntries(FIELDS.filter(key => key !== 'publishedAt' || Boolean(item.publishedAt)).map(key => [key, key === 'gallery' ? [...(item.gallery || [])] : item[key]]));
}

/** Describe publication state without confusing a saved draft with live content. */
export function publicationLabel(item) {
  if (item.isPublished && item.hasUnpublishedChanges) return 'Có thay đổi chưa xuất bản';
  return item.isPublished ? 'Đã xuất bản' : 'Bản nháp';
}

/** Wrap editor selection in supported markup, preserving the selection. */
export function wrapSelection(value, start, end, tag) {
  const defaults = { p: 'Nội dung đoạn', h2: 'Tiêu đề', h3: 'Tiêu đề phụ', strong: 'Chữ đậm', em: 'Chữ nghiêng', blockquote: 'Trích dẫn' };
  if (!Object.hasOwn(defaults, tag)) throw new Error('Kiểu định dạng không được hỗ trợ.');
  const selected = value.slice(start, end) || defaults[tag];
  const open = `<${tag}>`;
  return { value: `${value.slice(0, start)}${open}${selected}</${tag}>${value.slice(end)}`, start: start + open.length, end: start + open.length + selected.length };
}

/** Build the authenticated API client, with fetch injected for deterministic tests. */
export function createContentClient(fetcher, csrf) {
  async function request(path, { method = 'GET', body, multipart = false } = {}) {
    const headers = method === 'GET' ? {} : { 'X-CSRF-Token': csrf };
    if (body !== undefined && !multipart) headers['Content-Type'] = 'application/json';
    const response = await fetcher(path, { method, headers, credentials: 'same-origin', body: body === undefined ? undefined : multipart ? body : JSON.stringify(body) });
    let result;
    try { result = await response.json(); } catch { result = null; }
    if (!response.ok) {
      const error = new Error(response.status === 401 ? 'Đăng nhập lại để tiếp tục.' : result?.error?.message || `Yêu cầu thất bại (${response.status}).`);
      error.status = response.status;
      throw error;
    }
    return result;
  }
  return {
    list: () => request('/api/content'),
    get: id => request(`/api/content/${encodeURIComponent(id)}`),
    save: (id, item) => request(id ? `/api/content/${encodeURIComponent(id)}` : '/api/content', { method: id ? 'PUT' : 'POST', body: { item: contentPayload(item) } }),
    publish: id => request(`/api/content/${encodeURIComponent(id)}/publish`, { method: 'POST' }),
    unpublish: id => request(`/api/content/${encodeURIComponent(id)}/unpublish`, { method: 'POST' }),
    logout: () => request('/api/logout', { method: 'POST' }),
    async upload(file) {
      const form = new FormData();
      form.append('files', file);
      const result = await request('/api/uploads', { method: 'POST', body: form, multipart: true });
      if (!result?.data?.[0]?.src) throw new Error('Máy chủ chưa trả về đường dẫn ảnh.');
      return result.data[0].src;
    },
  };
}
