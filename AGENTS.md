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
| [context/roadmap/index.md](./context/roadmap/index.md)                                           | When picking up or reviewing roadmap work                                                         |
| [context/roadmap/index.md](./context/roadmap/index.md)                                           | Roadmap entry point (redirects to progressive-disclosure directory)                               |
| [context/dox/index.md](./context/dox/index.md)                                                   | When working on the `apps/dox` documentation site (the Dox epic)                                 |

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
