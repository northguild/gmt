# Inline mode — the pipeline without subagents

When the harness cannot dispatch subagents, run the sequence as labelled steps in one turn.

```text
## PIPELINE: [category] — [brief description]

### Step 1: [Agent role]
[Execute the specialist's workflow inline]

### Step 2: [Agent role]
[Pass artifacts from Step 1, execute next role]

### Pipeline complete
[What was done, what changed, what's pending]
```

## Step 1 — Research

If the plan needs Temporal behaviour, ISO 8601 edge cases or a design comparison, use the
documentation tools the harness provides (web search as the fallback). Summarize the findings
before proceeding.

## Step 2 — Implementation

Adopt the [`tdd-dev`](../../../tdd-dev.md) role and follow its vertical-slice workflow
exactly: one polyfill-verified failing test, the minimal fix, green, next slice.

## Step 3 — Test audit (optional)

If the work is non-trivial (multiple edge cases, locale-aware, timezone-sensitive) or the tests
feel thin, adopt the [`tester`](../../../tester.md) role. Do not modify implementation files. If
gaps are found, return to Step 2 with the targeted list.

## Step 3b — Standards review

Adopt the [`gmt-reviewer`](../../../gmt-reviewer.md) role. Read-only — do not modify any file.
Each finding names its source and the oracle that reproduced it. Never skipped. If a blocking
finding is open, return to Step 2 with the list.

## Step 4 — Story closure

Adopt the [`finalizer`](../../../finalizer.md) role and follow its workflow: skills, changeset
(per the [changeset rule](../../../../context/coding-standards.md#changesets)), READMEs, dox
corpus and stats, tracker `Status` + `pnpm deps:sync`, `pnpm run validate`. Draft a commit
message with `/commit-message` and a PR description with `/pr-desc` **for the owner to use** —
never commit or open the PR.

## Context files per role

- `context/coding-standards.md` — the sections the story touches, always
- `context/testing-standards/references/index.md` — tdd-dev and tester
- `context/jsdoc-standards.md` — implementation and finalizer
- `context/project-overview.md` — researcher and architect
- `context/domination/tracker.md` — architect and finalizer
- `PUBLISHING.md` — when release intent (changesets) is involved
