/**
 * Contact and project-inquiry forms: validate in the page and store each submission in Supabase.
 *
 * The mirror is a static site, so the browser inserts the row itself through Supabase's REST API with the public
 * `anon` key. Row Level Security (docs/supabase-form-schema.sql) lets that key INSERT only, never read.
 * Until supabase-config.json is filled in, submitting shows an honest "not configured" error instead of pretending.
 */
const BASE_PATH = '/deedee-studio-static';
const SUPABASE_URL = /^https:\/\/[a-z0-9-]{3,63}\.supabase\.co$/;
const COOLDOWN_MS = 15_000;

const TEXT = {
  vi: {
    required: 'Vui lòng điền thông tin này.',
    email: 'Email không hợp lệ.',
    phone: 'Số điện thoại không hợp lệ.',
    url: 'Đường dẫn không hợp lệ.',
    sending: 'Đang gửi…',
    sent: 'Cảm ơn bạn! DeeDee đã nhận được thông tin và sẽ liên hệ sớm.',
    failed: 'Không gửi được. Vui lòng thử lại sau hoặc email contact@deedeestudio.net.',
    notConfigured: 'Form chưa được kết nối nơi nhận dữ liệu. Vui lòng email contact@deedeestudio.net.',
    wait: 'Bạn vừa gửi xong, vui lòng đợi vài giây.',
  },
  en: {
    required: 'This field is required.',
    email: 'Enter a valid email address.',
    phone: 'Enter a valid phone number.',
    url: 'Enter a valid link.',
    sending: 'Sending…',
    sent: 'Thank you! DeeDee has received your message and will get back to you soon.',
    failed: 'Could not send. Please try again later or email contact@deedeestudio.net.',
    notConfigured: 'This form is not connected to a data store yet. Please email contact@deedeestudio.net.',
    wait: 'You just sent a message, please wait a few seconds.',
  },
};

export const messagesFor = language => TEXT[language === 'en' ? 'en' : 'vi'];

export function isConfigured(config) {
  return Boolean(config && SUPABASE_URL.test(String(config.url ?? ''))
    && /^[a-z][a-z0-9_]{0,62}$/.test(config.table || 'form_submissions')
    && publicFormKey(config));
}

/** Return a browser-safe publishable key or legacy anonymous JWT. */
export function publicFormKey(config) {
  const key = config?.publishableKey || config?.anonKey;
  if (typeof key !== 'string') return '';
  if (/^sb_publishable_[A-Za-z0-9_-]{20,}$/.test(key)) return key;
  try {
    const parts = key.split('.');
    if (parts.length !== 3) return '';
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload.role === 'anon' ? key : '';
  } catch {
    return '';
  }
}

const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim();

/** Read every labelled field of a Wix form; custom dropdowns show their choice in dropdown-base-text. */
export function collectFormFields(form) {
  const fields = [];
  for (const wrapper of form.querySelectorAll('[data-hook^="form-field-"][data-field-type]')) {
    const type = wrapper.getAttribute('data-field-type');
    if (type === 'SUBMIT_BUTTON') continue;
    const key = wrapper.getAttribute('data-hook').slice('form-field-'.length);
    const control = wrapper.querySelector('input:not([type="hidden"]), textarea');
    const dropdown = wrapper.querySelector('[data-hook="dropdown-base-text"]');
    const label = wrapper.parentElement?.querySelector('label');
    const labelText = clean(label?.textContent).replace(/\*$/, '').trim();
    // Wix gives a dropdown a plain <div> for its label, with the same text on the button.
    const named = control ?? wrapper.querySelector('[data-hook="dropdown-base"]');
    const country = wrapper.querySelector('[data-country-code]')?.dataset?.countryCode;
    fields.push({
      key,
      type,
      label: labelText || clean(named?.getAttribute?.('aria-label')) || key,
      value: clean(control ? control.value : dropdown?.textContent),
      required: /\*/.test(label?.textContent ?? '') || Boolean(wrapper.querySelector('[aria-label="required"]')),
      country: country ? clean(country) : undefined,
    });
  }
  return fields;
}

export function validateFields(fields, language) {
  const text = messagesFor(language);
  const errors = {};
  for (const field of fields) {
    if (field.required && !field.value) { errors[field.key] = text.required; continue; }
    if (!field.value) continue;
    if (field.type === 'CONTACTS_EMAIL' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(field.value)) errors[field.key] = text.email;
    else if (field.type === 'CONTACTS_PHONE' && field.value.replace(/\D/g, '').length < 6) errors[field.key] = text.phone;
    else if (field.type === 'URL_INPUT' && !/^(https?:\/\/)?[^\s.]+\.[^\s]{2,}$/i.test(field.value)) errors[field.key] = text.url;
  }
  return errors;
}

export function buildSubmission({ form, fields, language, pathname }) {
  const pick = type => fields.find(field => field.type === type);
  const phone = pick('CONTACTS_PHONE');
  return {
    form_label: clean(form.getAttribute?.('aria-label') || 'form').slice(0, 200),
    language: language === 'en' ? 'en' : 'vi',
    page_path: String(pathname ?? '').slice(0, 300),
    name: pick('CONTACTS_FIRST_NAME')?.value.slice(0, 200) || null,
    email: pick('CONTACTS_EMAIL')?.value.slice(0, 320) || null,
    phone: phone?.value ? `${phone.country ? `${phone.country} ` : ''}${phone.value}`.slice(0, 60) : null,
    fields: fields.map(({ key, label, value }) => ({ key, label, value: value.slice(0, 5000) })),
  };
}

