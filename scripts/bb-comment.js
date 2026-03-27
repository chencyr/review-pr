#!/usr/bin/env node
// bb-comment.js — 提交 PR Comment (general 或 inline)
// 用法:
//   bb-comment.js <pr_id> <repo> general <message>
//   bb-comment.js <pr_id> <repo> inline <file_path> <line_number> <message>

const BB_API = 'https://api.bitbucket.org/2.0';
const WORKSPACE = process.env.BITBUCKET_WORKSPACE;
const TOKEN = process.env.BITBUCKET_TOKEN;

if (!WORKSPACE || !TOKEN) {
  console.error('ERROR: BITBUCKET_WORKSPACE 或 BITBUCKET_TOKEN 未設定');
  process.exit(1);
}

const args = process.argv.slice(2);
const [prId, repo, type] = args;

if (!prId || !repo || !type) {
  console.error('用法: bb-comment.js <pr_id> <repo> general|inline ...');
  process.exit(1);
}

const url = `${BB_API}/repositories/${WORKSPACE}/${repo}/pullrequests/${prId}/comments`;
let payload;

if (type === 'general') {
  const message = args[3];
  if (!message) { console.error('ERROR: 需要 comment 內容'); process.exit(1); }
  payload = { content: { raw: message } };
} else if (type === 'inline') {
  const [filePath, lineNum, message] = args.slice(3);
  if (!filePath || !lineNum || !message) {
    console.error('用法: bb-comment.js <pr_id> <repo> inline <file_path> <line_number> <message>');
    process.exit(1);
  }
  payload = { content: { raw: message }, inline: { path: filePath, to: Number(lineNum) } };
} else {
  console.error(`ERROR: 未知 comment type: ${type} (請使用 general 或 inline)`);
  process.exit(1);
}

const res = await fetch(url, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${TOKEN}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  body: JSON.stringify(payload),
});

if (res.status === 201) {
  const data = await res.json();
  if (type === 'inline') {
    console.log(`OK: Inline comment #${data.id} 已提交至 ${args[3]}:${args[4]}`);
  } else {
    console.log(`OK: General comment #${data.id} 已提交`);
  }
} else {
  console.error(`ERROR: 提交 comment 失敗 (HTTP ${res.status})`);
  console.error(await res.text());
  process.exit(1);
}
