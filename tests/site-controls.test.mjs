import assert from 'node:assert/strict';
import test from 'node:test';
import {
  contactHref,
  installSiteControls,
  loadProjectData,
  observeEmptyWixImages,
  projectPage,
  toggleTestimonial,
  validateProjectData,
} from '../scripts/site-controls.mjs';

test('contact destinations preserve locale and Pages base path', () => {
  assert.equal(contactHref('/en/our-work/'), '/en/contact-us/');
  assert.equal(contactHref('/our-work'), '/contact-us/');
  assert.equal(contactHref('/deedee-studio-static/en/our-work/'), '/deedee-studio-static/en/contact-us/');
  assert.equal(contactHref('/deedee-studio-static/our-work/'), '/deedee-studio-static/contact-us/');
});

test('pagination follows the source six/nine-card batches without mutating data', () => {
  const items = Object.freeze(Array.from({ length: 13 }, (_, index) => String(index)));
  assert.deepEqual(projectPage(items, 6, 6), { items: items.slice(0, 12), count: 12, hasMore: true });
  assert.deepEqual(projectPage(items, 12, 6), { items: [...items], count: 13, hasMore: false });
  assert.equal(projectPage(items, 13, 9).count, 13);
  assert.throws(() => projectPage(items, -1, 6), /pagination/i);
});

test('testimonial expansion preserves text and restores the source clamp', () => {
  const classes = new Set(['iwXk2R']);
  const text = { classList: { toggle(name, enable) { if (enable) classes.add(name); else classes.delete(name); } } };
  const attrs = { 'aria-expanded': 'false' };
  const button = { textContent: 'Show More', dataset: {}, getAttribute: name => attrs[name], setAttribute: (name, value) => { attrs[name] = value; }, closest: () => ({ querySelector: () => text }) };
  assert.equal(toggleTestimonial(button), true);
  assert.equal(attrs['aria-expanded'], 'true');
  assert.equal(button.textContent, 'Show Less');
  assert.ok(!classes.has('iwXk2R'));
  toggleTestimonial(button);
  assert.equal(button.textContent, 'Show More');
  assert.ok(classes.has('iwXk2R'));
  assert.equal(toggleTestimonial({ closest: () => null }), false);
});

test('project data rejects executable markup and invalid shapes', () => {
  const page = { route: '/our-work', panel: 'panel', repeatId: 'repeat', buttonId: 'button', pageSize: 6, items: ['<div role="listitem"><a href="/deedee-studio-static/all-project/test">Test</a></div>'] };
  assert.deepEqual(validateProjectData({ pages: [page] }), [page]);
  for (const markup of ['<script>alert(1)</script>', '<img src="x" onerror="alert(1)">', '<a href="javascript:alert(1)">x</a>', '<iframe src="x"></iframe>']) {
    assert.throws(() => validateProjectData({ pages: [{ ...page, items: [markup] }] }), /project data/i);
  }
  assert.throws(() => validateProjectData({}), /project data/i);
  assert.throws(() => validateProjectData({ pages: [{ ...page, pageSize: 0 }] }), /project data/i);
});

test('project fetch reports unavailable data rather than pretending loading succeeded', async () => {
  await assert.rejects(loadProjectData(async () => ({ ok: false, status: 404 })), /404/);
  assert.deepEqual(await loadProjectData(async () => ({ ok: true, json: async () => ({ pages: [] }) })), []);
});

test('runtime corrects CTA links and delegates native testimonial clicks', async () => {
  const attrs = {};
  const anchor = { setAttribute: (key, value) => { attrs[key] = value; }, removeAttribute: key => { delete attrs[key]; } };
  let click;
  const root = { querySelectorAll: selector => selector.startsWith('wow-image') ? [] : [anchor], addEventListener: (name, fn) => { click = fn; } };
  installSiteControls(root, '/deedee-studio-static/en/our-work');
  assert.equal(attrs.href, '/deedee-studio-static/en/contact-us/');
  let prevented = false;
  const button = { dataset: {}, textContent: 'Show More', getAttribute: () => 'false', setAttribute() {}, closest: () => ({ querySelector: () => ({ classList: { toggle() {} } }) }) };
  await click({ target: { closest: selector => selector.includes('ellipsis') ? button : null }, preventDefault: () => { prevented = true; } });
  assert.equal(button.textContent, 'Show Less');
  assert.ok(prevented);
  await click({ target: {} });
});


