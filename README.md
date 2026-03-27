# review-pr

A [Claude Code](https://docs.anthropic.com/en/docs/claude-code) Skill that performs deep, structured code review on Pull Requests. Supports **GitHub** and **Bitbucket Cloud**.

## What it does

When invoked via `/review-pr`, the agent:

1. Connects to your Git provider and lists open PRs
2. Fetches PR info, diffstat, and full diff
3. Optionally retrieves a Spec (Jira ticket, Confluence page, or URL) for conformance checking
4. Reviews code across **5 dimensions**: Spec conformance, naming, logic errors, security vulnerabilities, readability
5. Discusses each finding with you interactively, letting you classify issues as Needs Fix / Deferred / Noted / Dismissed
6. Posts a structured summary comment and inline comments to the PR
7. Optionally approves the PR if no critical issues remain

## Quick start

### 1. Install as a Claude Code Skill

Clone this repo into your Claude Code skills directory, or add it as a git submodule:

```bash
git clone https://github.com/chencyr/review-pr.git ~/.claude/skills/review-pr
```

### 2. Configure your provider

Copy `.env.example` and fill in your credentials. Only one provider is needed:

```bash
cp .env.example .env
```

**GitHub:**
```
GITHUB_TOKEN=ghp_xxxxxxxxxxxx
GITHUB_OWNER=your-org
GITHUB_REPO=your-repo        # optional, can be selected interactively
```

**Bitbucket Cloud:**
```
BITBUCKET_TOKEN=ATCTTxxxxxxxx
BITBUCKET_WORKSPACE=your-workspace
BITBUCKET_REPO=your-repo     # optional
```

If both are configured, GitHub takes priority.

### 3. Use it

```
/review-pr                        # list open PRs and pick one
/review-pr 42                     # review PR #42 directly
/review-pr 42 spec:AUTH-123       # review PR #42 with Jira ticket as Spec
```

## Review dimensions

| Dimension | Focus | Severity |
|-----------|-------|----------|
| Spec conformance | Feature completeness, AC coverage, API contract | Critical / Warning |
| Naming | Clarity, consistency, convention adherence | Suggestion / Info |
| Logic errors | Immediate bugs, race conditions, edge cases, error handling | Critical / Warning |
| Security | Injection, auth, secrets, crypto, OWASP Top 10 | Critical / Warning |
| Readability | Structure, complexity, duplication, comments | Suggestion / Info |

See [`prompts/review-checklist.md`](prompts/review-checklist.md) for the full checklist.

## Project structure

```
review-pr/
├── SKILL.md                    # Skill definition and workflow (7 phases)
├── package.json                # Node.js project config
├── .env.example                # Environment variable template
├── prompts/
│   ├── review-checklist.md     # 5-dimension review guidelines
│   └── comment-template.md     # PR comment format template
└── scripts/
    ├── provider.js             # Auto-detect provider from env vars
    ├── providers/
    │   ├── bitbucket.js        # Bitbucket Cloud REST API adapter
    │   └── github.js           # GitHub REST API adapter
    ├── auth.js                 # Verify provider connection
    ├── repos.js                # List repositories
    ├── list-prs.js             # List pull requests
    ├── get-pr.js               # Get PR info / diffstat / diff
    ├── comment.js              # Post general or inline comments
    ├── approve.js              # Approve or unapprove a PR
    └── __tests__/              # Unit and integration tests
```

## Scripts

All scripts auto-detect the active provider. They can be run standalone or imported as ES modules:

```bash
# CLI usage
node scripts/auth.js
node scripts/repos.js 10
node scripts/list-prs.js my-repo OPEN
node scripts/get-pr.js 42 my-repo info
node scripts/comment.js 42 my-repo general "LGTM"
node scripts/approve.js 42 my-repo approve
```

```js
// Programmatic usage
import { detect } from './scripts/provider.js';

const p = detect();
const result = await p.listPrs({ token: p.token, owner: p.owner, repo: 'my-repo' });
console.log(result.prs);
```

## Adding a new provider

1. Create `scripts/providers/<name>.js` exporting: `id`, `label`, `auth`, `listRepos`, `listPrs`, `getPr`, `comment`, `approve`
2. Register it in `scripts/provider.js` with the corresponding env var names
3. Add tests in `scripts/__tests__/<name>.test.js`

## Testing

```bash
# Unit tests (51 tests)
npm test

# Integration tests (requires real tokens in .env)
npm run test:integration
```

Integration tests only run read-only operations (auth, list repos, list PRs, get PR). Write operations (comment, approve) are excluded for safety.

## Requirements

- Node.js >= 18 (uses native `fetch`)
- No external dependencies

## License

[Apache 2.0](LICENSE)
