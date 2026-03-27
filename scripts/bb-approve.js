#!/usr/bin/env node
// bb-approve.js — Approve 或 Unapprove 一個 PR
// 用法: bb-approve.js <pr_id> [repo_slug] [approve|unapprove]

const BB_API = 'https://api.bitbucket.org/2.0';
const WORKSPACE = process.env.BITBUCKET_WORKSPACE;
const TOKEN = process.env.BITBUCKET_TOKEN;

if (!WORKSPACE || !TOKEN) {
  console.error('ERROR: BITBUCKET_WORKSPACE 或 BITBUCKET_TOKEN 未設定');
  process.exit(1);
}

const [prId, repo = process.env.BITBUCKET_REPO, action = 'approve'] = process.argv.slice(2);

if (!prId) {
  console.error('用法: bb-approve.js <pr_id> [repo_slug] [approve|unapprove]');
  process.exit(1);
}
if (!repo) {
  console.error('ERROR: 未指定 repository');
  process.exit(1);
}
if (action !== 'approve' && action !== 'unapprove') {
  console.error(`ERROR: 未知操作 '${action}'，請使用 approve 或 unapprove`);
  process.exit(1);
}

const url = `${BB_API}/repositories/${WORKSPACE}/${repo}/pullrequests/${prId}/approve`;
const res = await fetch(url, {
  method: action === 'approve' ? 'POST' : 'DELETE',
  headers: {
    Authorization: `Bearer ${TOKEN}`,
    Accept: 'application/json',
  },
});

if (res.status === 200 || res.status === 204) {
  console.log(`OK: PR #${prId} 已 ${action}`);
} else {
  console.error(`ERROR: ${action} 失敗 (HTTP ${res.status})`);
  console.error(await res.text());
  process.exit(1);
}
