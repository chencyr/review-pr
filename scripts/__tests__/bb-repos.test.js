import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { run } from '../bb-repos.js';
import { mockFetch, BASE_OPTS } from './helpers.js';

const REPOS_DATA = {
  values: [
    { slug: 'my-api', name: 'My API', project: { key: 'PROJ' }, language: 'javascript', updated_on: '2026-03-20T00:00:00' },
    { slug: 'my-frontend', name: 'Frontend', project: { key: 'PROJ' }, language: 'typescript', updated_on: '2026-03-18T00:00:00' },
  ],
};

describe('bb-repos', () => {
  it('應在缺少必要參數時拋出錯誤', async () => {
    await assert.rejects(() => run({ token: 'tk' }), /未設定/);
  });

  it('應在沒有 repo 時回傳提示訊息', async () => {
    const result = await run({
      ...BASE_OPTS,
      fetchFn: mockFetch(200, { values: [] }),
    });
    assert.match(result.message, /沒有 repository/);
    assert.deepEqual(result.repos, []);
  });

  it('應列出 repositories', async () => {
    const result = await run({
      ...BASE_OPTS,
      fetchFn: mockFetch(200, REPOS_DATA),
    });
    assert.match(result.message, /共 2 個 repositories/);
    assert.match(result.message, /my-api/);
    assert.match(result.message, /my-frontend/);
    assert.match(result.message, /\[PROJ\]/);
    assert.equal(result.repos.length, 2);
  });

  it('應傳遞 pagelen 參數到 URL', async () => {
    let capturedUrl;
    const fetchFn = async (url) => {
      capturedUrl = url;
      return { ok: true, status: 200, json: async () => ({ values: [] }) };
    };
    await run({ ...BASE_OPTS, pagelen: '10', fetchFn });
    assert.match(capturedUrl, /pagelen=10/);
  });

  it('應在 API 失敗時拋出錯誤', async () => {
    await assert.rejects(
      () => run({ ...BASE_OPTS, fetchFn: mockFetch(403, 'forbidden') }),
      /403/,
    );
  });
});