test('defers manifest fetch and hydrates only placeholders near the viewport', async () => {
  const makeImage = uri => {
    const image = {
      attrs: {},
      dataset: {},
      style: {},
      getAttribute(name) { return this.attrs[name] ?? null; },
      closest() {
        return { getAttribute: () => JSON.stringify({ imageData: { uri }, displayMode: 'fill' }) };
      },
    };
    return image;
  };
  const first = makeImage('first.jpg');
  const second = makeImage('second.jpg');
  const images = [first, second];
  let callback;
  let options;
  const observed = new Set();
  const unobserved = [];
  class MockObserver {
    constructor(handler, observerOptions) {
      callback = handler;
      options = observerOptions;
    }
    observe(image) { observed.add(image); }
    unobserve(image) { observed.delete(image); unobserved.push(image); }
  }
  const manifest = {
    assets: {
      'https://static.wixstatic.com/media/first.jpg': '/assets/first.webp',
      'https://static.wixstatic.com/media/second.jpg': '/assets/second.webp',
    },
  };
  let fetches = 0;
  const fetchImpl = async () => {
    fetches += 1;
    return { ok: true, json: async () => manifest };
  };
  const root = { querySelectorAll: () => images };

  const observer = observeEmptyWixImages(root, '/mirror', fetchImpl, MockObserver);

  assert.ok(observer);
  assert.equal(options.rootMargin, '1200px 0px');
  assert.deepEqual([...observed], images);
  assert.equal(fetches, 0);
  await callback([{ target: first, isIntersecting: false, intersectionRatio: 0 }]);
  assert.equal(fetches, 0);

  const firstLoad = callback([{ target: first, isIntersecting: true, intersectionRatio: 1 }]);
  const secondLoad = callback([{ target: second, isIntersecting: true, intersectionRatio: 1 }]);
  await Promise.all([firstLoad, secondLoad]);
  assert.equal(fetches, 1);
  assert.equal(first.src, '/mirror/assets/first.webp');
  assert.equal(second.src, '/mirror/assets/second.webp');
  assert.deepEqual(unobserved, images);

});

test('rechecks hidden placeholders after desktop-to-mobile resize and footer scroll', async () => {
  let rect = { top: 0, bottom: 0, width: 0, height: 0 };
  const image = {
    attrs: {},
    dataset: {},
    style: {},
    getAttribute(name) { return this.attrs[name] ?? null; },
    getBoundingClientRect: () => rect,
    closest() {
      return { getAttribute: () => JSON.stringify({ imageData: { uri: 'footer.jpg' } }) };
    },
  };
  let intersectionCallback;
  const handlers = {};
  const frames = [];
  const observed = new Set();
  class MockObserver {
    constructor(handler) { intersectionCallback = handler; }
    observe(target) { observed.add(target); }
    unobserve(target) { observed.delete(target); }
  }
  const viewport = {
    innerHeight: 900,
    addEventListener(type, callback) { handlers[type] = callback; },
    requestAnimationFrame(callback) { frames.push(callback); },
  };
  let fetches = 0;
  const observer = observeEmptyWixImages(
    { querySelectorAll: () => [image] },
    '',
    async () => {
      fetches += 1;
      return {
        ok: true,
        json: async () => ({
          assets: { 'https://static.wixstatic.com/media/footer.jpg': '/assets/footer.webp' },
        }),
      };
    },
    MockObserver,
    viewport,
  );
  const flushFrames = () => frames.splice(0).forEach(callback => callback());

  flushFrames();
  await intersectionCallback([{ target: image, isIntersecting: false, intersectionRatio: 0 }]);
  assert.equal(fetches, 0);
  assert.equal(observed.has(image), true);

  viewport.innerHeight = 844;
  rect = { top: 4800, bottom: 4880, width: 120, height: 80 };
  handlers.resize();
  flushFrames();
  assert.equal(fetches, 0);

  rect = { top: 300, bottom: 380, width: 120, height: 80 };
  handlers.scroll();
  flushFrames();
  await new Promise(resolve => setImmediate(resolve));

  assert.equal(fetches, 1);
  assert.equal(image.src, '/assets/footer.webp');
  assert.equal(observed.has(image), false);
  assert.ok(observer);
});

test('retries a failed manifest request on a later intersection', async () => {
  const image = {
    attrs: {},
    dataset: {},
    style: {},
    getAttribute(name) { return this.attrs[name] ?? null; },
    closest() {
      return { getAttribute: () => JSON.stringify({ imageData: { uri: 'retry.jpg' } }) };
    },
  };
  let callback;
  let calls = 0;
  const observed = new Set();
  class MockObserver {
    constructor(handler) { callback = handler; }
    observe(target) { observed.add(target); }
    unobserve(target) { observed.delete(target); }
  }
  const observer = observeEmptyWixImages(
    { querySelectorAll: () => [image] },
    '',
    async () => {
      calls += 1;
      if (calls === 1) return { ok: false };
      return {
        ok: true,
        json: async () => ({
          assets: { 'https://static.wixstatic.com/media/retry.jpg': '/assets/retry.webp' },
        }),
      };
    },
    MockObserver,
  );

  await callback([{ target: image, isIntersecting: true, intersectionRatio: 1 }]);
  assert.equal(image.src, undefined);
  assert.equal(observed.has(image), true);

  await callback([{ target: image, isIntersecting: true, intersectionRatio: 1 }]);
  assert.equal(calls, 2);
  assert.equal(image.src, '/assets/retry.webp');
  assert.equal(observed.has(image), false);
  assert.ok(observer);
});

test('hydrates all empty placeholders when IntersectionObserver is unavailable', async () => {
  const image = {
    attrs: {},
    dataset: {},
    style: {},
    getAttribute(name) { return this.attrs[name] ?? null; },
    closest() {
      return { getAttribute: () => JSON.stringify({ imageData: { uri: 'fallback.jpg' } }) };
    },
  };
  let fetches = 0;
  const observer = observeEmptyWixImages(
    { querySelectorAll: () => [image] },
    '',
    async () => {
      fetches += 1;
      return {
        ok: true,
        json: async () => ({
          assets: { 'https://static.wixstatic.com/media/fallback.jpg': '/assets/fallback.webp' },
        }),
      };
    },
    undefined,
  );

  await new Promise(resolve => setImmediate(resolve));
  assert.equal(observer, null);
  assert.equal(fetches, 1);
  assert.equal(image.src, '/assets/fallback.webp');
});
