#!/usr/bin/env node
// bb-auth.js — 驗證 Bitbucket Cloud Access Token 有效性

const BB_API = 'https://api.bitbucket.org/2.0';

export async function run({ token, workspace, repo, fetchFn = fetch }) {
  if (!token) throw new Error('BITBUCKET_TOKEN 環境變數未設定');
  if (!workspace) throw new Error('BITBUCKET_WORKSPACE 環境變數未設定');

  const res = await fetchFn(`${BB_API}/workspaces/${workspace}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });

  if (res.ok) {
    const data = await res.json();
    const lines = [`OK: 已連線至 workspace: ${data.name || workspace} (${workspace})`];
    if (repo) lines.push(`預設 repository: ${repo}`);
    return { ok: true, message: lines.join('\n') };
  }

  const messages = {
    401: 'Token 無效或已過期 (HTTP 401)',
    403: 'Token 權限不足 (HTTP 403)',
    404: `Workspace '${workspace}' 不存在 (HTTP 404)`,
  };
  const msg = messages[res.status] || `未預期的錯誤 (HTTP ${res.status})`;
  throw new Error(msg);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const result = await run({
      token: process.env.BITBUCKET_TOKEN,
      workspace: process.env.BITBUCKET_WORKSPACE,
      repo: process.env.BITBUCKET_REPO,
    });
    console.log(result.message);
  } catch (e) {
    console.error(`ERROR: ${e.message}`);
    process.exit(1);
  }
}
