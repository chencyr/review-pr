import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { detect, loadDotEnv } from '../provider.js';

describe('provider detection', () => {
  it('應在設定 GITHUB_TOKEN 時偵測為 GitHub', () => {
    const p = detect({ GITHUB_TOKEN: 'ghp_xxx', GITHUB_OWNER: 'org', GITHUB_REPO: 'repo' });
    assert.equal(p.id, 'github');
    assert.equal(p.token, 'ghp_xxx');
    assert.equal(p.owner, 'org');
    assert.equal(p.repo, 'repo');
  });

  it('應在設定 BITBUCKET_TOKEN 時偵測為 Bitbucket', () => {
    const p = detect({ BITBUCKET_TOKEN: 'bb_xxx', BITBUCKET_WORKSPACE: 'ws', BITBUCKET_REPO: 'repo' });
    assert.equal(p.id, 'bitbucket');
    assert.equal(p.token, 'bb_xxx');
    assert.equal(p.owner, 'ws');
  });

  it('應在兩者都設定時優先使用 GitHub', () => {
    const p = detect({ GITHUB_TOKEN: 'gh', BITBUCKET_TOKEN: 'bb' });
    assert.equal(p.id, 'github');
  });

  it('應在沒有 token 時拋出錯誤', () => {
    assert.throws(() => detect({}), /未偵測到任何 provider/);
  });

  it('偵測結果應包含 provider 的函式', () => {
    const p = detect({ GITHUB_TOKEN: 'ghp_xxx' });
    assert.equal(typeof p.auth, 'function');
    assert.equal(typeof p.listRepos, 'function');
    assert.equal(typeof p.listPrs, 'function');
    assert.equal(typeof p.getPr, 'function');
    assert.equal(typeof p.comment, 'function');
    assert.equal(typeof p.approve, 'function');
  });

  it('應可從 .env 檔案載入 provider 設定', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'review-pr-env-'));
    const envPath = path.join(tempDir, '.env');

    fs.writeFileSync(
      envPath,
      [
        '# comment',
        'BITBUCKET_TOKEN=bb_from_file',
        'BITBUCKET_WORKSPACE="workspace-from-file"',
        'BITBUCKET_REPO=repo-from-file',
      ].join('\n'),
    );

    const loaded = loadDotEnv(envPath);
    assert.deepEqual(loaded, {
      BITBUCKET_TOKEN: 'bb_from_file',
      BITBUCKET_WORKSPACE: 'workspace-from-file',
      BITBUCKET_REPO: 'repo-from-file',
    });
  });
});
