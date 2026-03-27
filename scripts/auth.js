#!/usr/bin/env node
// auth.js — 驗證 Git provider 連線
import { detect } from './provider.js';

export async function run(overrides = {}) {
  const p = detect(overrides.env);
  return p.auth({ token: p.token, owner: p.owner, repo: p.repo, ...overrides });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const result = await run();
    console.log(result.message);
  } catch (e) {
    console.error(`ERROR: ${e.message}`);
    process.exit(1);
  }
}
