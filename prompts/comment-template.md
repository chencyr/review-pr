# PR Comment 格式模板

## General Comment (Review Summary)

提交至 PR 的 general comment，作為整體 review 摘要。使用以下格式：

```markdown
## Code Review Summary

**Reviewer**: Claude Code Review Agent
**Review Date**: {date}
**Spec Reference**: {spec_reference 或 "N/A"}

### Overview

{1-2 句總結此 PR 的變更內容與整體品質評估}

### Findings

| # | Severity | Category | File | Line | Status |
|---|----------|----------|------|------|--------|
| 1 | 🔴 Critical | {category} | `{file}` | L{line} | {status} |
| 2 | 🟡 Warning | {category} | `{file}` | L{line} | {status} |
| 3 | 🔵 Suggestion | {category} | `{file}` | L{line} | {status} |
| 4 | ⚪ Info | {category} | `{file}` | L{line} | {status} |

**Status 欄位值:**
- ✅ Needs Fix — 需修改
- ⏭️ Deferred — 暫不處理 (附帶原因)
- ℹ️ Noted — 已知悉，參考用
- 🚫 Dismissed — 非問題，不需處理

### Summary

- **Critical**: {n} issue(s) — {已確認需修改的數量} needs fix
- **Warning**: {n} issue(s)
- **Suggestion**: {n} issue(s)
- **Info**: {n} note(s)

### Verdict

{根據結果決定:}
- ✅ **Approved** — No blocking issues found.
- ⚠️ **Changes Requested** — {n} critical/warning issue(s) need to be addressed before merge.
```

---

## Inline Comment

提交至特定檔案行號的 inline comment。使用以下格式：

### Critical / Warning 問題

```markdown
**{severity_emoji} {severity}** | {category}

**Issue**: {問題描述}

**Risk**: {這個問題可能導致的後果}

**Suggestion**:
\`\`\`{language}
{建議的修改程式碼}
\`\`\`
```

### Suggestion / Info

```markdown
**{severity_emoji} {severity}** | {category}

{問題描述與建議}
```

---

## 格式規則

1. Comment 內容使用 Markdown 格式 (Bitbucket Cloud 支援)
2. 程式碼片段使用 fenced code block 並標注語言
3. 嚴重度 emoji 對照:
   - 🔴 Critical
   - 🟡 Warning
   - 🔵 Suggestion
   - ⚪ Info
4. Inline comment 應簡潔但完整，避免過長
5. General comment 的 Findings table 按嚴重度排序 (Critical → Warning → Suggestion → Info)
