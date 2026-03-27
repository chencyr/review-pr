# PR Code Review Agent — 系統設計規格書

## 1. 概述

此專案是一個 Claude Code Agent Skill，用於自動化 PR Code Review 流程。支援 **GitHub** 與 **Bitbucket Cloud**，透過 Provider Adapter 架構實現多平台統一操作。透過 `/review-pr` 指令觸發，Agent 會自動偵測 Git provider、連線驗證、盤點待 review 的 PR，對指定 PR 進行五大面向的深度分析，與用戶互動討論後提交 Comment 並 Approve。

---

## 2. 功能需求

### 2.1 Multi-Provider 支援

系統根據環境變數自動偵測使用的 Git provider，無需用戶手動指定。

**支援的 Provider：**

| Provider | 偵測依據 | API |
|----------|---------|-----|
| GitHub | `GITHUB_TOKEN` 存在 | GitHub REST API v3 |
| Bitbucket Cloud | `BITBUCKET_TOKEN` 存在 | Bitbucket REST API v2.0 |

**偵測優先順序：** GitHub > Bitbucket（當多個 token 同時存在時）

**統一操作介面：** 每個 provider 實作相同的 6 個操作：`auth`、`listRepos`、`listPrs`、`getPr`、`comment`、`approve`，回傳格式一致（`{ ok, message, ... }`），使上層邏輯與 provider 無關。

### 2.2 盤點待 Review 的 PR

- 連線 Git provider，列出當前狀態為 OPEN 的 Pull Requests
- 顯示 PR 的 ID、標題、作者、分支、Reviewers、更新時間
- 若不確定要 review 哪個 PR，與用戶互動確認

### 2.3 Code Review 五大面向

對指定 PR 進行以下五大面向的深度分析：

#### 面向 1: Spec 符合度

> 前提：僅在有提供 Spec 時進行，若未提供則跳過並標注。

| 檢查項目 | 說明 |
|---------|------|
| 功能完整性 | Spec 定義的每個功能點是否都有對應實作，列出遺漏項目 |
| 行為一致性 | 實作行為是否與 Spec 定義一致（條件判斷、流程順序、回傳值） |
| Edge Case 覆蓋 | Spec 中提到的邊界情境、錯誤處理是否有實作 |
| API 契約 | 欄位名稱、型別、格式、必填/選填是否與 Spec 吻合 |
| Acceptance Criteria | 若 Spec 包含 AC，逐條檢查是否滿足 |

**Spec 來源（按優先順序）：**

1. 用戶在指令中直接指定（e.g. `/review-pr 42 spec:PROJ-123`）
2. PR description 中的 Jira/Confluence 連結（自動偵測）
3. 互動詢問用戶是否有 Spec 可提供

**支援格式：**
- Jira ticket — 透過 Atlassian MCP 取得 description + acceptance criteria
- Confluence 頁面 — 透過 Atlassian MCP 讀取
- 本地檔案路徑 — 直接 Read
- URL — 透過 WebFetch 取得

#### 面向 2: 命名合理性

| 優先級 | 依據 |
|--------|------|
| 1 (最高) | Spec 文件中定義的術語/命名 |
| 2 | 團隊命名規範 (style guide / coding convention) |
| 3 | 業界通例 (該語言/框架的普遍慣例) |
| 4 (最低) | 目前可見範圍的程式碼風格 |

#### 面向 3: 邏輯錯誤

- **立即 Bug**：必定發生的錯誤（off-by-one、null 未處理、型別錯誤、無限迴圈等）
- **潛在 Bug**：特定情境觸發（race condition、時區、浮點精度、邊界值等）
- **錯誤處理**：exception 被吞掉、錯誤狀態未傳播、重試邏輯問題
- **狀態管理**：可變狀態、副作用、快取一致性

#### 面向 4: 資安弱點

參照 OWASP Top 10 / CWE：
- 注入攻擊（SQL、XSS、Command、NoSQL Injection）
- 認證與授權（硬編碼密碼、缺少授權檢查、Token 管理不當）
- 敏感資料（log 輸出 PII、未加密儲存、錯誤訊息洩露）
- 加密（弱雜湊、自行實作加密、不安全亂數）
- 路徑與檔案（path traversal、不安全上傳、不安全反序列化）
- 其他（SSRF、open redirect、CORS、rate limiting）

#### 面向 5: 可讀性

