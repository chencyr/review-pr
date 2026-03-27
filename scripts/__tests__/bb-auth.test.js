import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { run } from '../bb-auth.js';
import { mockFetch, BASE_OPTS } from './helpers.js';

describe('bb-auth', () => {
  it('應在缺少 token 時拋出錯誤', async () => {
    await assert.rejects(() => run({ workspace: 'ws' }), /BITBUCKET_TOKEN/);
  });

  it('應在缺少 workspace 時拋出錯誤', async () => {
    await assert.rejects(() => run({ token: 'tk' }), /BITBUCKET_WORKSPACE/);
  });

  it('應在驗證成功時回傳 ok', async () => {
    const result = await run({
      ...BASE_OPTS,
      fetchFn: mockFetch(200, { name: 'My Workspace' }),
    });
    assert.equal(result.ok, true);
    assert.match(result.message, /My Workspace/);
  });

  it('應在有預設 repo 時顯示', async () => {
    const result = await run({
      ...BASE_OPTS,
      fetchFn: mockFetch(200, { name: 'WS' }),
    });
    assert.match(result.message, /test-repo/);
  });

  it('應在 401 時拋出錯誤', async () => {
    await assert.rejects(
      () => run({ ...BASE_OPTS, fetchFn: mockFetch(401, {}) }),
      /401/,
    );
  });

  it('應在 403 時拋出錯誤', async () => {
    await assert.rejects(
      () => run({ ...BASE_OPTS, fetchFn: mockFetch(403, {}) }),
      /403/,
    );
  });

  it('應在 404 時拋出錯誤', async () => {
    await assert.rejects(
      () => run({ ...BASE_OPTS, fetchFn: mockFetch(404, {}) }),
      /404/,
    );
  });

  it('應在未知狀態碼時拋出錯誤', async () => {
    await assert.rejects(
      () => run({ ...BASE_OPTS, fetchFn: mockFetch(500, {}) }),
      /500/,
    );
  });

  it('應帶正確的 Authorization header 呼叫 fetch', async () => {
    let capturedUrl, capturedOpts;
    const fetchFn = async (url, opts) => {
      capturedUrl = url;
      capturedOpts = opts;
      return { ok: true, status: 200, json: async () => ({ name: 'WS' }) };
    };
    await run({ ...BASE_OPTS, fetchFn });
    assert.match(capturedUrl, /workspaces\/test-ws/);
    assert.equal(capturedOpts.headers.Authorization, 'Bearer test-token');
  });
});
