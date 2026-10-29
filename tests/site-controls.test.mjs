import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parseHTML } from 'linkedom';
import {
  contactHref,
  formDropdownOptions,
  installFormDropdowns,
  installSiteControls,
  isLoadMoreLabel,
  loadProjectData,
  observeEmptyWixImages,
  projectPage,
  setProjectMoreVisibility,
  syncScrollbarWidth,
  toggleTestimonial,
  validateProjectData,
} from '../scripts/site-controls.mjs';

test('contact destinations preserve locale and Pages base path', () => {
  assert.equal(contactHref('/en/our-work/'), '/en/contact-us/');
  assert.equal(contactHref('/our-work'), '/contact-us/');
  assert.equal(contactHref('/deedee-studio-static/en/our-work/'), '/deedee-studio-static/en/contact-us/');
  assert.equal(contactHref('/deedee-studio-static/our-work/'), '/deedee-studio-static/contact-us/');
});

test('contact form CTAs keep native navigation to the dedicated form routes', async () => {
  const listeners = new Map();
  const root = {
    addEventListener: (type, handler) => listeners.set(type, [...(listeners.get(type) || []), handler]),
    querySelectorAll: () => [],
    getElementById: () => null,
  };
  installSiteControls(root, '/deedee-studio-static/contact-us/');

  const anchor = { href: '', getAttribute: name => name === 'href' ? anchor.href : null };
  const target = { closest: selector => selector === 'a[data-popupid][href]' ? anchor : null };
  for (const href of [
    '/deedee-studio-static/contact-short-form/',
    '/deedee-studio-static/contact-long-form/',
  ]) {
    anchor.href = href;
    let prevented = false;
    const event = { target, preventDefault: () => { prevented = true; } };
    for (const handler of listeners.get('click') || []) handler(event);
    await Promise.resolve();
    assert.equal(prevented, false);
    assert.equal(anchor.getAttribute('href'), href);
  }
});

test('pagination follows the source six/nine-card batches without mutating data', () => {
  const items = Object.freeze(Array.from({ length: 13 }, (_, index) => String(index)));
  assert.deepEqual(projectPage(items, 6, 6), { items: items.slice(0, 12), count: 12, hasMore: true });
  assert.deepEqual(projectPage(items, 12, 6), { items: [...items], count: 13, hasMore: false });
  assert.equal(projectPage(items, 13, 9).count, 13);
  assert.throws(() => projectPage(items, -1, 6), /pagination/i);
});

test('testimonial expansion preserves text and restores the source clamp', () => {
  const { document } = parseHTML('<div role="listitem"><p class="iwXk2R">Long quote</p><button aria-expanded="false">Show More</button></div>');
  const text = document.querySelector('p');
  const button = document.querySelector('button');
  assert.equal(toggleTestimonial(button), true);
  assert.equal(button.getAttribute('aria-expanded'), 'true');
  assert.equal(button.textContent, 'Show Less');
  assert.ok(!text.classList.contains('iwXk2R'));
  assert.equal(toggleTestimonial(button), true, 'Show Less still finds the expanded text');
  assert.equal(button.textContent, 'Show More');
  assert.ok(text.classList.contains('iwXk2R'));
  assert.equal(toggleTestimonial(button), true, 'and it can be expanded again');
  assert.equal(button.textContent, 'Show Less');
  assert.equal(toggleTestimonial({ closest: () => null }), false);
});

