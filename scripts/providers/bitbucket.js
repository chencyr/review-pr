// providers/bitbucket.js — Bitbucket Cloud API adapter

const API = 'https://api.bitbucket.org/2.0';

export const id = 'bitbucket';
export const label = 'Bitbucket Cloud';

function hdrs(token) {
  return { Authorization: `Bearer ${token}`, Accept: 'application/json' };
}

export async function auth({ token, owner, repo, fetchFn = fetch }) {
  if (!token) throw new Error('BITBUCKET_TOKEN 環境變數未設定');
  if (!owner) throw new Error('BITBUCKET_WORKSPACE 環境變數未設定');

  const res = await fetchFn(`${API}/workspaces/${owner}`, { headers: hdrs(token) });

  if (res.ok) {
    const data = await res.json();
    const lines = [`OK: 已連線至 Bitbucket workspace: ${data.name || owner} (${owner})`];
    if (repo) lines.push(`預設 repository: ${repo}`);
    return { ok: true, message: lines.join('\n') };
  }

  const messages = {
    401: 'Token 無效或已過期 (HTTP 401)',
    403: 'Token 權限不足 (HTTP 403)',
    404: `Workspace '${owner}' 不存在 (HTTP 404)`,
  };
  throw new Error(messages[res.status] || `未預期的錯誤 (HTTP ${res.status})`);
}

export async function listRepos({ token, owner, pagelen = '50', fetchFn = fetch }) {
  const url = `${API}/repositories/${owner}?pagelen=${pagelen}&sort=-updated_on`;
  const res = await fetchFn(url, { headers: hdrs(token), redirect: 'follow' });
  if (!res.ok) throw new Error(`無法取得 repositories (HTTP ${res.status})`);

  const data = await res.json();
  const repos = data.values || [];

  if (!repos.length) return { ok: true, message: '此 workspace 下沒有 repository', repos: [] };

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

export async function listPrs({ token, owner, repo, state = 'OPEN', fetchFn = fetch }) {
  if (!repo) throw new Error('未指定 repository');
  const url = `${API}/repositories/${owner}/${repo}/pullrequests?state=${state}&pagelen=50&sort=-updated_on`;
  const res = await fetchFn(url, { headers: hdrs(token), redirect: 'follow' });
  if (!res.ok) throw new Error(`無法取得 pull requests (HTTP ${res.status})`);

  const data = await res.json();
  const prs = data.values || [];

  if (!prs.length) return { ok: true, message: `目前沒有狀態為 ${state} 的 Pull Request`, prs: [] };

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

async function bbFetch(url, accept = 'application/json', { token, fetchFn }) {
  const res = await fetchFn(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: accept },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return accept === 'application/json' ? res.json() : res.text();
}

export async function getPr({ token, owner, repo, prId, mode = 'all', fetchFn = fetch }) {
  if (!repo) throw new Error('未指定 repository');
  if (!prId) throw new Error('未指定 PR ID');

  const base = `${API}/repositories/${owner}/${repo}/pullrequests/${prId}`;
  const ctx = { token, fetchFn };
  const lines = [];

  if (mode === 'all' || mode === 'info') {
    lines.push('=== PR INFO ===');
    const pr = await bbFetch(base, 'application/json', ctx);
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
    const data = await bbFetch(`${base}/diffstat`, 'application/json', ctx);
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
    lines.push(await bbFetch(`${base}/diff`, 'text/plain', ctx));
  }

  return { ok: true, message: lines.join('\n') };
}

export async function comment({ token, owner, repo, prId, type, message, filePath, lineNum, fetchFn = fetch }) {
  if (!prId || !repo || !type) throw new Error('缺少必要參數: prId, repo, type');

  const url = `${API}/repositories/${owner}/${repo}/pullrequests/${prId}/comments`;
  let payload;

  if (type === 'general') {
    if (!message) throw new Error('需要 comment 內容');
    payload = { content: { raw: message } };
  } else if (type === 'inline') {
    if (!filePath || !lineNum || !message) throw new Error('inline comment 需要 filePath, lineNum, message');
    payload = { content: { raw: message }, inline: { path: filePath, to: Number(lineNum) } };
  } else {
    throw new Error(`未知 comment type: ${type} (請使用 general 或 inline)`);
  }

  const res = await fetchFn(url, {
    method: 'POST',
    headers: { ...hdrs(token), 'Content-Type': 'application/json' },
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

export async function approve({ token, owner, repo, prId, action = 'approve', fetchFn = fetch }) {
  if (!prId) throw new Error('未指定 PR ID');
  if (!repo) throw new Error('未指定 repository');
  if (action !== 'approve' && action !== 'unapprove') {
    throw new Error(`未知操作 '${action}'，請使用 approve 或 unapprove`);
  }

  const url = `${API}/repositories/${owner}/${repo}/pullrequests/${prId}/approve`;
  const res = await fetchFn(url, {
    method: action === 'approve' ? 'POST' : 'DELETE',
    headers: hdrs(token),
  });

  if (res.status === 200 || res.status === 204) {
    return { ok: true, message: `OK: PR #${prId} 已 ${action}` };
  }
  throw new Error(`${action} 失敗 (HTTP ${res.status})`);
}
