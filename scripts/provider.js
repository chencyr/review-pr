// provider.js — 根據環境變數自動偵測並載入對應的 Git provider

import * as github from './providers/github.js';
import * as bitbucket from './providers/bitbucket.js';

const PROVIDERS = [
  { module: github,    envToken: 'GITHUB_TOKEN',    envOwner: 'GITHUB_OWNER',        envRepo: 'GITHUB_REPO' },
  { module: bitbucket, envToken: 'BITBUCKET_TOKEN',  envOwner: 'BITBUCKET_WORKSPACE', envRepo: 'BITBUCKET_REPO' },
];

export function detect(env = process.env) {
  for (const p of PROVIDERS) {
    const token = env[p.envToken];
    if (token) {
      return {
        ...p.module,
        token,
        owner: env[p.envOwner],
        repo: env[p.envRepo],
      };
    }
  }
  throw new Error('未偵測到任何 provider。請設定 GITHUB_TOKEN 或 BITBUCKET_TOKEN');
}
