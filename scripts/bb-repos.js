#!/usr/bin/env node
// bb-repos.js — 列出 workspace 下的 repositories
// 用法: bb-repos.js [pagelen]

const BB_API = 'https://api.bitbucket.org/2.0';

export async function run({ token, workspace, pagelen = '50', fetchFn = fetch }) {
  if (!token || !workspace) throw new Error('BITBUCKET_WORKSPACE 或 BITBUCKET_TOKEN 未設定');

  const url = `${BB_API}/repositories/${workspace}?pagelen=${pagelen}&sort=-updated_on`;
  const res = await fetchFn(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    redirect: 'follow',
  });

  if (!res.ok) throw new Error(`無法取得 repositories (HTTP ${res.status})`);

  const data = await res.json();
  const repos = data.values || [];

  if (!repos.length) {
    return { ok: true, message: '此 workspace 下沒有 repository', repos: [] };
  }

  const lines = [`共 ${repos.length} 個 repositories:\n`];
  repos.forEach((r, i) => {
    const slug = r.slug || '';
    const project = r.project?.key || '-';
    const lang = r.language || '-';
    const updated = (r.updated_on || '').slice(0, 10);
    lines.push(`${String(i + 1).padStart(3)}. ${slug.padEnd(40)} [${project}] lang=${lang} updated=${updated}`);
  });

  return { ok: true, message: lines.join('\n'), repos };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const pagelen = process.argv[2] || '50';
    const result = await run({
      token: process.env.BITBUCKET_TOKEN,
      workspace: process.env.BITBUCKET_WORKSPACE,
      pagelen,
    });
    console.log(result.message);
  } catch (e) {
    console.error(`ERROR: ${e.message}`);
    process.exit(1);
  }
}
