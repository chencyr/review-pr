#!/usr/bin/env node
// bb-repos.js — 列出 workspace 下的 repositories
// 用法: bb-repos.js [pagelen]

const BB_API = 'https://api.bitbucket.org/2.0';
const WORKSPACE = process.env.BITBUCKET_WORKSPACE;
const TOKEN = process.env.BITBUCKET_TOKEN;

if (!WORKSPACE || !TOKEN) {
  console.error('ERROR: BITBUCKET_WORKSPACE 或 BITBUCKET_TOKEN 未設定');
  process.exit(1);
}

const pagelen = process.argv[2] || '50';

const url = `${BB_API}/repositories/${WORKSPACE}?pagelen=${pagelen}&sort=-updated_on`;
const res = await fetch(url, {
  headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/json' },
  redirect: 'follow',
});

if (!res.ok) {
  console.error(`ERROR: 無法取得 repositories (HTTP ${res.status})`);
  console.error(await res.text());
  process.exit(1);
}

const data = await res.json();
const repos = data.values || [];

if (!repos.length) {
  console.log('此 workspace 下沒有 repository');
  process.exit(0);
}

console.log(`共 ${repos.length} 個 repositories:\n`);
repos.forEach((r, i) => {
  const slug = r.slug || '';
  const project = r.project?.key || '-';
  const lang = r.language || '-';
  const updated = (r.updated_on || '').slice(0, 10);
  console.log(`${String(i + 1).padStart(3)}. ${slug.padEnd(40)} [${project}] lang=${lang} updated=${updated}`);
});