test('completed project lists hide the button and its Wix-styled wrapper', () => {
  const wrapper = { hidden: false, style: { display: 'flex' } };
  const button = { hidden: false, style: { display: 'inline-flex' }, parentElement: wrapper };
  assert.equal(setProjectMoreVisibility(button, false), true);
  assert.equal(button.hidden, true);
  assert.equal(button.style.display, 'none');
  assert.equal(wrapper.hidden, true);
  assert.equal(wrapper.style.display, 'none');
  assert.equal(setProjectMoreVisibility(button, true), true);
  assert.equal(button.hidden, false);
  assert.equal(button.style.display, '');
  assert.equal(wrapper.hidden, false);
  assert.equal(wrapper.style.display, '');
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
  const button = { dataset: {}, textContent: 'Show More', getAttribute: () => 'false', setAttribute() {}, closest: () => ({ querySelector: () => ({ classList: { toggle() {} }, toggleAttribute() {} }) }) };
  await click({ target: { closest: selector => selector.includes('ellipsis') ? button : null }, preventDefault: () => { prevented = true; } });
  assert.equal(button.textContent, 'Show Less');
  assert.ok(prevented);
  await click({ target: {} });
});
test('English Service route matches source content and uses English local navigation', () => {
  const html = readFileSync(new URL('../en/service/index.html', import.meta.url), 'utf8');
  assert.ok(html.includes('<html lang="en">'));
  assert.ok(html.includes('<title>SERVICE | DeeDee Studio</title>'));
  assert.ok(html.includes('rel="canonical" href="/deedee-studio-static/en/service"'));
  assert.ok(html.includes('DeeDee Animation studio offers high-quality animation production services from concept and storyboard to animation and postproduction.'));
  assert.ok(html.includes('TRULY CREATIVE SERVICES'));
  assert.ok(html.includes('INTERNATIONAL STANDARD PIPELINE'));
  assert.ok(html.includes('EXCELLENT PROJECT MANAGEMENT'));
  assert.ok(html.includes('href="/deedee-studio-static/en/our-work/"'));
  assert.ok(html.includes('href="/deedee-studio-static/en/service/"'));
  const galleryTitles = [...html.matchAll(/data-hook="item-title"[^>]*><span>([^<]+)<[/]span>/g)].map(([, title]) => title);
  assert.deepEqual(galleryTitles, [
    'SCRIPT WRITING',
    'STORYBOARD',
    'DIALOGUE RECORDING',
    'CHARACTER DESIGN',
    'VISUAL DEVELOPMENT',
    'HAND-DRAWN ANIMATION',
    'CUT-OUT ANIMATION',
    'HYBRID ANIMATION',
    'COMPOSITING',
    'SOUND DESIGN',
    'EDITING',
  ]);
  assert.equal(galleryTitles.length, 11);
});

test('English About us route is captured with matching page metadata', () => {
  const html = readFileSync(new URL('../en/aboutus/index.html', import.meta.url), 'utf8');
  assert.match(html, /<title>ABOUT US \| DeeDee Studio<\/title>/);
  assert.match(html, /rel="canonical" href="\/deedee-studio-static\/en\/aboutus"/);
  assert.match(html, /ABOUT US/);
});

