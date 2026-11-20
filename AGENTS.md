# GMT Temporal Library — Agent Guide

Copyright (c) 2026 NorthGuild. All rights reserved under [`.agents/LICENSE`](.agents/LICENSE); the root MIT licence does not apply to this file.

`@northguild/gmt`: Temporal-first date/time library. String-in, string-out. No `Date`.

## Context Files

| File | Read it when |
| --- | --- |
| [project-overview](./context/project-overview.md) | Always |
| [coding-standards](./context/coding-standards/index.md) | Writing or reviewing source: sentinels, calendar and zone semantics, changesets |
| [testing-standards](./context/testing-standards/references/index.md) | Writing or reviewing tests |
| [jsdoc-standards](./context/jsdoc-standards.md) | Adding or updating public JSDoc |
| [AUTHORITY_TABLE](./context/reference/AUTHORITY_TABLE.md) | A function implements a standard |
| [LOCAL_TIME_RESOLUTION](./context/reference/LOCAL_TIME_RESOLUTION.md) | A function takes a local wall time |
| [code-review-checklist](./context/code-review-checklist.md) | Reviewing a PR |
| [linting-packages](./context/linting-packages.md) | Working on gmt-eslint, gmt-oxlint or gmt-biome |
| [dox](./context/dox/index.md) | Working on `apps/dox` |
| [domination](./context/domination/index.md) | Picking up an epic story; check `Blocked by` first |
| [canary](./context/canary/index.md) | A canary or a `CNRY-*` story |
| [skills](./context/skills.md) | Choosing a skill |

## Git — Only on an Explicit Instruction

Leave finished work **unstaged**. Never stage, commit, branch, push or open a PR on your own initiative; permission is never inferred (a choice between approaches, "ship it", urgency). Force-pushes, pushes to `main` and history rewrites must be asked for by name. Two standing instructions need no new word: merge `origin/main` into the branch, and run `node scripts/pr-meta.mjs --apply` on an open PR. The full policy, with both standing instructions, is [context/git.md](./context/git.md).

## Core Rules (Quick Reference)

1. **No `Date` object.** `@js-temporal/polyfill` only, imported through `packages/gmt/src/internal/temporal.ts`.
2. **String-in, string-out.** Never return Temporal objects.
3. **Invalid input returns a sentinel, never throws.** Table: [API Contract](./context/coding-standards/api-contract.md#api-contract).
4. **Wrap every Temporal call in `try-catch`.** One exception: [the UTC clock readers](./context/coding-standards/api-contract.md#scoped-exception-the-utc-clock-readers).
5. **Keep `plain/` and `zoned/` separate.** Never mix them.
6. **Full 17-locale matrix** for locale-aware functions; `expectOneOfIcu` / `expectDateTimeEqual` where CLDR differs.
7. **Pre-built mocks** for error-path tests: `packages/gmt/src/test/mocks`.
8. **JSDoc with `@example`** on every public function: valid, invalid and edge inputs.
9. **TC39 Temporal is the calendar authority.** Arithmetic clamps, parsers reject: [Calendar & zone semantics](./context/coding-standards/calendar-and-zones.md#calendar--zone-semantics).
10. **Never truncate-and-re-resolve a zoned boundary.** Use `internal/zonedBucket.ts`, `startOfDay()` or `hoursInDay`; test the probe zones.
11. **One changeset rule:** [Changesets](./context/coding-standards/changesets.md#changesets). `major` is never used.
12. **Zero known bugs.** Fix a defect and its whole class in the same story; ship no `it.fails`, skip or known-defect note. `node scripts/test-markers.mjs check` is a backstop, not the definition: [Zero known bugs](./context/testing-standards/references/index.md#zero-known-bugs).
13. **Plain English** for anything a person reads (ISO 24495-1:2023): the [`plain-english` skill](./.agents/skills/plain-english/SKILL.md).
14. **Runtime workarounds follow one frozen approach:** fix to the standard's answer, dormant unless a probe fails, no output change on removal, no GMT copy of CLDR or ICU data. Never change it or add an exception without the owner's word naming the file: [runtime-workarounds](./context/coding-standards/runtime-workarounds.md).

## Sessions and Agents

- A story is `/plan-story`, `/clear`, `/implement`. One story per session; near 200K tokens, `/handoff`.
- Only the main session spawns agents ([`pipeline`](./.agents/skills/pipeline/SKILL.md)). Needs Claude Code 2.1.251+.
- Verdicts, not logs: `pnpm verdict`, `pnpm pr-status`, `pnpm -F dox gates`.
