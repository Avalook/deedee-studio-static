import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { repairBackgrounds } from './backgrounds.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sources = {
  '7181ac_cdb39d9a44de432aa1512b03efc83681~mv2.png': '/assets/home-services-original.png',
  '7181ac_182524c823b840f99b9d42f1c9db772f~mv2.png': '/assets/home-projects-original.png',
  '398383_e3fa2f0ed7da4689b2e7a4ecc6f0e2e7~mv2.png': '/assets/home-services-mobile-original.png',
  '398383_a055e15dc8414f218584da4f605063aa~mv2.png': '/assets/home-projects-mobile-original.png',
};
// Fail before rewriting any page if an original asset is missing.
for (const asset of Object.values(sources)) {
  const contents = await readFile(path.join(root, asset.slice(1)));
  if (contents.length === 0) throw new Error(`Empty background asset: ${asset}`);
}
const manifest = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8'));
let changed = 0;
for (const entry of manifest.pages) {
  const file = path.resolve(root, entry.file);
  if (!file.startsWith(root + path.sep)) throw new Error('Page outside site root');
  const original = await readFile(file, 'utf8');
  if (!Object.keys(sources).some(uri => original.includes(uri))) continue;
  const updated = repairBackgrounds(original, sources, '/deedee-studio-static');
  if (updated === original) continue;
  await writeFile(file, updated);
  changed += 1;
}
console.log(JSON.stringify({ changedPages: changed }));