test('homepage category image links preserve Wix tab queries while text links use the default route', () => {
  const homeHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const expectedImageRoutes = new Map([
    ['Group 625990.png', '/deedee-studio-static/our-work/'],
    ['Group 625993.png', '/deedee-studio-static/our-work/?tab=2'],
    ['Group 625992.png', '/deedee-studio-static/our-work/?tab=3'],
    ['Group 625994.png', '/deedee-studio-static/our-work/?tab=4'],
    ['originals.png', '/deedee-studio-static/our-work/'],
    ['long.png', '/deedee-studio-static/our-work/?tab=2'],
    ['short.png', '/deedee-studio-static/our-work/?tab=3'],
    ['game.png', '/deedee-studio-static/our-work/?tab=4'],
  ]);
  const anchors = [...homeHtml.matchAll(/<a\b[\s\S]*?<\/a>/g)].map(([html]) => html);

  for (const [imageName, expectedHref] of expectedImageRoutes) {
    const linkedImages = anchors.filter((html) => html.includes(`alt=\"${imageName}\"`));
    assert.ok(linkedImages.length > 0, `image link missing for ${imageName}`);
    for (const imageHtml of linkedImages) {
      const href = imageHtml.match(/href=\"([^\"]+)\"/)?.[1];
      assert.equal(href, expectedHref);
    }
  }

  const textLinks = anchors.filter((html) => /<a\b[^>]*>Long-form<\/a>/.test(html));
  assert.ok(textLinks.length > 0);
  assert.ok(textLinks.every((html) => html.includes('href=\"/deedee-studio-static/our-work/\"')));
});

test('project tabs reflect their selected state in the Wix-compatible URL and restore it on load', () => {
  const html = readFileSync(new URL('../our-work/index.html', import.meta.url), 'utf8');

  assert.ok(html.includes("const TAB_QUERY_KEY = 'tab'"), 'the Wix tab query key is the single source for reading and writing');
  assert.ok(html.includes('searchParams.get(TAB_QUERY_KEY)'), 'selected Wix tab query is read on load and on history navigation');
  assert.ok(html.includes('url.searchParams.set(TAB_QUERY_KEY, String(tabNumber(tab)))'), 'selected Wix tab query updates on click');
  assert.ok(html.includes("window.history.pushState({}, '', url)"), 'tab selection updates browser history');
  assert.ok(html.includes("if (tab && tab.getAttribute('aria-selected') !== 'true') activateTab(tab, false)"), 'URL tab selection is restored without rewriting history');
  assert.ok(html.includes("window.addEventListener('popstate', syncTabWithUrl)"), 'back and forward re-apply the URL tab selection');
  assert.ok(!html.includes("searchParams.get('.')"), 'the legacy dot query key is gone');
});

test('mobile homepage hero aligns title and contact links with the Wix viewport measurements', () => {
  const homeHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

  assert.match(homeHtml, /<style id="deedee-mobile-hero-parity">/);
  assert.match(homeHtml, /#comp-ms5wzsh8 h2\.wixui-rich-text__text\{font-size:8vw!important\}/);
  assert.match(homeHtml, /#comp-mqoqnftt1 h2\.wixui-rich-text__text\{font-size:4\.8vw!important\}/);
  assert.match(homeHtml, /#comp-mseh4j1x \.wixui-button__label,#comp-mseh40ur \.wixui-button__label\{font-size:4vw!important\}/);
  assert.doesNotMatch(homeHtml, /#comp-ms5wzsh8\{translate:/);
  assert.doesNotMatch(homeHtml, /#comp-mqoqnftt1\{translate:/);
  assert.doesNotMatch(homeHtml, /#comp-mseh4j1x\{translate:/);
  assert.doesNotMatch(homeHtml, /#comp-mseh40ur\{translate:/);
});

test('desktop vertical menu links preserve the original VI and EN destinations', () => {
  const hrefFor = (file, label) => {
    const html = readFileSync(new URL(file, import.meta.url), 'utf8');
    const navStart = html.indexOf('<nav id="comp-la0k3lsy_r_comp-lbd4oowu"');
    const navEnd = html.indexOf('</nav>', navStart);
    assert.ok(navStart >= 0 && navEnd >= 0, `desktop menu not found in ${file}`);
    const menuHtml = html.slice(navStart, navEnd + '</nav>'.length);
    const match = menuHtml.match(new RegExp('<a[^>]*href="([^"]+)"[^>]*>' + label + '</a>'));
    assert.ok(match, `menu link not found: ${label}`);
    return match[1];
  };

  assert.equal(hrefFor('../index.html', 'Khám phá'), '/deedee-studio-static/blog/');
  assert.equal(hrefFor('../en/index.html', 'About us'), '/deedee-studio-static/en/aboutus/');
  assert.equal(hrefFor('../en/index.html', 'Explore'), '/deedee-studio-static/en/explore/');

  const englishExplore404 = readFileSync(new URL('../en/explore/index.html', import.meta.url), 'utf8');
  assert.match(englishExplore404, /<title>404/);
  assert.match(englishExplore404, /error-page\.css/);
  assert.equal(hrefFor('../en/index.html', 'Service'), '/deedee-studio-static/en/service/');
});


test('local form dropdown choices mirror the live Wix contact forms', () => {
  assert.deepEqual(formDropdownOptions('Loại dự án'), [
    '2D Series',
    '3D / Hybrid Series',
    'Feature Film',
    'Co-production / Co-development',
    'Khác',
  ]);
  assert.deepEqual(formDropdownOptions('Trạng thái dự án'), [
    'Đã có kinh phí / Được phê duyệt',
    'Kêu gọi tài trợ, cần báo giá để thuyết trình',
    'Tìm kiếm đối tác đồng sản xuất',
  ]);
  assert.deepEqual(formDropdownOptions('Thời gian dự kiến bắt đầu'), [
    'Trong 3 tháng tới',
    'Từ 3 - 6 tháng tới',
    'Từ 6 - 12 tháng tới',
  ]);
  assert.deepEqual(formDropdownOptions('Không tồn tại'), []);
  assert.deepEqual(formDropdownOptions('Loại dự án', '/contact-short-form'), [
    'Game cinematic / Trailer',
    'Brand / Commercial animation',
    'Short film',
    'Proof of Concept',
    'Music Video',
    'Khác',
  ]);
  assert.deepEqual(formDropdownOptions('Thời gian dự kiến bắt đầu', '/contact-short-form'), [
    'Trong 3 tháng tới',
    '3 - 6 tháng tới',
    '6 - 12 tháng tới',
  ]);
});

test('form dropdown listeners capture clicks before Wix can stop propagation', () => {
  const registrations = [];
  const root = {
    addEventListener(type, listener, capture) { registrations.push({ type, listener, capture }); },
    querySelectorAll() { return []; },
  };
  installFormDropdowns(root);
  assert.deepEqual(registrations.map(({ type, capture }) => [type, capture]), [
    ['click', true],
    ['keydown', true],
  ]);
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

test('syncScrollbarWidth mirrors the real scrollbar width onto the body like the Wix runtime', () => {
  const props = {};
  const root = { documentElement: { clientWidth: 1425 }, body: { style: { setProperty: (name, value) => { props[name] = value; } } } };
  assert.equal(syncScrollbarWidth(root, { innerWidth: 1440 }), 15);
  assert.equal(props['--scrollbar-width'], '15px');
  root.documentElement.clientWidth = 1440;
  assert.equal(syncScrollbarWidth(root, { innerWidth: 1440 }), 0);
  assert.equal(props['--scrollbar-width'], '0px');
  assert.equal(syncScrollbarWidth({ documentElement: {}, body: null }, { innerWidth: 1440 }), null);
});

test('load-more buttons are recognised in Vietnamese and in both English wordings', () => {
  for (const label of ['Xem thêm', 'See more', 'Show More', 'SEE MORE']) assert.equal(isLoadMoreLabel(label), true, label);
  for (const label of ['Contact us', 'Check out our work', '', null, undefined]) assert.equal(isLoadMoreLabel(label), false, String(label));
});

test('English forms offer the same dropdown choices as the live Wix forms', () => {
  assert.deepEqual(formDropdownOptions('Type of project', '/deedee-studio-static/en/contact-short-form/'),
    ['Game cinematic / Trailer', 'Brand / Commercial animation', 'Short film', 'Proof of Concept', 'Music Video', 'Others']);
  assert.deepEqual(formDropdownOptions('Type of project', '/deedee-studio-static/en/contact-long-form/'),
    ['2D Series', '3D / Hybrid Series', 'Feature Film', 'Co-production / Co-development', 'Others']);
  assert.deepEqual(formDropdownOptions('Current status', '/en/contact-long-form/'),
    ['Have funding already / Greenlit', 'Call for funding, need quotation to pitch', 'Finding co-production partner']);
  assert.deepEqual(formDropdownOptions('Expected timeline to start', '/en/contact-long-form/'), ['In next 3 months', '3 - 6 months', '6 - 12 months']);
  assert.deepEqual(formDropdownOptions('Unknown label', '/en/contact-long-form/'), []);
});
