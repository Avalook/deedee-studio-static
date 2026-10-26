import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);

const RUNTIME_PATTERN = /<script data-deedee-local-runtime>([\s\S]*?)<\/script>/;
const TAB_LABELS = ['Originals', 'Long-form', 'Short-form', 'Game'];

async function readRuntime(pathname) {
  const html = await readFile(new URL(pathname, root), 'utf8');
  const script = RUNTIME_PATTERN.exec(html);
  assert.ok(script, `${pathname} needs the local runtime script`);
  return script[1];
}

class Element {
  constructor(tag, options = {}) {
    this.tagName = String(tag).toUpperCase();
    this.tag = String(tag).toLowerCase();
    this.id = options.id || '';
    this.classes = new Set(options.class ? options.class.split(/\s+/) : []);
    this.attributes = new Map();
    this.children = [];
    this.parentNode = null;
    this.listeners = new Map();
    this.style = {};
    this.dataset = {};
    this.text = options.text || '';
    for (const [name, value] of Object.entries(options.attrs || {})) this.setAttribute(name, value);
  }

  get className() { return [...this.classes].join(' '); }

  get textContent() { return this.text; }

  setAttribute(name, value) {
    if (name === 'id') this.id = String(value);
    else if (name === 'class') this.classes = new Set(String(value).split(/\s+/).filter(Boolean));
    else this.attributes.set(name, String(value));
    return this;
  }

  getAttribute(name) {
    if (name === 'id') return this.id || null;
    if (name === 'class') return this.className || null;
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }

  get classList() {
    return {
      add: (name) => this.classes.add(name),
      remove: (name) => this.classes.delete(name),
      contains: (name) => this.classes.has(name),
      toggle: (name, force) => {
        const on = force === undefined ? !this.classes.has(name) : Boolean(force);
        if (on) this.classes.add(name);
        else this.classes.delete(name);
        return on;
      },
    };
  }

  append(...nodes) {
    for (const node of nodes) {
      node.parentNode = this;
      this.children.push(node);
    }
    return this;
  }

  descendants() {
    return this.children.flatMap((child) => [child, ...child.descendants()]);
  }

  matches(selector) {
    return String(selector).split(',').map((part) => part.trim()).some((part) => {
      const tokens = part.match(/\[[^\]]+\]|#[^\s.[]+|\.[^\s.[]+|^[a-zA-Z][\w-]*/) ?? [];
      return tokens.every((token) => {
        if (token.startsWith('[')) {
          const parsed = /^\[([\w-]+)(?:=["']?([^"'\]]*)["']?)?\]$/.exec(token);
          if (!parsed) return false;
          const value = this.getAttribute(parsed[1]);
          return parsed[2] === undefined ? value !== null : value === parsed[2];
        }
        if (token.startsWith('#')) return this.id === token.slice(1);
        if (token.startsWith('.')) return this.classes.has(token.slice(1));
        return this.tag === token.toLowerCase();
      });
    });
  }

  closest(selector) {
    for (let node = this; node; node = node.parentNode) {
      if (node.matches(selector)) return node;
    }
    return null;
  }

  querySelectorAll(selector) {
    return this.descendants().filter((node) => node.matches(selector));
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  addEventListener(type, handler) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), handler]);
  }

  focus() {}
}

