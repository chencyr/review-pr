#!/usr/bin/env node
// get-pr.js — 取得 PR 詳細資訊、diffstat 與 diff
import { detect } from './provider.js';

export async function run(overrides = {}) {
  const p = detect(overrides.env);
  return p.getPr({ token: p.token, owner: p.owner, repo: p.repo, ...overrides });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const [prId, repo, mode] = process.argv.slice(2);
    const result = await run({
      prId,
      ...(repo && { repo }),
      ...(mode && { mode }),
    });
    console.log(result.message);
  } catch (e) {
    console.error(`ERROR: ${e.message}`);
    process.exit(1);
  }
}
