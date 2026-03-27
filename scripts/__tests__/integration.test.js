import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import * as bb from '../providers/bitbucket.js';
import * as gh from '../providers/github.js';

// === Bitbucket Cloud ===
const BB_TOKEN = process.env.BITBUCKET_TOKEN;
const BB_WS = process.env.BITBUCKET_WORKSPACE;
const BB_REPO = process.env.BITBUCKET_REPO;
const skipBB = !BB_TOKEN || !BB_WS;

describe('integration: Bitbucket Cloud (read-only)', { skip: skipBB }, () => {
  describe('auth', () => {
    it('應成功驗證連線', async () => {
      const result = await bb.auth({ token: BB_TOKEN, owner: BB_WS, repo: BB_REPO });
      assert.equal(result.ok, true);
      assert.match(result.message, /OK: 已連線至 Bitbucket/);
    });

    it('應在無效 token 時拋出 401', async () => {
      await assert.rejects(() => bb.auth({ token: 'invalid', owner: BB_WS }), /401/);
    });
  });

  describe('listRepos', () => {
    it('應列出 repositories', async () => {
      const result = await bb.listRepos({ token: BB_TOKEN, owner: BB_WS, pagelen: '5' });
      assert.equal(result.ok, true);
      assert.ok(Array.isArray(result.repos));
    });
  });

  describe('listPrs', { skip: !BB_REPO }, () => {
    it('應列出 PR', async () => {
      const result = await bb.listPrs({ token: BB_TOKEN, owner: BB_WS, repo: BB_REPO });
      assert.equal(result.ok, true);
      assert.ok(Array.isArray(result.prs));
    });
  });

  describe('getPr', { skip: !BB_REPO }, () => {
    let prId;
    before(async () => {
      const list = await bb.listPrs({ token: BB_TOKEN, owner: BB_WS, repo: BB_REPO });
      if (!list.prs.length) {
        const merged = await bb.listPrs({ token: BB_TOKEN, owner: BB_WS, repo: BB_REPO, state: 'MERGED' });
        prId = merged.prs[0]?.id;
      } else {
        prId = list.prs[0].id;
      }
    });

    it('mode=info 應取得 PR 資訊', { skip: !prId }, async () => {
      const result = await bb.getPr({ token: BB_TOKEN, owner: BB_WS, repo: BB_REPO, prId: String(prId), mode: 'info' });
      assert.match(result.message, /PR #/);
    });

    it('mode=diffstat 應取得變更摘要', { skip: !prId }, async () => {
      const result = await bb.getPr({ token: BB_TOKEN, owner: BB_WS, repo: BB_REPO, prId: String(prId), mode: 'diffstat' });
      assert.match(result.message, /DIFFSTAT/);
    });
  });
});

// === GitHub ===
const GH_TOKEN = process.env.GITHUB_TOKEN;
const GH_OWNER = process.env.GITHUB_OWNER;
const GH_REPO = process.env.GITHUB_REPO;
const skipGH = !GH_TOKEN;

describe('integration: GitHub (read-only)', { skip: skipGH }, () => {
  describe('auth', () => {
    it('應成功驗證連線', async () => {
      const result = await gh.auth({ token: GH_TOKEN, owner: GH_OWNER, repo: GH_REPO });
      assert.equal(result.ok, true);
      assert.match(result.message, /OK: 已連線至 GitHub/);
    });

    it('應在無效 token 時拋出 401', async () => {
      await assert.rejects(() => gh.auth({ token: 'invalid' }), /401/);
    });
  });

  describe('listRepos', { skip: !GH_OWNER }, () => {
    it('應列出 repositories', async () => {
      const result = await gh.listRepos({ token: GH_TOKEN, owner: GH_OWNER, pagelen: '5' });
      assert.equal(result.ok, true);
      assert.ok(Array.isArray(result.repos));
    });
  });

  describe('listPrs', { skip: !GH_OWNER || !GH_REPO }, () => {
    it('應列出 PR', async () => {
      const result = await gh.listPrs({ token: GH_TOKEN, owner: GH_OWNER, repo: GH_REPO });
      assert.equal(result.ok, true);
      assert.ok(Array.isArray(result.prs));
    });
  });

  describe('getPr', { skip: !GH_OWNER || !GH_REPO }, () => {
    let prId;
    before(async () => {
      const list = await gh.listPrs({ token: GH_TOKEN, owner: GH_OWNER, repo: GH_REPO });
      if (!list.prs.length) {
        const closed = await gh.listPrs({ token: GH_TOKEN, owner: GH_OWNER, repo: GH_REPO, state: 'closed' });
        prId = closed.prs[0]?.number;
      } else {
        prId = list.prs[0].number;
      }
    });

    it('mode=info 應取得 PR 資訊', { skip: !prId }, async () => {
      const result = await gh.getPr({ token: GH_TOKEN, owner: GH_OWNER, repo: GH_REPO, prId: String(prId), mode: 'info' });
      assert.match(result.message, /PR #/);
    });

    it('mode=diffstat 應取得變更摘要', { skip: !prId }, async () => {
      const result = await gh.getPr({ token: GH_TOKEN, owner: GH_OWNER, repo: GH_REPO, prId: String(prId), mode: 'diffstat' });
      assert.match(result.message, /DIFFSTAT/);
    });
  });
});