function createDocument() {
  const body = new Element('body');
  const doc = {
    body,
    listeners: new Map(),
    createElement: (tag) => new Element(tag),
    querySelectorAll(selector) {
      return [body, ...body.descendants()].filter((node) => node.matches(selector));
    },
    querySelector(selector) {
      return this.querySelectorAll(selector)[0] ?? null;
    },
    getElementById(id) {
      return this.querySelectorAll(`#${id}`)[0] ?? null;
    },
    addEventListener(type, handler) {
      this.listeners.set(type, [...(this.listeners.get(type) ?? []), handler]);
    },
  };

  // Mirrors the Wix Tabs markup captured on /our-work/: one widget, four tabs, four panels.
  const widget = new Element('div', { class: 'Tabscomponent1176390459__root style-m70n6xh64__root wixui-tabs' });
  const tabList = new Element('div', { class: 'TabsList2027980309__root wixui-tabs__menu-container', attrs: { role: 'tablist' } });
  widget.append(tabList);
  const tabs = [];
  const panels = [];
  TAB_LABELS.forEach((label, index) => {
    const panelId = `comp-panel-${index}`;
    const tab = new Element('div', {
      id: `tab-${panelId}`,
      class: `TabsList2027980309__tab wixui-tabs__item${index === 0 ? ' TabsList2027980309--current' : ''}`,
      text: label,
      attrs: {
        'data-hook': 'tab-item',
        'data-testid': index === 0 ? 'ActiveTabItem' : 'false',
        'data-idx': String(index),
        role: 'tab',
        tabindex: index === 0 ? '0' : '-1',
        'aria-selected': String(index === 0),
        'aria-controls': panelId,
      },
    });
    tabList.append(tab);
    tabs.push(tab);

    const panel = new Element('div', {
      class: 'Tabscomponent1176390459__tabPanelWrapper' + (index === 0 ? ' Tabscomponent1176390459--isVisible' : ''),
      attrs: {
        'data-hook': 'TabPanel',
        role: 'tabpanel',
        'aria-labelledby': tab.id,
        'aria-hidden': String(index !== 0),
      },
    });
    panel.append(new Element('div', { id: panelId }));
    widget.append(panel);
    panels.push(panel);
  });
  body.append(widget);

  return { body, doc, panels, tabs };
}

function createWindow(initialHref) {
  const entries = [initialHref];
  let cursor = 0;
  const win = {
    listeners: new Map(),
    addEventListener(type, handler) {
      win.listeners.set(type, [...(win.listeners.get(type) ?? []), handler]);
    },
    dispatch(type, event = {}) {
      for (const handler of win.listeners.get(type) ?? []) handler(event);
    },
    history: {
      get entries() { return entries; },
      pushState(_state, _title, url) {
        entries.splice(cursor + 1, entries.length, String(url));
        cursor += 1;
      },
      replaceState(_state, _title, url) {
        entries[cursor] = String(url);
      },
      back() {
        if (cursor === 0) return false;
        cursor -= 1;
        win.dispatch('popstate', { state: null });
        return true;
      },
      forward() {
        if (cursor === entries.length - 1) return false;
        cursor += 1;
        win.dispatch('popstate', { state: null });
        return true;
      },
    },
    location: {
      get href() { return entries[cursor]; },
      get search() { return new URL(entries[cursor]).search; },
    },
  };
  return win;
}

