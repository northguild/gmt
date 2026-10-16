---
name: skill-optimizer
description: Audit agent skills for token waste and progressive-disclosure violations, and catch common triggering/loading problems. Use when the user asks to "optimize skills", "reduce skill tokens", "trim SKILL.md", "enforce progressive disclosure", "audit skill size", "why isn't my skill triggering", or "check skill descriptions for collisions".
metadata:
  author: craig-o-curtis
  version: 1.0
allowed-tools: Read, Grep, Glob, Bash(python3:*), Bash(uv run:*), Bash(cat .env*)[deny], Bash(grep .env*)[deny]
---

Audit every agent skill for token waste, progressive-disclosure violations, and the common
failure modes from Anthropic's troubleshooting guide (doesn't trigger / doesn't load / wrong
skill used / name shadowing / runtime errors).

> This skill is **advisory only — it never edits files**. It prints a report; the human applies
> the suggested extractions and fixes.

## Steps

1. Locate skills via Glob: `**/.agents/skills/*/SKILL.md`
2. Run the analyzer (report-only). It needs only the system `python3`; PyYAML is optional
   (a built-in parser covers `key: value`, quoted values, `>`/`|` blocks and a one-level
   `metadata:` map when it is missing). `uv run` also works.

   ```bash
   python3 .agents/skills/skill-optimizer/scripts/optimize.py --all .agents/skills
   ```

   Or a single skill:

   ```bash
   python3 .agents/skills/skill-optimizer/scripts/optimize.py .agents/skills/<name>
   ```

3. Report per skill: char and line count, size-budget status, progressive-disclosure section
   candidates, description trigger-phrase gaps, and runtime-readiness warnings (script exec
   bit, backslash paths, undocumented deps).
4. Report line-budget findings: `SKILL.md` over 200 lines, any `references/` file over 200
   lines (both are warnings), and the softer `notes` entry for `SKILL.md` at 150 lines or more.
5. Report missing `.claude/skills/<name>` symlinks. This runs only when the scanned directory is
   `<repo>/.agents/skills` and `<repo>/.claude/skills` exists.
6. In `--all` mode also report cross-skill issues: duplicate `name`s (shadowing risk) and
   near-duplicate descriptions (wrong-skill risk).
7. End with a one-line per-skill verdict and a summary count.

## Rules & thresholds

All budgets, extraction thresholds, and the report format live in
[references/rules.md](references/rules.md). Edit that file to tune, not this one.

## If a skill still won't load after passing

Run `claude --debug` and look for messages naming the skill. For plugin skills, clear the cache,
restart, and reinstall. (The script cannot perform these — they are manual steps.)
