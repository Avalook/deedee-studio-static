(() => {
  'use strict';

  // One runtime serves the CMS proxy (editor, preview and API-backed public mode) and the published static site.
  // On the static site the page tag carries data-overrides (published JSON) and data-base (path prefix).
  if (window.__deedeeCmsRuntime) return;
  window.__deedeeCmsRuntime = true;
  const script = document.currentScript;
  const overridesUrl = (script && script.dataset.overrides) || '';
  const basePath = (script && script.dataset.base) || '';

  const query = new URLSearchParams(window.location.search);
  const editorMode = query.get('cms-editor') === '1';
  const previewToken = query.get('cmsPreviewToken') || (location.pathname === '/preview' ? query.get('token') : '');
  const originals = new WeakMap();
  const removedOriginals = new Map();
  const routeFromPath = (pathname) => {
    let route = pathname;
    if (basePath && (route === basePath || route.startsWith(`${basePath}/`))) route = route.slice(basePath.length);
    return route.replace(/\/$/, '') || '/';
  };
  const pageId = (query.get('pageId') || routeFromPath(location.pathname));
  let documentModel = { schemaVersion: 1, pageId, operations: [], insertions: [] };
  let selected = null;
  let drag = null;
  let chosenDevice = 'desktop';
  let selectionStyle;
  let interactMode = false;

  function send(type, payload = {}) {
    if (!editorMode || window.parent === window) return;
    window.parent.postMessage({ source: 'deedee-cms', type, ...payload }, location.origin);
  }

  function deviceForWidth(width) {
    if (width <= 750) return 'mobile';
    if (width <= 900) return 'tablet';
    if (width <= 1200) return 'laptop';
    return 'desktop';
  }

  function findTarget(node) {
    if (interactMode) return null;
    const element = node instanceof Element ? node : node && node.parentElement;
    if (!element) return null;
    // Let mobile-navigation.mjs handle hamburger menu interactions in editor mode.
    if (element.closest('button[aria-label="Menu"][aria-haspopup="dialog"]')) return null;
    if (element.closest('[data-hook="hamburger-overlay-root"]')) return null;
    const target = element.closest('[data-cms-added], [id^="comp-"], [id^="SITE_"], h1, h2, h3, h4, p, a, button, img, section, article');
    if (!target || target === document.body || target === document.documentElement) return null;
    if (target.closest('script,style,svg,head')) return null;
    return target;
  }

  function canDelete(element) {
    if (!element || !element.isConnected || element === document.body || element === document.documentElement) return false;
    if (/^(?:SITE_|PAGES_CONTAINER$|masterPage$)/.test(element.id || '')) return false;
    if (element.closest('header,nav,footer,[role="navigation"],#SITE_HEADER,#SITE_FOOTER,[data-cms-protected]')) return false;
    if (['main', 'header', 'nav', 'footer', 'script', 'style', 'head', 'html', 'body'].includes(element.localName)) return false;
    if (element.querySelector('header,nav,main,footer,[role="navigation"],[data-cms-protected],[id^="SITE_"],#PAGES_CONTAINER,#masterPage')) return false;
    return Boolean(element.closest('#SITE_CONTAINER,main,[data-cms-added]'));
  }

  function selectorFor(element) {
    const hasUniqueId = (item) => Boolean(
      item.id &&
      /^[A-Za-z][A-Za-z0-9_-]{0,127}$/.test(item.id) &&
      document.querySelectorAll(`#${item.id}`).length === 1,
    );
    if (hasUniqueId(element)) return `#${element.id}`;
    const added = element.getAttribute('data-cms-added');
    if (added && /^add_[a-f0-9-]{36}$/.test(added)) return `[data-cms-added="${added}"]`;

    const parts = [];
    let current = element;
    while (current && current !== document.documentElement) {
      if (hasUniqueId(current)) {
        parts.unshift(`#${current.id}`);
        break;
      }
      const tag = current.localName;
      const siblings = current.parentElement
        ? Array.from(current.parentElement.childNodes).map((item) => {
          const removed = [...removedOriginals].find(([, anchor]) => anchor === item);
          return removed ? removed[0] : item;
        }).filter((item) => item.localName === tag)
        : [];
      const ordinal = siblings.indexOf(current) + 1;
      parts.unshift(ordinal > 0 ? `${tag}:nth-of-type(${ordinal})` : tag);
      current = current.parentElement;
    }
    return parts.join(' > ');
  }

  function rememberOriginal(element) {
    if (originals.has(element)) return originals.get(element);
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    for (let node = walker.nextNode(); node; node = walker.nextNode()) textNodes.push({ node, value: node.nodeValue });
    const original = {
      textNodes,
      src: element instanceof HTMLImageElement ? element.getAttribute('src') : null,
      href: element instanceof HTMLAnchorElement ? element.getAttribute('href') : null,
      hidden: element.style.display,
      width: element.style.width,
      height: element.style.height,
      fontSize: element.style.fontSize,
      color: element.style.color,
      backgroundColor: element.style.backgroundColor,
      translate: element.style.translate,
    };
    originals.set(element, original);
    return original;
  }

  function restoreOriginal(element) {
    const original = originals.get(element);
    if (!original) return;
    for (const entry of original.textNodes) if (entry.node.isConnected) entry.node.nodeValue = entry.value;
    if (element instanceof HTMLImageElement && original.src !== null) element.setAttribute('src', original.src);
    if (element instanceof HTMLAnchorElement) {
      if (original.href === null) element.removeAttribute('href');
      else element.setAttribute('href', original.href);
    }
    element.style.display = original.hidden;
    element.style.width = original.width;
    element.style.height = original.height;
    element.style.fontSize = original.fontSize;
    element.style.color = original.color;
    element.style.backgroundColor = original.backgroundColor;
    element.style.translate = original.translate;
  }


function isTextEditable(element) {
    if (!element || ['img', 'video', 'iframe', 'input', 'svg'].includes(element.localName)) return false;
    if (element.querySelector('img,video,iframe,input,button,svg')) return false;
    return Boolean((element.innerText || '').trim());
  }

  function setVisibleText(element, value) {
    const groups = [[]];
    const visit = (node) => {
      for (const child of node.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) groups[groups.length - 1].push(child);
        else if (child.nodeType === Node.ELEMENT_NODE && child.tagName === 'BR') groups.push([]);
        else if (child.nodeType === Node.ELEMENT_NODE) visit(child);
      }
    };
    visit(element);
    const original = originals.get(element);
    const originalValues = new Map((original?.textNodes || []).map((entry) => [entry.node, entry.value]));
    const lines = String(value).split(/\r?\n/);
    groups.forEach((nodes, index) => {
      if (!nodes.length) return;
      const line = groups.length > 1 ? (lines[index] || '') : lines.join(' ');
      const weights = nodes.map((node) => Math.max(1, (originalValues.get(node) || node.nodeValue || '').length));
      const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
      let cursor = 0;
      nodes.forEach((node, nodeIndex) => {
        const end = nodeIndex === nodes.length - 1
          ? line.length
          : Math.round(line.length * (weights.slice(0, nodeIndex + 1).reduce((sum, weight) => sum + weight, 0) / totalWeight));
        node.nodeValue = line.slice(cursor, end);
        cursor = end;
      });
    });
    if (!groups.some((nodes) => nodes.length)) element.appendChild(document.createTextNode(String(value).replace(/\r?\n/g, ' ')));
  }

  function restoreTouchedElements() {
    // Restore in reverse removal order so nested nodes and nth-of-type selectors retain identity.
    for (const [element, anchor] of [...removedOriginals].reverse()) {
      if (anchor.parentNode) anchor.parentNode.replaceChild(element, anchor);
      restoreOriginal(element);
    }
    removedOriginals.clear();
    for (const operation of documentModel.operations) {
      let element;
      try { element = document.querySelector(operation.selector); } catch { element = null; }
      if (element) restoreOriginal(element);
    }
    for (const element of document.querySelectorAll('[data-cms-added]')) element.remove();
  }

  function insertComponents(insertions) {
    const root = document.querySelector('#SITE_CONTAINER') || document.body;
    for (const item of insertions || []) {
      const element = document.createElement(item.type === 'image' ? 'img' : item.type === 'video' ? 'video' : item.type === 'button' ? 'a' : 'p');
      element.setAttribute('data-cms-added', item.id);
      element.className = 'deedee-cms-added';
      if (item.type === 'image') {
        element.src = item.image;
        element.alt = item.text || 'Image';
      } else if (item.type === 'video') {
        element.src = item.video;
        element.controls = true;
        element.preload = 'metadata';
        element.setAttribute('playsinline', '');
        element.style.maxWidth = '100%';
      } else {
        element.textContent = item.text;
        if (item.type === 'button') {
          element.href = item.href || '/contact-us';
          element.classList.add('deedee-cms-added--button');
        }
      }
      root.appendChild(element);
    }
  }

  function applyDocument(nextDocument) {
    if (!nextDocument || nextDocument.pageId !== pageId || !Array.isArray(nextDocument.operations)) return;
    restoreTouchedElements();
    documentModel = nextDocument;
    insertComponents(documentModel.insertions);
    if (document.head) applySeo(documentModel.seo);
    const device = deviceForWidth(window.innerWidth);
    // Resolve the full batch before any removal to avoid nth-of-type drift.
    const targets = documentModel.operations.map((operation) => {
      let element;
      try { element = document.querySelector(operation.selector); } catch { element = null; }
      return { operation, element, deletable: canDelete(element) };
    });
    for (const { operation, element } of targets) {
      if (!element) continue;
      rememberOriginal(element);
      if (operation.text !== undefined && isTextEditable(element)) setVisibleText(element, operation.text);
      if (operation.image !== undefined && element instanceof HTMLImageElement) element.src = operation.image;
      if (operation.href !== undefined && element instanceof HTMLAnchorElement) element.setAttribute('href', operation.href);
      if (operation.hidden !== undefined) element.style.display = operation.hidden ? 'none' : '';
      if (operation.width !== undefined) element.style.width = `${operation.width}px`;
      if (operation.height !== undefined) element.style.height = `${operation.height}px`;
      if (operation.fontSize !== undefined) element.style.fontSize = `${operation.fontSize}px`;
      if (operation.color !== undefined) element.style.color = operation.color;
      if (operation.backgroundColor !== undefined) element.style.backgroundColor = operation.backgroundColor;
      const responsiveStyle = operation.responsive?.[device] || {};
      if (responsiveStyle.width !== undefined) element.style.width = `${responsiveStyle.width}px`;
      if (responsiveStyle.height !== undefined) element.style.height = `${responsiveStyle.height}px`;
      if (responsiveStyle.fontSize !== undefined) element.style.fontSize = `${responsiveStyle.fontSize}px`;
      if (responsiveStyle.color !== undefined) element.style.color = responsiveStyle.color;
      if (responsiveStyle.backgroundColor !== undefined) element.style.backgroundColor = responsiveStyle.backgroundColor;
      const offset = operation.offsets && operation.offsets[device];
      if (offset) element.style.translate = `${offset.x}px ${offset.y}px`;
    }
    for (const { operation, element, deletable } of targets) {
      if (operation.deleted !== true || !deletable || !element.parentNode) continue;
      const anchor = document.createComment('cms component removed');
      element.parentNode.replaceChild(anchor, element);
      removedOriginals.set(element, anchor);
    }
    if (selected && !selected.isConnected) { selected.removeAttribute('data-cms-selected'); selected = null; send('selected', { selection: null }); }
  }

  // Same as portableSelector() in public/admin/document-scope.mjs.
  function portableSelector(selector) {
    return String(selector).replace(/^#comp-[A-Za-z0-9]+(_r_comp-[A-Za-z0-9_-]+)(?= |$|:)/, (_match, shared) => `[id$="${shared}"]`);
  }

  function selectedInfo(element) {
    const rect = element.getBoundingClientRect();
    const own = selectorFor(element);
    const operation = documentModel.operations.filter((item) => item.selector === own || item.selector === portableSelector(own))
      .reduce((merged, item) => ({ ...merged, ...item }), {});
    return {
      selector: selectorFor(element),
      deletable: canDelete(element),
      insertionId: element.getAttribute('data-cms-added') || null,
      tag: element.localName,
      label: (element.innerText || element.alt || element.id || element.localName).trim().slice(0, 100),
      text: isTextEditable(element) ? element.innerText : null,
      image: element instanceof HTMLImageElement ? element.getAttribute('src') : null,
      href: element instanceof HTMLAnchorElement ? element.getAttribute('href') : null,
      width: Math.round(rect.width * 100) / 100,
      height: Math.round(rect.height * 100) / 100,
      fontSize: Number.parseFloat(getComputedStyle(element).fontSize) || null,
      color: rgbToHex(getComputedStyle(element).color),
      backgroundColor: rgbToHex(getComputedStyle(element).backgroundColor),
      hidden: getComputedStyle(element).display === 'none',
      offsets: operation.offsets || {},
      responsive: operation.responsive || {},
      editableText: isTextEditable(element),
    };
  }

  function rgbToHex(value) {
    const match = value.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (!match) return '#000000';
    return `#${match.slice(1, 4).map((part) => Number(part).toString(16).padStart(2, '0')).join('')}`;
  }

  function selectElement(element) {
    if (selected) selected.removeAttribute('data-cms-selected');
    selected = element;
    if (selected) {
      rememberOriginal(selected);
      selected.setAttribute('data-cms-selected', 'true');
      send('selected', { selection: selectedInfo(selected) });
    }
  }

  function addSelectionStyles() {
    selectionStyle = document.createElement('style');
    selectionStyle.textContent = '[data-cms-selected="true"]{outline:2px solid #1c93ff!important;outline-offset:2px!important;cursor:move!important}';
    selectionStyle.id = 'deedee-cms-selection-styles';
    document.head.appendChild(selectionStyle);
    document.documentElement.style.setProperty('--deedee-cms-edit-mode', '1');
  }


  function addComponentStyles() {
    const styles = document.createElement('style');
    styles.id = 'deedee-cms-component-styles';
    styles.textContent = '.deedee-cms-added{display:block;max-width:100%;margin:24px auto;padding:16px;color:#161616;font:600 20px/1.4 Arial,sans-serif;background:#f4efff}.deedee-cms-added--button{width:max-content;padding:12px 20px;border-radius:24px;background:#e6008d;color:#fff;text-decoration:none}';
    document.head.appendChild(styles);
  }

  function beginEditor() {
    addSelectionStyles();
    document.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || !event.isPrimary) return;
      const target = findTarget(event.target);
      if (!target) return;
      event.preventDefault();
      event.stopPropagation();
      selectElement(target);
      // pointerdown is prevented for dragging, so focus the canvas explicitly for Delete/Backspace.
      if (!document.body.hasAttribute('tabindex')) document.body.setAttribute('tabindex', '-1');
      document.body.focus({ preventScroll: true });
      const device = deviceForWidth(window.innerWidth);
      chosenDevice = device;
      const info = selectedInfo(target);
      const offset = info.offsets[device] || { x: 0, y: 0 };
      drag = { target, selector: info.selector, x: event.clientX, y: event.clientY, startX: offset.x, startY: offset.y, moved: false };
      target.setPointerCapture(event.pointerId);
    }, true);

    document.addEventListener('pointermove', (event) => {
      if (!drag) return;
      const x = Math.round((drag.startX + event.clientX - drag.x) * 100) / 100;
      const y = Math.round((drag.startY + event.clientY - drag.y) * 100) / 100;
      drag.moved = drag.moved || Math.abs(x - drag.startX) > 1 || Math.abs(y - drag.startY) > 1;
      drag.target.style.translate = `${x}px ${y}px`;
    }, true);

    document.addEventListener('pointerup', () => {
      if (!drag) return;
      if (drag.moved) {
        const x = Number.parseFloat(drag.target.style.translate.split(' ')[0]) || 0;
        const y = Number.parseFloat(drag.target.style.translate.split(' ')[1]) || 0;
        send('offset', { selector: drag.selector, device: chosenDevice, x, y });
      }
      drag = null;
    }, true);

    document.addEventListener('click', (event) => {
      if (event.target.closest('[data-cms-selected="true"]')) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, true);

    window.addEventListener('message', (event) => {
      if (event.source !== window.parent || event.origin !== location.origin || !event.data || event.data.source !== 'deedee-cms-admin') return;
      if (event.data.type === 'set-document') applyDocument(event.data.document);
      if (event.data.type === 'set-interact-mode') {
        interactMode = Boolean(event.data.interact);
        if (selectionStyle) selectionStyle.disabled = interactMode;
        if (interactMode && selected) { selected.removeAttribute('data-cms-selected'); selected = null; send('selected', { selection: null }); }
        document.documentElement.style.setProperty('--deedee-cms-edit-mode', interactMode ? '0' : '1');
      }
      if (event.data.type === 'select' && typeof event.data.selector === 'string') {
        let element;
        try { element = document.querySelector(event.data.selector); } catch { element = null; }
        if (element) selectElement(element);
      }
    });
    document.addEventListener('keydown', (event) => {
      if (!selected || !canDelete(selected) || !['Delete', 'Backspace'].includes(event.key) || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      if (event.target.closest('input,textarea,select,button,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[role="dialog"],dialog')) return;
      event.preventDefault();
      send('delete-component', { selection: selectedInfo(selected) });
    });
    send('ready');
  }

  // Edits saved for "every page" live under the page id '*'; the page's own edits win field by field.
  // Keep in step with public/admin/document-scope.mjs, which the editor preview uses.
  function mergeDocuments(site, page) {
    const bySelector = new Map(((site && site.operations) || []).map((operation) => [operation.selector, operation]));
    for (const operation of (page && page.operations) || []) {
      bySelector.set(operation.selector, { ...(bySelector.get(operation.selector) || {}), ...operation });
    }
    const seo = { ...((site && site.seo) || {}), ...((page && page.seo) || {}) };
    return {
      schemaVersion: 1,
      pageId,
      operations: [...bySelector.values()],
      insertions: [...((site && site.insertions) || []), ...((page && page.insertions) || [])],
      ...(Object.keys(seo).length ? { seo } : {}),
    };
  }

  // Title, description, share image and noindex. Published pages also carry these in their own <head>
  // (written at publish time); this keeps the live preview and API-backed mode in step.
  const seoOriginals = new Map();
  function setMeta(attr, name, content) {
    let tag = document.head.querySelector(`meta[${attr}="${name}"]`);
    if (!seoOriginals.has(`${attr}:${name}`)) seoOriginals.set(`${attr}:${name}`, tag ? tag.getAttribute('content') : null);
    if (content === undefined) {
      const original = seoOriginals.get(`${attr}:${name}`);
      if (tag && original === null) tag.remove();
      else if (tag) tag.setAttribute('content', original);
      return;
    }
    if (!tag) { tag = document.createElement('meta'); tag.setAttribute(attr, name); document.head.appendChild(tag); }
    tag.setAttribute('content', content);
  }
  function applySeo(seo = {}) {
    if (!seoOriginals.has('title')) seoOriginals.set('title', document.title);
    document.title = seo.title !== undefined ? seo.title : seoOriginals.get('title');
    setMeta('name', 'description', seo.description);
    setMeta('property', 'og:title', seo.title);
    setMeta('property', 'og:description', seo.description);
    setMeta('name', 'twitter:title', seo.title);
    setMeta('name', 'twitter:description', seo.description);
    setMeta('property', 'og:image', seo.image);
    setMeta('name', 'twitter:image', seo.image);
    setMeta('name', 'robots', seo.noindex ? 'noindex,nofollow' : undefined);
  }

  function pageFromOverrides(payload) {
    const pages = payload && payload.pages;
    if (!pages || typeof pages !== 'object') return null;
    // Non-ASCII routes are stored decoded by the editor but location.pathname is percent-encoded.
    let decoded = pageId;
    try { decoded = decodeURI(pageId); } catch { /* keep the raw route */ }
    const own = pages[decoded] || pages[pageId] || null;
    const shared = pages['*'] || null;
    return own || shared ? mergeDocuments(shared, own) : null;
  }

  async function bootStatic() {
    try {
      const response = await fetch(overridesUrl, { cache: 'no-cache' });
      if (!response.ok) return;
      const published = pageFromOverrides(await response.json());
      if (published) applyDocument({ ...published, pageId });
    } catch {
      // No published overrides: the archived page is shown as captured.
    }
  }

  async function bootPublic() {
    try {
      const endpoint = previewToken
        ? `/api/site-state/preview?token=${encodeURIComponent(previewToken)}&pageId=${encodeURIComponent(pageId)}`
        : `/api/site-state/public?pageId=${encodeURIComponent(pageId)}`;
      const siteEndpoint = endpoint.replace(/pageId=[^&]*/, 'pageId=%2A');
      const [response, siteResponse] = await Promise.all([
        fetch(endpoint, { credentials: 'same-origin' }),
        fetch(siteEndpoint, { credentials: 'same-origin' }).catch(() => null),
      ]);
      if (!response.ok) return;
      const payload = await response.json();
      const sitePayload = siteResponse && siteResponse.ok ? await siteResponse.json().catch(() => null) : null;
      if (payload && payload.document) applyDocument(mergeDocuments(sitePayload && sitePayload.document, payload.document));
    } catch {
      // The static archive remains usable if the optional local CMS is offline.
    }
  }

  addComponentStyles();

  window.addEventListener('resize', () => {
    applyDocument(documentModel);
    if (editorMode && selected) send('selected', { selection: selectedInfo(selected) });
  });

  if (editorMode) beginEditor();
  else if (overridesUrl) {
    bootStatic();
    // Re-apply once the page's own scripts (galleries, ticker) have finished building the DOM.
    window.addEventListener('load', () => { if (documentModel.operations.length || documentModel.insertions.length) applyDocument(documentModel); }, { once: true });
  } else bootPublic();
})();
