---
name: update-readme
description: Diff the current branch against main, identify user-facing API changes, then update the root README, packages/gmt/README.md, and the inner namespace READMEs (packages/gmt/src/{plain,zoned,unix,utc,regex}/README.md) to reflect those changes.
argument-hint: "no arguments needed"
---

# Update READMEs

Keep the project's README files in sync with the changes on the current branch. Run this skill after adding, removing, or renaming exported functions, adding a new namespace module, or changing a significant behavior that consumers need to know about.

## Repo README layout

There are four levels of README in this repo:

1. **Root** — `README.md`: monorepo overview, install, package table, project structure tree, contributing commands.
2. **Package** — `packages/gmt/README.md`: full API overview for `@burglekitt/gmt`. Includes design philosophy, quick-start examples, and the API surface section.
3. **Namespace** — `packages/gmt/src/{plain,zoned,unix,utc,regex}/README.md`: per-namespace function lists, one per module (calculate, format, get, …).
4. **Sub-package** — `packages/gmt-biome/README.md`, `packages/gmt-eslint/README.md`, `packages/gmt-oxlint/README.md`: each linting package's own docs (usually untouched by API changes).

## Steps

### 1. Ground the diff in real state

Run these in parallel:

```bash
git log --oneline main..HEAD
git diff main...HEAD --stat
```

Then read the changeset(s) in `.changeset/*.md` (skip `README.md` inside `.changeset/`). The changeset describes the user-visible change and the version bump type (`patch` / `minor` / `major`).

Build a working list of:

- **New exports**: functions added on this branch.
- **Renamed/removed exports**: must be pulled from every README they appear in.
- **New modules or namespaces**: e.g. a new `unix/format/` module that didn't exist before.
- **Behavior or option changes**: e.g. a new option accepted by an existing formatter.

### 2. Read every README that may be affected

Before touching any file, read the current content of the potentially-affected READMEs. Do not update a file you haven't read.

Determine which READMEs need changes:

- New exports in `plain/` → `packages/gmt/src/plain/README.md` + `packages/gmt/README.md`
- New exports in `zoned/` → `packages/gmt/src/zoned/README.md` + `packages/gmt/README.md`
- New exports in `unix/` → `packages/gmt/src/unix/README.md` + `packages/gmt/README.md`
- New exports in `utc/` → `packages/gmt/src/utc/README.md` + `packages/gmt/README.md`
- New exports in `regex/` → `packages/gmt/src/regex/README.md` + `packages/gmt/README.md`
- Any new namespace (e.g. `unix`) added to the top-level exports → root `README.md` + `packages/gmt/README.md` project structure tree

### 3. Update namespace READMEs

For each affected `packages/gmt/src/<namespace>/README.md`:

- Add new functions to the correct module section. Match the existing list style exactly: one bullet per function, alphabetically sorted within the list, backtick-quoted names.
- If a new module is introduced within the namespace (e.g. a `format/` module that previously didn't exist), add a new `### <module>` section in the same style as the others.
- If the new module involves locale-aware formatting via `Intl.DateTimeFormat` or `Intl.RelativeTimeFormat`, include the **Locale data note** blockquote under the `### format` heading. Copy the canonical wording from an existing namespace README — do not paraphrase it.
- Remove any function names that were deleted or renamed.
- Do not add prose or examples — namespace READMEs are reference lists only.

### 4. Update `packages/gmt/README.md`

This README has several sections to keep in sync:

**Quick Start examples**: If new top-level functions are added that represent a new concept (e.g. relative formatting), add a brief code block under the relevant `### <concept>` section. Match the comment style (`// e.g. "..."` for runtime-dependent output, `// "..."` for deterministic output).

**Formatting section**: If new `format*` functions are added, add them to the import list in the quick-start formatting block and add a brief example line. Place relative formatters together. Keep examples concise — one or two lines each.

**API Surface section**: The links at the bottom point to the namespace README files. This section usually needs no change unless a new namespace is introduced.

**Install / Package Layout sections**: Rarely change; only update if the public import shape changed (e.g. a new named export at the top level).

### 5. Update root `README.md`

The root README is mostly stable. Only update it when:

- A new top-level namespace is added to the `@burglekitt/gmt` exports (update the "currently exports…" line and possibly the project structure tree).
- A new function is added that belongs in the "Use GMT instead" bullet list under the "no JavaScript Date objects" section.
- A new package is added to the Packages table.

If none of these apply, skip the root README.

### 6. Verify no stale references remain

After editing, grep for any renamed or removed function names across all four README levels to confirm no stale references remain:

```bash
grep -r "<old-function-name>" packages/gmt/README.md packages/gmt/src/*/README.md README.md
```

### 7. Report what changed

Print a short summary:

- Which README files were modified.
- What was added, removed, or updated in each.
- Any open questions (e.g. "should `formatRelativeZoned` move to a new `### format` section in the zoned README or stay under the existing one?").

## Rules

- **Never invent function names.** Every function listed must exist in `packages/gmt/src/`. Cross-check with `grep` or by reading the barrel export (`src/<namespace>/index.ts`) before adding to a README.
- **Match existing style exactly.** Bullet lists, heading levels, blockquote wording for locale notes, alphabetical ordering within a module list — don't drift from the established pattern.
- **Do not add prose to namespace READMEs.** They are reference lists. Prose and examples belong in `packages/gmt/README.md`.
- **Do not remove the locale data note** from a `### format` section that already has it — only add it when the module is newly getting locale-aware formatters.
- **Do not fabricate changeset content.** Only describe changes that are visible in the diff.
- **One logical edit per file.** Read the file, identify all changes needed, make them in a single pass, not iteratively.
