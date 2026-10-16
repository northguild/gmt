---
name: plan-story
description: Plan a gmt story end to end from its id or the current worktree — resolves the story from the branch name, checks Blocked by, has architect write the library spec folder, then has dox-architect shortlist the Dox tools for the owner to choose and spec the chosen ones. Use when the user says "plan", "plan this story", "plan issue 197", "plan #197", "plan MAR-16" or "spec this out". Planning only; implementation is /pipeline in a fresh session.
---

# Plan a story

The main session runs this. You never ask the owner which agent to use: the story decides.
Planning ends with approved specs on disk. Implementation is a separate, fresh session.

## 1. Resolve the story

- **No argument:** read it from the branch.
  `git branch --show-current` → `feature/197-mar-16-…` gives issue `#197` and story `MAR-16`
  (the id is the `<letters>-<digits>` after the issue number, upper-cased).
- **`197` or `#197`:** `gh issue view 197 --json title -q .title` → the title starts with the id.
- **`MAR-16`:** use it as given.

Find the row: `grep -n '| MAR-16 ' context/domination/tracker.md` (a `DOX-*` id lives in
`context/dox/tracker.md`). Read the row only, not the whole tracker. If no row matches, stop and
ask the owner which story they mean.

## 2. Gate

- Run `pnpm deps:ready`. If the story is not in the ready list, stop and report its `Blocked by`.
- If the row's `Status` is `Done`, stop and say so.
- If `context/domination/specs/<ID>/index.md` already exists, show its scope and ask the owner
  whether to revise it or start over. Never overwrite a spec silently.

## 3. Route

| Story | Steps |
| --- | --- |
| Realm story (`MAR-*`, `TRAN-*`, `INT-*`, `CORE-*`, …) | 4, then 5 |
| `DOX-*` story | 5 only (skip the library index input) |

## 4. Library spec — `architect` (Opus)

Spawn `architect` with: the story id, the issue number, the tracker row, the path
`context/domination/issues/<ID>.md`, and this output contract — a spec folder at
`context/domination/specs/<ID>/`: `index.md` of 150 lines or fewer (scope, signatures, file
list, authority table, slice table linking each slice) and one slice file per function or slice,
200 lines or fewer each. Ask for a reply of 30 lines or fewer: the slice table and any open design
question, each with its recommended answer.

**4b. Grill.** Run the [`grilling`](../grilling/SKILL.md) method on the architect's open questions
and anything the spec leaves silently assumed: map the design tree, ask the whole frontier each
round, recompute, stop when the frontier is empty. One house change: put each round to the owner
with `AskUserQuestion` (up to 4 questions a call, recommended answer first with "(Recommended)"),
never as questions in prose. Look facts up yourself (or with `Explore`); only decisions go to the
owner. Then resume the same `architect` (`SendMessage`) with the answers to finalize the spec.

## 5. Dox tools — `dox-architect` (Opus), in two calls

**5a. Shortlist.** Spawn `dox-architect` in shortlist mode with the story id, the tracker row and
(for a realm story) `context/domination/specs/<ID>/index.md`. It returns 2–5 candidate tools,
ranked, each with: name, what the reader does with it, the library functions it calls, why it
fits this story's painpoint, and rough size. It marks one as recommended. No spec yet.

**5b. Owner chooses** — the first grilling round for Dox. Ask with `AskUserQuestion`
(`multiSelect: true`), recommended tool first with "(Recommended)" in its label, one option per
candidate, the "why" as the description.

**5c. Spec.** Resume the same `dox-architect` (`SendMessage`) with the chosen tools. It writes
`context/dox/specs/<id>/index.md` (lower-case id, 150 lines or fewer) plus one slice per tool,
200 lines or fewer each. Every tool ships with its Dox chat button. Grill its open questions as
in 4b before it finalizes. If the owner chose none, skip.

## 6. Approve and hand over

Every index starts with frontmatter the architects write as a draft:

```yaml
---
story: MAR-16
issue: 197
status: draft        # approved only after grilling ends and the owner approves
dox: none            # or context/dox/specs/mar-16/index.md
---
```

Show the owner the spec paths and each index's slice table. Ask with `AskUserQuestion` whether to
approve. On yes, set `status: approved` in each index (library and Dox) and set `dox:` in the
library index, then run `python3 .agents/skills/plan-story/scripts/plan_gate.py` — it must print
`PASS`. Then tell the owner: "Run `/clear`, then `/implement`." 

## Rules

- Planning writes only spec files. No source, tests, tracker `Status` or changesets.
- Nothing is staged or committed ([Git rule](../../../AGENTS.md#git--only-on-an-explicit-instruction)).
- Pass agents paths, not pasted file content.
