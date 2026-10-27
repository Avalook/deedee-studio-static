const $ = (id) => document.getElementById(id);
let csrf = '';
let me = null;

function notice(message, kind = 'info') {
  const box = $('notice');
  box.textContent = message;
  box.dataset.kind = kind;
  box.hidden = !message;
}

async function api(path, { method = 'GET', body } = {}) {
  const response = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(method === 'GET' ? {} : { 'X-CSRF-Token': csrf }) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message || `Lỗi ${response.status}`);
  return payload;
}

function cell(text) {
  const td = document.createElement('td');
  td.textContent = text;
  return td;
}

function button(label, onClick, className = '') {
  const el = document.createElement('button');
  el.type = 'button';
  el.textContent = label;
  if (className) el.className = className;
  el.addEventListener('click', onClick);
  return el;
}

async function guarded(action, success) {
  try {
    await action();
    if (success) notice(success, 'ok');
  } catch (error) {
    notice(error.message, 'error');
  }
}

function renderUsers(users, roles) {
  const body = $('users-body');
  body.replaceChildren();
  for (const user of users) {
    const row = document.createElement('tr');
    const name = cell(user.username);
    if (user.id === me.id) {
      const tag = document.createElement('span');
      tag.className = 'me';
      tag.textContent = ' (bạn)';
      name.append(tag);
    }
    const roleCell = document.createElement('td');
    const select = document.createElement('select');
    select.setAttribute('aria-label', `Vai trò của ${user.username}`);
    for (const role of roles) select.add(new Option(role, role, false, role === user.role));
    select.disabled = user.id === me.id;
    select.addEventListener('change', () => guarded(async () => { await api(`/api/users/${user.id}`, { method: 'PATCH', body: { role: select.value } }); await load(); }, `Đã đổi vai trò của ${user.username}.`));
    roleCell.append(select);
    const actions = document.createElement('td');
    const wrap = document.createElement('div');
    wrap.className = 'row-actions';
    wrap.append(button('Đặt lại mật khẩu', () => {
      const password = prompt(`Mật khẩu mới cho ${user.username} (từ 12 ký tự):`);
      if (!password) return;
      guarded(() => api(`/api/users/${user.id}`, { method: 'PATCH', body: { password } }), `Đã đổi mật khẩu của ${user.username}; các phiên đăng nhập cũ đã bị đóng.`);
    }));
    if (user.id !== me.id) {
      wrap.append(button('Xóa', () => {
        if (!confirm(`Xóa tài khoản ${user.username}? Không thể hoàn tác.`)) return;
        guarded(async () => { await api(`/api/users/${user.id}`, { method: 'DELETE' }); await load(); }, `Đã xóa ${user.username}.`);
      }, 'danger'));
    }
    actions.append(wrap);
    row.append(name, roleCell, cell(new Date(user.createdAt).toLocaleDateString('vi-VN')), actions);
    body.append(row);
  }
}

async function load() {
  const { users, roles } = await api('/api/users');
  renderUsers(users, roles);
}

async function start() {
  const session = await fetch('/api/session', { credentials: 'same-origin' });
  if (!session.ok) { location.assign('/admin/login'); return; }
  const payload = await session.json();
  csrf = payload.csrf;
  me = payload.user;
  $('account').textContent = `${me.username} · ${me.role}`;
  $('logout').addEventListener('click', () => guarded(async () => { await api('/api/logout', { method: 'POST' }); location.assign('/admin/login'); }));

  if (me.role === 'admin') {
    $('admin-only').hidden = false;
    await guarded(load);
    $('create-form').addEventListener('submit', (event) => {
      event.preventDefault();
      guarded(async () => {
        await api('/api/users', { method: 'POST', body: { username: $('new-username').value, password: $('new-password').value, role: $('new-role').value } });
        $('create-form').reset();
        await load();
      }, 'Đã tạo tài khoản.');
    });
  }

  $('password-form').addEventListener('submit', (event) => {
    event.preventDefault();
    if ($('next-password').value !== $('repeat-password').value) { notice('Hai mật khẩu mới không khớp.', 'error'); return; }
    guarded(async () => {
      await api('/api/account/password', { method: 'POST', body: { currentPassword: $('current-password').value, newPassword: $('next-password').value } });
      $('password-form').reset();
    }, 'Đã đổi mật khẩu. Các phiên đăng nhập khác của bạn đã bị đóng.');
  });
}

start().catch((error) => notice(error.message, 'error'));
