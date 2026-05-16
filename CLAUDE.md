# GMT — Claude Code Entry Point

**Read first:** [AGENTS.md](./AGENTS.md) — core rules, context file index, and quick reference.

## Context Files

Scoped documentation — load only what the task requires:

| File | Load when... |
|---|---|
| [context/project-overview.md](./context/project-overview.md) | Always — what GMT is, Temporal API refs, Date pitfalls, comparison libs |
| [context/coding-standards.md](./context/coding-standards.md) | Writing or reviewing source code |
| [context/testing-standards.md](./context/testing-standards.md) | Writing or reviewing tests |
| [context/jsdoc-standards.md](./context/jsdoc-standards.md) | Adding or updating JSDoc |
| [context/code-review-checklist.md](./context/code-review-checklist.md) | Reviewing a PR |
| [context/linting-packages.md](./context/linting-packages.md) | Working on gmt-eslint, gmt-oxlint, or gmt-biome |

## Available Skills

Reusable slash commands live in `.agents/skills/`. Run them with `/skill-name`.

| Skill | What it does |
|---|---|
| `/update-readme` | Diffs vs main, updates namespace and package READMEs to reflect changes |
| `/changelog` | Rewrites the pending `.changeset/*.md` description to match CHANGELOG style |
| `/commit-message` | Generates a ready-to-copy commit message from the current diff (read-only) |
| `/pr-desc` | Generates a full PR title and description from the branch diff |
| `/code-review` | GMT-specific code review guidance and checklist |
| `/tanstack-intent` | Keeps `packages/gmt/skills/` in sync with source changes |

## Repo Layout (quick orientation)

```
packages/
  gmt/          # @burglekitt/gmt — the main library
  gmt-eslint/   # ESLint flat config plugin
  gmt-oxlint/   # Oxlint JS plugin
  gmt-biome/    # Biome GritQL plugins
context/        # Agent documentation (scoped — see table above)
.agents/skills/ # Reusable slash command skills (see table above)
.changeset/     # Pending version bump descriptions
```