- 結構清晰度（函式長度、巢狀層數、職責單一性）
- 複雜度（條件判斷複雜度、magic number）
- 註解品質（是否與程式碼一致、TODO/FIXME 追蹤）
- 程式碼重複（可提取為共用函式的大段複製貼上）

### 2.4 嚴重度分級

| 等級 | Emoji | 適用情境 |
|------|-------|---------|
| Critical | 🔴 | 立即 Bug、功能遺漏、可被利用的資安漏洞 |
| Warning | 🟡 | 潛在 Bug、部分 Spec 偏差、潛在資安風險 |
| Suggestion | 🔵 | 命名改善、可讀性建議 |
| Info | ⚪ | 風格偏好、供參考 |

### 2.5 互動式討論

- 按嚴重度排序，逐一與用戶討論每個問題
- 用戶可對每個問題做出判定：
  - **Needs Fix** ✅ — 需修改
  - **Deferred** ⏭️ — 暫不處理（附帶原因）
  - **Noted** ℹ️ — 已知悉，參考用
  - **Dismissed** 🚫 — 非問題
- 討論中途可提供用戶建議與替代方案

### 2.6 提交 Comment

- General Comment：Review Summary table + Verdict
- Inline Comment：對 Needs Fix / Deferred 的問題，在對應檔案行號提交
- 所有 Comment 內容須經用戶確認後才提交

### 2.7 Approve

- 若無未解決的 Critical 問題（Needs Fix），詢問用戶是否 approve
- 若有未解決的 Critical 問題，建議不要 approve 並告知原因
- Approve 操作必須經用戶確認

### 2.8 大 Diff 處理策略

當 diff 內容過大（超過 50 個檔案或 3000 行變更）時，切換為逐檔分析模式：

1. 依 diffstat 將檔案分組（核心邏輯 / 測試 / 設定檔 / 文件）
2. 優先分析核心邏輯檔案
3. 可使用 Agent 工具產生 subagent 平行分析不同檔案群組

---

## 3. 技術架構

### 3.1 Provider Adapter 架構

```
scripts/
├── provider.js              # Provider 偵測器 (detect)
├── providers/
│   ├── bitbucket.js          # Bitbucket Cloud adapter
│   └── github.js             # GitHub adapter
├── auth.js                   # Provider-agnostic CLI wrapper
├── repos.js
├── list-prs.js
├── get-pr.js
├── comment.js
└── approve.js
```

**Provider 介面：** 每個 provider module 須 export 以下成員：

| Export | 型別 | 說明 |
|--------|------|------|
| `id` | `string` | Provider 識別碼（`'github'`, `'bitbucket'`） |
| `label` | `string` | 顯示名稱 |
| `auth(opts)` | `async function` | 驗證連線 |
| `listRepos(opts)` | `async function` | 列出 repositories |
| `listPrs(opts)` | `async function` | 列出 pull requests |
| `getPr(opts)` | `async function` | 取得 PR 資訊 / diffstat / diff |
| `comment(opts)` | `async function` | 提交 general 或 inline comment |
| `approve(opts)` | `async function` | Approve 或 unapprove PR |

**共通參數：** 所有函式接受 `{ token, owner, repo, fetchFn, ... }`:
- `token` — API 認證 token
- `owner` — 組織/workspace（GitHub: org 或 username，Bitbucket: workspace slug）
- `repo` — Repository slug/name
- `fetchFn` — 可注入的 fetch 函式（用於測試 mock，預設為全域 `fetch`）

**共通回傳：** `{ ok: boolean, message: string, ... }` — 額外欄位依操作而異（如 `prs`, `repos`）

**偵測機制（`provider.js`）：** 遍歷 PROVIDERS 陣列，第一個 token 環境變數存在者勝出。

### 3.2 Provider 差異對照

