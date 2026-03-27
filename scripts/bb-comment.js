#!/usr/bin/env node
// bb-comment.js — 提交 PR Comment (general 或 inline)
// 用法:
//   bb-comment.js <pr_id> <repo> general <message>
//   bb-comment.js <pr_id> <repo> inline <file_path> <line_number> <message>

const BB_API = 'https://api.bitbucket.org/2.0';

export async function run({ token, workspace, prId, repo, type, message, filePath, lineNum, fetchFn = fetch }) {
  if (!token || !workspace) throw new Error('BITBUCKET_WORKSPACE 或 BITBUCKET_TOKEN 未設定');
  if (!prId || !repo || !type) throw new Error('用法: bb-comment.js <pr_id> <repo> general|inline ...');

  const url = `${BB_API}/repositories/${workspace}/${repo}/pullrequests/${prId}/comments`;
  let payload;

  if (type === 'general') {
    if (!message) throw new Error('需要 comment 內容');
    payload = { content: { raw: message } };
  } else if (type === 'inline') {
    if (!filePath || !lineNum || !message) {
      throw new Error('用法: bb-comment.js <pr_id> <repo> inline <file_path> <line_number> <message>');
    }
    payload = { content: { raw: message }, inline: { path: filePath, to: Number(lineNum) } };
  } else {
    throw new Error(`未知 comment type: ${type} (請使用 general 或 inline)`);
  }

  const res = await fetchFn(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (res.status === 201) {
    const data = await res.json();
    if (type === 'inline') {
      return { ok: true, message: `OK: Inline comment #${data.id} 已提交至 ${filePath}:${lineNum}` };
    }
    return { ok: true, message: `OK: General comment #${data.id} 已提交` };
  }
  throw new Error(`提交 comment 失敗 (HTTP ${res.status})`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const args = process.argv.slice(2);
    const [prId, repo, type] = args;
    let opts = {
      token: process.env.BITBUCKET_TOKEN,
      workspace: process.env.BITBUCKET_WORKSPACE,
      prId, repo, type,
    };
    if (type === 'general') {
      opts.message = args[3];
    } else if (type === 'inline') {
      opts.filePath = args[3];
      opts.lineNum = args[4];
      opts.message = args[5];
    }
    const result = await run(opts);
    console.log(result.message);
  } catch (e) {
    console.error(`ERROR: ${e.message}`);
    process.exit(1);
  }
}
