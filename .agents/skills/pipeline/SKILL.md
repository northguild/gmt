---
name: pipeline
description: Run a @northguild/gmt library or Dox request end to end from the main session — classify it (feature, bug fix, refactor, docs, research, review, direct execution, Dox), then dispatch architect, researcher, tdd-dev, tester, gmt-reviewer, finalizer, dox-architect, dox-builder and dox-tester in order. Use when the user says "implement", "build it", "implement a story", "fix this bug", "run the pipeline", "pick up <story id>", or when it is unclear which GMT agent should handle a task.
---

# Pipeline — the main session orchestrates

The main session is the only orchestrator. It classifies the request, spawns each specialist
directly, passes artifacts between them and reports back. **No specialist spawns another**:
every persona lists `Agent` in `disallowedTools`, and `.claude/settings.json` sets
`CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH=1`.

**Rules you never restate or bend:** [AGENTS.md § Core Rules](../../../AGENTS.md#core-rules-quick-reference)
and [§ Git — Only on an Explicit Instruction](../../../AGENTS.md#git--only-on-an-explicit-instruction).

## Specialists

| Agent | Model | Role |
| --- | --- | --- |
| `architect` | Opus | Library planning — writes the spec folder |
| `dox-architect` | Opus | Dox planning — writes the execution spec |
| `researcher` | Opus | Temporal / Intl docs lookup, design comparisons |
| `tdd-dev` | Sonnet | Vertical-slice test-first implementation |
| `tester` | Sonnet | Coverage audit and gap rows |
| `gmt-reviewer` | Opus | Standards and domain-convention review, read-only — the last check before code ships |
| `finalizer` | Sonnet | Story closure; drafts commit and PR text |
| `dox-builder` | Sonnet | Executes a Dox spec in `apps/dox` |
| `dox-tester` | Sonnet | Verifies a Dox story against its definition of done |

## Classify the request

| Category | Trigger | Pipeline | Changeset |
| --- | --- | --- | --- |
| **A. Story** | A tracker story: realm (`MAR-*`, `CORE-*`, …) or `DOX-*` | [`/plan-story`](../plan-story/SKILL.md) in its own session, then the gate, then `tdd-dev` → (`tester`) → `gmt-reviewer` → (`dox-builder` → `dox-tester`) → `finalizer` | per rule |
| **B. Bug fix** | Incorrect behaviour or a failing test | (`researcher`) → `tdd-dev` → `tester` → `gmt-reviewer` → `finalizer` | `patch` |
| **C. Refactor** | Internals only, no behaviour change | `tdd-dev` → `tester` → `finalizer` (commit message only) | none |
| **D. Documentation** | Docs, READMEs, JSDoc | `finalizer` (documentation steps only) | none |
| **E. Research** | Temporal behaviour, design options | `researcher` only; do not implement unless asked | — |
| **F. Code review** | Review code or a diff | `gmt-reviewer` ([checklist](../../../context/code-review-checklist.md) first) | — |
| **G. Owner's spec, no story** | The owner hands over a complete spec for work with no tracker row | `tdd-dev` → `gmt-reviewer` → `finalizer` | per rule |
| **H. Dox fix, no story** | A change in `apps/dox` with no story id | `dox-architect` → `dox-builder` → `dox-tester` | per rule |

Changeset levels follow the one [changeset rule](../../../context/coding-standards.md#changesets).

**The plan gate runs for category A only** — exactly when the work is a tracker story. Every
story is planned with `/plan-story`, however small: a small story gets a small spec (an index
and one slice), never no spec. Nothing else has a story spec, so nothing else runs the gate.

- **A.** Check `Blocked by` in the tracker (or `pnpm deps:ready`) first; never start a blocked
  story. Skip `researcher` if the Temporal API is well known. A small story (one function, under
  50 lines, no new namespace, not locale-aware) may skip `tester`; say so.
- **A, docs-site Core story.** A `CORE-*` story that adds no function and whose work is the docs
  site (`CORE-86` … `CORE-88`) has nothing to test first, so `tdd-dev` and `tester` are skipped:
  `dox-builder` → `dox-tester` for `apps/dox`, including the export step under
  `apps/dox/scripts` (`CORE-87`); `finalizer` for the READMEs and skills (`CORE-88`).
  `dox-builder` never touches `packages/gmt`.
- **B.** Skip `architect`; `tdd-dev` records the failing repro before the fix.
- **C.** Skip `architect`, `researcher` and the release steps of `finalizer`.
- **H.** `dox-architect` returns the execution spec; the main session then runs `dox-builder`
  and `dox-tester`. Library changes found on the way go through A or B, never through Dox.

**Never skip `gmt-reviewer`** where it appears — a wrong constant is the same size as a right one.

## Find the spec

Planning is [`/plan-story`](../plan-story/SKILL.md), in its own session. To implement, read the
story id from the branch (`feature/197-mar-16-…` → `MAR-16`) and load
`context/domination/specs/<ID>/index.md`, plus `context/dox/specs/<id>/index.md` if it exists.
For a story (category A), run `python3 .agents/skills/plan-story/scripts/plan_gate.py` first. On
`FAIL`, stop and tell the owner to run `/plan-story`; never plan inline.

A spec lives only while its story is in progress: `finalizer` folds its decisions into the issue
file (or Dox `built.md`), rewrites inbound references and deletes it. Never cite a spec from code,
comments or context files; cite the issue's Decisions section or the external standard.

## Hand each worker the least context that works

- The architect writes a spec folder: `index.md` of 150 lines or fewer (scope, signatures,
  file list, slice table) and one slice file per function, 200 lines or fewer each.
- `tdd-dev` and `tester` get the index plus the slice they work on — never the whole folder.
- `gmt-reviewer` gets the index plus the slices that the diff under review touches.
- Pass paths, not pasted content. Name the context file **sections** each worker needs.
- Ask each worker for a short report (findings, files changed, test counts), not a transcript.
- Workers verify with `node scripts/verdict.mjs`, `pnpm --filter dox gates` and
  `node scripts/pr-status.mjs`, and quote the screen. A raw log is read only for a failure it names.

**Escalate one call, not the default.** Pass `model: "opus"` on a single `tdd-dev` or `tester`
call only when a slice has failed review twice, or turns on tricky domain arithmetic or a
disputed reading of a standard. Say so in the report. The agent files' defaults stay as they are.

## Orchestration rules

1. **Pass artifacts between agents.** Spec → `tdd-dev`; `tdd-dev` output → `tester`;
   `tester` gaps and `gmt-reviewer` findings → `tdd-dev`.
2. **Iteration cap (defined only here):** the `tdd-dev` → `tester` and `tdd-dev` →
   `gmt-reviewer` loops each run at most **2 iterations**, likewise `dox-builder` →
   `dox-tester`. After the second pass, report what remains to the user.
3. **Zero known bugs.** A defect found at any stage is fixed in the same story before the next
   step. Never deferred, pinned with `it.fails`, skipped or documented as known; `finalizer`
   refuses to close a story that carries one ([Core Rule 12](../../../AGENTS.md#core-rules-quick-reference)).
4. **Escalate blockers** — an ambiguous spec, a design conflict, tests that cannot pass: stop
   and report to the user with full context. No step fails or is skipped silently.
5. **Nothing is committed.** The pipeline ends with unstaged changes plus drafted commit and PR
   text for the owner. Never run `changeset version`, `changeset publish`, `npm publish` or
   `gh release create` (see `PUBLISHING.md`).

## Keep the session small

One story per session. Run `/clear` between stories. If the session nears ~200K tokens before
the story is done, write a `/handoff` note and continue in a fresh session.

## Without subagents

In a single-model chat, run the same sequence as labelled steps in one turn — see
[references/inline-mode.md](references/inline-mode.md).
