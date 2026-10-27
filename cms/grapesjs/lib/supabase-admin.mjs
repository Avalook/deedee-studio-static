/**
 * Server-side access to the form and comment tables with the Supabase service_role key.
 * The key comes only from the environment (SUPABASE_SERVICE_ROLE_KEY): it is never written to the repository,
 * sent to a browser, or included in an error message.
 */
const SUPABASE_URL = /^https:\/\/[a-z0-9-]{3,63}\.supabase\.co$/;
const ID = /^[a-f0-9-]{36}$/i;
export const PAGE_SIZE = 50;

export const KINDS = {
  forms: { table: 'form_submissions', flag: 'handled' },
  comments: { table: 'comments', flag: 'approved' },
};

export class SupabaseError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export function adminSettings({ env = process.env, configUrl = '' } = {}) {
  const url = String(env.SUPABASE_URL || configUrl || '').replace(/\/+$/, '');
  const key = String(env.SUPABASE_SERVICE_ROLE_KEY || '');
  if (!SUPABASE_URL.test(url) || key.length < 20) return null;
  return { url, key };
}

export function createSupabaseAdmin({ url, key, fetchImpl = globalThis.fetch }) {
  async function request(pathAndQuery, { method = 'GET', body, count = false } = {}) {
    let response;
    try {
      response = await fetchImpl(`${url}/rest/v1/${pathAndQuery}`, {
        method,
        headers: { apikey: key, Authorization: `Bearer ${key}`, ...(body ? { 'Content-Type': 'application/json' } : {}),
          Prefer: [count ? 'count=exact' : '', method === 'PATCH' ? 'return=minimal' : ''].filter(Boolean).join(',') || 'return=minimal' },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(20000),
      });
    } catch { throw new SupabaseError(0, 'Không kết nối được Supabase.'); }
    if (response.status === 401 || response.status === 403) throw new SupabaseError(response.status, 'Supabase từ chối khóa service_role. Kiểm tra SUPABASE_SERVICE_ROLE_KEY.');
    if (response.status === 404) throw new SupabaseError(404, 'Chưa có bảng trong Supabase. Chạy file SQL trong thư mục docs.');
    if (!response.ok) throw new SupabaseError(response.status, `Supabase trả lỗi ${response.status}.`);
    return response;
  }

  const kindOf = (kind) => { if (!KINDS[kind]) throw new SupabaseError(400, 'Loại dữ liệu không hợp lệ.'); return KINDS[kind]; };
  const idOf = (id) => { if (!ID.test(String(id))) throw new SupabaseError(400, 'Mã không hợp lệ.'); return String(id).toLowerCase(); };

  return {
    /** status: 'pending' | 'done' | 'all' */
    async list(kind, { status = 'pending', page = 1, pageSize = PAGE_SIZE } = {}) {
      const { table, flag } = kindOf(kind);
      const offset = (Math.max(1, Number(page) || 1) - 1) * pageSize;
      const filter = status === 'pending' ? `&${flag}=eq.false` : status === 'done' ? `&${flag}=eq.true` : '';
      const response = await request(`${table}?select=*&order=created_at.desc&limit=${pageSize}&offset=${offset}${filter}`, { count: true });
      const items = await response.json();
      const total = Number((response.headers.get('content-range') || '').split('/')[1]);
      return { items: Array.isArray(items) ? items : [], total: Number.isFinite(total) ? total : (Array.isArray(items) ? items.length : 0), page: offset / pageSize + 1, pageSize };
    },
    /** Every row for a CSV export, in bounded pages. */
    async listAll(kind, { status = 'all', max = 5000 } = {}) {
      const rows = [];
      for (let page = 1; rows.length < max; page += 1) {
        const batch = await this.list(kind, { status, page, pageSize: 500 });
        rows.push(...batch.items);
        if (batch.items.length < 500) break;
      }
      return rows.slice(0, max);
    },
    async setDone(kind, id, done) {
      const { table, flag } = kindOf(kind);
      await request(`${table}?id=eq.${idOf(id)}`, { method: 'PATCH', body: { [flag]: Boolean(done) } });
    },
    async remove(kind, id) {
      if (kind !== 'comments') throw new SupabaseError(400, 'Chỉ được xóa bình luận.');
      const { table } = kindOf(kind);
      await request(`${table}?id=eq.${idOf(id)}`, { method: 'DELETE' });
    },
  };
}

const CSV_COLUMNS = {
  forms: ['created_at', 'form_label', 'language', 'page_path', 'name', 'email', 'phone', 'handled', 'fields'],
  comments: ['created_at', 'post_path', 'language', 'author_name', 'body', 'approved'],
};

/** RFC 4180 CSV; cells that a spreadsheet could run as a formula are prefixed with an apostrophe. */
export function toCsv(kind, rows) {
  const columns = CSV_COLUMNS[kind];
  const cell = (value) => {
    let text = value == null ? '' : String(value);
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const flatten = (row, column) => column === 'fields' && Array.isArray(row.fields)
    ? row.fields.map((field) => `${field.label || field.key}: ${field.value}`).join(' | ')
    : row[column];
  return `﻿${[columns.join(','), ...rows.map((row) => columns.map((column) => cell(flatten(row, column))).join(','))].join('\r\n')}\r\n`;
}
