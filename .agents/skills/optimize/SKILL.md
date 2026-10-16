---
name: optimize
description: Run agent-optimizer and skill-optimizer together and print one short summary of the findings in files this branch changed, plus repo-wide symlink, kilo.jsonc and skill-name problems. Use when the user says "optimize", "run the optimizers", "check agent and skill budgets", "audit our agent setup", or at the end of /implement. Add --usage for the 7-day token report.
---

# Optimize — both audits, one short summary

```bash
python3 .agents/skills/optimize/scripts/run.py            # this branch's findings + repo-wide
python3 .agents/skills/optimize/scripts/run.py --all      # every finding (the backlog too)
python3 .agents/skills/optimize/scripts/run.py --usage    # append the 7-day token report
```

It runs [agent-optimizer](../agent-optimizer/SKILL.md) and
[skill-optimizer](../skill-optimizer/SKILL.md) and prints at most 30 findings. Never read their
raw JSON into the session; the summary is the point. `--base REF` changes the branch point
(default `origin/main`).

## Reading the result

- `PASS` — nothing to fix on this branch. Report the backlog count in one line.
- `FAIL` — each listed finding is a file this branch touched, or a repo-wide problem.
  - **Caused or worsened by this branch** (a new spec over budget, a broken link, a missing
    symlink): fix it now, then re-run until `PASS` or only pre-existing findings remain.
  - **Already there before this branch** (check with `git show <base>:<path> | wc -l`): leave
    it, and list it for the owner as backlog. Never grow it further.
- The fix for a size finding is progressive disclosure: an index of 150 lines or fewer that links
  scoped files of 200 lines or fewer. Never cut content to fit.

## When to run it

- Last step of [`/implement`](../implement/SKILL.md), before the work is reported ready.
- After any change to `.agents/`, `.claude/`, `context/`, `AGENTS.md`, `CLAUDE.md` or `kilo.jsonc`.
- Weekly with `--usage`, to compare token use against the previous week.
