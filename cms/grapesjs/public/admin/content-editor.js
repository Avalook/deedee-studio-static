import { blankContent, contentPayload, createContentClient, publicationLabel, slugify, wrapSelection } from './content-model.js';

const byId = id => document.getElementById(id);
const fieldNames = Object.keys(blankContent());
let state = { items: [], item: blankContent(), dirty: false, busy: false, user: null, client: null };
let deferredNavigation = null;

function notice(message, tone = 'info') {
  byId('notice').textContent = message;
  byId('notice').dataset.tone = tone;
  byId('notice').hidden = false;
}

function fail(error) {
  notice(error.message || 'Không thể hoàn thành thao tác. Vui lòng thử lại.', 'error');
  if (error.status === 401) location.assign('/admin/login');
}

function setBusy(value) {
  state = { ...state, busy: value };
  document.body.dataset.busy = String(value);
  byId('content-form').inert = value;
  for (const id of ['save', 'preview', 'new-content', 'unpublish']) byId(id).disabled = value;
  byId('publish').disabled = value || state.user?.role !== 'publisher';
}

async function run(action) {
  if (state.busy) return;
  setBusy(true);
  try { await action(); } catch (error) { fail(error); } finally { setBusy(false); }
}

function readFields() {
  return Object.fromEntries(fieldNames.map(name => {
    const input = byId(name);
    const value = name === 'featured' ? input.checked : name === 'gallery' ? input.value.split('\n').map(line => line.trim()).filter(Boolean) : input.value;
    return [name, value];
  }));
}

function setDirty() {
  state = { ...state, dirty: true };
  byId('save-status').textContent = 'Có thay đổi chưa lưu trên máy.';
  updateRoute();
  updateCover();
}

function updateRoute() {
  const language = byId('language').value === 'en' ? '/en' : '';
  const folder = byId('type').value === 'project' ? 'all-project' : 'post';
  byId('route-preview').textContent = `${language}/${folder}/${byId('slug').value || 'duong-dan-noi-dung'}/`;
  byId('project-fields').hidden = byId('type').value !== 'project';
  byId('article-fields').hidden = byId('type').value === 'project';
}

function updateCover() {
  const value = byId('cover').value.trim();
  const safe = /^https:\/\//i.test(value) || /^\/(?:media|assets|deedee-studio-static\/assets)\//.test(value);
  byId('cover-preview').hidden = !safe;
  if (safe) byId('cover-preview').src = value;
  else byId('cover-preview').removeAttribute('src');
}

function showItem(item) {
  state = { ...state, item: { ...blankContent(), ...item }, dirty: false };
  for (const name of fieldNames) {
    if (name === 'featured') byId(name).checked = Boolean(item[name]);
    else byId(name).value = name === 'gallery' ? (item[name] || []).join('\n') : name === 'publishedAt' ? (item[name] || '').slice(0, 10) : item[name] ?? '';
  }
  byId('type').disabled = Boolean(item.id);
  byId('language').disabled = Boolean(item.id);
  byId('slug').disabled = Boolean(item.firstPublishedAt || item.isPublished || item.publishedItem);
  byId('make-slug').disabled = byId('slug').disabled;
  byId('route-lock').hidden = !byId('slug').disabled;
  byId('editor-title').textContent = item.id ? item.title : 'Tạo nội dung mới';
  byId('item-status').textContent = item.id ? publicationLabel(item) : 'Bản nháp mới';
  byId('item-status').dataset.status = item.status || 'draft';
  byId('save-status').textContent = item.id ? 'Đã lưu nháp. Chỉ nội dung đã xuất bản mới xuất hiện trên website.' : 'Điền tiêu đề và đường dẫn để bắt đầu.';
  byId('unpublish').hidden = !item.isPublished || state.user?.role !== 'publisher';
  byId('notice').hidden = true;
  updateRoute();
  updateCover();
  renderList();
}

function filteredItems() {
  const query = byId('search').value.toLocaleLowerCase('vi');
  return state.items.filter(item => (!byId('filter-type').value || item.type === byId('filter-type').value)
    && (!byId('filter-status').value || item.status === byId('filter-status').value)
    && item.title.toLocaleLowerCase('vi').includes(query));
}

