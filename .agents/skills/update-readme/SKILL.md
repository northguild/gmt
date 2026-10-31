---
name: update-readme
description: Bring the two landing-page READMEs (README.md and packages/gmt/README.md) up to date. The two files are identical. Syncs the generated figures, runs the checks on the sample block, the namespace links and the agent prompt, and makes the four hand edits that remain - a namespace added or removed, a sampled function changed, the agent prompt changed, a library added or removed. Never adds a section for a function or a feature; that content goes to a docs guide. Namespace READMEs (packages/gmt/src/<namespace>/README.md) stay one-line stubs pointing at the docs site. Use when the user asks to "update the README" or "sync the READMEs", or after a story changes the public API.
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

1. The title, then one line of badges: npm version, licence, CI status and Node version. No downloads badge.
2. A one-line claim that names JavaScript, TypeScript, time zones, DST and business days, and lists the libraries GMT stands in for ("in place of …"). Then one line of links (docs, API reference, tools, Discord).
3. The opening block, a block showing one operation across all six types (date, time, date and time, zoned, UTC, Unix) so readers see the suffix names a type, then the DST example. The opening block is the plainest, most used calls (add, subtract, diff, start and end of a month, compare, format) and comes first. The DST example: a short code block with no `Date` in it. It shows a day and 24 hours giving different answers across a spring-forward in one zone, then a gap time that `disambiguation: "reject"` refuses. Every line is a `call // result` line, checked like the sample.
4. Two fact bullets: the functions and locales, and the never-throws contract. The README holds no test count and no CI test run count.
5. One line under the bullets. It sends readers to the docs site's `/why-gmt/` page for the latest test counts, CI volume and the comparison with the other libraries, and to `/compare/` for the full comparison and the method.
6. One line of migrate links.
7. **Install**: one command, then one line that links the three lint plugins.
8. **Use**: the sample. It is one import line and three calls with their results, the business-day and zone-conversion calls that the opening block does not show. Longer examples belong on the docs site.
9. The namespace links: one line of links to `/reference/<namespace>/` for every namespace, then a "By industry:" line that links each industry's page (`/industries/<id>/`). Only a namespace that exports functions has a link, so `regex` and `types` have none. A line linking the guides and the tools follows.
10. **Agent prompt**: a setup prompt for someone using the library.
11. **License**.

## What they never hold

No README holds a section for one function or one feature, and none holds a "Quick Start". The docs site (<https://northguild.dev/gmt>) holds that content.

| Content                                         | Where it lives                              |
| ----------------------------------------------- | ------------------------------------------- |
| How to use a function or a feature              | A guide under `/guides/`                    |
| Signatures, options and examples                | The generated reference under `/reference/` |
| Design philosophy and core rules                | `/core-rules/`                              |
| Install detail and what the package exports     | `/install/`                                 |
| Test counts, CI volume and locale coverage      | `/why-gmt/`                                 |
| The full comparison with other libraries        | `/compare/`                                 |
| The agent skills table                          | `/guides/integration/skills/`               |
| Contributor rules                               | `CONTRIBUTING.md` in the repository         |

The site also serves `/llms.txt`, `/llms-full.txt` and a `.md` twin of every page for AI agents.

A story that adds or changes functions adds no README section. It adds or updates a docs guide, which the Dox agents write, and the generated reference follows from the JSDoc.

## The data that must stay current

| Data                                                                                                                                   | Source                                                                                     | Who writes it                                                   | What checks it                                                            |
| -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------- | ------------------------------------------------------------------------- |
| GMT's figures in the fact bullet: functions and locales (the test and CI counts go to `apps/dox/src/data/gmt-stats.json` for the site) | The repository                                                                             | `pnpm stats:sync`                                               | `node scripts/stats.mjs check`                                            |
| The libraries the opening line and the Why GMT sentence name                                                                                                   | `apps/dox/src/data/library-measurements.json`; each entry carries a `measuredOn` date      | You, by hand                                                    | `node scripts/stats.mjs check` compares both lists with that file; it also rejects a typed test or CI run count. Nothing measures them again automatically |
| The sample block                                                                                                                       | A real call against the built library                                                      | You, by hand                                                    | `node scripts/api-surface.mjs check` runs every `call // result` line     |
| The namespace links                                                                                                                    | The namespaces that export functions. "By industry:" links each industry's page            | You, by hand                                                    | `node scripts/stats.mjs check`                                            |
| The two files being identical                                                                                                          | `README.md`                                                                                | You: edit one, then `cp README.md packages/gmt/README.md`       | `node scripts/stats.mjs check`; `cmp README.md packages/gmt/README.md`    |
| The agent prompt                                                                                                                       | `AGENT_PROMPT` in `apps/dox/src/lib/agent-prompt.ts`                                       | You, by hand, in all three copies                               | The Dox test `apps/dox/src/lib/agent-prompt.test.ts`                      |

Both checks are part of `pnpm run validate`. `stats check` also fails when someone rewords a guarded line, because nothing then checks that line's figure. `sync` rewrites digits only. Everything else needs a hand edit, and `check` says which.

## Steps

See [references/steps.md](references/steps.md). It covers the sync, the two checks and the four cases that still need a hand edit: a namespace added or removed, a sampled function changed, the agent prompt changed, and a library added or removed.

## Rules

- **Never type a figure.** `pnpm stats:sync` writes every number. If a figure looks wrong, fix its source, not the README.
- **Never type a result.** Every result in the sample comes from a real call against the built library, pasted as printed.
- **Never invent function names.** Every function in the sample must exist in `packages/gmt/src/`. Check the barrel export (`src/<namespace>/index.ts`) before you use a name.
- **Never add a section for a function or a feature.** Tell the user which docs guide the content belongs in.
- **The two files are identical.** Edit `README.md`, then copy it: `cp README.md packages/gmt/README.md`.
- **Namespace READMEs are stubs.** They are one-line pointers to the docs site. Do not expand them into function lists. Update one only when its reference path changes, and add one for a new namespace.
- **Leave the sub-package READMEs alone** unless that lint package's own rules or options changed.
- **Match the existing style exactly.** Keep the heading levels, the code-block shapes and the comment style of the sample.
- **One logical edit per file.** Read the file, identify all changes needed, and make them in a single pass.
