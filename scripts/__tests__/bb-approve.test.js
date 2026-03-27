import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { run } from '../bb-approve.js';
import { mockFetch, BASE_OPTS } from './helpers.js';

describe('bb-approve', () => {
  const opts = { ...BASE_OPTS, prId: '42' };

  it('應在缺少必要參數時拋出錯誤', async () => {
    await assert.rejects(() => run({ token: 'tk' }), /未設定/);
    await assert.rejects(() => run({ ...BASE_OPTS }), /用法/);
    await assert.rejects(() => run({ ...BASE_OPTS, prId: '1', repo: undefined }), /未指定/);
  });

  it('應在未知 action 時拋出錯誤', async () => {
    await assert.rejects(
      () => run({ ...opts, action: 'invalid', fetchFn: mockFetch(200, {}) }),
      /未知操作/,
    );
  });

  it('approve 成功時應回傳 ok', async () => {
    const result = await run({ ...opts, fetchFn: mockFetch(200, {}) });
    assert.equal(result.ok, true);
    assert.match(result.message, /PR #42 已 approve/);
  });

  it('unapprove 成功時應回傳 ok (204)', async () => {
    const result = await run({ ...opts, action: 'unapprove', fetchFn: mockFetch(204, {}) });
    assert.match(result.message, /unapprove/);
  });

  it('approve 應使用 POST 方法', async () => {
    let method;
    const fetchFn = async (_, o) => { method = o.method; return { ok: true, status: 200 }; };
    await run({ ...opts, fetchFn });
    assert.equal(method, 'POST');
  });

  it('unapprove 應使用 DELETE 方法', async () => {
    let method;
    const fetchFn = async (_, o) => { method = o.method; return { ok: true, status: 204 }; };
    await run({ ...opts, action: 'unapprove', fetchFn });
    assert.equal(method, 'DELETE');
  });

  it('應在 API 失敗時拋出錯誤', async () => {
    await assert.rejects(
      () => run({ ...opts, fetchFn: mockFetch(403, 'forbidden') }),
      /失敗.*403/,
    );
  });
});
