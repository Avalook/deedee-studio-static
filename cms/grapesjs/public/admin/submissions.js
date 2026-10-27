const $ = (id) => document.getElementById(id);
const state = { kind: 'forms', status: 'pending', page: 1, pageSize: 50, total: 0, csrf: '' };
const LABEL = { forms: { done: 'Đã xử lý', undo: 'Chưa xử lý' }, comments: { done: 'Duyệt', undo: 'Bỏ duyệt' } };

function notice(message, kind = 'info') {
  const box = $('notice');
  box.textContent = message; box.dataset.kind = kind; box.hidden = !message;
}

async function api(path, { method = 'GET', body } = {}) {
  const response = await fetch(path, {
    method, credentials: 'same-origin',
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(method === 'GET' ? {} : { 'X-CSRF-Token': state.csrf }) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message || `Lỗi ${response.status}`);
  return payload;
}

const el = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; };
const when = (value) => { const date = new Date(value); return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('vi-VN'); };
const isDone = (item) => (state.kind === 'forms' ? item.handled : item.approved);

function button(label, onClick, className = '') {
  const node = el('button', className, label); node.type = 'button'; node.addEventListener('click', onClick); return node;
}

function renderItem(item) {
  const li = el('li', 'inbox-item'); li.dataset.done = String(isDone(item));
  const head = el('div', 'inbox-head');
  if (state.kind === 'forms') {
    head.append(el('strong', '', item.name || item.email || item.phone || '(không tên)'), el('span', 'inbox-meta', `${item.form_label} · ${item.page_path}`));
  } else {
    head.append(el('strong', '', item.author_name), el('span', 'inbox-meta', item.post_path));
  }
  head.append(el('span', 'inbox-meta', when(item.created_at)));
  li.append(head);
  if (state.kind === 'forms') {
    const list = el('dl', 'inbox-fields');
    for (const field of Array.isArray(item.fields) ? item.fields : []) { list.append(el('dt', '', field.label || field.key), el('dd', '', field.value)); }
    li.append(list);
  } else {
    li.append(el('p', 'inbox-body', item.body));
  }
  const actions = el('div', 'inbox-actions');
  const labels = LABEL[state.kind];
  actions.append(button(isDone(item) ? labels.undo : labels.done, () => act(item, async () => api(`/api/inbox/${state.kind}/${item.id}`, { method: 'PATCH', body: { done: !isDone(item) } }))));
  if (state.kind === 'comments') {
    actions.append(button('Xóa', () => { if (confirm('Xóa bình luận này vĩnh viễn?')) act(item, async () => api(`/api/inbox/comments/${item.id}`, { method: 'DELETE' })); }, 'danger'));
  }
  li.append(actions);
  return li;
}

async function act(item, action) {
  try { await action(); await load(); } catch (error) { notice(error.message, 'error'); }
}

async function load() {
  notice('');
  const query = new URLSearchParams({ kind: state.kind, status: state.status, page: String(state.page) });
  const data = await api(`/api/inbox?${query}`);
  $('setup').hidden = data.configured !== false;
  $('inbox').hidden = data.configured === false;
  if (data.configured === false) return;
  state.total = data.total; state.pageSize = data.pageSize || 50;
  const list = $('list'); list.replaceChildren(...data.items.map(renderItem));
  $('empty').hidden = data.items.length > 0;
  $('count').textContent = `${data.total} mục`;
  const pages = Math.max(1, Math.ceil(data.total / state.pageSize));
  $('page').textContent = `Trang ${state.page}/${pages}`;
  $('prev').disabled = state.page <= 1; $('next').disabled = state.page >= pages;
  $('csv').href = `/api/inbox/export.csv?${new URLSearchParams({ kind: state.kind, status: state.status })}`;
}

function guarded(action) { return () => action().catch((error) => notice(error.message, 'error')); }

async function boot() {
  const session = await fetch('/api/session', { credentials: 'same-origin' });
  if (session.status === 401) { location.href = '/admin/login'; return; }
  const { user, csrf } = await session.json();
  state.csrf = csrf; $('account').textContent = `${user.username} (${user.role})`;
  $('logout').addEventListener('click', async () => { await api('/api/logout', { method: 'POST' }).catch(() => {}); location.href = '/admin/login'; });
  if (!['publisher', 'admin'].includes(user.role)) { notice('Chỉ publisher hoặc admin xem được dữ liệu người dùng gửi.', 'error'); return; }
  document.querySelectorAll('[data-kind]').forEach((tab) => tab.addEventListener('click', guarded(async () => {
    state.kind = tab.dataset.kind; state.page = 1;
    document.querySelectorAll('[data-kind]').forEach((other) => other.setAttribute('aria-selected', String(other === tab)));
    await load();
  })));
  $('status').addEventListener('change', guarded(async () => { state.status = $('status').value; state.page = 1; await load(); }));
  $('prev').addEventListener('click', guarded(async () => { state.page -= 1; await load(); }));
  $('next').addEventListener('click', guarded(async () => { state.page += 1; await load(); }));
  await load();
}

boot().catch((error) => notice(error.message, 'error'));
