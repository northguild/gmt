---
name: agent-optimizer
description: Audit AGENTS.md, CLAUDE.md, the context/ tree and the .agents personas for token waste, orphaned files, broken links, model choice and symlink drift, and tally transcript usage. Use when the user asks to "optimize agent context", "reduce agent tokens", "audit context size", "clean up AGENTS.md", "find orphaned context files", "check context/ for duplicates", "audit agent personas", or "where are my tokens going".
metadata:
  author: craig-o-curtis
  version: 2.0
allowed-tools: Read, Grep, Glob, Bash(python3:*), Bash(uv run:*), Bash(cat .env*)[deny], Bash(grep .env*)[deny]
---

Audit the top-level entry files (`AGENTS.md`, `CLAUDE.md`), every file under `context/`
(recursively), the personas in `.agents/*.md`, and the `.claude/` and `kilo.jsonc` mirrors for
token waste. A second script tallies where tokens actually went in recent sessions.

> This skill is **advisory only — it never edits files**. It prints reports; the human applies
> the suggested extractions and fixes.

## Steps

1. Run the analyzer from the repo root (stdlib only; `uv run` also works):

   ```bash
   python3 .agents/skills/agent-optimizer/scripts/optimize.py .
   ```

   Pass the directory that holds `AGENTS.md`/`CLAUDE.md` and `context/`. The JSON ends with a
   `summary` of counts per category; read that first, then the sections below.
2. Report per entry file: chars, lines, budget status, and any `##` section large enough to
   extract into `context/`.
3. Report **orphans** first (see below), then broken links, then over-budget context files.
4. Report near-duplicate context files (merge candidates).
5. Report the persona audit and the sync check.
6. Run the usage report and name the top three token sinks (see "Usage report").
7. End with a one-line verdict per entry file and a summary count of issues.

## What each report section means

- `entry_files` — `AGENTS.md` and `CLAUDE.md`: `chars`, `lines`, `over_budget`,
  `over_line_budget`, `section_candidates`. Entry files load on nearly every task, so they get
  the tightest budget (150 lines).
- `context.files` — every `context/**/*.md` except `context/archive/`. Each has `chars`,
  `lines`, `linked_from` (files that link to it directly) and budget warnings.
- `context.orphans` — files not reachable by following Markdown links transitively from the
  entry files and from `.agents/*.md`. Nobody will find them through the documented path:
  link them from a parent file or delete them. Highest-priority finding.
- `context.broken_links` — relative `.md` links (anchors ignored, URLs skipped, code ignored)
  whose target does not exist, across entry files, personas and context files.
- `context.near_duplicates` — pairs of files with highly similar lines; merge or re-scope.
- `personas` — one row per `.agents/*.md` with `name:` frontmatter: `lines`, `model`, and
  warnings for the line budget, a missing or `inherit` model, Opus/Fable outside
  `OPUS_ALLOWED`, and a missing `Agent` in `disallowedTools` (nested spawns are banned).
- `sync.agents` / `sync.skills` — each persona needs `.claude/agents/<name>.md` and each
  `.agents/skills/<dir>` needs `.claude/skills/<dir>`, as symlinks that resolve to it. Lists:
  `missing`, `wrong_target`, `dangling` (broken link), `extra` (no matching source).
- `sync.kilo` — personas absent from `kilo.jsonc` `agent`, and entries whose
  `{file:...}` prompt path does not exist.

## Usage report

```bash
python3 .agents/skills/agent-optimizer/scripts/usage.py --days 7 --project-glob '*gmt*' --top 15
```

Add `--json` for machine output; `--root` overrides `~/.claude/projects`. It reads transcripts
only and prints, per (agent, model): requests, total context tokens, share, average and peak
context, and requests over 150K. Then: spawn counts per agent type, context by spawn depth, and
the files read most (sum of `Read` result sizes). Context = input + cache read + cache creation
tokens per request, de-duplicated by message id. Output tokens are not reported because
transcripts log them mid-stream.

Read it like this: a high share on an agent with a large average points at a model or context
problem; many requests over 150K point at missing compaction or oversized reads; the same file
read many times belongs in a shorter context file or an entry-file summary.

## Rules & thresholds

All budgets, the `OPUS_ALLOWED` list, the archive exclusion and the report format live in
[references/rules.md](references/rules.md). Edit that file to tune, and keep the constants at
the top of `scripts/optimize.py` and `scripts/checks_personas.py` in sync with it.

## If the context/ directory structure itself needs rework

- Every `context/**/*.md` file should be reachable from an entry file or persona through links;
  a human reading the entry file cannot find it otherwise.
- Always-relevant files belong high in the routing table with an "Always" trigger; narrow files
  need a specific "when..." trigger.
- A file over budget is a signal to split by sub-topic (as `coding-standards.md` is split from
  `testing-standards/index.md`), not to shrink prose at the cost of clarity.
- Finished or superseded material belongs in `context/archive/`, which the audit skips.
