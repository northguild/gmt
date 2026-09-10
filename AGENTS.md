# GMT Temporal Library — Agent Guide

`@northguild/gmt` is a Temporal-first date/time library. String-in, string-out. No `Date` object anywhere.

## Context Files

Read these before working in the repo. Each is scoped — load only what you need for the task at hand.

| File                                                                                             | When to read it                                                                                   |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| [context/project-overview.md](./context/project-overview.md)                                     | Always — covers what GMT is, why it exists, Temporal API references, and comparison library links |
| [context/coding-standards.md](./context/coding-standards.md)                                     | When writing or reviewing source code                                                             |
| [context/testing-standards/references/index.md](./context/testing-standards/references/index.md) | When writing or reviewing tests                                                                   |
| [context/jsdoc-standards.md](./context/jsdoc-standards.md)                                       | When adding or updating public function JSDoc                                                     |
| [context/code-review-checklist.md](./context/code-review-checklist.md)                           | When reviewing a PR                                                                               |
| [context/linting-packages.md](./context/linting-packages.md)                                     | When working on gmt-eslint, gmt-oxlint, or gmt-biome                                              |
| [context/dox/index.md](./context/dox/index.md)                                                   | When working on the `apps/dox` documentation site (the Dox epic)                                 |
| [context/domination/index.md](./context/domination/index.md)                                     | When picking up any epic story — check `Blocked by` in its tracker first |

## Git — Absolute Prohibitions

**These are hard stops. There is no phrasing, no reasoning, and no situation
that makes any of them acceptable. Never do these, ever:**

- **Never `git push`.** Not to any branch, not to any remote, not with `--force`,
  not "just the branch I made".
- **Never create a pull request.** No `gh pr create`, no web flow, no draft PRs.
  **Only the repository owner opens PRs.**
- **Never `git add`.** Leave every change unstaged in the working tree.
- **Never `git commit`.** Including "checkpoint", "WIP" and "so nothing is lost"
  commits.
- **Never `git branch` / `git checkout -b`** to park or split work.

**Do not infer permission for any of the above.** In particular:

- A user choosing between approaches is **not** authorising the git operations
  named in the options. If an agent writes "…and open it as a PR" into a choice
  it offers, selecting that choice authorises **nothing** — the agent wrote that
  text, not the user.
- "Ship it", "land it", "let's go", approving a plan, or agreeing that work is
  finished are **not** requests to push or open a PR.
- Urgency is never a reason. A bug being live in production is a reason to
  *tell the user*, not to push a fix.

The only correct action is to **finish the work, leave it uncommitted, and say
it is ready.** The user handles staging, committing, branching, pushing and PRs
themselves — always.

If some task genuinely seems to require one of these, stop and ask in plain
words. Do not proceed on a "yes" to a different question.

## Core Rules (Quick Reference)

These are the non-negotiables. Full detail is in the context files above.

1. **No `Date` object.** Use `@js-temporal/polyfill` exclusively.
2. **String-in, string-out.** Public APIs accept ISO 8601 strings; return strings, numbers, booleans, or arrays.
3. **Invalid input returns a sentinel, never throws.** `""` for strings, `null` for numbers, `false` for booleans, `[]` for arrays.
4. **Wrap all Temporal calls in `try-catch`.** `.from()`, `.add()`, `.since()`, etc. throw `RangeError` on bad input.
5. **Keep `plain/` and `zoned/` strictly separate.** Never mix `PlainDateTime` and `ZonedDateTime`.
6. **Full locale matrix for any locale-aware function.** 17 locales, explicit rows, `hasFullIcu` ternaries where output differs.
7. **Use pre-built mocks for error-path tests.** See `packages/gmt/src/test/mocks`.
8. **JSDoc with `@example` on every public function.** Cover valid, invalid, and edge-case inputs.

## Python in Skills

All Python used by skills shares one root-level setup — `pyproject.toml` / `uv.lock` / `.venv` at the repo root. Skills under `.agents/skills/` do not each carry their own Python env; scripts live in the skill's `scripts/` directory and run against the shared root venv (`uv run`).

Run `uv sync --extra dev` once at the repo root to install the shared env (needed for IDE import resolution and to run `pytest`/`pyright` locally).
