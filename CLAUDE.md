# GMT — Claude Code Entry Point

**Read first:** [AGENTS.md](./AGENTS.md) — core rules, context file index, and quick reference.

## Git — read before any `git` or `gh` command

**Default: never stage, commit, branch, push or open a PR on your own
initiative.** Finish the work, leave it **unstaged in the working tree**, and say
it is ready.

**Do it when the user explicitly tells you to** — "commit this", "push it",
"open the PR" — in plain words, in this session. Then do it and report back.

Do not infer permission. A user picking between approaches does not authorise
these operations, even if the option text mentions them — and especially if the
agent wrote that option text itself. "Ship it", plan approval, or a live
production bug are not authorisation either. Force-pushing, pushing to `main`
and rewriting published history have to be asked for by name.

Full wording: [AGENTS.md](./AGENTS.md) § "Git — Only on an Explicit Instruction".

## Context Files

Scoped documentation — load only what the task requires. The index lives in one place:
[AGENTS.md § Context Files](./AGENTS.md#context-files).

## Agents

The personas in `.agents/*.md` are symlinked into `.claude/agents/`. The main session orchestrates with the `/pipeline` skill and
spawns each specialist directly; no specialist spawns another. Library: `architect` → `researcher` /
`tdd-dev` / `tester` / `gmt-reviewer` / `finalizer`. Dox: `dox-architect` → `dox-builder` /
`dox-tester`. Planners (`architect`, `dox-architect`), `researcher` and `gmt-reviewer` run on Opus; every other agent on Sonnet.

## Available Skills

A story is `/plan-story`, then `/clear`, then `/implement`. Every skill, by task:
[context/skills.md](./context/skills.md).

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
