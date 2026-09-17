# GMT Temporal Library — Agent Guide

`@northguild/gmt` is a Temporal-first date/time library. String-in, string-out. No `Date` object anywhere.

## Context Files

Read these before working in the repo. Each is scoped — load only what you need for the task at hand.

| File                                                                                             | When to read it                                                                                                                                  |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| [context/project-overview.md](./context/project-overview.md)                                     | Always — covers what GMT is, why it exists, Temporal API references, and comparison library links                                                |
| [context/coding-standards.md](./context/coding-standards.md)                                     | When writing or reviewing source code — API contract and sentinel table, calendar & zone semantics (TC39 clamp, zone boundaries), changeset rule |
| [context/testing-standards/references/index.md](./context/testing-standards/references/index.md) | When writing or reviewing tests                                                                                                                  |
| [context/jsdoc-standards.md](./context/jsdoc-standards.md)                                       | When adding or updating public function JSDoc                                                                                                    |
| [context/reference/AUTHORITY_TABLE.md](./context/reference/AUTHORITY_TABLE.md)                   | When planning or reviewing any function that implements a standard — how a rule cites its clause                                                 |
| [context/reference/LOCAL_TIME_RESOLUTION.md](./context/reference/LOCAL_TIME_RESOLUTION.md)       | When a function takes a local wall time — the disambiguation vocabulary and the canonical DST cases                                              |
| [context/code-review-checklist.md](./context/code-review-checklist.md)                           | When reviewing a PR                                                                                                                              |
| [context/linting-packages.md](./context/linting-packages.md)                                     | When working on gmt-eslint, gmt-oxlint, or gmt-biome                                                                                             |
| [context/dox/index.md](./context/dox/index.md)                                                   | When working on the `apps/dox` documentation site (the Dox epic)                                                                                 |
| [context/domination/index.md](./context/domination/index.md)                                     | When picking up any epic story — check `Blocked by` in its tracker first                                                                         |

## Git — Only on an Explicit Instruction

**The default is always: finish the work, leave it unstaged in the working tree,
and say it is ready.** Do not stage, commit, branch, push or open a pull request
on your own initiative — not as a checkpoint, not "so nothing is lost", not
because the work looks finished.

**Do them when the user tells you to, in plain words, in the current session.**
"Commit this", "push the branch", "open the PR" are instructions: carry them out
and report what you did. An instruction covers the operation it names for the
work in hand. It is not a standing licence — a later, separate write needs its
own instruction.

**Never infer the permission.** It has to come from the user, about this
operation, in their own words:

- A user choosing between approaches is **not** authorising the git operations
  named in the options. If an agent writes "…and open it as a PR" into a choice
  it offers, selecting that choice authorises **nothing** — the agent wrote that
  text, not the user.
- "Ship it", "land it", "let's go", approving a plan, or agreeing that work is
  finished are **not** requests to push or open a PR. They are about the work,
  not about git.
- Urgency is not a reason on its own. A bug being live in production is a reason
  to *tell the user*, not to push a fix nobody asked for.
- A "yes" to a different question is not a yes to this one.

**Destructive and wide-reaching variants have to be asked for by name.**
`--force` / `--force-with-lease`, a push to `main` or any default branch, a
rewrite of published history, and `git reset --hard` over uncommitted work are
authorised only when the user asks for that specific thing. "Push the branch"
does not authorise force-pushing it.

If one of these seems genuinely necessary and nobody has asked for it, stop and
ask in plain words.

## Core Rules (Quick Reference)

These are the non-negotiables. Full detail is in the context files above.

1. **No `Date` object.** Use `@js-temporal/polyfill` exclusively.
2. **String-in, string-out.** Public APIs accept ISO 8601 strings; return strings, numbers, booleans, arrays, `bigint`, or plain objects — never Temporal objects.
3. **Invalid input returns a sentinel, never throws.** `""` for strings, `null` for numbers and objects, `false` for booleans, `[]` for arrays — the full table (bigint, span, exceptions) is [coding-standards § API Contract](./context/coding-standards.md#api-contract).
4. **Wrap all Temporal calls in `try-catch`.** `.from()`, `.add()`, `.since()`, etc. throw `RangeError` on bad input.
5. **Keep `plain/` and `zoned/` strictly separate.** Never mix `PlainDateTime` and `ZonedDateTime`.
6. **Full locale matrix for any locale-aware function.** 17 locales, explicit rows, `expectOneOfIcu`/`expectDateTimeEqual` (from `packages/gmt/src/test/icuVariants.ts`) where CLDR wording differs.
7. **Use pre-built mocks for error-path tests.** See `packages/gmt/src/test/mocks`.
8. **JSDoc with `@example` on every public function.** Cover valid, invalid, and edge-case inputs.
9. **TC39 Temporal is the calendar authority.** Arithmetic clamps (`overflow: "constrain"`); parsers reject. See [§ Calendar & zone semantics](./context/coding-standards.md#calendar--zone-semantics).
10. **Never truncate-and-re-resolve a zoned boundary.** Use `internal/zonedBucket.ts` or `startOfDay()`/`hoursInDay`; test against the probe zones. Same section.
11. **One changeset rule.** Fix → `patch`, no behaviour change → none, new API → `minor`, breaking change → `minor` with a **Breaking changes** migration section. `major` is never used. See [coding-standards § Changesets](./context/coding-standards.md#changesets).
12. **Zero known bugs.** A defect found is fixed now, in the same story, and its whole class with it. It is never deferred, pinned with `it.fails`, skipped, or documented as known. No disabled, focused or expected-to-fail test ships; `node scripts/test-markers.mjs check` in `validate` enforces it. That script is a backstop, not the definition of this rule: its checks are lexical, so it catches `it.skip` / `it.fails` reliably but cannot see a carried defect worded any other way, and a green check is never on its own evidence that the rule was met. See [testing standards § Zero known bugs](./context/testing-standards/references/index.md#zero-known-bugs).

## Python in Skills

All Python used by skills shares one root-level setup — `pyproject.toml` / `uv.lock` / `.venv` at the repo root. Skills under `.agents/skills/` do not each carry their own Python env; scripts live in the skill's `scripts/` directory and run against the shared root venv (`uv run`).

Run `uv sync --extra dev` once at the repo root to install the shared env (needed for IDE import resolution and to run `pytest`/`pyright` locally).
