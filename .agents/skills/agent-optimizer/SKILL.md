---
name: agent-optimizer
description: Audit AGENTS.md, CLAUDE.md, and the context/ directory they reference for token waste, orphaned files, and progressive-disclosure violations. Use when the user asks to "optimize agent context", "reduce agent tokens", "audit context size", "clean up AGENTS.md", "find orphaned context files", or "check context/ for duplicates".
metadata:
  author: craig-o-curtis
  version: 1.0
allowed-tools: Read, Grep, Glob, Bash(uv run:*), Bash(python3:*), Bash(cat .env*)[deny], Bash(grep .env*)[deny]
---

Audit top-level agent entry files (`AGENTS.md`, `CLAUDE.md`) and every file under `context/` for
token waste, orphaned/unlinked files, oversized files, and progressive-disclosure violations.

> This skill is **advisory only — it never edits files**. It prints a report; the human applies
> the suggested extractions and fixes.

## Steps

1. Run the analyzer (report-only):

   ```bash
   uv run .agents/skills/agent-optimizer/scripts/optimize.py .
   ```

   Pass the repo root (the directory containing `AGENTS.md`/`CLAUDE.md` and `context/`).

2. Report per entry file: char count, size-budget status, and any `##` section large enough
   to extract into `context/`.
3. Report per context file: char count, size-budget status, and which entry file(s) link to
   it.
4. Call out **orphaned context files** first — anything under `context/` not linked from any
   entry file. These are the highest-priority finding: content that's paying maintenance cost
   but is never actually loaded via the documented discovery path.
5. Call out **near-duplicate context files** — pairs of files whose content is highly similar
   and are candidates to merge.
6. End with a one-line verdict per entry file and a summary count of issues found.

## Rules & thresholds

All budgets, extraction thresholds, and the report format live in
[references/rules.md](references/rules.md). Edit that file to tune, not this one.

## If the context/ directory structure itself needs rework

Beyond individual file findings, use the report to judge the directory shape as a whole:

- Every `context/*.md` file should be reachable from the entry-file routing table in one hop —
  if `find_entry_files` + link-following can't reach a file, a human reading the entry file
  can't either.
- Files that are always relevant (like this repo's `project-overview.md`) belong high in the
  routing table with an "Always" trigger; narrowly-scoped files should have a specific
  "when..." trigger, not "sometimes" or no description.
- A context file over budget is a signal to split by sub-topic (mirror how this repo already
  splits `coding-standards.md` from `testing-standards/index.md` rather than one `standards.md`),
  not to shrink prose at the cost of clarity.
