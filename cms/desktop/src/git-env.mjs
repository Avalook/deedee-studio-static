import path from 'node:path';

const pathKey = (env) => Object.keys(env).find((key) => key.toUpperCase() === 'PATH') || 'PATH';

/** Point Git at the copy shipped with the app, and give it the code as a header so it never appears in a URL or argument. */
export function gitEnvironment(env, { gitDir, token, platform = process.platform }) {
  const windows = platform === 'win32';
  const join = windows ? path.win32.join : path.posix.join;
  const delimiter = windows ? ';' : ':';
  const bins = windows ? [join(gitDir, 'cmd'), join(gitDir, 'mingw64', 'bin'), join(gitDir, 'usr', 'bin')] : [join(gitDir, 'bin')];
  const key = pathKey(env);
  return {
    ...env,
    [key]: [...bins, env[key] || ''].join(delimiter),
    GIT_EXEC_PATH: join(gitDir, ...(windows ? ['mingw64', 'libexec', 'git-core'] : ['libexec', 'git-core'])),
    GIT_TEMPLATE_DIR: join(gitDir, ...(windows ? ['mingw64', 'share', 'git-core', 'templates'] : ['share', 'git-core', 'templates'])),
    GIT_CONFIG_COUNT: '1',
    GIT_CONFIG_KEY_0: 'http.https://github.com/.extraheader',
    GIT_CONFIG_VALUE_0: `Authorization: Basic ${Buffer.from(`x-access-token:${token}`).toString('base64')}`,
  };
}

const CODE = /^(?:github_pat_[A-Za-z0-9_]{20,}|ghp_[A-Za-z0-9]{20,})$/;
export const isActivationCode = (value) => CODE.test(String(value ?? '').trim());
