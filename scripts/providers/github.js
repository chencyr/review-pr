// providers/github.js — GitHub REST API adapter

const API = 'https://api.github.com';

export const id = 'github';
export const label = 'GitHub';

function hdrs(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

async function ghFetch(url, opts, fetchFn) {
  const res = await fetchFn(url, opts);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res;
}

export async function auth({ token, owner, repo, fetchFn = fetch }) {
  if (!token) throw new Error('GITHUB_TOKEN 環境變數未設定');

  // 驗證 token 有效性
  const res = await fetchFn(`${API}/user`, { headers: hdrs(token) });

  if (res.ok) {
    const user = await res.json();
    const lines = [`OK: 已連線至 GitHub，使用者: ${user.login} (${user.name || user.login})`];
    if (owner) lines.push(`目標 owner: ${owner}`);
    if (repo) lines.push(`預設 repository: ${repo}`);
    return { ok: true, message: lines.join('\n') };
  }

  const messages = {
    401: 'Token 無效或已過期 (HTTP 401)',
    403: 'Token 權限不足 (HTTP 403)',
  };
  throw new Error(messages[res.status] || `未預期的錯誤 (HTTP ${res.status})`);
}

export async function listRepos({ token, owner, pagelen = '50', fetchFn = fetch }) {
  if (!owner) throw new Error('GITHUB_OWNER 環境變數未設定');

  // 嘗試 org endpoint，失敗則 fallback 到 user endpoint
  let url = `${API}/orgs/${owner}/repos?per_page=${pagelen}&sort=updated&direction=desc`;
  let res = await fetchFn(url, { headers: hdrs(token) });

  if (res.status === 404) {
    url = `${API}/users/${owner}/repos?per_page=${pagelen}&sort=updated&direction=desc`;
    res = await fetchFn(url, { headers: hdrs(token) });
  }
  if (!res.ok) throw new Error(`無法取得 repositories (HTTP ${res.status})`);

  const repos = await res.json();

  if (!repos.length) return { ok: true, message: '此 owner 下沒有 repository', repos: [] };

  const lines = [`共 ${repos.length} 個 repositories:\n`];
  repos.forEach((r, i) => {
    const name = r.name || '';
    const lang = r.language || '-';
    const visibility = r.private ? 'private' : 'public';
    const updated = (r.updated_at || '').slice(0, 10);
    lines.push(`${String(i + 1).padStart(3)}. ${name.padEnd(40)} [${visibility}] lang=${lang} updated=${updated}`);
  });
  return { ok: true, message: lines.join('\n'), repos };
}

export async function listPrs({ token, owner, repo, state = 'open', fetchFn = fetch }) {
  if (!repo) throw new Error('未指定 repository');
  if (!owner) throw new Error('GITHUB_OWNER 環境變數未設定');

  // GitHub 使用小寫 state: open, closed, all
  const ghState = state.toLowerCase() === 'merged' ? 'closed' : state.toLowerCase();
  const url = `${API}/repos/${owner}/${repo}/pulls?state=${ghState}&per_page=50&sort=updated&direction=desc`;
  const res = await fetchFn(url, { headers: hdrs(token) });
  if (!res.ok) throw new Error(`無法取得 pull requests (HTTP ${res.status})`);

  let prs = await res.json();

  // 如果原始 state 是 MERGED，過濾只保留已合併的 PR
  if (state.toLowerCase() === 'merged') {
    prs = prs.filter(pr => pr.merged_at);
  }

  if (!prs.length) return { ok: true, message: `目前沒有狀態為 ${state} 的 Pull Request`, prs: [] };

  const lines = [`共 ${prs.length} 個 ${state} 的 PR:\n`];
  prs.forEach((pr, i) => {
    const source = pr.head?.ref || '?';
    const dest = pr.base?.ref || '?';
    const reviewers = (pr.requested_reviewers || []).map(r => r.login).join(', ');
    const updated = (pr.updated_at || '').slice(0, 16).replace('T', ' ');
    lines.push(`${String(i + 1).padStart(3)}. PR #${pr.number} - ${pr.title}`);
    lines.push(`     Author: ${pr.user?.login || 'unknown'} | ${source} → ${dest}`);
    lines.push(`     Reviewers: ${reviewers || '(none)'}`);
    lines.push(`     Updated: ${updated}\n`);
  });
  return { ok: true, message: lines.join('\n'), prs };
}

export async function getPr({ token, owner, repo, prId, mode = 'all', fetchFn = fetch }) {
  if (!repo) throw new Error('未指定 repository');
  if (!prId) throw new Error('未指定 PR ID');
  if (!owner) throw new Error('GITHUB_OWNER 環境變數未設定');

  const base = `${API}/repos/${owner}/${repo}/pulls/${prId}`;
  const lines = [];

  if (mode === 'all' || mode === 'info') {
    const res = await ghFetch(base, { headers: hdrs(token) }, fetchFn);
    const pr = await res.json();
    lines.push('=== PR INFO ===');
    lines.push(`PR #${pr.number}: ${pr.title}`);
    lines.push(`State: ${pr.state}${pr.merged ? ' (merged)' : ''}`);
    lines.push(`Author: ${pr.user.login}`);
    lines.push(`Source: ${pr.head.ref} → ${pr.base.ref}`);
    lines.push('Description:');
    lines.push((pr.body || '(none)').slice(0, 2000));
    lines.push(`\nReviewers: ${(pr.requested_reviewers || []).map(r => r.login).join(', ')}`);
    lines.push(`Created: ${pr.created_at.slice(0, 16)}`);
    lines.push(`Updated: ${pr.updated_at.slice(0, 16)}`);
    lines.push(`Link: ${pr.html_url}`);
    if (mode === 'info') return { ok: true, message: lines.join('\n') };
  }

  if (mode === 'all' || mode === 'diffstat') {
    const res = await ghFetch(`${base}/files?per_page=100`, { headers: hdrs(token) }, fetchFn);
    const files = await res.json();
    lines.push('\n=== DIFFSTAT ===');
    const symbols = { added: 'A', removed: 'D', modified: 'M', renamed: 'R', copied: 'C', changed: 'M' };
    let totalAdd = 0, totalDel = 0;
    for (const f of files) {
      const added = f.additions || 0;
      const removed = f.deletions || 0;
      totalAdd += added;
      totalDel += removed;
      const sym = symbols[f.status] || '?';
      lines.push(`  [${sym}] ${f.filename.padEnd(60)} +${String(added).padEnd(5)} -${removed}`);
    }
    lines.push(`\nTotal: ${files.length} files, +${totalAdd} -${totalDel}`);
    if (mode === 'diffstat') return { ok: true, message: lines.join('\n') };
  }

  if (mode === 'all' || mode === 'diff') {
    lines.push('\n=== DIFF ===');
    const res = await ghFetch(base, {
      headers: { ...hdrs(token), Accept: 'application/vnd.github.diff' },
    }, fetchFn);
    lines.push(await res.text());
  }

  return { ok: true, message: lines.join('\n') };
}

export async function comment({ token, owner, repo, prId, type, message, filePath, lineNum, fetchFn = fetch }) {
  if (!prId || !repo || !type) throw new Error('缺少必要參數: prId, repo, type');
  if (!owner) throw new Error('GITHUB_OWNER 環境變數未設定');

  if (type === 'general') {
    if (!message) throw new Error('需要 comment 內容');
    // GitHub: issue comment endpoint (general PR comment)
    const url = `${API}/repos/${owner}/${repo}/issues/${prId}/comments`;
    const res = await fetchFn(url, {
      method: 'POST',
      headers: { ...hdrs(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: message }),
    });
    if (res.status === 201) {
      const data = await res.json();
      return { ok: true, message: `OK: General comment #${data.id} 已提交` };
    }
    throw new Error(`提交 comment 失敗 (HTTP ${res.status})`);
  }

  if (type === 'inline') {
    if (!filePath || !lineNum || !message) throw new Error('inline comment 需要 filePath, lineNum, message');
    // 取得 PR 的 head commit SHA
    const prRes = await ghFetch(`${API}/repos/${owner}/${repo}/pulls/${prId}`, { headers: hdrs(token) }, fetchFn);
    const pr = await prRes.json();
    const commitId = pr.head.sha;

    const url = `${API}/repos/${owner}/${repo}/pulls/${prId}/comments`;
    const res = await fetchFn(url, {
      method: 'POST',
      headers: { ...hdrs(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        body: message,
        commit_id: commitId,
        path: filePath,
        line: Number(lineNum),
        side: 'RIGHT',
      }),
    });
    if (res.status === 201) {
      const data = await res.json();
      return { ok: true, message: `OK: Inline comment #${data.id} 已提交至 ${filePath}:${lineNum}` };
    }
    throw new Error(`提交 comment 失敗 (HTTP ${res.status})`);
  }

  throw new Error(`未知 comment type: ${type} (請使用 general 或 inline)`);
}

export async function approve({ token, owner, repo, prId, action = 'approve', fetchFn = fetch }) {
  if (!prId) throw new Error('未指定 PR ID');
  if (!repo) throw new Error('未指定 repository');
  if (!owner) throw new Error('GITHUB_OWNER 環境變數未設定');
  if (action !== 'approve' && action !== 'unapprove') {
    throw new Error(`未知操作 '${action}'，請使用 approve 或 unapprove`);
  }

  if (action === 'approve') {
    const url = `${API}/repos/${owner}/${repo}/pulls/${prId}/reviews`;
    const res = await fetchFn(url, {
      method: 'POST',
      headers: { ...hdrs(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'APPROVE' }),
    });
    if (res.ok) return { ok: true, message: `OK: PR #${prId} 已 approve` };
    throw new Error(`approve 失敗 (HTTP ${res.status})`);
  }

  // unapprove: dismiss the latest approve review
  const reviewsRes = await ghFetch(
    `${API}/repos/${owner}/${repo}/pulls/${prId}/reviews`,
    { headers: hdrs(token) },
    fetchFn,
  );
  const reviews = await reviewsRes.json();
  const myUserRes = await ghFetch(`${API}/user`, { headers: hdrs(token) }, fetchFn);
  const me = await myUserRes.json();
  const myApproval = reviews.reverse().find(r => r.user.login === me.login && r.state === 'APPROVED');

  if (!myApproval) throw new Error('找不到可撤回的 approve review');

  const url = `${API}/repos/${owner}/${repo}/pulls/${prId}/reviews/${myApproval.id}/dismissals`;
  const res = await fetchFn(url, {
    method: 'PUT',
    headers: { ...hdrs(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'Unapprove via review-pr' }),
  });
  if (res.ok) return { ok: true, message: `OK: PR #${prId} 已 unapprove` };
  throw new Error(`unapprove 失敗 (HTTP ${res.status})`);
}
