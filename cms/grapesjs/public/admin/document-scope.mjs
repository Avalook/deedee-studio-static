/**
 * Edits can apply to one page or to every page ("site-wide": menu, footer, shared banners).
 * The preview and the published pages show the site-wide document first and the page's own edits on top:
 * for the same component the page's fields win, any field the page does not set still comes from the site-wide edit.
 */
export function mergeDocuments(siteDocument, pageDocument, pageId) {
  const site = siteDocument || { operations: [], insertions: [] };
  const page = pageDocument || { operations: [], insertions: [] };
  const bySelector = new Map(site.operations.map((operation) => [operation.selector, operation]));
  for (const operation of page.operations) {
    bySelector.set(operation.selector, { ...(bySelector.get(operation.selector) || {}), ...operation });
  }
  const seo = { ...(site.seo || {}), ...(page.seo || {}) };
  return {
    schemaVersion: 1,
    pageId,
    operations: [...bySelector.values()],
    insertions: [...(site.insertions || []), ...(page.insertions || [])],
    ...(Object.keys(seo).length ? { seo } : {}),
  };
}

/**
 * Components of the shared header and footer have a different id on every page (comp-<page>_r_comp-<shared>).
 * Site-wide edits address them by the shared part so that they match on every page.
 */
export function portableSelector(selector) {
  return String(selector).replace(/^#comp-[A-Za-z0-9]+(_r_comp-[A-Za-z0-9_-]+)(?= |$|:)/, (_match, shared) => `[id$="${shared}"]`);
}
