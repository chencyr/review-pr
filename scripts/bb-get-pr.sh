#!/usr/bin/env bash
# bb-get-pr.sh — 取得 PR 詳細資訊、diffstat 與 diff
# 用法: bb-get-pr.sh <pr_id> [repo_slug]
# 輸出模式:
#   bb-get-pr.sh <pr_id> [repo] info     — 僅 PR 基本資訊 (JSON)
#   bb-get-pr.sh <pr_id> [repo] diffstat — 僅 diffstat (JSON)
#   bb-get-pr.sh <pr_id> [repo] diff     — 僅 unified diff (text)
#   bb-get-pr.sh <pr_id> [repo]          — 全部 (預設)
set -euo pipefail

BB_API="https://api.bitbucket.org/2.0"
WORKSPACE="${BITBUCKET_WORKSPACE:?BITBUCKET_WORKSPACE 未設定}"
TOKEN="${BITBUCKET_TOKEN:?BITBUCKET_TOKEN 未設定}"

PR_ID="${1:?用法: bb-get-pr.sh <pr_id> [repo_slug] [info|diffstat|diff]}"
REPO="${2:-${BITBUCKET_REPO:-}}"
MODE="${3:-all}"

if [[ -z "$REPO" ]]; then
  echo "ERROR: 未指定 repository"
  exit 1
fi

BASE="${BB_API}/repositories/${WORKSPACE}/${REPO}/pullrequests/${PR_ID}"

fetch() {
  local url="$1"
  local accept="${2:-application/json}"
  local resp
  resp=$(curl -s -w "\n%{http_code}" -L \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Accept: ${accept}" \
    "$url")
  local code
  code=$(echo "$resp" | tail -1)
  local body
  body=$(echo "$resp" | sed '$d')
  if [[ "$code" != "200" ]]; then
    echo "ERROR: HTTP ${code} for ${url}" >&2
    echo "$body" >&2
    return 1
  fi
  echo "$body"
}

# PR 基本資訊
if [[ "$MODE" == "all" || "$MODE" == "info" ]]; then
  echo "=== PR INFO ==="
  pr_info=$(fetch "$BASE")
  echo "$pr_info" | python3 -c "
import sys, json
pr = json.load(sys.stdin)
print(f\"PR #{pr['id']}: {pr['title']}\")
print(f\"State: {pr['state']}\")
print(f\"Author: {pr['author']['display_name']}\")
print(f\"Source: {pr['source']['branch']['name']} → {pr['destination']['branch']['name']}\")
print(f\"Description:\")
desc = pr.get('description', '') or '(none)'
print(desc[:2000])
print(f\"\nReviewers: {', '.join(r['display_name'] for r in pr.get('reviewers', []))}\")
print(f\"Created: {pr['created_on'][:16]}\")
print(f\"Updated: {pr['updated_on'][:16]}\")
print(f\"Link: {pr['links']['html']['href']}\")
"
  if [[ "$MODE" == "info" ]]; then exit 0; fi
fi

# Diffstat
if [[ "$MODE" == "all" || "$MODE" == "diffstat" ]]; then
  echo ""
  echo "=== DIFFSTAT ==="
  diffstat=$(fetch "${BASE}/diffstat")
  echo "$diffstat" | python3 -c "
import sys, json
data = json.load(sys.stdin)
files = data.get('values', [])
total_add = 0
total_del = 0
for f in files:
    status = f.get('status', '?')
    added = f.get('lines_added', 0)
    removed = f.get('lines_removed', 0)
    total_add += added
    total_del += removed
    old_path = (f.get('old') or {}).get('path', '')
    new_path = (f.get('new') or {}).get('path', '')
    path = new_path or old_path
    symbol = {'added': 'A', 'removed': 'D', 'modified': 'M', 'renamed': 'R'}.get(status, '?')
    print(f'  [{symbol}] {path:<60s} +{added:<5d} -{removed}')
print(f\"\nTotal: {len(files)} files, +{total_add} -{total_del}\")
"
  if [[ "$MODE" == "diffstat" ]]; then exit 0; fi
fi

# Unified diff
if [[ "$MODE" == "all" || "$MODE" == "diff" ]]; then
  echo ""
  echo "=== DIFF ==="
  fetch "${BASE}/diff" "text/plain"
fi