| 操作 | Bitbucket | GitHub |
|------|-----------|--------|
| Auth | `GET /workspaces/{owner}` | `GET /user` |
| List repos | `GET /repositories/{owner}` | `GET /orgs/{owner}/repos`，404 fallback `GET /users/{owner}/repos` |
| List PRs | `GET .../pullrequests?state=` | `GET .../pulls?state=`（state 需轉小寫；MERGED → closed 再過濾 `merged_at`） |
| PR info | `GET .../pullrequests/{id}` | `GET .../pulls/{id}` |
| Diffstat | `GET .../pullrequests/{id}/diffstat` | `GET .../pulls/{id}/files` |
| Diff | `GET .../pullrequests/{id}/diff` (Accept: text/plain) | `GET .../pulls/{id}` (Accept: application/vnd.github.diff) |
| General comment | `POST .../pullrequests/{id}/comments` body: `{content: {raw}}` | `POST .../issues/{id}/comments` body: `{body}` |
| Inline comment | `POST .../pullrequests/{id}/comments` body: `{content, inline: {path, to}}` | `POST .../pulls/{id}/comments` body: `{body, commit_id, path, line, side}` (需先取 head SHA) |
| Approve | `POST .../pullrequests/{id}/approve` | `POST .../pulls/{id}/reviews` body: `{event: "APPROVE"}` |
| Unapprove | `DELETE .../pullrequests/{id}/approve` | `PUT .../pulls/{id}/reviews/{reviewId}/dismissals` (需先查詢自己的 approval review) |

### 3.3 CLI 腳本

每個 CLI 腳本為 provider-agnostic 的薄包裝層，職責為：
1. 呼叫 `detect()` 取得 provider
2. 從 `process.argv` 解析參數
3. 呼叫對應的 provider 函式
4. 輸出結果或錯誤

同時 export `run(overrides)` 函式，供程式化呼叫與測試。

| Script | 用法 |
|--------|------|
| `auth.js` | 驗證連線 |
| `repos.js [pagelen]` | 列出 repositories |
| `list-prs.js [repo] [state]` | 列出 PR |
| `get-pr.js <pr_id> [repo] [info\|diffstat\|diff\|all]` | 取得 PR 資訊 |
| `comment.js <pr_id> <repo> general <message>` | 提交 general comment |
| `comment.js <pr_id> <repo> inline <file> <line> <message>` | 提交 inline comment |
| `approve.js <pr_id> [repo] [approve\|unapprove]` | Approve / unapprove |

### 3.4 環境變數

只需設定其中一個 provider。若同時設定多個，依偵測優先順序決定。

**GitHub：**
| 變數 | 必填 | 說明 |
|------|------|------|
| `GITHUB_TOKEN` | 是 | Personal Access Token (classic 或 fine-grained) |
| `GITHUB_OWNER` | 否 | Organization 或 username |
| `GITHUB_REPO` | 否 | 預設 repository name |

**Bitbucket Cloud：**
| 變數 | 必填 | 說明 |
|------|------|------|
| `BITBUCKET_TOKEN` | 是 | Bitbucket Access Token |
| `BITBUCKET_WORKSPACE` | 否 | Workspace slug |
| `BITBUCKET_REPO` | 否 | 預設 repository slug |

### 3.5 專案結構

```
review-pr/
├── .claude/
│   ├── CLAUDE.md                 # 專案級指引 (always-on context)
│   ├── settings.json             # 權限設定
│   └── settings.local.json       # 本地權限設定
├── .env.example                  # 環境變數範本
├── package.json                  # Node.js 專案設定 (type: module)
├── SKILL.md                      # Skill 入口點與 7-Phase 流程定義
├── SPEC.md                       # 本文件 — 系統設計規格書
├── README.md                     # 使用說明與快速入門
├── LICENSE                       # Apache 2.0
├── prompts/
│   ├── review-checklist.md       # 五大面向分析指引
│   └── comment-template.md       # PR Comment 格式模板
└── scripts/
    ├── provider.js               # Provider 自動偵測
    ├── providers/
    │   ├── bitbucket.js          # Bitbucket Cloud adapter
    │   └── github.js             # GitHub adapter
    ├── auth.js                   # 驗證連線
    ├── repos.js                  # 列出 repositories
    ├── list-prs.js               # 列出 PR
    ├── get-pr.js                 # 取得 PR 資訊/diff
    ├── comment.js                # 提交 comment
    ├── approve.js                # Approve PR
    └── __tests__/
        ├── helpers.js            # Mock fetch 工廠與共用常數
        ├── provider.test.js      # Provider 偵測邏輯測試
        ├── bitbucket.test.js     # Bitbucket adapter 單元測試
        ├── github.test.js        # GitHub adapter 單元測試
        └── integration.test.js   # 整合測試 (real API, read-only)
```

### 3.6 技術堆疊

| 項目 | 選擇 | 說明 |
|------|------|------|
| 語言 | JavaScript (ES Modules) | `"type": "module"` in package.json |
| Runtime | Node.js >= 18 | 使用原生 `fetch`，無外部依賴 |
| 測試框架 | `node:test` + `node:assert` | Node.js 內建 test runner |
| HTTP | 原生 `fetch` | 無需 axios / node-fetch |
| 外部依賴 | 無 | 零 dependencies |

