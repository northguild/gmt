# Steps

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

Namespace READMEs are one-line stubs pointing at the docs site. The full function reference is generated automatically by the docs build.

For each affected `packages/gmt/src/<namespace>/README.md`:

- Ensure the stub follows the shape:
  ```markdown
  # <Namespace> API

  See the full reference at [/reference/<slug>](/reference/<slug>).
  ```
  where `<slug>` is `plain`, `zoned`, `unix`, `utc`, `duration`, or `regex`.
- Do **not** expand the stub into a function list. The docs generator owns the function index.
- Only update a namespace README if the reference path slug itself changes (e.g. a namespace rename).

### 4. Update `packages/gmt/README.md`

This README has several sections to keep in sync:

**Quick Start examples**: If new top-level functions are added that represent a new concept (e.g. relative formatting), add a brief code block under the relevant `### <concept>` section. Match the comment style (`// e.g. "..."` for runtime-dependent output, `// "..."` for deterministic output).

**Formatting section**: If new `format*` functions are added, add them to the import list in the quick-start formatting block and add a brief example line. Place relative formatters together. Keep examples concise — one or two lines each.

**API Surface section**: The links at the bottom point to the namespace README files. This section usually needs no change unless a new namespace is introduced.

**Install / Package Layout sections**: Rarely change; only update if the public import shape changed (e.g. a new named export at the top level).

### 5. Update root `README.md`

The root README is mostly stable. Only update it when:

- A new top-level namespace is added to the `@northguild/gmt` exports (update the "currently exports…" line and possibly the project structure tree).
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
