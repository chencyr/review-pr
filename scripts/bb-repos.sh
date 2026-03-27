#!/usr/bin/env bash
# bb-repos.sh — 列出 workspace 下的 repositories
set -euo pipefail

BB_API="https://api.bitbucket.org/2.0"
WORKSPACE="${BITBUCKET_WORKSPACE:?BITBUCKET_WORKSPACE 未設定}"
TOKEN="${BITBUCKET_TOKEN:?BITBUCKET_TOKEN 未設定}"

PAGELEN="${1:-50}"

response=$(curl -s -w "\n%{http_code}" -L \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Accept: application/json" \
  "${BB_API}/repositories/${WORKSPACE}?pagelen=${PAGELEN}&sort=-updated_on")

http_code=$(echo "$response" | tail -1)
body=$(echo "$response" | sed '$d')

if [[ "$http_code" != "200" ]]; then
  echo "ERROR: 無法取得 repositories (HTTP ${http_code})"
  echo "$body"
  exit 1
fi

echo "$body" | python3 -c "
import sys, json
data = json.load(sys.stdin)
repos = data.get('values', [])
if not repos:
    print('此 workspace 下沒有 repository')
    sys.exit(0)
print(f'共 {len(repos)} 個 repositories:\n')
for i, r in enumerate(repos, 1):
    slug = r.get('slug', '')
    name = r.get('name', '')
    lang = r.get('language', '-')
    project = r.get('project', {}).get('key', '-')
    updated = r.get('updated_on', '')[:10]
    print(f'{i:3d}. {slug:<40s} [{project}] lang={lang} updated={updated}')
"
