import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as bb from '../providers/bitbucket.js';
import { mockFetch, BB_OPTS } from './helpers.js';

describe('bitbucket provider', () => {
  describe('auth', () => {
    it('應在缺少 token 時拋出錯誤', async () => {
      await assert.rejects(() => bb.auth({ owner: 'ws' }), /BITBUCKET_TOKEN/);
    });

    it('應在缺少 owner 時拋出錯誤', async () => {
      await assert.rejects(() => bb.auth({ token: 'tk' }), /BITBUCKET_WORKSPACE/);
    });

    it('應在驗證成功時回傳 ok', async () => {
      const result = await bb.auth({ ...BB_OPTS, fetchFn: mockFetch(200, { name: 'My WS' }) });
      assert.equal(result.ok, true);
      assert.match(result.message, /My WS/);
    });

    it('應在有預設 repo 時顯示', async () => {
      const result = await bb.auth({ ...BB_OPTS, fetchFn: mockFetch(200, { name: 'WS' }) });
      assert.match(result.message, /test-repo/);
    });

    it('應在 401 時拋出錯誤', async () => {
      await assert.rejects(() => bb.auth({ ...BB_OPTS, fetchFn: mockFetch(401, {}) }), /401/);
    });

    it('應在 403 時拋出錯誤', async () => {
      await assert.rejects(() => bb.auth({ ...BB_OPTS, fetchFn: mockFetch(403, {}) }), /403/);
    });

    it('應在 404 時拋出錯誤', async () => {
      await assert.rejects(() => bb.auth({ ...BB_OPTS, fetchFn: mockFetch(404, {}) }), /404/);
    });

    it('應帶正確的 Authorization header', async () => {
      let captured;
      const fetchFn = async (url, opts) => { captured = { url, opts }; return { ok: true, status: 200, json: async () => ({ name: 'W' }) }; };
      await bb.auth({ ...BB_OPTS, fetchFn });
      assert.match(captured.url, /workspaces\/test-ws/);
      assert.equal(captured.opts.headers.Authorization, 'Bearer bb-test-token');
    });
  });

  describe('approve', () => {
    it('approve 成功應回傳 ok', async () => {
      const result = await bb.approve({ ...BB_OPTS, prId: '42', fetchFn: mockFetch(200, {}) });
      assert.match(result.message, /PR #42 已 approve/);
    });

    it('unapprove 成功應回傳 ok (204)', async () => {
      const result = await bb.approve({ ...BB_OPTS, prId: '42', action: 'unapprove', fetchFn: mockFetch(204, {}) });
      assert.match(result.message, /unapprove/);
    });

    it('approve 應使用 POST', async () => {
      let method;
      const fetchFn = async (_, o) => { method = o.method; return { ok: true, status: 200 }; };
      await bb.approve({ ...BB_OPTS, prId: '1', fetchFn });
      assert.equal(method, 'POST');
    });

    it('unapprove 應使用 DELETE', async () => {
      let method;
      const fetchFn = async (_, o) => { method = o.method; return { ok: true, status: 204 }; };
      await bb.approve({ ...BB_OPTS, prId: '1', action: 'unapprove', fetchFn });
      assert.equal(method, 'DELETE');
    });

    it('未知 action 應拋出錯誤', async () => {
      await assert.rejects(() => bb.approve({ ...BB_OPTS, prId: '1', action: 'invalid' }), /未知操作/);
    });

    it('API 失敗應拋出錯誤', async () => {
      await assert.rejects(() => bb.approve({ ...BB_OPTS, prId: '1', fetchFn: mockFetch(403, '') }), /失敗.*403/);
    });
  });

  describe('comment', () => {
    it('應成功提交 general comment', async () => {
      let body;
      const fetchFn = async (_, o) => { body = JSON.parse(o.body); return { ok: true, status: 201, json: async () => ({ id: 99 }) }; };
      const result = await bb.comment({ ...BB_OPTS, prId: '1', type: 'general', message: 'LGTM', fetchFn });
      assert.match(result.message, /General comment #99/);
      assert.deepEqual(body, { content: { raw: 'LGTM' } });
    });

    it('應成功提交 inline comment', async () => {
      let body;
      const fetchFn = async (_, o) => { body = JSON.parse(o.body); return { ok: true, status: 201, json: async () => ({ id: 100 }) }; };
      const result = await bb.comment({ ...BB_OPTS, prId: '1', type: 'inline', filePath: 'a.js', lineNum: '10', message: 'Fix', fetchFn });
      assert.match(result.message, /Inline comment #100.*a\.js:10/);
      assert.deepEqual(body.inline, { path: 'a.js', to: 10 });
    });

    it('未知 type 應拋出錯誤', async () => {
      await assert.rejects(() => bb.comment({ ...BB_OPTS, prId: '1', type: 'bad' }), /未知 comment type/);
    });
  });

  describe('listRepos', () => {
    it('應列出 repositories', async () => {
      const data = { values: [{ slug: 'r1', project: { key: 'P' }, language: 'js', updated_on: '2026-01-01' }] };
      const result = await bb.listRepos({ ...BB_OPTS, fetchFn: mockFetch(200, data) });
      assert.match(result.message, /r1/);
      assert.equal(result.repos.length, 1);
    });

    it('空列表應回傳提示', async () => {
      const result = await bb.listRepos({ ...BB_OPTS, fetchFn: mockFetch(200, { values: [] }) });
      assert.match(result.message, /沒有 repository/);
    });
  });

  describe('listPrs', () => {
    it('應列出 PR', async () => {
      const data = { values: [{ id: 10, title: 'Fix', author: { display_name: 'A' }, source: { branch: { name: 'fix' } }, destination: { branch: { name: 'main' } }, reviewers: [], updated_on: '2026-01-01T00:00' }] };
      const result = await bb.listPrs({ ...BB_OPTS, fetchFn: mockFetch(200, data) });
      assert.match(result.message, /PR #10/);
    });

    it('未指定 repo 應拋出錯誤', async () => {
      await assert.rejects(() => bb.listPrs({ ...BB_OPTS, repo: undefined }), /未指定/);
    });
  });

  describe('getPr', () => {
    const PR = {
      id: 42, title: 'T', state: 'OPEN', author: { display_name: 'A' },
      source: { branch: { name: 'f' } }, destination: { branch: { name: 'm' } },
      description: 'D', reviewers: [], created_on: '2026-01-01T00:00', updated_on: '2026-01-02T00:00',
      links: { html: { href: 'https://bb.org/pr/42' } },
    };

    it('mode=info 應回傳 PR 資訊', async () => {
      const result = await bb.getPr({ ...BB_OPTS, prId: '42', mode: 'info', fetchFn: mockFetch(200, PR) });
      assert.match(result.message, /PR #42: T/);
    });

    it('mode=diffstat 應回傳摘要', async () => {
      const data = { values: [{ status: 'modified', lines_added: 5, lines_removed: 2, new: { path: 'a.js' } }] };
      const result = await bb.getPr({ ...BB_OPTS, prId: '42', mode: 'diffstat', fetchFn: mockFetch(200, data) });
      assert.match(result.message, /\[M\].*a\.js/);
      assert.match(result.message, /Total: 1 files/);
    });

    it('API 失敗應拋出錯誤', async () => {
      await assert.rejects(() => bb.getPr({ ...BB_OPTS, prId: '42', mode: 'info', fetchFn: mockFetch(500, '') }), /500/);
    });
  });
});
