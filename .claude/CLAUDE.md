# PR Code Review Agent

此專案是一個 Claude Code Agent Skill，用於自動化 PR Code Review，支援 GitHub 與 Bitbucket Cloud。

## 專案結構

- `SPEC.md` — 系統設計規格書
- `SKILL.md` — Skill 入口點與流程定義
- `prompts/review-checklist.md` — 五大面向分析指引
- `prompts/comment-template.md` — PR Comment 格式模板
- `scripts/providers/*.js` — 各 provider API adapter (bitbucket, github)
- `scripts/provider.js` — provider 自動偵測
- `scripts/*.js` — provider-agnostic CLI 腳本

## 環境需求

只需設定其中一個 provider:

**GitHub:**
- `GITHUB_TOKEN` — GitHub Personal Access Token
- `GITHUB_OWNER` — Organization 或 username
- `GITHUB_REPO` — 預設 Repository (可選)

**Bitbucket Cloud:**
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

- Scripts 使用 JavaScript (Node.js)，以原生 fetch 呼叫 API，無外部依賴
- 新增 provider 時實作 `scripts/providers/<name>.js` 並在 `provider.js` 註冊
- Comment 格式使用 Markdown (GitHub, Bitbucket 皆支援)
- 所有對外 API 操作 (comment, approve) 必須經用戶確認才執行
