#!/usr/bin/env node
// bb-auth.js — 驗證 Bitbucket Cloud Access Token 有效性

const BB_API = 'https://api.bitbucket.org/2.0';
const TOKEN = process.env.BITBUCKET_TOKEN;
const WORKSPACE = process.env.BITBUCKET_WORKSPACE;

if (!TOKEN) {
  console.error('ERROR: BITBUCKET_TOKEN 環境變數未設定');
  console.error('請執行: export BITBUCKET_TOKEN=your_access_token');
  process.exit(1);
}

if (!WORKSPACE) {
  console.error('ERROR: BITBUCKET_WORKSPACE 環境變數未設定');
  console.error('請執行: export BITBUCKET_WORKSPACE=your_workspace');
  process.exit(1);
}

const res = await fetch(`${BB_API}/workspaces/${WORKSPACE}`, {
  headers: {
    Authorization: `Bearer ${TOKEN}`,
    Accept: 'application/json',
  },
});

if (res.ok) {
  const data = await res.json();
  console.log(`OK: 已連線至 workspace: ${data.name || WORKSPACE} (${WORKSPACE})`);
  if (process.env.BITBUCKET_REPO) {
    console.log(`預設 repository: ${process.env.BITBUCKET_REPO}`);
  }
} else if (res.status === 401) {
  console.error('ERROR: Token 無效或已過期 (HTTP 401)');
  console.error('請重新產生 Access Token: Bitbucket > Settings > Access Tokens');
  process.exit(1);
} else if (res.status === 403) {
  console.error('ERROR: Token 權限不足 (HTTP 403)');
  console.error('所需權限: Repositories (Read), Pull Requests (Read/Write)');
  process.exit(1);
} else if (res.status === 404) {
  console.error(`ERROR: Workspace '${WORKSPACE}' 不存在 (HTTP 404)`);
  console.error('請確認 BITBUCKET_WORKSPACE 環境變數是否正確');
  process.exit(1);
} else {
  console.error(`ERROR: 未預期的錯誤 (HTTP ${res.status})`);
  console.error(await res.text());
  process.exit(1);
}
