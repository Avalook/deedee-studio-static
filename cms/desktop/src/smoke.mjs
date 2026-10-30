import { writeFile } from 'node:fs/promises';

/** Used by the release build check only (DEEDEE_SMOKE_REMOTE): edit a page and publish it to a throwaway local remote. */
export async function runSmokeTest({ fetch, origin, csrf, resultFile }) {
  const headers = { 'Content-Type': 'application/json', Origin: origin, 'X-CSRF-Token': csrf };
  const url = `${origin}/api/site-state?pageId=%2Fprivacy-policy`;
  const state = await (await fetch(url, { credentials: 'include' })).json();
  const document = { ...state.document, operations: [{ selector: 'h1', text: 'Smoke test' }] };
  const saved = await fetch(url, { method: 'PUT', credentials: 'include', headers, body: JSON.stringify({ baseRevisionId: state.revisionId, document }) });
  const { revisionId } = await saved.json();
  const published = await fetch(`${origin}/api/versions/${revisionId}/publish`, { method: 'POST', credentials: 'include', headers });
  const body = await published.json();
  const editor = await fetch(`${origin}/admin`, { credentials: 'include' });
  await writeFile(resultFile, JSON.stringify({ saved: saved.status, published: published.status, editor: editor.status, git: body.export?.git ?? null, error: body.error ?? null }));
}