### 3.7 記憶管理

使用 Claude Code auto memory 系統，持久化以下資訊：

- **Git Provider 連線資訊**（type: reference）— provider 類型、owner、預設 repo
- **PR Review 紀錄**（type: project）— 每個 PR 的 review 狀態、issues、判定結果

目的：新 Session 開啟時可將關鍵資訊回復到 context，支援跨 session 的 review 追蹤。

### 3.8 Spec 整合

透過以下管道取得 Spec 內容：
- Atlassian MCP（`getJiraIssue`）— 取得 Jira ticket
- Atlassian MCP（`getConfluencePage`）— 取得 Confluence 頁面
- WebFetch — 取得任意 URL 內容
- Read — 取得本地檔案

---

## 4. 測試策略

### 4.1 單元測試

以 `node:test` 內建 test runner 執行，透過 `fetchFn` 注入 mock fetch 避免真實 API 呼叫。

| 測試檔案 | 涵蓋範圍 |
|----------|---------|
| `provider.test.js` | detect() 偵測邏輯、優先順序、缺少 token 錯誤 |
| `bitbucket.test.js` | Bitbucket adapter 全 6 操作：參數驗證、成功回應、錯誤處理、HTTP method/header 驗證 |
| `github.test.js` | GitHub adapter 全 6 操作：同上，另含 org/user fallback、MERGED 過濾、inline comment commit_id |

**執行方式：** `npm test`

### 4.2 整合測試

以真實 API token 呼叫，**僅執行唯讀操作**（auth、listRepos、listPrs、getPr）。寫入操作（comment、approve）排除，避免對目標 repo 產生副作用。

- 環境變數未設定時自動 skip
- 支援 Bitbucket 與 GitHub 兩套整合測試
- getPr 測試需先動態取得一個存在的 PR ID，若無 PR 則 skip

**執行方式：** `npm run test:integration`（需先設定 .env）

---

## 5. 執行流程

```
Phase 1: 連線確認 (auth.js)
    ↓
Phase 2: 選擇目標 PR (repos.js / list-prs.js)
    ↓
Phase 2.5: 取得 Spec（條件性 — Jira / Confluence / URL / 本地檔案）
    ↓
Phase 3: 取得 PR 內容 (get-pr.js — info + diffstat + diff)
    ↓  若超過 50 檔或 3000 行 → 切換逐檔分析模式
    ↓
Phase 4: 逐檔 Review（五大面向分析）
    ↓
Phase 5: 互動討論（逐一確認每個問題的判定）
    ↓
Phase 6: 提交 Comment (comment.js — 經用戶確認)
    ↓
Phase 7: Approve (approve.js — 條件性，經用戶確認)
```

---

## 6. 使用方式

```bash
/review-pr                          # 盤點待 review 的 PR
/review-pr 42                       # 直接 review PR #42
/review-pr 42 spec:AUTH-123         # review PR #42，以 Jira AUTH-123 為 Spec
/review-pr 42 repo:my-service       # review 指定 repo 的 PR #42
```

---

## 7. 擴充新 Provider

新增 provider 僅需：

1. 建立 `scripts/providers/<name>.js`，export `id`、`label` 及 6 個操作函式
2. 在 `scripts/provider.js` 的 `PROVIDERS` 陣列新增對應的 env var 映射
3. 更新 `.env.example` 加入新 provider 的環境變數區塊
4. 在 `scripts/__tests__/<name>.test.js` 撰寫單元測試
5. 在 `integration.test.js` 加入條件性的整合測試區塊

---

## 8. 設計原則

1. **用戶主導**: 所有對外操作（comment、approve）必須經用戶確認
2. **務實導向**: Critical 問題優先，不讓 Suggestion/Info 淹沒重要問題
3. **尊重作者**: Comment 用語建設性、具體、禮貌
4. **Context 意識**: 只 review diff 中的變更，不要求超出 PR 範圍的改動
5. **安全優先**: 資安問題永遠最高優先級
6. **Provider 無關**: 上層邏輯不依賴特定 provider，透過統一介面操作
7. **零依賴**: 僅使用 Node.js 內建功能（fetch、test runner），不引入外部套件
8. **可測試性**: 所有函式接受 `fetchFn` 注入，支援無網路環境下的完整測試
