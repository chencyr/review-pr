#!/usr/bin/env node
// comment.js — 提交 PR Comment (general 或 inline)
import { detect } from './provider.js';

export async function run(overrides = {}) {
  const p = detect(overrides.env);
  return p.comment({ token: p.token, owner: p.owner, repo: p.repo, ...overrides });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const args = process.argv.slice(2);
    const [prId, repo, type] = args;
    const opts = { prId, repo, type };
    if (type === 'general') {
      opts.message = args[3];
    } else if (type === 'inline') {
      opts.filePath = args[3];
      opts.lineNum = args[4];
      opts.message = args[5];
    }
    const result = await run(opts);
    console.log(result.message);
  } catch (e) {
    console.error(`ERROR: ${e.message}`);
    process.exit(1);
  }
}
