#!/usr/bin/env node
// bb-list-prs.js — 列出 repository 中待 review 的 Pull Requests
// 用法: bb-list-prs.js [repo_slug] [state]

const BB_API = 'https://api.bitbucket.org/2.0';

export async function run({ token, workspace, repo, state = 'OPEN', fetchFn = fetch }) {
  if (!token || !workspace) throw new Error('BITBUCKET_WORKSPACE 或 BITBUCKET_TOKEN 未設定');
  if (!repo) throw new Error('未指定 repository');

  const url = `${BB_API}/repositories/${workspace}/${repo}/pullrequests?state=${state}&pagelen=50&sort=-updated_on`;
  const res = await fetchFn(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    redirect: 'follow',
  });

  if (!res.ok) throw new Error(`無法取得 pull requests (HTTP ${res.status})`);

  const data = await res.json();
  const prs = data.values || [];

  if (!prs.length) {
    return { ok: true, message: `目前沒有狀態為 ${state} 的 Pull Request`, prs: [] };
  }

  const lines = [`共 ${prs.length} 個 ${state} 的 PR:\n`];
  prs.forEach((pr, i) => {
    const source = pr.source?.branch?.name || '?';
    const dest = pr.destination?.branch?.name || '?';
    const reviewers = (pr.reviewers || []).map(r => r.display_name).join(', ');
    const updated = (pr.updated_on || '').slice(0, 16).replace('T', ' ');
    lines.push(`${String(i + 1).padStart(3)}. PR #${pr.id} - ${pr.title}`);
    lines.push(`     Author: ${pr.author?.display_name || 'unknown'} | ${source} → ${dest}`);
    lines.push(`     Reviewers: ${reviewers || '(none)'}`);
    lines.push(`     Updated: ${updated}\n`);
  });

  return { ok: true, message: lines.join('\n'), prs };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const [repo = process.env.BITBUCKET_REPO, state = 'OPEN'] = process.argv.slice(2);
    const result = await run({
      token: process.env.BITBUCKET_TOKEN,
      workspace: process.env.BITBUCKET_WORKSPACE,
      repo, state,
    });
    console.log(result.message);
  } catch (e) {
    console.error(`ERROR: ${e.message}`);
    process.exit(1);
  }
}