async function installRuntime(initialHref) {
  const source = await readRuntime('our-work/index.html');
  const { body, doc, panels, tabs } = createDocument();
  const win = createWindow(initialHref);
  new Function('document', 'window', 'location', 'CSS', 'Element', source)(
    doc,
    win,
    win.location,
    { escape: (value) => String(value) },
    Element,
  );
  const selectedLabel = () => tabs.find((tab) => tab.getAttribute('aria-selected') === 'true')?.text;
  const visiblePanels = () => panels.filter((panel) => panel.classList.contains('Tabscomponent1176390459--isVisible'));
  const click = (target) => {
    const event = { target, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
    for (const handler of doc.listeners.get('click') ?? []) handler(event);
  };
  return { body, click, doc, panels, selectedLabel, tabs, visiblePanels, win };
}

test('the Vi homepage category cards link to the Wix tab query', async () => {
  const html = await readFile(new URL('index.html', root), 'utf8');
  const hrefs = [...html.matchAll(/href="([^"]*\/our-work\/[^"]*tab=\d[^"]*)"/g)].map((match) => match[1]);

  for (const tab of [2, 3, 4]) {
    assert.ok(hrefs.includes(`/deedee-studio-static/our-work/?tab=${tab}`), `missing ?tab=${tab} link`);
  }
  assert.equal(hrefs.length, 6, 'each category card appears twice on the homepage');
});

test('the our-work runtime tab widget exposes one tab per Wix index', async () => {
  const html = await readFile(new URL('our-work/index.html', root), 'utf8');
  const indexes = [...html.matchAll(/data-hook="tab-item"[^>]*data-idx="(\d+)"/g)].map((match) => match[1]);

  assert.deepEqual(indexes, ['0', '1', '2', '3']);
});

test('the our-work runtime uses the Wix tab query key instead of the legacy dot key', async () => {
  const source = await readRuntime('our-work/index.html');

  assert.match(source, /const TAB_QUERY_KEY = 'tab'/);
  assert.match(source, /searchParams\.set\(TAB_QUERY_KEY/);
  assert.match(source, /searchParams\.get\(TAB_QUERY_KEY/);
  assert.doesNotMatch(source, /searchParams\.(?:set|get)\('\.'\)/);
});

test('?tab=2, ?tab=3 and ?tab=4 preselect Long-form, Short-form and Game', async () => {
  const cases = [[2, 'Long-form'], [3, 'Short-form'], [4, 'Game']];
  for (const [tabNumber, label] of cases) {
    const page = await installRuntime(`https://local/deedee-studio-static/our-work/?tab=${tabNumber}`);
    const expectedTabId = page.tabs[tabNumber - 1].id;

    assert.equal(page.selectedLabel(), label, `?tab=${tabNumber} should select ${label}`);
    assert.deepEqual(page.visiblePanels().map((panel) => panel.getAttribute('aria-labelledby')), [expectedTabId],
      `?tab=${tabNumber} should show the ${label} panel`);
    assert.equal(page.win.history.entries.length, 1, `?tab=${tabNumber} must not add a history entry on load`);
  }
});

test('the default selection stays Originals without a query and for unknown tab numbers', async () => {
  for (const query of ['', '?tab=1', '?tab=9', '?tab=Long-form']) {
    const page = await installRuntime(`https://local/deedee-studio-static/our-work/${query}`);

    assert.equal(page.selectedLabel(), 'Originals', `${query || 'no query'} should keep Originals`);
    assert.equal(page.visiblePanels().length, 1, `${query || 'no query'} should show one panel`);
  }
});

test('clicking a category tab writes ?tab=N with the Wix numbering', async () => {
  const page = await installRuntime('https://local/deedee-studio-static/our-work/');

  for (const [index, label] of [[1, 'Long-form'], [2, 'Short-form'], [3, 'Game']]) {
    page.click(page.tabs[index]);

    assert.equal(page.selectedLabel(), label);
    assert.equal(new URL(page.win.location.href).searchParams.get('tab'), String(index + 1), `${label} should publish tab=${index + 1}`);
    assert.equal(new URL(page.win.location.href).searchParams.has('.'), false, 'the legacy dot key must not be written');
  }
});

test('back and forward keep the selected tab in sync with the URL', async () => {
  const page = await installRuntime('https://local/deedee-studio-static/our-work/?tab=2');

  assert.equal(page.selectedLabel(), 'Long-form');
  page.click(page.tabs[3]);
  assert.equal(page.selectedLabel(), 'Game');
  page.click(page.tabs[2]);
  assert.equal(page.selectedLabel(), 'Short-form');

  assert.equal(page.win.history.back(), true);
  assert.equal(page.selectedLabel(), 'Game', 'back restores the ?tab=4 selection');

  assert.equal(page.win.history.back(), true);
  assert.equal(page.selectedLabel(), 'Long-form', 'a second back restores the loaded ?tab=2 selection');

  assert.equal(page.win.history.forward(), true);
  assert.equal(page.selectedLabel(), 'Game', 'forward re-applies ?tab=4');

  page.win.history.pushState({}, '', 'https://local/deedee-studio-static/our-work/');
  page.win.dispatch('popstate', { state: null });
  assert.equal(page.selectedLabel(), 'Originals', 'an empty query falls back to Originals');
});

test('refreshing a selected category keeps that category', async () => {
  const page = await installRuntime('https://local/deedee-studio-static/our-work/');
  page.click(page.tabs[2]);
  const refreshed = await installRuntime(page.win.location.href);

  assert.equal(refreshed.selectedLabel(), 'Short-form');
});
