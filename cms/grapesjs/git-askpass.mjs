#!/usr/bin/env node
// Git invokes this helper without placing credentials in arguments or the remote URL.
const prompt = process.argv[2] || '';
process.stdout.write(/username/i.test(prompt) ? 'x-access-token\n' : `${process.env.CMS_GITHUB_TOKEN || ''}\n`);
