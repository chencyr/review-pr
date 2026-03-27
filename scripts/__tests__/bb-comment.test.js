import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { run } from '../bb-comment.js';
import { mockFetch, BASE_OPTS } from './helpers.js';

describe('bb-comment', () => {
  it('應在缺少必要參數時拋出錯誤', async () => {
    await assert.rejects(() => run({ token: 'tk' }), /未設定/);
    await assert.rejects(() => run({ ...BASE_OPTS, prId: '1' }), /用法/);
  });

  it('應在未知 comment type 時拋出錯誤', async () => {
    await assert.rejects(
      () => run({ ...BASE_OPTS, prId: '1', type: 'unknown' }),
      /未知 comment type/,
    );
  });

  it('general comment 缺少 message 時應拋出錯誤', async () => {
    await assert.rejects(
      () => run({ ...BASE_OPTS, prId: '1', type: 'general' }),
      /需要 comment/,
    );
  });

  it('inline comment 缺少參數時應拋出錯誤', async () => {
    await assert.rejects(
      () => run({ ...BASE_OPTS, prId: '1', type: 'inline', filePath: 'a.js' }),
      /用法/,
    );
  });

  it('應成功提交 general comment', async () => {
    let body;
    const fetchFn = async (_, o) => {
      body = JSON.parse(o.body);
      return { ok: true, status: 201, json: async () => ({ id: 99 }) };
    };
    const result = await run({ ...BASE_OPTS, prId: '1', type: 'general', message: 'LGTM', fetchFn });
    assert.equal(result.ok, true);
    assert.match(result.message, /General comment #99/);
    assert.deepEqual(body, { content: { raw: 'LGTM' } });
  });

  it('應成功提交 inline comment', async () => {
    let body;
    const fetchFn = async (_, o) => {
      body = JSON.parse(o.body);
      return { ok: true, status: 201, json: async () => ({ id: 100 }) };
    };
    const result = await run({
      ...BASE_OPTS, prId: '1', type: 'inline',
      filePath: 'src/app.js', lineNum: '42', message: 'Fix this',
      fetchFn,
    });
    assert.match(result.message, /Inline comment #100.*src\/app\.js:42/);
    assert.deepEqual(body.inline, { path: 'src/app.js', to: 42 });
  });

  it('應在 API 失敗時拋出錯誤', async () => {
    await assert.rejects(
      () => run({
        ...BASE_OPTS, prId: '1', type: 'general', message: 'test',
        fetchFn: mockFetch(400, 'bad request'),
      }),
      /失敗.*400/,
    );
  });
});
