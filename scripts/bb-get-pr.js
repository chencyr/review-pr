#!/usr/bin/env node
// bb-get-pr.js — 取得 PR 詳細資訊、diffstat 與 diff
// 用法: bb-get-pr.js <pr_id> [repo_slug] [info|diffstat|diff]

const BB_API = 'https://api.bitbucket.org/2.0';
const WORKSPACE = process.env.BITBUCKET_WORKSPACE;
const TOKEN = process.env.BITBUCKET_TOKEN;

if (!WORKSPACE || !TOKEN) {
  console.error('ERROR: BITBUCKET_WORKSPACE 或 BITBUCKET_TOKEN 未設定');
  process.exit(1);
}

const [prId, repo = process.env.BITBUCKET_REPO, mode = 'all'] = process.argv.slice(2);

if (!prId) {
  console.error('用法: bb-get-pr.js <pr_id> [repo_slug] [info|diffstat|diff]');
  process.exit(1);
}
if (!repo) {
  console.error('ERROR: 未指定 repository');
  process.exit(1);
}

const base = `${BB_API}/repositories/${WORKSPACE}/${repo}/pullrequests/${prId}`;

async function bb(url, accept = 'application/json') {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${TOKEN}`, Accept: accept },
    redirect: 'follow',
  });
  if (!res.ok) {
    console.error(`ERROR: HTTP ${res.status} for ${url}`);
    console.error(await res.text());
    process.exit(1);
  }
  return accept === 'application/json' ? res.json() : res.text();
}

// PR 基本資訊
if (mode === 'all' || mode === 'info') {
  console.log('=== PR INFO ===');
  const pr = await bb(base);
  console.log(`PR #${pr.id}: ${pr.title}`);
  console.log(`State: ${pr.state}`);
  console.log(`Author: ${pr.author.display_name}`);
  console.log(`Source: ${pr.source.branch.name} → ${pr.destination.branch.name}`);
  console.log('Description:');
  console.log((pr.description || '(none)').slice(0, 2000));
  console.log(`\nReviewers: ${(pr.reviewers || []).map(r => r.display_name).join(', ')}`);
  console.log(`Created: ${pr.created_on.slice(0, 16)}`);
  console.log(`Updated: ${pr.updated_on.slice(0, 16)}`);
  console.log(`Link: ${pr.links.html.href}`);
  if (mode === 'info') process.exit(0);
}

// Diffstat
if (mode === 'all' || mode === 'diffstat') {
  console.log('\n=== DIFFSTAT ===');
  const data = await bb(`${base}/diffstat`);
  const files = data.values || [];
  const symbols = { added: 'A', removed: 'D', modified: 'M', renamed: 'R' };
  let totalAdd = 0, totalDel = 0;
  for (const f of files) {
    const added = f.lines_added || 0;
    const removed = f.lines_removed || 0;
    totalAdd += added;
    totalDel += removed;
    const path = f.new?.path || f.old?.path || '';
    const sym = symbols[f.status] || '?';
    console.log(`  [${sym}] ${path.padEnd(60)} +${String(added).padEnd(5)} -${removed}`);
  }
  console.log(`\nTotal: ${files.length} files, +${totalAdd} -${totalDel}`);
  if (mode === 'diffstat') process.exit(0);
}

// Unified diff
if (mode === 'all' || mode === 'diff') {
  console.log('\n=== DIFF ===');
  console.log(await bb(`${base}/diff`, 'text/plain'));
}
