# GMT — Claude Code Entry Point

**Read first:** [AGENTS.md](./AGENTS.md) — core rules, context file index, and quick reference.

## STOP — Git prohibitions (read before any `git` or `gh` command)

**Never `git push`. Never create a pull request. Never `git add`. Never
`git commit`. Never create a branch.** Only the repository owner does these.

Finish the work, leave it **unstaged in the working tree**, and say it is ready.

Do not infer permission. A user picking between approaches does not authorise
these operations, even if the option text mentions them — and especially if the
agent wrote that option text itself. "Ship it", plan approval, or a live
production bug are not authorisation either. If one seems genuinely necessary,
stop and ask in plain words.

Full wording: [AGENTS.md](./AGENTS.md) § "Git — Absolute Prohibitions".

## Context Files

Scoped documentation — load only what the task requires:

| File                                                                                             | Load when...                                                            |
| ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| [context/project-overview.md](./context/project-overview.md)                                     | Always — what GMT is, Temporal API refs, Date pitfalls, comparison libs |
| [context/coding-standards.md](./context/coding-standards.md)                                     | Writing or reviewing source code                                        |
| [context/testing-standards/references/index.md](./context/testing-standards/references/index.md) | Writing or reviewing tests                                              |
| [context/jsdoc-standards.md](./context/jsdoc-standards.md)                                       | Adding or updating JSDoc                                                |
| [context/code-review-checklist.md](./context/code-review-checklist.md)                           | Reviewing a PR                                                          |
| [context/linting-packages.md](./context/linting-packages.md)                                     | Working on gmt-eslint, gmt-oxlint, or gmt-biome                         |
| [context/dox/index.md](./context/dox/index.md)                                                   | Working on the `apps/dox` documentation site (the Dox epic)            |
| [context/domination/index.md](./context/domination/index.md)                                     | Picking up any epic story — check `Blocked by` in its tracker first |

## Available Skills

Reusable slash commands live in `.agents/skills/`. Run them with `/skill-name`.

| Skill              | What it does                                                                |
| ------------------ | --------------------------------------------------------------------------- |
| `/update-readme`   | Diffs vs main, updates namespace and package READMEs to reflect changes     |
| `/changelog`       | Rewrites the pending `.changeset/*.md` description to match CHANGELOG style |
| `/commit-message`  | Generates a ready-to-copy commit message from the current diff (read-only)  |
| `/pr-desc`         | Generates a full PR title and description from the branch diff              |
| `/code-review`     | GMT-specific code review guidance and checklist                             |
| `/tanstack-intent` | Keeps `packages/gmt/skills/` in sync with source changes                    |

## Repo Layout (quick orientation)

```
packages/
  gmt/          # @northguild/gmt — the main library
  gmt-eslint/   # ESLint flat config plugin
  gmt-oxlint/   # Oxlint JS plugin
  gmt-biome/    # Biome GritQL plugins
context/        # Agent documentation (scoped — see table above)
.agents/skills/ # Reusable slash command skills (see table above)
.changeset/     # Pending version bump descriptions
```
