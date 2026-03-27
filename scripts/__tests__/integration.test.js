import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { run as authRun } from '../bb-auth.js';
import { run as reposRun } from '../bb-repos.js';
import { run as listPrsRun } from '../bb-list-prs.js';
import { run as getPrRun } from '../bb-get-pr.js';

const TOKEN = process.env.BITBUCKET_TOKEN;
const WORKSPACE = process.env.BITBUCKET_WORKSPACE;
const REPO = process.env.BITBUCKET_REPO;

const skip = !TOKEN || !WORKSPACE;

describe('integration (real API, read-only)', { skip }, () => {
  // bb-approve, bb-comment 有寫入行為，不納入整合測試

  describe('bb-auth', () => {
    it('應成功驗證連線', async () => {
      const result = await authRun({ token: TOKEN, workspace: WORKSPACE, repo: REPO });
      assert.equal(result.ok, true);
      assert.match(result.message, /OK: 已連線至 workspace/);
    });

    it('應在無效 token 時拋出 401 錯誤', async () => {
      await assert.rejects(
        () => authRun({ token: 'invalid-token-xxx', workspace: WORKSPACE }),
        /401/,
      );
    });

    it('應在不存在的 workspace 時拋出錯誤', async () => {
      await assert.rejects(
        () => authRun({ token: TOKEN, workspace: 'nonexistent-ws-zzz-999' }),
        /404|403/,
      );
    });
  });

  describe('bb-repos', () => {
    it('應列出 workspace 的 repositories', async () => {
      const result = await reposRun({ token: TOKEN, workspace: WORKSPACE, pagelen: '5' });
      assert.equal(result.ok, true);
      assert.ok(Array.isArray(result.repos));
    });

    it('應支援 pagelen 參數', async () => {
      const result = await reposRun({ token: TOKEN, workspace: WORKSPACE, pagelen: '2' });
      assert.ok(result.repos.length <= 2);
    });
  });

  describe('bb-list-prs', { skip: !REPO }, () => {
    it('應列出 PR (不論有無結果都不報錯)', async () => {
      const result = await listPrsRun({ token: TOKEN, workspace: WORKSPACE, repo: REPO });
      assert.equal(result.ok, true);
      assert.ok(Array.isArray(result.prs));
    });

    it('應支援 state 參數', async () => {
      const result = await listPrsRun({ token: TOKEN, workspace: WORKSPACE, repo: REPO, state: 'MERGED' });
      assert.equal(result.ok, true);
      assert.ok(Array.isArray(result.prs));
    });
  });

  describe('bb-get-pr', { skip: !REPO }, () => {
    let prId;

    before(async () => {
      // 取得一個真實存在的 PR ID（任何狀態），若無 PR 則跳過
      const list = await listPrsRun({ token: TOKEN, workspace: WORKSPACE, repo: REPO, state: 'OPEN' });
      if (!list.prs.length) {
        const merged = await listPrsRun({ token: TOKEN, workspace: WORKSPACE, repo: REPO, state: 'MERGED' });
        prId = merged.prs[0]?.id;
      } else {
        prId = list.prs[0].id;
      }
    });

    it('mode=info 應取得 PR 資訊', { skip: !prId }, async () => {
      const result = await getPrRun({ token: TOKEN, workspace: WORKSPACE, repo: REPO, prId: String(prId), mode: 'info' });
      assert.equal(result.ok, true);
      assert.match(result.message, /PR #/);
      assert.match(result.message, /State:/);
      assert.match(result.message, /Author:/);
    });

    it('mode=diffstat 應取得變更摘要', { skip: !prId }, async () => {
      const result = await getPrRun({ token: TOKEN, workspace: WORKSPACE, repo: REPO, prId: String(prId), mode: 'diffstat' });
      assert.equal(result.ok, true);
      assert.match(result.message, /DIFFSTAT/);
      assert.match(result.message, /Total:/);
    });

    it('mode=diff 應取得 unified diff', { skip: !prId }, async () => {
      const result = await getPrRun({ token: TOKEN, workspace: WORKSPACE, repo: REPO, prId: String(prId), mode: 'diff' });
      assert.equal(result.ok, true);
      assert.match(result.message, /DIFF/);
    });
  });
});