function renderList() {
  const list = byId('content-list');
  list.replaceChildren();
  const items = filteredItems();
  byId('list-count').textContent = `${items.length} nội dung`;
  for (const item of items) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `item-card${item.id === state.item.id ? ' is-selected' : ''}`;
    button.dataset.contentId = item.id;
    const meta = document.createElement('span');
    meta.className = 'item-meta';
    meta.textContent = `${item.type === 'project' ? 'DỰ ÁN' : 'BÀI VIẾT'} · ${item.language.toUpperCase()}`;
    const title = document.createElement('strong');
    title.textContent = item.title;
    const status = document.createElement('span');
    status.className = 'item-status';
    status.textContent = publicationLabel(item);
    button.append(meta, title, status);
    button.addEventListener('click', () => navigate(() => run(async () => showItem((await state.client.get(item.id)).item))));
    list.append(button);
  }
  if (!items.length) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = state.items.length ? 'Không có nội dung phù hợp bộ lọc.' : 'Chưa có bài viết hoặc dự án mới. Bấm “Tạo mới” để bắt đầu.';
    list.append(empty);
  }
}

function navigate(action) {
  if (state.busy) return;
  if (!state.dirty) return action();
  deferredNavigation = action;
  byId('leave-dialog').showModal();
}

async function refreshList() {
  const result = await state.client.list();
  state = { ...state, items: result.items };
  renderList();
}

async function saveDraft() {
  if (!byId('content-form').reportValidity()) throw new Error('Kiểm tra tiêu đề, đường dẫn và các trường được đánh dấu.');
  const result = await state.client.save(state.item.id, readFields());
  showItem(result.item);
  await refreshList();
  notice('Đã lưu nháp. Website công khai chưa thay đổi.', 'success');
  return result.item;
}

function insertText(text) {
  const area = byId('bodyHtml');
  area.setRangeText(text, area.selectionStart, area.selectionEnd, 'end');
  area.focus();
  setDirty();
}

function escapeAttribute(value) {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function upload(kind, files) {
  if (!files.length) return;
  for (const file of files) {
    if (file.size > 2 * 1024 * 1024) throw new Error(`Ảnh “${file.name}” vượt quá 2 MB.`);
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) throw new Error('Chỉ hỗ trợ PNG, JPG, WebP hoặc GIF.');
  }
  const uploaded = [];
  for (const file of files) uploaded.push(await state.client.upload(file));
  if (kind === 'cover') byId('cover').value = uploaded[0];
  if (kind === 'gallery') byId('gallery').value = [byId('gallery').value, ...uploaded].filter(Boolean).join('\n');
  if (kind === 'body') insertText(uploaded.map(src => `<figure><img src="${escapeAttribute(src)}" alt=""><figcaption></figcaption></figure>`).join('\n'));
  setDirty();
  notice(`Đã tải ${uploaded.length} ảnh. Bấm “Lưu nháp” để giữ thay đổi.`, 'success');
}

function bindForm() {
  byId('content-form').addEventListener('input', setDirty);
  byId('content-form').addEventListener('change', setDirty);
  byId('content-form').addEventListener('submit', event => { event.preventDefault(); run(saveDraft); });
  byId('title').addEventListener('input', () => {
    if (!state.item.id && !byId('slug').dataset.manual) byId('slug').value = slugify(byId('title').value);
    updateRoute();
  });
  byId('slug').addEventListener('input', () => { byId('slug').dataset.manual = 'true'; });
  byId('make-slug').addEventListener('click', () => { byId('slug').value = slugify(byId('title').value); setDirty(); });
  for (const button of document.querySelectorAll('[data-format]')) button.addEventListener('click', () => {
    const area = byId('bodyHtml');
    const formatted = wrapSelection(area.value, area.selectionStart, area.selectionEnd, button.dataset.format);
    area.value = formatted.value;
    area.focus();
    area.setSelectionRange(formatted.start, formatted.end);
    setDirty();
  });
  byId('insert-list').addEventListener('click', () => insertText('<ul>\n<li>Mục thứ nhất</li>\n<li>Mục thứ hai</li>\n</ul>'));
  for (const kind of ['cover', 'body', 'gallery']) byId(`${kind}-upload`).addEventListener('change', event => {
    const files = Array.from(event.target.files || []);
    run(async () => { await upload(kind, files); event.target.value = ''; });
  });
}

