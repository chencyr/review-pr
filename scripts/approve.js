#!/usr/bin/env node
// approve.js — Approve 或 Unapprove 一個 PR
import { detect } from './provider.js';

export async function run(overrides = {}) {
  const p = detect(overrides.env);
  return p.approve({ token: p.token, owner: p.owner, repo: p.repo, ...overrides });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const [prId, repo, action] = process.argv.slice(2);
    const result = await run({
      prId,
      ...(repo && { repo }),
      ...(action && { action }),
    });
    console.log(result.message);
  } catch (e) {
    console.error(`ERROR: ${e.message}`);
    process.exit(1);
  }
}