export async function submitToSupabase(config, row, fetchImpl = globalThis.fetch) {
  if (!isConfigured(config)) throw new Error('Invalid public form configuration');
  const key = publicFormKey(config);
  const response = await fetchImpl(`${config.url}/rest/v1/${config.table || 'form_submissions'}`, {
    method: 'POST',
    headers: {
      apikey: key,
      ...(key.startsWith('sb_publishable_') ? {} : { Authorization: `Bearer ${key}` }),
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(row),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Supabase answered ${response.status}`);
}

function setMessage(form, kind, message) {
  // Wix forms differ: role=status/alert pairs, or a single aria-live region. Create a holder if there is none.
  let holder = form.querySelector(kind === 'error' ? '[role="alert"], [role="region"][aria-live]' : '[role="status"], [role="region"][aria-live]');
  if (!holder) {
    holder = form.ownerDocument.createElement('div');
    holder.setAttribute('role', kind === 'error' ? 'alert' : 'status');
    form.appendChild(holder);
  }
  let node = holder.querySelector('[data-deedee-form-message]');
  if (!node) {
    node = form.ownerDocument.createElement('p');
    node.setAttribute('data-deedee-form-message', '');
    holder.appendChild(node);
  }
  node.textContent = message;
  node.style.cssText = `margin:12px 0 0;font:600 15px/1.4 inherit;color:${kind === 'error' ? '#c0102f' : '#1f7a3d'};`;
}

function clearMessages(form) {
  form.querySelectorAll('[data-deedee-form-message]').forEach(node => { node.textContent = ''; });
}

function showErrors(form, fields, errors) {
  for (const field of fields) {
    const slot = form.querySelector(`[data-hook="field-error-${field.key}"]`);
    if (!slot) continue;
    slot.textContent = errors[field.key] ?? '';
    if (errors[field.key]) slot.style.cssText = 'color:#c0102f;font-size:13px;margin-top:4px;';
  }
}

let configPromise;
export function loadFormConfig(base, fetchImpl = globalThis.fetch) {
  configPromise ??= fetchImpl(`${base}/supabase-config.json`, { cache: 'no-cache' })
    .then(response => (response.ok ? response.json() : null))
    .catch(() => null);
  return configPromise;
}

export function resetFormConfigCache() { configPromise = undefined; }

export function installFormSubmit(doc = globalThis.document, win = globalThis.window, fetchImpl = globalThis.fetch) {
  if (!doc?.addEventListener || !win?.location) return false;
  const base = win.location.pathname === BASE_PATH || win.location.pathname.startsWith(`${BASE_PATH}/`) ? BASE_PATH : '';
  const language = doc.documentElement?.lang === 'en' ? 'en' : 'vi';
  const text = messagesFor(language);

  for (const form of doc.querySelectorAll('form')) {
    if (form.querySelector('[data-deedee-form-honeypot]') || !form.querySelector('[data-hook="submit-button"]')) continue;
    const trap = doc.createElement('input');
    trap.setAttribute('data-deedee-form-honeypot', '');
    trap.setAttribute('tabindex', '-1');
    trap.setAttribute('autocomplete', 'off');
    trap.setAttribute('aria-hidden', 'true');
    trap.style.cssText = 'position:absolute;left:-9999px;opacity:0;height:0;width:0;';
    form.appendChild(trap);
  }

  doc.addEventListener('click', async event => {
    const button = event.target?.closest?.('form [data-hook="submit-button"]');
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const form = button.closest('form');
    if (form.dataset.deedeeSubmitting === 'true') return;
    clearMessages(form);
    const fields = collectFormFields(form);
    const errors = validateFields(fields, language);
    showErrors(form, fields, errors);
    if (Object.keys(errors).length) {
      form.querySelector(`[data-hook="field-error-${Object.keys(errors)[0]}"]`)?.scrollIntoView?.({ block: 'center' });
      return;
    }
    if (form.querySelector('[data-deedee-form-honeypot]')?.value) { setMessage(form, 'status', text.sent); return; }
    let last = 0;
    try { last = Number(win.localStorage?.getItem('deedee-form-last')) || 0; } catch { /* storage unavailable */ }
    if (Date.now() - last < COOLDOWN_MS) { setMessage(form, 'error', text.wait); return; }
    const config = await loadFormConfig(base, fetchImpl);
    if (!isConfigured(config)) { setMessage(form, 'error', text.notConfigured); return; }

    form.dataset.deedeeSubmitting = 'true';
    const label = button.querySelector('span') ?? button;
    const original = label.textContent;
    label.textContent = text.sending;
    button.setAttribute('aria-disabled', 'true');
    try {
      await submitToSupabase(config, buildSubmission({ form, fields, language, pathname: win.location.pathname }), fetchImpl);
      form.querySelectorAll('input:not([type="hidden"]), textarea').forEach(control => { control.value = ''; });
      form.querySelectorAll('[data-hook="dropdown-base-text"]').forEach(node => { node.textContent = ''; });
      try { win.localStorage?.setItem('deedee-form-last', String(Date.now())); } catch { /* storage unavailable */ }
      setMessage(form, 'status', text.sent);
    } catch {
      setMessage(form, 'error', text.failed);
    } finally {
      label.textContent = original;
      button.setAttribute('aria-disabled', 'false');
      delete form.dataset.deedeeSubmitting;
    }
  }, true);
  return true;
}
