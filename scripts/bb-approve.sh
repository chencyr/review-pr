#!/usr/bin/env bash
# bb-approve.sh — Approve 或 Unapprove 一個 PR
# 用法:
#   bb-approve.sh <pr_id> [repo_slug] [approve|unapprove]
set -euo pipefail

BB_API="https://api.bitbucket.org/2.0"
WORKSPACE="${BITBUCKET_WORKSPACE:?BITBUCKET_WORKSPACE 未設定}"
TOKEN="${BITBUCKET_TOKEN:?BITBUCKET_TOKEN 未設定}"

PR_ID="${1:?用法: bb-approve.sh <pr_id> [repo_slug] [approve|unapprove]}"
REPO="${2:-${BITBUCKET_REPO:-}}"
ACTION="${3:-approve}"

if [[ -z "$REPO" ]]; then
  echo "ERROR: 未指定 repository"
  exit 1
fi

URL="${BB_API}/repositories/${WORKSPACE}/${REPO}/pullrequests/${PR_ID}/approve"

if [[ "$ACTION" == "approve" ]]; then
  response=$(curl -s -w "\n%{http_code}" \
    -X POST \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Accept: application/json" \
    "$URL")
elif [[ "$ACTION" == "unapprove" ]]; then
  response=$(curl -s -w "\n%{http_code}" \
    -X DELETE \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Accept: application/json" \
    "$URL")
else
  echo "ERROR: 未知操作 '${ACTION}'，請使用 approve 或 unapprove"
  exit 1
fi

http_code=$(echo "$response" | tail -1)
body=$(echo "$response" | sed '$d')

if [[ "$http_code" == "200" || "$http_code" == "204" ]]; then
  echo "OK: PR #${PR_ID} 已 ${ACTION}"
else
  echo "ERROR: ${ACTION} 失敗 (HTTP ${http_code})"
  echo "$body"
  exit 1
fi
