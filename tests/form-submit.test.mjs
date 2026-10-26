import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildSubmission,
  collectFormFields,
  isConfigured,
  messagesFor,
  submitToSupabase,
  validateFields,
} from '../scripts/form-submit.mjs';

const KEY = 'sb_publishable_' + 'x'.repeat(24);

function field({ key, type, label, value = '', required = false, dropdown = false, country }) {
  const control = dropdown ? null : { value, getAttribute: () => null };
  return {
    getAttribute: name => ({ 'data-hook': `form-field-${key}`, 'data-field-type': type })[name],
    querySelector: selector => {
      if (selector.startsWith('input')) return control;
      if (selector === '[data-hook="dropdown-base-text"]') return dropdown ? { textContent: value } : null;
      if (selector === '[data-country-code]') return country ? { dataset: { countryCode: country } } : null;
      if (selector === '[aria-label="required"]') return null;
      return null;
    },
    parentElement: { querySelector: () => ({ textContent: `${label}${required ? '*' : ''}` }) },
  };
}
const formWith = (...fields) => ({
  getAttribute: () => 'Short contact form ',
  querySelectorAll: () => fields,
});

const fields = () => collectFormFields(formWith(
  field({ key: 'ho_ten', type: 'CONTACTS_FIRST_NAME', label: 'Họ tên', value: '  Nguyễn  Văn A ', required: true }),
  field({ key: 'email', type: 'CONTACTS_EMAIL', label: 'Email', value: 'a@b.vn', required: true }),
  field({ key: 'phone', type: 'CONTACTS_PHONE', label: 'SĐT', value: '0903 415 890', country: '+84' }),
  field({ key: 'loai_du_an_1', type: 'DROPDOWN', label: 'Loại dự án', value: 'Short film', required: true, dropdown: true }),
  field({ key: 'mo_ta', type: 'TEXT_AREA', label: 'Mô tả', value: '' }),
  { getAttribute: name => ({ 'data-hook': 'form-field-send', 'data-field-type': 'SUBMIT_BUTTON' })[name], querySelector: () => null, parentElement: null },
));

test('collects labelled values, dropdown choices and the phone country, skipping the submit button', () => {
  const collected = fields();
  assert.deepEqual(collected.map(f => f.key), ['ho_ten', 'email', 'phone', 'loai_du_an_1', 'mo_ta']);
  assert.equal(collected[0].value, 'Nguyễn Văn A');
  assert.equal(collected[0].label, 'Họ tên');
  assert.equal(collected[0].required, true);
  assert.equal(collected[2].country, '+84');
  assert.equal(collected[3].value, 'Short film');
});

test('validation: required, email, phone and link formats, in both languages', () => {
  const list = fields();
  assert.deepEqual(validateFields(list, 'vi'), {});
  const bad = list.map(f => ({ ...f }));
  bad[0].value = '';
  bad[1].value = 'not-an-email';
  bad[2].value = '12';
  assert.deepEqual(validateFields(bad, 'vi'), { ho_ten: messagesFor('vi').required, email: messagesFor('vi').email, phone: messagesFor('vi').phone });
  assert.equal(validateFields(bad, 'en').email, 'Enter a valid email address.');
  assert.equal(validateFields([{ key: 'w', type: 'URL_INPUT', value: 'deedeestudio.net', required: false }], 'en').w, undefined);
  assert.equal(validateFields([{ key: 'w', type: 'URL_INPUT', value: 'not a link', required: false }], 'en').w, 'Enter a valid link.');
  assert.deepEqual(validateFields([{ key: 'n', type: 'TEXT_INPUT', value: '', required: false }], 'vi'), {}, 'optional blanks pass');
});

test('submission row matches the Supabase table and truncates oversized values', () => {
  const row = buildSubmission({ form: formWith(), fields: fields(), language: 'vi', pathname: '/deedee-studio-static/contact-short-form/' });
  assert.deepEqual(Object.keys(row), ['form_label', 'language', 'page_path', 'name', 'email', 'phone', 'fields']);
  assert.equal(row.form_label, 'Short contact form');
  assert.equal(row.phone, '+84 0903 415 890');
  assert.equal(row.name, 'Nguyễn Văn A');
  assert.equal(row.fields.length, 5);
  assert.deepEqual(row.fields[3], { key: 'loai_du_an_1', label: 'Loại dự án', value: 'Short film' });
  const huge = buildSubmission({ form: formWith(), fields: [{ key: 'm', type: 'TEXT_AREA', label: 'm', value: 'x'.repeat(9000) }], language: 'xx', pathname: 'p'.repeat(500) });
  assert.equal(huge.fields[0].value.length, 5000);
  assert.equal(huge.page_path.length, 300);
  assert.equal(huge.language, 'vi');
  assert.equal(huge.name, null);
});

test('only a real *.supabase.co project with a key counts as configured', () => {
  assert.equal(isConfigured({ url: 'https://abcdefghijkl.supabase.co', anonKey: KEY }), true);
  for (const bad of [null, {}, { url: '', anonKey: '' }, { url: 'https://abcdefghijkl.supabase.co', anonKey: 'short' },
    { url: 'http://abcdefghijkl.supabase.co', anonKey: KEY }, { url: 'https://evil.example/x.supabase.co', anonKey: KEY },
    { url: 'https://abcdefghijkl.supabase.co/', anonKey: KEY }]) {
    assert.equal(isConfigured(bad), false, JSON.stringify(bad));
  }
});

test('insert uses the REST endpoint, the anon key and asks for no row back', async () => {
  let call;
  await submitToSupabase({ url: 'https://abcdefghijkl.supabase.co', anonKey: KEY, table: 'form_submissions' }, { name: 'A' }, async (url, options) => { call = { url, options }; return { ok: true }; });
  assert.equal(call.url, 'https://abcdefghijkl.supabase.co/rest/v1/form_submissions');
  assert.equal(call.options.method, 'POST');
  assert.equal(call.options.headers.apikey, KEY);
  assert.equal(call.options.headers.Authorization, `Bearer ${KEY}`);
  assert.equal(call.options.headers.Prefer, 'return=minimal');
  assert.deepEqual(JSON.parse(call.options.body), { name: 'A' });
  await assert.rejects(submitToSupabase({ url: 'https://abcdefghijkl.supabase.co', anonKey: KEY }, {}, async () => ({ ok: false, status: 401 })), /401/);
});
