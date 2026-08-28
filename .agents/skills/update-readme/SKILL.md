---
name: update-readme
description: Diff the current branch against main, identify user-facing API changes, then update the root README, packages/gmt/README.md, and the inner namespace READMEs (packages/gmt/src/{plain,zoned,unix,utc,regex}/README.md) to reflect those changes. Namespace READMEs are now one-line stubs pointing at the docs site; only update them if the reference path changes. Use when the user asks to "update the README", "sync the docs", or after adding, removing, or renaming exported functions.
argument-hint: "no arguments needed"
---

# Update READMEs

Keep the project's README files in sync with the changes on the current branch. Run this skill after adding, removing, or renaming exported functions, adding a new namespace module, or changing a significant behavior that consumers need to know about.

## Repo README layout

There are four levels of README in this repo:

1. **Root** — `README.md`: monorepo overview, install, package table, project structure tree, contributing commands.
2. **Package** — `packages/gmt/README.md`: full API overview for `@northguild/gmt`. Includes design philosophy, quick-start examples, and the API surface section.
3. **Namespace** — `packages/gmt/src/{plain,zoned,unix,utc,regex}/README.md`: one-line stubs pointing at the corresponding docs site section. The full function reference is generated automatically by the docs build — do not maintain function lists here.
4. **Sub-package** — `packages/gmt-biome/README.md`, `packages/gmt-eslint/README.md`, `packages/gmt-oxlint/README.md`: each linting package's own docs (usually untouched by API changes).

## Steps

See [references/steps.md](references/steps.md) for the full step-by-step (grounding the diff, reading affected READMEs, updating namespace/package/root READMEs, verifying no stale references, and reporting).

## Rules

- **Never invent function names.** Every function listed must exist in `packages/gmt/src/`. Cross-check with `grep` or by reading the barrel export (`src/<namespace>/index.ts`) before adding to a README.
- **Match existing style exactly.** Bullet lists, heading levels, blockquote wording for locale notes, alphabetical ordering within a module list — don't drift from the established pattern.
- **Namespace READMEs are stubs.** They are one-line pointers to the docs site. Do not expand them into function lists. Only update them if the reference path slug changes.
- **Do not remove the locale data note** from a `### format` section that already has it — only add it when the module is newly getting locale-aware formatters.
- **Do not fabricate changeset content.** Only describe changes that are visible in the diff.
- **One logical edit per file.** Read the file, identify all changes needed, make them in a single pass, not iteratively.
