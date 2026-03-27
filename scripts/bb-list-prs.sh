#!/usr/bin/env bash
# bb-list-prs.sh — 列出 repository 中待 review 的 Pull Requests
# 用法: bb-list-prs.sh [repo_slug] [state]
set -euo pipefail

BB_API="https://api.bitbucket.org/2.0"
WORKSPACE="${BITBUCKET_WORKSPACE:?BITBUCKET_WORKSPACE 未設定}"
TOKEN="${BITBUCKET_TOKEN:?BITBUCKET_TOKEN 未設定}"

REPO="${1:-${BITBUCKET_REPO:-}}"
STATE="${2:-OPEN}"

if [[ -z "$REPO" ]]; then
  echo "ERROR: 未指定 repository"
  echo "用法: bb-list-prs.sh <repo_slug> [state]"
  echo "或設定 BITBUCKET_REPO 環境變數"
  exit 1
fi

response=$(curl -s -w "\n%{http_code}" -L \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Accept: application/json" \
  "${BB_API}/repositories/${WORKSPACE}/${REPO}/pullrequests?state=${STATE}&pagelen=50&sort=-updated_on")

http_code=$(echo "$response" | tail -1)
body=$(echo "$response" | sed '$d')

if [[ "$http_code" != "200" ]]; then
  echo "ERROR: 無法取得 pull requests (HTTP ${http_code})"
  echo "$body"
  exit 1
fi

echo "$body" | python3 -c "
import sys, json
data = json.load(sys.stdin)
prs = data.get('values', [])
if not prs:
    print('目前沒有狀態為 ${STATE} 的 Pull Request')
    sys.exit(0)
print(f'共 {len(prs)} 個 ${STATE} 的 PR:\n')
for i, pr in enumerate(prs, 1):
    pr_id = pr.get('id', '')
    title = pr.get('title', '')
    author = pr.get('author', {}).get('display_name', 'unknown')
    source = pr.get('source', {}).get('branch', {}).get('name', '?')
    dest = pr.get('destination', {}).get('branch', {}).get('name', '?')
    reviewers = ', '.join(r.get('display_name', '') for r in pr.get('reviewers', []))
    updated = pr.get('updated_on', '')[:16].replace('T', ' ')
    print(f'{i:3d}. PR #{pr_id} - {title}')
    print(f'     Author: {author} | {source} → {dest}')
    print(f'     Reviewers: {reviewers or \"(none)\"}')
    print(f'     Updated: {updated}')
    print()
"
