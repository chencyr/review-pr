#!/usr/bin/env node
// bb-list-prs.js — 列出 repository 中待 review 的 Pull Requests
// 用法: bb-list-prs.js [repo_slug] [state]

const BB_API = 'https://api.bitbucket.org/2.0';
const WORKSPACE = process.env.BITBUCKET_WORKSPACE;
const TOKEN = process.env.BITBUCKET_TOKEN;

if (!WORKSPACE || !TOKEN) {
  console.error('ERROR: BITBUCKET_WORKSPACE 或 BITBUCKET_TOKEN 未設定');
  process.exit(1);
}

const [repo = process.env.BITBUCKET_REPO, state = 'OPEN'] = process.argv.slice(2);

if (!repo) {
  console.error('ERROR: 未指定 repository');
  console.error('用法: bb-list-prs.js <repo_slug> [state]');
  console.error('或設定 BITBUCKET_REPO 環境變數');
  process.exit(1);
}

const url = `${BB_API}/repositories/${WORKSPACE}/${repo}/pullrequests?state=${state}&pagelen=50&sort=-updated_on`;
const res = await fetch(url, {
  headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/json' },
  redirect: 'follow',
});

if (!res.ok) {
  console.error(`ERROR: 無法取得 pull requests (HTTP ${res.status})`);
  console.error(await res.text());
  process.exit(1);
}

const data = await res.json();
const prs = data.values || [];

if (!prs.length) {
  console.log(`目前沒有狀態為 ${state} 的 Pull Request`);
  process.exit(0);
}

console.log(`共 ${prs.length} 個 ${state} 的 PR:\n`);
prs.forEach((pr, i) => {
  const source = pr.source?.branch?.name || '?';
  const dest = pr.destination?.branch?.name || '?';
  const reviewers = (pr.reviewers || []).map(r => r.display_name).join(', ');
  const updated = (pr.updated_on || '').slice(0, 16).replace('T', ' ');
  console.log(`${String(i + 1).padStart(3)}. PR #${pr.id} - ${pr.title}`);
  console.log(`     Author: ${pr.author?.display_name || 'unknown'} | ${source} → ${dest}`);
  console.log(`     Reviewers: ${reviewers || '(none)'}`);
  console.log(`     Updated: ${updated}\n`);
});