function bindActions() {
  for (const id of ['search', 'filter-type', 'filter-status']) byId(id).addEventListener('input', renderList);
  byId('new-content').addEventListener('click', () => navigate(() => { delete byId('slug').dataset.manual; showItem(blankContent(byId('type').value, byId('language').value)); byId('title').focus(); }));
  byId('preview').addEventListener('click', () => run(async () => {
    const item = state.dirty || !state.item.id ? await saveDraft() : state.item;
    location.assign(`/admin/content/${encodeURIComponent(item.id)}/preview`);
  }));
  byId('publish').addEventListener('click', () => run(async () => {
    const item = state.dirty || !state.item.id ? await saveDraft() : state.item;
    const result = await state.client.publish(item.id);
    showItem(result.item);
    await refreshList();
    notice(result.export?.git?.pushed || result.export?.pushed ? 'Đã xuất bản và gửi thay đổi lên GitHub. Chờ website triển khai bản cập nhật.' : 'Đã xuất bản ra thư mục website trên máy. Nếu chưa bật tự đẩy Git, cần đồng bộ lên GitHub để website công khai cập nhật.', 'success');
  }));
  byId('unpublish').addEventListener('click', () => byId('unpublish-dialog').showModal());
  byId('unpublish-cancel').addEventListener('click', () => byId('unpublish-dialog').close());
  byId('unpublish-confirm').addEventListener('click', () => {
    byId('unpublish-dialog').close();
    run(async () => { const result = await state.client.unpublish(state.item.id); showItem(result.item); await refreshList(); notice('Đã gỡ nội dung khỏi bản xuất bản. Nếu chưa tự đẩy Git, cần đồng bộ lên GitHub.', 'success'); });
  });
  byId('logout').addEventListener('click', () => navigate(() => run(async () => { await state.client.logout(); location.assign('/admin/login'); })));
}

function bindNavigation() {
  byId('leave-cancel').addEventListener('click', () => { byId('leave-dialog').close(); deferredNavigation = null; });
  byId('leave-discard').addEventListener('click', () => { byId('leave-dialog').close(); state = { ...state, dirty: false }; const action = deferredNavigation; deferredNavigation = null; action?.(); });
  byId('leave-save').addEventListener('click', () => run(async () => {
    await saveDraft();
    byId('leave-dialog').close();
    const action = deferredNavigation;
    deferredNavigation = null;
    setBusy(false);
    action?.();
  }));
  for (const link of document.querySelectorAll('a[href]')) link.addEventListener('click', event => {
    if (state.dirty && !event.metaKey && !event.ctrlKey) { event.preventDefault(); navigate(() => location.assign(link.href)); }
  });
  window.addEventListener('beforeunload', event => { if (state.dirty) { event.preventDefault(); event.returnValue = ''; } });
}

async function boot() {
  bindForm();
  bindActions();
  bindNavigation();
  setBusy(true);
  try {
    const response = await fetch('/api/session', { credentials: 'same-origin' });
    if (response.status === 401) { location.assign('/admin/login'); return; }
    if (!response.ok) throw new Error('Không đọc được phiên đăng nhập. Vui lòng tải lại trang.');
    const session = await response.json();
    state = { ...state, user: session.user, client: createContentClient(fetch, session.csrf) };
    byId('account').textContent = `${session.user.username} · ${session.user.role}`;
    byId('role-note').textContent = session.user.role === 'publisher' ? 'Bạn có quyền lưu nháp và xuất bản.' : 'Bạn có quyền lưu nháp. Tài khoản publisher sẽ duyệt và xuất bản.';
    await refreshList();
    const requestedId = new URLSearchParams(location.search).get('id');
    showItem(requestedId ? (await state.client.get(requestedId)).item : blankContent());
  } catch (error) { fail(error); } finally { setBusy(false); }
}

boot();
