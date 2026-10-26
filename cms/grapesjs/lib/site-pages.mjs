import { createEmptySiteDocument, validateSiteDocument } from './site-document.mjs';

export function normalizePageIdFromUrl(url) {
  const requested = url.searchParams.get('pageId') || '/';
  return validateSiteDocument(createEmptySiteDocument(requested)).pageId;
}

export function siteDocumentFor(revision, pageId = '/') {
  const empty = createEmptySiteDocument(pageId);
  if (!revision || !revision.projectData) return empty;
  try {
    const projectData = revision.projectData;
    if (projectData.pages && projectData.schemaVersion === 1 && !Array.isArray(projectData.pages)) {
      const page = projectData.pages[pageId];
      return page ? validateSiteDocument(page) : empty;
    }
    const legacy = validateSiteDocument(projectData);
    return legacy.pageId === pageId ? legacy : empty;
  } catch {
    return empty;
  }
}

export function withPageDocument(projectData, document) {
  let pages = {};
  if (projectData?.pages && projectData.schemaVersion === 1 && !Array.isArray(projectData.pages)) {
    pages = { ...projectData.pages };
  } else if (projectData) {
    try {
      const legacy = validateSiteDocument(projectData);
      pages[legacy.pageId] = legacy;
    } catch {
      pages['/'] = createEmptySiteDocument('/');
    }
  }
  return { schemaVersion: 1, pages: { ...pages, [document.pageId]: document } };
}

export function manifestRoutes(manifest) {
  return (Array.isArray(manifest.pages) ? manifest.pages : []).map((page) => ({
    route: validateSiteDocument(createEmptySiteDocument(page.route || '/')).pageId,
    title: String(page.title || page.route || '/').slice(0, 180),
  }));
}
