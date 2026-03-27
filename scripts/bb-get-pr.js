#!/usr/bin/env node
// bb-get-pr.js — 取得 PR 詳細資訊、diffstat 與 diff
// 用法: bb-get-pr.js <pr_id> [repo_slug] [info|diffstat|diff]

const BB_API = 'https://api.bitbucket.org/2.0';

async function bb(url, accept = 'application/json', { token, fetchFn }) {
  const res = await fetchFn(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: accept },
    redirect: 'follow',
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  return accept === 'application/json' ? res.json() : res.text();
}

export async function run({ token, workspace, prId, repo, mode = 'all', fetchFn = fetch }) {
  if (!token || !workspace) throw new Error('BITBUCKET_WORKSPACE 或 BITBUCKET_TOKEN 未設定');
  if (!prId) throw new Error('用法: bb-get-pr.js <pr_id> [repo_slug] [info|diffstat|diff]');
  if (!repo) throw new Error('未指定 repository');

  const base = `${BB_API}/repositories/${workspace}/${repo}/pullrequests/${prId}`;
  const ctx = { token, fetchFn };
  const lines = [];

  if (mode === 'all' || mode === 'info') {
    lines.push('=== PR INFO ===');
    const pr = await bb(base, 'application/json', ctx);
    lines.push(`PR #${pr.id}: ${pr.title}`);
    lines.push(`State: ${pr.state}`);
    lines.push(`Author: ${pr.author.display_name}`);
    lines.push(`Source: ${pr.source.branch.name} → ${pr.destination.branch.name}`);
    lines.push('Description:');
    lines.push((pr.description || '(none)').slice(0, 2000));
    lines.push(`\nReviewers: ${(pr.reviewers || []).map(r => r.display_name).join(', ')}`);
    lines.push(`Created: ${pr.created_on.slice(0, 16)}`);
    lines.push(`Updated: ${pr.updated_on.slice(0, 16)}`);
    lines.push(`Link: ${pr.links.html.href}`);
    if (mode === 'info') return { ok: true, message: lines.join('\n') };
  }

  if (mode === 'all' || mode === 'diffstat') {
    lines.push('\n=== DIFFSTAT ===');
    const data = await bb(`${base}/diffstat`, 'application/json', ctx);
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
      lines.push(`  [${sym}] ${path.padEnd(60)} +${String(added).padEnd(5)} -${removed}`);
    }
    lines.push(`\nTotal: ${files.length} files, +${totalAdd} -${totalDel}`);
    if (mode === 'diffstat') return { ok: true, message: lines.join('\n') };
  }

  if (mode === 'all' || mode === 'diff') {
    lines.push('\n=== DIFF ===');
    lines.push(await bb(`${base}/diff`, 'text/plain', ctx));
  }

  return { ok: true, message: lines.join('\n') };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const [prId, repo = process.env.BITBUCKET_REPO, mode = 'all'] = process.argv.slice(2);
    const result = await run({
      token: process.env.BITBUCKET_TOKEN,
      workspace: process.env.BITBUCKET_WORKSPACE,
      prId, repo, mode,
    });
    console.log(result.message);
  } catch (e) {
    console.error(`ERROR: ${e.message}`);
    process.exit(1);
  }
}
