#!/usr/bin/env node
// list-prs.js — 列出 Pull Requests
import { detect } from './provider.js';

export async function run(overrides = {}) {
  const p = detect(overrides.env);
  return p.listPrs({ token: p.token, owner: p.owner, repo: p.repo, ...overrides });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const [repo, state] = process.argv.slice(2);
    const result = await run({ ...(repo && { repo }), ...(state && { state }) });
    console.log(result.message);
  } catch (e) {
    console.error(`ERROR: ${e.message}`);
    process.exit(1);
  }
}
