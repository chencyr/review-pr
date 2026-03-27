# Bitbucket Code Review Agent

此專案是一個 Claude Code Agent Skill，用於自動化 Bitbucket Cloud PR Code Review。

## 專案結構

- `SPEC.md` — 系統設計規格書
- `.claude/skills/review-pr/` — 主要 Skill
  - `SKILL.md` — Skill 入口點與流程定義
  - `prompts/review-checklist.md` — 五大面向分析指引
  - `prompts/comment-template.md` — PR Comment 格式模板
  - `scripts/bb-*.sh` — Bitbucket API 操作腳本

## 環境需求

- `BITBUCKET_TOKEN` — Bitbucket Cloud Access Token
- `BITBUCKET_WORKSPACE` — Workspace slug
- `BITBUCKET_REPO` — 預設 Repository slug (可選)

## Skill 使用

```
/review-pr              — 盤點待 review 的 PR
/review-pr 42           — 直接 review PR #42
/review-pr 42 spec:AUTH-123  — review PR #42，以 Jira AUTH-123 為 Spec
```

## 開發慣例

- Shell scripts 使用 `set -euo pipefail`
- API 回應解析使用 python3 inline script
- Comment 格式使用 Markdown (Bitbucket Cloud 支援)
- 所有對外 API 操作 (comment, approve) 必須經用戶確認才執行
