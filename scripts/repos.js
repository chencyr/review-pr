#!/usr/bin/env node
// repos.js — 列出 repositories
import { detect } from './provider.js';

export async function run(overrides = {}) {
  const p = detect(overrides.env);
  return p.listRepos({ token: p.token, owner: p.owner, ...overrides });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const pagelen = process.argv[2] || '50';
    const result = await run({ pagelen });
    console.log(result.message);
  } catch (e) {
    console.error(`ERROR: ${e.message}`);
    process.exit(1);
  }
}
