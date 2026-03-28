// provider.js — 根據環境變數自動偵測並載入對應的 Git provider
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as github from './providers/github.js';
import * as bitbucket from './providers/bitbucket.js';

const PROVIDERS = [
  { module: github,    envToken: 'GITHUB_TOKEN',    envOwner: 'GITHUB_OWNER',        envRepo: 'GITHUB_REPO' },
  { module: bitbucket, envToken: 'BITBUCKET_TOKEN',  envOwner: 'BITBUCKET_WORKSPACE', envRepo: 'BITBUCKET_REPO' },
];

const SKILL_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function parseDotEnvValue(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function loadDotEnv(filePath) {
  if (!filePath) {
    const cwdEnv = path.join(process.cwd(), '.env');
    filePath = fs.existsSync(cwdEnv) ? cwdEnv : path.join(SKILL_ROOT, '.env');
  }
  if (!fs.existsSync(filePath)) return {};

  const parsed = {};
  const content = fs.readFileSync(filePath, 'utf8');

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const normalized = line.startsWith('export ') ? line.slice(7).trim() : line;
    const separatorIndex = normalized.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = normalized.slice(0, separatorIndex).trim();
    if (!key) continue;

    const value = normalized.slice(separatorIndex + 1);
    parsed[key] = parseDotEnvValue(value);
  }

  return parsed;
}

export function detect(env = process.env) {
  const effectiveEnv =
    env === process.env ? { ...loadDotEnv(), ...process.env } : env;

  for (const p of PROVIDERS) {
    const token = effectiveEnv[p.envToken];
    if (token) {
      return {
        ...p.module,
        token,
        owner: effectiveEnv[p.envOwner],
        repo: effectiveEnv[p.envRepo],
      };
    }
  }
  throw new Error('未偵測到任何 provider。請設定 GITHUB_TOKEN 或 BITBUCKET_TOKEN');
}
