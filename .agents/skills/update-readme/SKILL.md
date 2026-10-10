---
name: update-readme
description: Bring the two landing-page READMEs (README.md and packages/gmt/README.md) up to date. The two files are identical. Syncs the generated figures, runs the checks on the comparison table, the sample block, the namespace links and the agent prompt, and makes the four hand edits that remain - a namespace added or removed, a sampled function changed, the agent prompt changed, a library added, removed or re-ordered in the comparison table. Never adds a section for a function or a feature; that content goes to a docs guide. Namespace READMEs (packages/gmt/src/<namespace>/README.md) stay one-line stubs pointing at the docs site. Use when the user asks to "update the README" or "sync the READMEs", or after a story changes the public API, the test suite or the CI matrix.
argument-hint: "no arguments needed"
---

# Update READMEs

Bring the READMEs up to date with the current branch. Run this skill after a story changes the public API, the test suite or the CI matrix. Run it too when `node scripts/stats.mjs check` or `node scripts/api-surface.mjs check` fails on a README.

## Repo README layout

There are four levels of README in this repo:

1. **Root** — `README.md`: the GitHub landing page.
2. **Package** — `packages/gmt/README.md`: the npm landing page. It is identical to the root file, whole file.
3. **Namespace** — `packages/gmt/src/<namespace>/README.md`: one-line stubs pointing at the corresponding docs site section. The docs build generates the full function reference. Do not maintain function lists here.
4. **Sub-package** — `packages/gmt-biome/README.md`, `packages/gmt-eslint/README.md`, `packages/gmt-oxlint/README.md`: each linting package's own docs. An API change in `@northguild/gmt` usually leaves them untouched.

## What the two landing pages hold

The two files are one page, identical byte for byte. The root file adds nothing. In order, the page holds:

1. The title, a one-line claim and one line of links (docs, API reference, tools, Discord).
2. Four fact lines: bullets led by numbers. They give the tests and CI test runs, the multiple over the other libraries, the functions and locales, and the never-throws contract.
3. The comparison table: GMT's row, then one row for each library in `apps/dox/src/data/library-measurements.json`. The columns are Tests, CI test runs and Built on.
4. One sentence under the table. It gives the days the other libraries were measured and links to the docs site's `/compare/` page.
5. **Install**: one command, then one line that links the three lint plugins.
6. **Use**: the sample. It is one import line and eight calls with their results.
7. The namespace links: one line of links to `/reference/<namespace>/` for the general namespaces, then a "By industry:" line for the industry namespaces. Only a namespace that exports functions has a link, so `regex` and `types` have none. A line linking the guides and the tools follows.
8. **Agent prompt**: a setup prompt for someone using the library.
9. **License**.

## What they never hold

No README holds a section for one function or one feature, and none holds a "Quick Start". The docs site (<https://gmt-dox.northguild.workers.dev>) holds that content.

| Content                                         | Where it lives                              |
| ----------------------------------------------- | ------------------------------------------- |
| How to use a function or a feature              | A guide under `/guides/`                    |
| Signatures, options and examples                | The generated reference under `/reference/` |
| Design philosophy and core rules                | `/core-rules/`                              |
| Install detail and what the package exports     | `/install/`                                 |
| Testing strategy, CI volume and locale coverage | `/why-gmt/`                                 |
| The full comparison with other libraries        | `/compare/`                                 |
| The agent skills table                          | `/guides/integration/skills/`               |
| Contributor rules                               | `CONTRIBUTING.md` in the repository         |

The site also serves `/llms.txt`, `/llms-full.txt` and a `.md` twin of every page for AI agents.

A story that adds or changes functions adds no README section. It adds or updates a docs guide, which the Dox agents write, and the generated reference follows from the JSDoc.

## The data that must stay current

| Data                                                                                                                                   | Source                                                                                     | Who writes it                                                   | What checks it                                                            |
| -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------- | ------------------------------------------------------------------------- |
| GMT's figures in the fact lines and its table row: tests, CI test runs, time zones, Node versions, the multiple, functions and locales | The repository                                                                             | `pnpm stats:sync`                                               | `node scripts/stats.mjs check`                                            |
| The other libraries' figures and the days they were measured                                                                           | `apps/dox/src/data/library-measurements.json`; each entry carries a `measuredOn` date      | `pnpm stats:sync`                                               | `node scripts/stats.mjs check`. Nothing measures them again automatically |
| The sample block                                                                                                                       | A real call against the built library                                                      | You, by hand                                                    | `node scripts/api-surface.mjs check` runs every `call // result` line     |
| The rows of the comparison table and their order                                                                                       | One row per library in `library-measurements.json`: GMT's first, then by tests, most first | You, by hand. `sync` fills a row's figures and pads the columns | `node scripts/stats.mjs check`                                            |
| The count word in the fact lines ("six")                                                                                               | The number of libraries in `library-measurements.json`                                     | You, by hand                                                    | `node scripts/stats.mjs check`                                            |
| The namespace links                                                                                                                    | The namespaces that export functions. The industry ones go on the "By industry:" line      | You, by hand                                                    | `node scripts/stats.mjs check`                                            |
| The two files being identical                                                                                                          | `README.md`                                                                                | You: edit one, then `cp README.md packages/gmt/README.md`       | `node scripts/stats.mjs check`; `cmp README.md packages/gmt/README.md`    |
| The agent prompt                                                                                                                       | `AGENT_PROMPT` in `apps/dox/src/lib/agent-prompt.ts`                                       | You, by hand, in all three copies                               | The Dox test `apps/dox/src/lib/agent-prompt.test.ts`                      |

Both checks are part of `pnpm run validate`. `stats check` also fails when someone rewords a guarded line, because nothing then checks that line's figure. `sync` rewrites digits and the table's padding only. Everything else needs a hand edit, and `check` says which.

## Steps

See [references/steps.md](references/steps.md). It covers the sync, the two checks and the four cases that still need a hand edit: a namespace added or removed, a sampled function changed, the agent prompt changed, and a library added, removed or re-ordered in the comparison table.

## Rules

- **Never type a figure.** `pnpm stats:sync` writes every number. If a figure looks wrong, fix its source, not the README. The one count you write is the word in the fact lines ("six").
- **Never type a result.** Every result in the sample comes from a real call against the built library, pasted as printed.
- **Never invent function names.** Every function in the sample must exist in `packages/gmt/src/`. Check the barrel export (`src/<namespace>/index.ts`) before you use a name.
- **Never add a section for a function or a feature.** Tell the user which docs guide the content belongs in.
- **The two files are identical.** Edit `README.md`, then copy it: `cp README.md packages/gmt/README.md`.
- **Namespace READMEs are stubs.** They are one-line pointers to the docs site. Do not expand them into function lists. Update one only when its reference path changes, and add one for a new namespace.
- **Leave the sub-package READMEs alone** unless that lint package's own rules or options changed.
- **Match the existing style exactly.** Keep the heading levels, the table shapes and the comment style of the sample.
- **One logical edit per file.** Read the file, identify all changes needed, and make them in a single pass.
