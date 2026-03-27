import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { run } from '../bb-list-prs.js';
import { mockFetch, BASE_OPTS } from './helpers.js';

const PRS_DATA = {
  values: [
    {
      id: 10,
      title: 'Fix login bug',
      author: { display_name: 'Alice' },
      source: { branch: { name: 'fix/login' } },
      destination: { branch: { name: 'main' } },
      reviewers: [{ display_name: 'Bob' }],
      updated_on: '2026-03-25T10:00:00',
    },
    {
      id: 11,
      title: 'Add dashboard',
      author: { display_name: 'Charlie' },
      source: { branch: { name: 'feature/dashboard' } },
      destination: { branch: { name: 'develop' } },
      reviewers: [],
      updated_on: '2026-03-24T09:00:00',
    },
  ],
};

describe('bb-list-prs', () => {
  it('應在缺少必要參數時拋出錯誤', async () => {
    await assert.rejects(() => run({ token: 'tk' }), /未設定/);
    await assert.rejects(() => run({ ...BASE_OPTS, repo: undefined }), /未指定/);
  });

  it('應在沒有 PR 時回傳提示訊息', async () => {
    const result = await run({
      ...BASE_OPTS,
      fetchFn: mockFetch(200, { values: [] }),
    });
    assert.match(result.message, /目前沒有/);
    assert.deepEqual(result.prs, []);
  });

  it('應列出 PR', async () => {
    const result = await run({
      ...BASE_OPTS,
      fetchFn: mockFetch(200, PRS_DATA),
    });
    assert.match(result.message, /共 2 個 OPEN 的 PR/);
    assert.match(result.message, /PR #10 - Fix login bug/);
    assert.match(result.message, /PR #11 - Add dashboard/);
    assert.match(result.message, /Alice/);
    assert.match(result.message, /fix\/login → main/);
    assert.equal(result.prs.length, 2);
  });

  it('應在回傳中附帶 prs 陣列', async () => {
    const result = await run({
      ...BASE_OPTS,
      fetchFn: mockFetch(200, PRS_DATA),
    });
    assert.equal(result.prs[0].id, 10);
    assert.equal(result.prs[1].id, 11);
  });

  it('應傳遞 state 參數到 URL', async () => {
    let capturedUrl;
    const fetchFn = async (url) => {
      capturedUrl = url;
      return { ok: true, status: 200, json: async () => ({ values: [] }) };
    };
    await run({ ...BASE_OPTS, state: 'MERGED', fetchFn });
    assert.match(capturedUrl, /state=MERGED/);
  });

  it('應在 API 失敗時拋出錯誤', async () => {
    await assert.rejects(
      () => run({ ...BASE_OPTS, fetchFn: mockFetch(500, 'error') }),
      /500/,
    );
  });
});
