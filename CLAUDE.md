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

Scoped documentation — load only what the task requires. The index lives in one place:
[AGENTS.md § Context Files](./AGENTS.md#context-files).

## Agents

The personas in `.agents/*.md` are symlinked into `.claude/agents/` (Claude Code) and
registered in `kilo.jsonc` (Kilo). Library pipeline: `master` → `driver` → `architect` /
`researcher` / `tdd-dev` / `tester` / `finalizer`. Dox site: `dox-architect` → `dox-builder` /
`dox-tester`.

## Available Skills

Skills live in `.agents/skills/` and are symlinked into `.claude/skills/`. Run them with
`/skill-name`.

| Skill              | What it does                                                                |
| ------------------ | --------------------------------------------------------------------------- |
| `/update-readme`   | Diffs vs main, updates the root and package READMEs to reflect changes      |
| `/changelog`       | Rewrites the pending `.changeset/*.md` description to match CHANGELOG style |
| `/commit-message`  | Drafts a ready-to-copy commit message from the current diff (read-only)     |
| `/pr-desc`         | Drafts a PR title and description from the branch diff (read-only)          |
| `/code-review`     | GMT-specific review checklist — see note below                              |
| `/tanstack-intent` | Keeps `packages/gmt/skills/` in sync with source changes                    |
| `/tdd`             | Vertical-slice red → green reference                                        |
| `/implement`       | Implement a spec or ticket end to end (leaves changes unstaged)             |
| `/research`        | Research a question against primary sources into a Markdown file            |
| `/prototype`       | Throwaway prototype to answer a design question                             |
| `/handoff`         | Write a handoff note for the next session                                   |
| `/grill-with-docs` | Interview-style design review that records decisions as docs                |

**`/code-review` name collision.** Claude Code ships a built-in `/code-review`. If the
built-in wins, load the GMT checklist directly:
[context/code-review-checklist.md](./context/code-review-checklist.md).

## Repo Layout (quick orientation)

```text
packages/
  gmt/          # @northguild/gmt — the main library
  gmt-eslint/   # ESLint flat config plugin
  gmt-oxlint/   # Oxlint JS plugin
  gmt-biome/    # Biome GritQL plugins
context/        # Agent documentation (scoped — see AGENTS.md)
.agents/        # Agent personas (*.md) and skills (skills/)
.claude/        # Symlinks into .agents/ for Claude Code
.changeset/     # Pending version bump descriptions
```
