---
name: implement
description: "Implement a planned gmt or Dox story end to end, after a plan gate confirms /plan-story approved its spec. Use when the owner types /implement in a story worktree."
disable-model-invocation: true
---

# Implement a planned story

## 1. Gate — nothing runs until the plan is approved

```bash
python3 .agents/skills/plan-story/scripts/plan_gate.py          # story from the branch name
python3 .agents/skills/plan-story/scripts/plan_gate.py MAR-16   # or name it
```

- **PASS:** continue.
- **FAIL:** stop. Show the owner each `FAIL` line and say: "Run `/plan-story` first." Do not plan
  inline, do not write a spec yourself, and do not work around a failed gate.

The gate checks that the spec index exists, is marked `status: approved`, stays within 150
lines, links slices that exist and stay within 200 lines, and records the Dox decision
(`dox: none` or an approved Dox spec).

## 2. Blocked by

Read the story's `Blocked by` cell in `context/domination/tracker.md` (or `context/dox/tracker.md`).
A non-empty cell means something has to land first: say so instead of working around it. A
`(parenthesised)` entry is not a blocker — it is a shared primitive this story builds itself, so
fold it into the work and say so. `pnpm deps:ready` lists what is startable.

## 3. Build

Follow [`/pipeline`](../pipeline/SKILL.md) from "Find the spec": tdd-dev, tester and gmt-reviewer
per library slice, then dox-builder and dox-tester per Dox slice, then finalizer. Each worker gets
the index plus its own slice. A docs-site Core story (`CORE-86` … `CORE-88`) has no library
slice: `/pipeline` says who builds instead.

## 4. Finish

`finalizer` flips the story's `Status` to `Done` and runs `pnpm deps:sync`. If the work changed
what the story consumes, update its `## What gmt provides (do not re-implement)` section first —
the `Blocked by` column is generated from it. It then folds and deletes the story's spec (see
[finalizer step 10](../../finalizer.md), after `validate` passes): Decisions to `issues/<ID>.md` or `built.md`, inbound
references rewritten, the spec folder and its index line removed.

## 5. Optimize

Run [`/optimize`](../optimize/SKILL.md) (`python3 .agents/skills/optimize/scripts/run.py`). Fix
every finding this story caused or worsened; list pre-existing ones for the owner as backlog.

Leave every change unstaged and report that the work is ready. Do not `git add`, commit, push,
branch or open a PR unless the owner asks in plain words
([AGENTS.md § Git](../../../AGENTS.md#git--only-on-an-explicit-instruction)).
