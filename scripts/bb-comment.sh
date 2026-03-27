#!/usr/bin/env bash
# bb-comment.sh — 提交 PR Comment (general 或 inline)
# 用法:
#   bb-comment.sh <pr_id> <repo> general <message>
#   bb-comment.sh <pr_id> <repo> inline <file_path> <line_number> <message>
set -euo pipefail

BB_API="https://api.bitbucket.org/2.0"
WORKSPACE="${BITBUCKET_WORKSPACE:?BITBUCKET_WORKSPACE 未設定}"
TOKEN="${BITBUCKET_TOKEN:?BITBUCKET_TOKEN 未設定}"

PR_ID="${1:?用法: bb-comment.sh <pr_id> <repo> general|inline ...}"
REPO="${2:?需要 repo_slug}"
TYPE="${3:?需要 comment type: general 或 inline}"

URL="${BB_API}/repositories/${WORKSPACE}/${REPO}/pullrequests/${PR_ID}/comments"

if [[ "$TYPE" == "general" ]]; then
  MESSAGE="${4:?需要 comment 內容}"
  payload=$(python3 -c "
import json, sys
print(json.dumps({'content': {'raw': sys.argv[1]}}, ensure_ascii=False))
" "$MESSAGE")

elif [[ "$TYPE" == "inline" ]]; then
  FILE_PATH="${4:?需要檔案路徑}"
  LINE_NUM="${5:?需要行號}"
  MESSAGE="${6:?需要 comment 內容}"
  payload=$(python3 -c "
import json, sys
print(json.dumps({
    'content': {'raw': sys.argv[1]},
    'inline': {'path': sys.argv[2], 'to': int(sys.argv[3])}
}, ensure_ascii=False))
" "$MESSAGE" "$FILE_PATH" "$LINE_NUM")

else
  echo "ERROR: 未知 comment type: ${TYPE} (請使用 general 或 inline)"
  exit 1
fi

response=$(curl -s -w "\n%{http_code}" \
  -X POST \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d "$payload" \
  "$URL")

http_code=$(echo "$response" | tail -1)
body=$(echo "$response" | sed '$d')

if [[ "$http_code" == "201" ]]; then
  comment_id=$(echo "$body" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || echo "?")
  if [[ "$TYPE" == "inline" ]]; then
    echo "OK: Inline comment #${comment_id} 已提交至 ${FILE_PATH}:${LINE_NUM}"
  else
    echo "OK: General comment #${comment_id} 已提交"
  fi
else
  echo "ERROR: 提交 comment 失敗 (HTTP ${http_code})"
  echo "$body"
  exit 1
fi
