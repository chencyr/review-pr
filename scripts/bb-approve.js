#!/usr/bin/env node
// bb-approve.js — Approve 或 Unapprove 一個 PR
// 用法: bb-approve.js <pr_id> [repo_slug] [approve|unapprove]

const BB_API = 'https://api.bitbucket.org/2.0';

export async function run({ token, workspace, prId, repo, action = 'approve', fetchFn = fetch }) {
  if (!token || !workspace) throw new Error('BITBUCKET_WORKSPACE 或 BITBUCKET_TOKEN 未設定');
  if (!prId) throw new Error('用法: bb-approve.js <pr_id> [repo_slug] [approve|unapprove]');
  if (!repo) throw new Error('未指定 repository');
  if (action !== 'approve' && action !== 'unapprove') {
    throw new Error(`未知操作 '${action}'，請使用 approve 或 unapprove`);
  }

  const url = `${BB_API}/repositories/${workspace}/${repo}/pullrequests/${prId}/approve`;
  const res = await fetchFn(url, {
    method: action === 'approve' ? 'POST' : 'DELETE',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });

  if (res.status === 200 || res.status === 204) {
    return { ok: true, message: `OK: PR #${prId} 已 ${action}` };
  }
  throw new Error(`${action} 失敗 (HTTP ${res.status})`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const [prId, repo = process.env.BITBUCKET_REPO, action = 'approve'] = process.argv.slice(2);
    const result = await run({
      token: process.env.BITBUCKET_TOKEN,
      workspace: process.env.BITBUCKET_WORKSPACE,
      prId, repo, action,
    });
    console.log(result.message);
  } catch (e) {
    console.error(`ERROR: ${e.message}`);
    process.exit(1);
  }
}
