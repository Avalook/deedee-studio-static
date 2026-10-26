import assert from 'node:assert/strict';
import test from 'node:test';
import { findPhoneCountry, PHONE_COUNTRIES, phoneCountrySelection, searchPhoneCountries } from '../scripts/phone-countries.mjs';
import { applyPhoneCountrySelection } from '../scripts/phone-country-selector.mjs';

test('phone country data keeps all 238 Wix choices in source order', () => {
  assert.equal(PHONE_COUNTRIES.length, 238);
  assert.deepEqual(PHONE_COUNTRIES[0], { name: 'Ả-rập Xê-út', code: '+966', flag: 'SAU' });
  assert.deepEqual(PHONE_COUNTRIES.at(-1), { name: 'Zimbabwe', code: '+263', flag: 'ZWE' });
  assert.deepEqual(PHONE_COUNTRIES.find(country => country.name === 'Việt Nam'), { name: 'Việt Nam', code: '+84', flag: 'VNM' });
  assert.ok(PHONE_COUNTRIES.every(country => country.name && /^\+\d{1,4}$/.test(country.code) && /^[A-Z]{3}$/.test(country.flag)));
});

test('country search matches accent-insensitive names and dialing codes', () => {
  assert.deepEqual(searchPhoneCountries('viet nam').map(country => country.name), ['Việt Nam']);
  assert.deepEqual(searchPhoneCountries('VIỆT NAM').map(country => country.code), ['+84']);
  assert.ok(searchPhoneCountries('+84').some(country => country.name === 'Việt Nam'));
  assert.deepEqual(searchPhoneCountries('no matching country'), []);
});

test('country option selection resolves the full row including its Wix flag code', () => {
  assert.deepEqual(findPhoneCountry('Việt Nam', '+84'), { name: 'Việt Nam', code: '+84', flag: 'VNM' });
  assert.equal(findPhoneCountry('Việt Nam', '+1'), null);
});

test('selecting a country updates the trigger code and accessible name', () => {
  const flagImage = { src: '', alt: '', style: {}, dataset: {}, setAttribute() {} };
  const countryIcon = { replaceWith(element) { this.replacement = element; } };
  const codeElement = {
    textContent: '',
    style: {},
    children: [],
    remove() { this.removed = true; },
    replaceChildren(...children) { this.children = children; },
    append(child) { this.children = [...this.children, child]; },
  };
  const attributes = new Map([['aria-label', 'Phone. Chọn mã quốc gia']]);
  const queriedSelectors = [];
  const trigger = {
    ownerDocument: { createElement: tag => tag === 'img' ? flagImage : codeElement },
    dataset: {},
    title: '',
    getAttribute: name => attributes.get(name) ?? null,
    setAttribute: (name, value) => attributes.set(name, value),
    querySelector: selector => { queriedSelectors.push(selector); return selector === '[data-local-country-flag]' ? null : selector === 'svg' ? countryIcon : selector === '[data-local-country-code]' ? codeElement : null; },
    append: element => { if (element !== codeElement) throw new Error('unexpected element'); },
  };

  assert.equal(applyPhoneCountrySelection(trigger, { name: 'Việt Nam', code: '+84', flag: 'VNM' }), true);
  assert.ok(queriedSelectors.includes('svg'));
  assert.equal(countryIcon.replacement, flagImage);
  assert.equal(flagImage.src, 'https://static.parastorage.com/services/linguist-flags/1.1005.0/assets/flags/square/VNM.png');
  assert.equal(flagImage.alt, '');
  assert.equal(trigger.dataset.countryName, 'Việt Nam');
  assert.equal(trigger.dataset.countryCode, '+84');
  assert.equal(attributes.get('aria-label'), 'Phone. Chọn mã quốc gia: Việt Nam +84');
  assert.equal(trigger.title, 'Việt Nam +84');
  assert.equal(applyPhoneCountrySelection(trigger, { name: '', code: '+84' }), false);
  assert.equal(phoneCountrySelection({ name: 'Invalid', code: '84' }), null);
});
