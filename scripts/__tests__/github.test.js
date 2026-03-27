import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as gh from '../providers/github.js';
import { mockFetch, GH_OPTS } from './helpers.js';

describe('github provider', () => {
  describe('auth', () => {
    it('應在缺少 token 時拋出錯誤', async () => {
      await assert.rejects(() => gh.auth({}), /GITHUB_TOKEN/);
    });

    it('應在驗證成功時回傳 ok', async () => {
      const result = await gh.auth({ ...GH_OPTS, fetchFn: mockFetch(200, { login: 'alice', name: 'Alice' }) });
      assert.equal(result.ok, true);
      assert.match(result.message, /alice/);
    });

    it('應在 401 時拋出錯誤', async () => {
      await assert.rejects(() => gh.auth({ ...GH_OPTS, fetchFn: mockFetch(401, {}) }), /401/);
    });

    it('應帶正確的 headers', async () => {
      let captured;
      const fetchFn = async (url, opts) => { captured = opts; return { ok: true, status: 200, json: async () => ({ login: 'a' }) }; };
      await gh.auth({ ...GH_OPTS, fetchFn });
      assert.equal(captured.headers.Authorization, 'Bearer gh-test-token');
      assert.equal(captured.headers['X-GitHub-Api-Version'], '2022-11-28');
    });
  });

  describe('listRepos', () => {
    it('應列出 repositories', async () => {
      const repos = [{ name: 'api', language: 'Go', private: false, updated_at: '2026-01-01' }];
      const result = await gh.listRepos({ ...GH_OPTS, fetchFn: mockFetch(200, repos) });
      assert.match(result.message, /api/);
      assert.equal(result.repos.length, 1);
    });

    it('org 404 時應 fallback 到 user endpoint', async () => {
      let calls = 0;
      const fetchFn = async (url) => {
        calls++;
        if (url.includes('/orgs/')) return { ok: false, status: 404 };
        return { ok: true, status: 200, json: async () => [{ name: 'r', language: '-', private: false, updated_at: '' }] };
      };
      const result = await gh.listRepos({ ...GH_OPTS, fetchFn });
      assert.equal(calls, 2);
      assert.equal(result.repos.length, 1);
    });

    it('空列表應回傳提示', async () => {
      const result = await gh.listRepos({ ...GH_OPTS, fetchFn: mockFetch(200, []) });
      assert.match(result.message, /沒有 repository/);
    });

    it('缺少 owner 應拋出錯誤', async () => {
      await assert.rejects(() => gh.listRepos({ token: 'tk' }), /GITHUB_OWNER/);
    });
  });

  describe('listPrs', () => {
    const PRS = [
      { number: 1, title: 'Fix', user: { login: 'alice' }, head: { ref: 'fix' }, base: { ref: 'main' }, requested_reviewers: [], updated_at: '2026-01-01T00:00' },
    ];

    it('應列出 PR', async () => {
      const result = await gh.listPrs({ ...GH_OPTS, fetchFn: mockFetch(200, PRS) });
      assert.match(result.message, /PR #1 - Fix/);
    });

    it('MERGED state 應過濾已合併的 PR', async () => {
      const prs = [
        { ...PRS[0], merged_at: '2026-01-01' },
        { ...PRS[0], number: 2, title: 'Open', merged_at: null },
      ];
      const result = await gh.listPrs({ ...GH_OPTS, state: 'MERGED', fetchFn: mockFetch(200, prs) });
      assert.equal(result.prs.length, 1);
      assert.match(result.message, /PR #1/);
    });

    it('未指定 repo 應拋出錯誤', async () => {
      await assert.rejects(() => gh.listPrs({ ...GH_OPTS, repo: undefined }), /未指定/);
    });
  });

  describe('getPr', () => {
    const PR = {
      number: 42, title: 'Feature', state: 'open', merged: false,
      user: { login: 'alice' }, head: { ref: 'feat', sha: 'abc123' }, base: { ref: 'main' },
      body: 'Description', requested_reviewers: [{ login: 'bob' }],
      created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-02T00:00:00Z',
      html_url: 'https://github.com/org/repo/pull/42',
    };

    it('mode=info 應回傳 PR 資訊', async () => {
      const result = await gh.getPr({ ...GH_OPTS, prId: '42', mode: 'info', fetchFn: mockFetch(200, PR) });
      assert.match(result.message, /PR #42: Feature/);
      assert.match(result.message, /alice/);
      assert.match(result.message, /feat → main/);
    });

    it('mode=diffstat 應回傳檔案摘要', async () => {
      const files = [
        { filename: 'a.js', status: 'modified', additions: 10, deletions: 3 },
        { filename: 'b.js', status: 'added', additions: 20, deletions: 0 },
      ];
      const result = await gh.getPr({ ...GH_OPTS, prId: '42', mode: 'diffstat', fetchFn: mockFetch(200, files) });
      assert.match(result.message, /\[M\].*a\.js/);
      assert.match(result.message, /\[A\].*b\.js/);
      assert.match(result.message, /Total: 2 files, \+30 -3/);
    });

    it('mode=diff 應回傳 diff 文字', async () => {
      const fetchFn = async () => ({ ok: true, status: 200, text: async () => '--- a\n+++ b\n+new line' });
      const result = await gh.getPr({ ...GH_OPTS, prId: '42', mode: 'diff', fetchFn });
      assert.match(result.message, /DIFF/);
      assert.match(result.message, /\+new line/);
    });

    it('API 失敗應拋出錯誤', async () => {
      await assert.rejects(() => gh.getPr({ ...GH_OPTS, prId: '42', mode: 'info', fetchFn: mockFetch(404, '') }), /404/);
    });
  });

  describe('comment', () => {
    it('應成功提交 general comment', async () => {
      let body;
      const fetchFn = async (_, o) => { body = JSON.parse(o.body); return { ok: true, status: 201, json: async () => ({ id: 55 }) }; };
      const result = await gh.comment({ ...GH_OPTS, prId: '1', type: 'general', message: 'LGTM', fetchFn });
      assert.match(result.message, /General comment #55/);
      assert.deepEqual(body, { body: 'LGTM' });
    });

    it('應成功提交 inline comment', async () => {
      let commentBody;
      const fetchFn = async (url, o) => {
        if (url.includes('/pulls/1/comments')) {
          commentBody = JSON.parse(o.body);
          return { ok: true, status: 201, json: async () => ({ id: 66 }) };
        }
        // getPr for head sha
        return { ok: true, status: 200, json: async () => ({ head: { sha: 'abc123' } }) };
      };
      const result = await gh.comment({ ...GH_OPTS, prId: '1', type: 'inline', filePath: 'a.js', lineNum: '10', message: 'Fix', fetchFn });
      assert.match(result.message, /Inline comment #66.*a\.js:10/);
      assert.equal(commentBody.path, 'a.js');
      assert.equal(commentBody.line, 10);
      assert.equal(commentBody.commit_id, 'abc123');
    });

    it('未知 type 應拋出錯誤', async () => {
      await assert.rejects(() => gh.comment({ ...GH_OPTS, prId: '1', type: 'bad' }), /未知 comment type/);
    });
  });

  describe('approve', () => {
    it('approve 成功應回傳 ok', async () => {
      const result = await gh.approve({ ...GH_OPTS, prId: '42', fetchFn: mockFetch(200, { id: 1 }) });
      assert.match(result.message, /PR #42 已 approve/);
    });

    it('approve 應 POST review with APPROVE event', async () => {
      let body;
      const fetchFn = async (_, o) => { body = JSON.parse(o.body); return { ok: true, status: 200, json: async () => ({}) }; };
      await gh.approve({ ...GH_OPTS, prId: '1', fetchFn });
      assert.deepEqual(body, { event: 'APPROVE' });
    });

    it('未知 action 應拋出錯誤', async () => {
      await assert.rejects(() => gh.approve({ ...GH_OPTS, prId: '1', action: 'bad' }), /未知操作/);
    });

    it('API 失敗應拋出錯誤', async () => {
      await assert.rejects(() => gh.approve({ ...GH_OPTS, prId: '1', fetchFn: mockFetch(403, '') }), /失敗.*403/);
    });
  });
});
