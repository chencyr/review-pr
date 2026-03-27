#!/usr/bin/env bash
# bb-auth.sh — 驗證 Bitbucket Cloud Access Token 有效性
set -euo pipefail

BB_API="https://api.bitbucket.org/2.0"

if [[ -z "${BITBUCKET_TOKEN:-}" ]]; then
  echo "ERROR: BITBUCKET_TOKEN 環境變數未設定"
  echo "請執行: export BITBUCKET_TOKEN=your_access_token"
  exit 1
fi

if [[ -z "${BITBUCKET_WORKSPACE:-}" ]]; then
  echo "ERROR: BITBUCKET_WORKSPACE 環境變數未設定"
  echo "請執行: export BITBUCKET_WORKSPACE=your_workspace"
  exit 1
fi

# 驗證 token — 嘗試取得 workspace 資訊
response=$(curl -s -w "\n%{http_code}" \
  -H "Authorization: Bearer ${BITBUCKET_TOKEN}" \
  -H "Accept: application/json" \
  "${BB_API}/workspaces/${BITBUCKET_WORKSPACE}")

http_code=$(echo "$response" | tail -1)
body=$(echo "$response" | sed '$d')

if [[ "$http_code" == "200" ]]; then
  workspace_name=$(echo "$body" | python3 -c "import sys,json; print(json.load(sys.stdin).get('name',''))" 2>/dev/null || echo "$BITBUCKET_WORKSPACE")
  echo "OK: 已連線至 workspace: ${workspace_name} (${BITBUCKET_WORKSPACE})"
  if [[ -n "${BITBUCKET_REPO:-}" ]]; then
    echo "預設 repository: ${BITBUCKET_REPO}"
  fi
  exit 0
elif [[ "$http_code" == "401" ]]; then
  echo "ERROR: Token 無效或已過期 (HTTP 401)"
  echo "請重新產生 Access Token: Bitbucket > Settings > Access Tokens"
  exit 1
elif [[ "$http_code" == "403" ]]; then
  echo "ERROR: Token 權限不足 (HTTP 403)"
  echo "所需權限: Repositories (Read), Pull Requests (Read/Write)"
  exit 1
elif [[ "$http_code" == "404" ]]; then
  echo "ERROR: Workspace '${BITBUCKET_WORKSPACE}' 不存在 (HTTP 404)"
  echo "請確認 BITBUCKET_WORKSPACE 環境變數是否正確"
  exit 1
else
  echo "ERROR: 未預期的錯誤 (HTTP ${http_code})"
  echo "$body"
  exit 1
fi
