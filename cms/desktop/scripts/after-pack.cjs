const { execFileSync } = require('node:child_process');
const { cpSync } = require('node:fs');
const path = require('node:path');

exports.default = async function afterPack({ electronPlatformName, appOutDir, packager }) {
  const mac = electronPlatformName === 'darwin';
  const app = path.join(appOutDir, `${packager.appInfo.productFilename}.app`);
  const resources = mac ? path.join(app, 'Contents', 'Resources') : path.join(appOutDir, 'resources');
  // electron-builder drops every node_modules folder from extraResources, and the CMS server needs its own.
  cpSync(path.join(__dirname, '..', 'build', 'cms', 'node_modules'), path.join(resources, 'cms', 'node_modules'), { recursive: true });
  // Apple Silicon refuses to run an app whose signature no longer matches, so without a paid Apple identity
  // the packaged app gets an ad-hoc signature. macOS still asks the user to allow it the first time.
  if (mac) execFileSync('codesign', ['--force', '--deep', '--sign', '-', app], { stdio: 'inherit' });
};
