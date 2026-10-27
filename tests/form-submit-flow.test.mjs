import assert from 'node:assert/strict';
import test from 'node:test';
import { parseHTML } from 'linkedom';
import { installFormSubmit, loadFormConfig, resetFormConfigCache, messagesFor } from '../scripts/form-submit.mjs';

const config = { url: 'https://abcdefghijkl.supabase.co', publishableKey: `sb_publishable_${'x'.repeat(24)}` };

function fixture({ lang = 'en', value = 'Customer', trap = '', storageFails = false } = {}) {
  const { document } = parseHTML(`<html lang="${lang}"><body><form aria-label="Contact">
    <div><label>Name*</label><div data-hook="form-field-name" data-field-type="CONTACTS_FIRST_NAME"><input value="${value}"></div><p data-hook="field-error-name"></p></div>
    <div><label>Email*</label><div data-hook="form-field-email" data-field-type="CONTACTS_EMAIL"><input value="customer@example.com"></div><p data-hook="field-error-email"></p></div>
    <div><label>Project</label><div data-hook="form-field-choice" data-field-type="DROPDOWN"><span data-hook="dropdown-base-text">Animation</span></div></div>
    <button data-hook="submit-button"><span>Send</span></button></form></body></html>`);
  const form = document.querySelector('form');
  const button = form.querySelector('button');
  const stored = new Map();
  let listener;
  const add = document.addEventListener.bind(document);
  document.addEventListener = (type, fn, options) => { if (type === 'click') listener = fn; add(type, fn, options); };
  const win = { location: { pathname: '/deedee-studio-static/en/contact-short-form/' }, localStorage: {
    getItem: key => { if (storageFails) throw new Error('blocked'); return stored.get(key); },
    setItem: (key, val) => { if (storageFails) throw new Error('blocked'); stored.set(key, val); },
  } };
  const calls = [];
  let send = async () => ({ ok: true });
  const fetch = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/supabase-config.json')) return { ok: true, json: async () => config };
    return send(url, options);
  };
  resetFormConfigCache();
  assert.equal(installFormSubmit(document, win, fetch), true);
  form.querySelector('[data-deedee-form-honeypot]').value = trap;
  const click = (target = button) => listener({ target, preventDefault() {}, stopImmediatePropagation() {} });
  return { document, form, button, calls, stored, click, setSend: fn => { send = fn; } };
}

test('contact submission sends actual field data, clears values and enforces a cooldown', async () => {
  const f = fixture();
  await f.click();
  assert.equal(f.calls.length, 2);
  assert.equal(f.calls[0].url, '/deedee-studio-static/supabase-config.json');
  const row = JSON.parse(f.calls[1].options.body);
  assert.equal(row.name, 'Customer');
  assert.equal(row.email, 'customer@example.com');
  assert.equal(row.language, 'en');
  assert.equal(f.form.querySelector('input').value, '');
  assert.equal(f.form.querySelector('[data-hook="dropdown-base-text"]').textContent, '');
  assert.equal(f.form.querySelector('[role="status"]').textContent, messagesFor('en').sent);
  assert.equal(f.button.getAttribute('aria-disabled'), 'false');
  assert.equal(f.button.textContent, 'Send');
  f.form.querySelector('[data-hook="form-field-name"] input').value = 'Again';
  f.form.querySelector('[data-hook="form-field-email"] input').value = 'again@example.com';
  await f.click();
  assert.equal(f.calls.length, 2);
  assert.equal(f.form.querySelector('[role="alert"]').textContent, messagesFor('en').wait);
});

test('invalid contact fields show inline errors and never fetch', async () => {
  const f = fixture({ value: '' });
  let scrolled = false;
  f.form.querySelector('[data-hook="field-error-name"]').scrollIntoView = () => { scrolled = true; };
  await f.click();
  assert.equal(f.calls.length, 0);
  assert.equal(f.form.querySelector('[data-hook="field-error-name"]').textContent, messagesFor('en').required);
  assert.equal(scrolled, true);
  await f.click(f.document.body);
  assert.equal(f.calls.length, 0);
});

test('honeypot submissions do not reach the database', async () => {
  const f = fixture({ trap: 'bot' });
  await f.click();
  assert.equal(f.calls.length, 0);
  assert.equal(f.form.querySelector('[role="status"]').textContent, messagesFor('en').sent);
});

test('network failures preserve entered data and restore the submit button', async () => {
  const f = fixture();
  f.setSend(async () => { throw new Error('offline'); });
  await f.click();
  assert.equal(f.form.querySelector('input').value, 'Customer');
  assert.equal(f.form.querySelector('[role="alert"]').textContent, messagesFor('en').failed);
  assert.equal(f.form.dataset.deedeeSubmitting, undefined);
  assert.equal(f.button.getAttribute('aria-disabled'), 'false');
  assert.equal(f.button.textContent, 'Send');
  f.setSend(async () => ({ ok: true }));
  await f.click();
  assert.equal(f.calls.length, 3, 'retry reuses cached configuration');
  assert.equal(f.form.querySelector('[role="alert"]').textContent, '');
});

test('a pending submission ignores duplicate clicks and succeeds without local storage', async () => {
  const f = fixture({ lang: 'vi', storageFails: true });
  let finish;
  f.setSend(() => new Promise(resolve => { finish = resolve; }));
  const pending = f.click();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.button.getAttribute('aria-disabled'), 'true');
  assert.equal(f.button.textContent, messagesFor('vi').sending);
  await f.click();
  assert.equal(f.calls.length, 2);
  finish({ ok: true });
  await pending;
  assert.equal(f.form.querySelector('[role="status"]').textContent, messagesFor('vi').sent);
});

test('unconfigured services and failed configuration downloads show honest errors', async () => {
  for (const fetch of [async () => ({ ok: false }), async () => { throw new Error('offline'); }, async () => ({ ok: true, json: async () => ({}) })]) {
    const f = fixture();
    resetFormConfigCache();
    await loadFormConfig('', fetch);
    await f.click();
    assert.equal(f.calls.length, 0);
    assert.equal(f.form.querySelector('[role="alert"]').textContent, messagesFor('en').notConfigured);
  }
  assert.equal(installFormSubmit(null, {}), false);
  const f = fixture();
  installFormSubmit(f.document, { location: { pathname: '/' } });
  assert.equal(f.form.querySelectorAll('[data-deedee-form-honeypot]').length, 1);
});
