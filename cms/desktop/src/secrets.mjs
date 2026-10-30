import { randomBytes } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const password = () => randomBytes(24).toString('base64url');

/** Everything secret stays in one file, encrypted by the operating system's key store (Keychain on Mac, DPAPI on Windows). */
export function createSecrets({ dir, cipher }) {
  const file = path.join(dir, 'secrets.bin');
  return {
    async read() {
      try {
        return JSON.parse(cipher.decryptString(await readFile(file)));
      } catch {
        return null;
      }
    },
    async write(values) {
      await mkdir(dir, { recursive: true, mode: 0o700 });
      await writeFile(file, cipher.encryptString(JSON.stringify(values)), { mode: 0o600 });
      return values;
    },
    async clear() {
      await rm(file, { force: true });
    },
  };
}

/** First activation: the local CMS accounts get random passwords nobody has to know, because the app signs in by itself. */
export function newSecrets({ token, formKey = '' }) {
  return { token, formKey, adminPassword: password(), publisherPassword: password(), editorPassword: password() };
}
