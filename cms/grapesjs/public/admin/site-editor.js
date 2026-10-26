(() => {
  'use strict';

  const state = {
    csrf: '',
    user: null,
    revisionId: '',
    pageId: '/',
    routes: [],
    document: { schemaVersion: 1, pageId: '/', operations: [], insertions: [] },
    selection: null,
    dirty: false,
    undo: [],
    redo: [],
    device: 'desktop',
  };
  const byId = (id) => document.getElementById(id);
  const frame = byId('site-frame');
  const status = byId('status');
  const toastBox = byId('toast');
  let toastTimer;

  function toast(message, tone = '') {
    toastBox.textContent = message;
    toastBox.dataset.tone = tone;
    toastBox.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastBox.hidden = true; }, 4000);
  }

  async function api(endpoint, { method = 'GET', body, csrf = false } = {}) {
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (csrf) headers['X-CSRF-Token'] = state.csrf;
    const response = await fetch(endpoint, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'same-origin',
    });
    let payload = null;
    try { payload = await response.json(); } catch { payload = null; }
    if (response.status === 401) {
      location.replace('/admin/login');
      throw new Error('Đăng nhập lại để tiếp tục.');
    }
    if (!response.ok) {
      throw new Error(payload?.error?.message || `Yêu cầu thất bại (${response.status})`);
    }
    return payload;
  }

  function stateEndpoint() { return `/api/site-state?pageId=${encodeURIComponent(state.pageId)}`; }
  function routeFrameUrl(pageId) { return `${pageId === '/' ? '/' : `${pageId}/`}?cms-editor=1`; }

  function setStatus() {
    status.textContent = state.dirty ? 'Có thay đổi chưa lưu' : `Đã lưu · ${state.revisionId.slice(4, 12)}`;
    status.classList.toggle('dirty', state.dirty);
    byId('save').disabled = !state.dirty;
  }

  function sendDocument() {
    frame.contentWindow?.postMessage({ source: 'deedee-cms-admin', type: 'set-document', document: state.document }, location.origin);
  }

  function updateOperation(selector, patch) {
    const previous = state.document;
    state.undo.push(previous);
    state.redo = [];
    const existing = previous.operations.find((operation) => operation.selector === selector) || { selector };
    const merged = { ...existing, ...patch };
    for (const [key, value] of Object.entries(merged)) {
      if (value === undefined) delete merged[key];
    }
    const operations = previous.operations.filter((operation) => operation.selector !== selector);
    if (Object.keys(merged).length > 1) operations.push(merged);
    state.document = { ...previous, operations };
    state.dirty = true;
    setStatus();
    sendDocument();
  }

  function updateOffset(selector, device, x, y) {
    const current = state.document.operations.find((item) => item.selector === selector);
    const offsets = { ...(current?.offsets || {}), [device]: { x, y } };
    updateOperation(selector, { offsets });
    if (state.selection?.selector === selector) state.selection = { ...state.selection, offsets };
  }

  function updateResponsiveStyle(selector, key, value) {
    const current = state.document.operations.find((item) => item.selector === selector);
    const responsive = { ...(current?.responsive || {}) };
    const style = { ...(responsive[state.device] || {}) };
    if (value === undefined) delete style[key];
    else style[key] = value;
    if (Object.keys(style).length) responsive[state.device] = style;
    else delete responsive[state.device];
    updateOperation(selector, { responsive: Object.keys(responsive).length ? responsive : undefined });
    if (state.selection?.selector === selector) state.selection = { ...state.selection, responsive };
  }

  function applyUndo(next, fromUndo) {
    if (fromUndo) {
      state.redo.push(state.document);
      state.document = state.undo.pop();
    } else {
      state.undo.push(state.document);
      state.document = state.redo.pop();
    }
    state.dirty = true;
    setStatus();
    sendDocument();
  }

  function setSelection(selection) {
    state.selection = selection;
    byId('selection-label').textContent = selection ? `${selection.tag} · ${selection.label || selection.selector}` : 'Chưa chọn thành phần';
    byId('text').value = selection?.text ?? '';
    byId('text').disabled = !selection?.editableText;
    byId('href').value = selection?.href || '';
    byId('href').disabled = selection?.tag !== 'a';
    byId('image').value = selection?.image || '';
    byId('image').disabled = selection?.tag !== 'img';
    byId('replace-image').disabled = selection?.tag !== 'img';
    const responsive = selection?.responsive?.[state.device] || {};
    byId('width').value = responsive.width ?? selection?.width ?? '';
    byId('height').value = responsive.height ?? selection?.height ?? '';
    byId('font-size').value = responsive.fontSize ?? selection?.fontSize ?? '';
    byId('color').value = responsive.color || selection?.color || '#111111';
    byId('background').value = responsive.backgroundColor || selection?.backgroundColor || '#ffffff';
    byId('hidden').value = String(Boolean(selection?.hidden));
    const offsets = selection?.offsets?.[state.device] || { x: 0, y: 0 };
    byId('offset-x').value = offsets.x;
    byId('offset-y').value = offsets.y;
  }

  function pushInsertion(type, image = '') {
    const item = {
      id: `add_${crypto.randomUUID()}`,
      type,
      ...(type === 'image' ? { image } : { text: type === 'button' ? 'Liên hệ DeeDee' : 'Thêm nội dung tại đây' }),
      ...(type === 'button' ? { href: '/contact-us' } : {}),
    };
    state.undo.push(state.document);
    state.redo = [];
    state.document = { ...state.document, insertions: [...state.document.insertions, item] };
    state.dirty = true;
    setStatus();
    sendDocument();
    toast('Đã thêm thành phần vào cuối trang; bạn có thể kéo và chỉnh ở khung xem.');
  }

  async function uploadImage(file) {
    const form = new FormData();
    form.append('files', file);
    const response = await fetch('/api/uploads', {
      method: 'POST',
      headers: { 'X-CSRF-Token': state.csrf },
      body: form,
      credentials: 'same-origin',
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error?.message || 'Tải ảnh thất bại.');
    return payload.data?.[0]?.src;
  }

  async function saveDraft() {
    try {
      const result = await api(stateEndpoint(), {
        method: 'PUT',
        csrf: true,
        body: { baseRevisionId: state.revisionId, document: state.document },
      });
      state.revisionId = result.revisionId;
      state.document = result.document;
      state.dirty = false;
      setStatus();
      toast('Đã lưu bản nháp.');
      return true;
    } catch (error) {
      toast(error.message, 'error');
      return false;
    }
  }

  async function previewDraft() {
    if (state.dirty && !(await saveDraft())) return;
    try {
      const result = await api(`/api/versions/${state.revisionId}/preview-token`, { method: 'POST', csrf: true });
      const previewUrl = new URL(result.url, location.origin);
      previewUrl.searchParams.set('pageId', state.pageId);
      window.open(previewUrl.pathname + previewUrl.search, '_blank', 'noopener');
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  async function publishDraft() {
    if (state.user?.role !== 'publisher') return toast('Tài khoản publisher mới được xuất bản.', 'error');
    if (state.dirty && !(await saveDraft())) return;
    if (!window.confirm('Xuất bản các thay đổi này? Trang clone sẽ hiển thị chúng sau khi các file xuất ra được đưa lên GitHub.')) return;
    try {
      const result = await api(`/api/versions/${state.revisionId}/publish`, { method: 'POST', csrf: true });
      const exported = result?.export;
      if (!exported?.enabled) toast('Đã xuất bản trong CMS. Xuất file cho trang tĩnh đang tắt (CMS_EXPORT=0).');
      else if (exported.error) toast(exported.error, 'error');
      else if (exported.gitError) toast(exported.gitError, 'error');
      else if (exported.git?.pushed) toast(`Đã xuất bản và đẩy lên GitHub (${exported.pages} trang). Trang clone cập nhật sau khoảng 1 phút.`);
      else toast(`Đã ghi ${exported.files.length} file cho trang tĩnh (${exported.pages} trang, ${exported.operations} chỉnh sửa). Commit và push chúng để lên GitHub Pages.`);
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  function renderVersions(versions) {
    const list = byId('version-list');
    list.textContent = '';
    for (const version of versions) {
      const row = document.createElement('article');
      row.className = 'version';
      const info = document.createElement('div');
      info.textContent = version.label || 'Bản nháp';
      const meta = document.createElement('small');
      meta.textContent = `${new Date(version.createdAt).toLocaleString('vi-VN')} · ${version.createdBy}${version.isPublished ? ' · Đã xuất bản' : ''}`;
      info.appendChild(meta);
      const actions = document.createElement('div');
      actions.className = 'version-actions';
      const restore = document.createElement('button');
      restore.type = 'button';
      restore.textContent = 'Khôi phục thành nháp';
      restore.disabled = version.isDraft;
      restore.addEventListener('click', async () => {
        try {
          await api(`/api/versions/${version.id}/restore`, { method: 'POST', csrf: true });
          const current = await api(stateEndpoint());
          state.revisionId = current.revisionId;
          state.document = current.document;
          state.dirty = false;
          state.undo = [];
          state.redo = [];
          setStatus();
          sendDocument();
          byId('versions-dialog').close();
          toast('Phiên bản cũ đã được sao chép thành bản nháp mới.');
        } catch (error) { toast(error.message, 'error'); }
      });
      actions.appendChild(restore);
      row.append(info, actions);
      list.appendChild(row);
    }
  }

  async function openVersions() {
    try {
      const result = await api('/api/versions');
      renderVersions(result.versions || []);
      byId('versions-dialog').showModal();
    } catch (error) { toast(error.message, 'error'); }
  }

  function bindControls() {
    byId('save').addEventListener('click', saveDraft);
    byId('preview').addEventListener('click', previewDraft);
    byId('publish').addEventListener('click', publishDraft);
    byId('versions').addEventListener('click', openVersions);
    byId('versions-close').addEventListener('click', () => byId('versions-dialog').close());
    byId('logout').addEventListener('click', async () => {
      try { await api('/api/logout', { method: 'POST', csrf: true }); } catch { /* The session may already be expired. */ }
      location.replace('/admin/login');
    });
    byId('undo').addEventListener('click', () => { if (state.undo.length) applyUndo(null, true); });
    document.querySelectorAll('[data-width]').forEach((button) => button.addEventListener('click', () => {
      document.querySelectorAll('[data-width]').forEach((item) => item.classList.toggle('active', item === button));
      const width = Number(button.dataset.width);
      frame.style.width = `${width}px`;
      state.device = width <= 750 ? 'mobile' : width <= 900 ? 'tablet' : width <= 1200 ? 'laptop' : 'desktop';
      if (state.selection) setSelection(state.selection);
    }));
    document.querySelectorAll('[data-add]').forEach((button) => button.addEventListener('click', () => pushInsertion(button.dataset.add)));
    byId('add-image').addEventListener('click', () => byId('upload').click());
    byId('upload').addEventListener('change', async () => {
      const [file] = byId('upload').files || [];
      if (!file) return;
      try {
        const image = await uploadImage(file);
        if (state.selection?.tag === 'img') updateOperation(state.selection.selector, { image });
        else pushInsertion('image', image);
        toast('Ảnh đã được tải lên thư viện.');
      } catch (error) { toast(error.message, 'error'); }
      byId('upload').value = '';
    });
    byId('replace-image').addEventListener('click', () => byId('upload').click());

    const bindField = (id, key, parse = (value) => value) => byId(id).addEventListener('change', () => {
      if (!state.selection) return;
      const value = byId(id).value;
      updateOperation(state.selection.selector, { [key]: value === '' ? undefined : parse(value) });
    });
    const bindResponsiveField = (id, key, parse = (value) => value) => byId(id).addEventListener('change', () => {
      if (!state.selection) return;
      const value = byId(id).value;
      updateResponsiveStyle(state.selection.selector, key, value === '' ? undefined : parse(value));
    });
    bindField('text', 'text');
    bindField('href', 'href');
    bindField('image', 'image');
    bindResponsiveField('width', 'width', Number);
    bindResponsiveField('height', 'height', Number);
    bindResponsiveField('font-size', 'fontSize', Number);
    bindResponsiveField('color', 'color');
    bindResponsiveField('background', 'backgroundColor');
    byId('hidden').addEventListener('change', () => {
      if (state.selection) updateOperation(state.selection.selector, { hidden: byId('hidden').value === 'true' });
    });
    const updatePosition = () => {
      if (!state.selection) return;
      updateOffset(state.selection.selector, state.device, Number(byId('offset-x').value) || 0, Number(byId('offset-y').value) || 0);
    };
    byId('offset-x').addEventListener('change', updatePosition);
    byId('offset-y').addEventListener('change', updatePosition);

    window.addEventListener('message', (event) => {
      if (event.source !== frame.contentWindow || event.origin !== location.origin || event.data?.source !== 'deedee-cms') return;
      if (event.data.type === 'ready') sendDocument();
      if (event.data.type === 'selected') setSelection(event.data.selection);
      if (event.data.type === 'offset') updateOffset(event.data.selector, event.data.device, event.data.x, event.data.y);
    });
    window.addEventListener('beforeunload', (event) => {
      if (!state.dirty) return;
      event.preventDefault();
      event.returnValue = '';
    });
    byId('route-picker').addEventListener('change', async (event) => {
      if (state.dirty && !(await saveDraft())) {
        event.target.value = state.pageId;
        return;
      }
      state.pageId = event.target.value;
      state.selection = null;
      setSelection(null);
      try {
        const current = await api(stateEndpoint());
        state.revisionId = current.revisionId;
        state.document = current.document;
        state.dirty = false;
        setStatus();
        frame.src = routeFrameUrl(state.pageId);
      } catch (error) { toast(error.message, 'error'); }
    });
    frame.src = routeFrameUrl(state.pageId);
  }

  async function boot() {
    bindControls();
    try {
      const session = await api('/api/session');
      state.csrf = session.csrf;
      state.user = session.user;
      byId('user').textContent = `${session.user.username} · ${session.user.role}`;
      byId('publish').disabled = session.user.role !== 'publisher';
      const routeData = await api('/api/routes');
      state.routes = routeData.routes || [];
      const picker = byId('route-picker');
      for (const route of state.routes) {
        const option = document.createElement('option');
        option.value = route.route;
        option.textContent = `${route.title} · ${route.route}`;
        picker.appendChild(option);
      }
      picker.value = state.pageId;
      const current = await api(stateEndpoint());
      state.revisionId = current.revisionId;
      state.document = current.document;
      setStatus();
    } catch (error) {
      toast(error.message, 'error');
      status.textContent = 'Không tải được bản nháp';
    }
  }

  boot();
})();
