import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { run } from '../bb-get-pr.js';
import { mockFetch, BASE_OPTS } from './helpers.js';

const PR_DATA = {
  id: 42,
  title: 'Add feature X',
  state: 'OPEN',
  author: { display_name: 'Alice' },
  source: { branch: { name: 'feature/x' } },
  destination: { branch: { name: 'main' } },
  description: 'Implements feature X',
  reviewers: [{ display_name: 'Bob' }],
  created_on: '2026-03-20T10:00:00',
  updated_on: '2026-03-25T14:30:00',
  links: { html: { href: 'https://bitbucket.org/ws/repo/pull-requests/42' } },
};

const DIFFSTAT_DATA = {
  values: [
    { status: 'modified', lines_added: 10, lines_removed: 3, new: { path: 'src/app.js' }, old: { path: 'src/app.js' } },
    { status: 'added', lines_added: 25, lines_removed: 0, new: { path: 'src/new.js' } },
  ],
};

function multiFetch(map) {
  return async (url, opts) => {
    for (const [pattern, response] of Object.entries(map)) {
      if (url.includes(pattern)) {
        return {
          ok: true,
          status: 200,
          json: async () => response,
          text: async () => (typeof response === 'string' ? response : JSON.stringify(response)),
        };
      }
    }
    return { ok: false, status: 404, text: async () => 'not found' };
  };
}

describe('bb-get-pr', () => {
  const opts = { ...BASE_OPTS, prId: '42' };

  it('應在缺少必要參數時拋出錯誤', async () => {
    await assert.rejects(() => run({ token: 'tk' }), /未設定/);
    await assert.rejects(() => run({ ...BASE_OPTS }), /用法/);
    await assert.rejects(() => run({ ...BASE_OPTS, prId: '1', repo: undefined }), /未指定/);
  });

  it('mode=info 應回傳 PR 資訊', async () => {
    const result = await run({
      ...opts, mode: 'info',
      fetchFn: mockFetch(200, PR_DATA),
    });
    assert.match(result.message, /PR #42: Add feature X/);
    assert.match(result.message, /Alice/);
    assert.match(result.message, /feature\/x → main/);
    assert.match(result.message, /Bob/);
  });

  it('mode=diffstat 應回傳檔案變更摘要', async () => {
    const result = await run({
      ...opts, mode: 'diffstat',
      fetchFn: mockFetch(200, DIFFSTAT_DATA),
    });
    assert.match(result.message, /\[M\].*src\/app\.js/);
    assert.match(result.message, /\[A\].*src\/new\.js/);
    assert.match(result.message, /Total: 2 files, \+35 -3/);
  });

  it('mode=diff 應回傳 unified diff', async () => {
    const diffText = '--- a/file\n+++ b/file\n@@ -1 +1 @@\n-old\n+new';
    const result = await run({
      ...opts, mode: 'diff',
      fetchFn: async () => ({ ok: true, status: 200, text: async () => diffText }),
    });
    assert.match(result.message, /=== DIFF ===/);
    assert.match(result.message, /\+new/);
  });

  it('mode=all 應包含所有區塊', async () => {
    const fetchFn = multiFetch({
      '/pullrequests/42/diffstat': DIFFSTAT_DATA,
      '/pullrequests/42/diff': '--- diff content ---',
      '/pullrequests/42': PR_DATA,
    });
    const result = await run({ ...opts, mode: 'all', fetchFn });
    assert.match(result.message, /=== PR INFO ===/);
    assert.match(result.message, /=== DIFFSTAT ===/);
    assert.match(result.message, /=== DIFF ===/);
  });

  it('應在 API 失敗時拋出錯誤', async () => {
    await assert.rejects(
      () => run({ ...opts, mode: 'info', fetchFn: mockFetch(500, 'error') }),
      /HTTP 500/,
    );
  });
});
