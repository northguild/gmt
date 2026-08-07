---
name: tanstack-intent
description: Scan the gmt source tree for changes that affect agent skills, update the TanStack Intent skill files and `_artifacts/`, then validate. Run after adding/removing/renaming exported APIs in `packages/gmt/src/` or bumping the package version.
argument-hint: "[skill-slug...]    # optional — restrict to specific skill slugs"
---

# TanStack Intent Skill Maintenance

Keep the [TanStack Intent](https://github.com/tanstack/intent) agent skills under `packages/gmt/skills/` in sync with the actual gmt source code and version. Run this skill whenever:

- A new method or formatter is added to `packages/gmt/src/`
- An existing method is renamed, removed, or its signature changes
- The package version in `packages/gmt/package.json` changes (or a changeset bumps it)
- A whole domain of functionality is introduced (which may need a brand-new skill)

The goal: agents that consume `@burglekitt/gmt`'s skills get an accurate, current picture of the API surface and how to use it.

## Inputs

- Optional argument: one or more skill slugs (e.g. `format-relative-time format-date-time`). If provided, only update those skills. If omitted, audit every skill and the artifacts wholesale.

## Steps

### 0. Check the `@tanstack/intent` tool itself isn't stale

The `intent` CLI (`devDependency` in `package.json` and every `packages/*/package.json`) is a separate concern from the *content* drift this skill otherwise handles — it can fall behind npm just like any other dependency, and its CLI/frontmatter contract does change between releases (e.g. the `type`/`library`/`library_version` frontmatter fields moved under a nested `metadata:` key at some point after 0.0.x). Check before doing anything else:

```bash
npm view @tanstack/intent version
grep '"@tanstack/intent"' package.json packages/*/package.json
```

If the installed `devDependency` version is behind latest, use context7/`find-docs` against `/tanstack/intent` to confirm what changed (CLI flags, frontmatter schema, new commands) before bumping — don't assume it's purely additive. Bump the version string in all four `package.json` files that declare it (`package.json`, `packages/gmt/package.json`, `packages/gmt-eslint/package.json`, `packages/gmt-biome/package.json`, `packages/gmt-oxlint/package.json`), run `pnpm install`, then run `pnpm exec intent validate packages/gmt/skills` — a schema-migration error here (like the `metadata:` nesting one) is expected and has a one-shot fix: `pnpm exec intent validate packages/gmt/skills --fix`.

### 1. Audit what changed

Run these in parallel to ground the audit in real state, not memory:

```bash
git diff main --stat -- packages/gmt/src/
git log --oneline main..HEAD -- packages/gmt/src/
grep -m1 '"version"' packages/gmt/package.json
ls .changeset/*.md 2>/dev/null
```

Read any pending changeset(s) — they describe the user-visible API change and will tell you the next version bump (`patch`/`minor`/`major`).

Build a working list of:

- **New exports** introduced on this branch (functions, types) — these likely need to land in an existing skill's `covers:` list or warrant a new skill.
- **Renamed/removed exports** — must be removed from `covers:` lists and code snippets.
- **Concept additions** that span multiple types (e.g. a new family like relative formatting that touches `plain/`, `zoned/`, `unix/`, `utc/`) — these often deserve their own skill.

### 2. Decide: update existing skill vs create new skill

A change belongs in an **existing** skill when:

- It's a new function within an established domain (e.g. another `parseXFromDate` joins `parse-date-time`).
- The behavior and options match the skill's existing patterns.

A change deserves a **new skill** when:

- It spans multiple domains/value types with shared concepts (e.g. relative formatting across plain/zoned/unix/utc all share `reference`, `numeric`, `style`).
- It introduces a new mental model agents need to route to independently.
- The existing skill would exceed ~500 lines (Intent's hard cap) if extended.

If creating a new skill, propose its name and slug to the user before scaffolding files.

### 3. Update existing skill files

For each affected skill at `packages/gmt/skills/<slug>/SKILL.md`:

1. Update the frontmatter `description` if the skill's scope changed materially. The description is the agent-facing routing key — it must mention the new function names or concept keywords.
2. Bump `library_version` to match the next published version (read from `package.json` + the changeset bump).
3. Add code examples for new functions under **Core Patterns**. Match the style of existing examples (short, real values, returned-value comments).
4. If the new functions take options that aren't already covered, add a sub-section explaining them.
5. If the skill involves locale-aware formatting via `Intl.*`, ensure it has a **Runtime ICU data** section explaining full vs small/partial ICU output divergence. See `packages/gmt/skills/format-date-time/SKILL.md` for the canonical wording.
6. Update the **Common Mistakes** section if the new functions have new failure modes.
7. Update or extend the **Locale Matrix** / similar reference tables if applicable.
8. Keep the file under 500 lines (Intent enforces this). If approaching the cap, split out a `references/` markdown file and link to it instead of inlining.

### 4. Create a new skill (only if step 2 said so)

```bash
mkdir -p packages/gmt/skills/<new-slug>
```

Author `packages/gmt/skills/<new-slug>/SKILL.md` with the frontmatter format:

```yaml
---
name: <new-slug>
description: >
  <1–3 sentences. Concrete enough that an agent can route to this skill from
  a user request. Name the functions, options, and concept keywords.>
type: core   # or: sub-skill | framework | lifecycle | composition | security
library: '@burglekitt/gmt'
library_version: '<next-version>'
sources:
  - 'burglekitt/gmt:packages/gmt/src/<path-to-source-file>.ts'
  # ...one per source file the skill teaches
---
```

Then write the body, mirroring the structure of similar existing skills:

- **Setup** — import statement(s).
- **Core Patterns** — runnable examples with returned-value comments.
- A routing/picking table if multiple functions cover the same concept across types.
- **Runtime ICU data** if any function delegates to `Intl.*`.
- **Common Mistakes** with severity prefixes (`HIGH`, `MEDIUM`, `LOW`) and Wrong/Correct pairs.
- **References** section with relative links to sibling skills (e.g. `[Format Date/Time skill](../format-date-time/SKILL.md)`).

### 5. Update `_artifacts/skill_tree.yaml`

The skill tree is the canonical registry that downstream tooling reads.

1. Bump `library.version` to the next published version (or use the `--set-version` shortcut in step 8, which bumps `metadata.library_version` on every SKILL.md at once — you still need to bump this file's `library.version`/`generated_at` by hand, `--set-version` only touches SKILL.md frontmatter).
2. Bump `generated_at` to today's date (format `YYYY-MM-DD`).
3. For each updated skill, refresh its `description` to mention any new method names or scope changes.
4. For each new skill, add a top-level entry with:

```yaml
  - name: <Display Name>
    slug: <new-slug>
    type: core           # or other valid type
    domain: <domain-slug from domain_map>
    path: 'skills/<new-slug>/SKILL.md'
    package: 'packages/gmt'
    description: <1–2 sentence agent-facing routing key>
    requires:
      - <other slug>     # omit array if none
    sources:
      - 'burglekitt/gmt:packages/gmt/src/<file>.ts'
```

### 6. Update `_artifacts/domain_map.yaml`

1. Bump the header `# Version:` and `# Date:` comments.
2. Bump `library.version`.
3. For each updated skill, extend its `covers:` list with the new function names and its `tasks:` list with the user-facing tasks the new functions enable.
4. For each new skill, append a new entry under `skills:` mirroring the existing shape (`name`, `slug`, `domain`, `description`, `type`, `packages`, `covers`, `tasks`).
5. Add `cross_references` entries when the new skill is logically reached from an existing one (e.g. `format-date-time → format-relative-time`).

### 7. Update inner package READMEs (when relevant)

If the change affects user-facing formatter behavior or adds a new module-level concept, also update the relevant `packages/gmt/src/<plain|unix|utc|zoned|regex>/README.md` so consumers reading the source-tree docs see it too. Match the existing structure (lists of functions per module).

### 8. Validate

```bash
pnpm exec intent validate packages/gmt/skills
```

The validator checks:

- Frontmatter is parseable YAML with required `name` and `description` fields.
- `name` matches the directory path.
- `description` ≤ 1024 characters.
- `type: framework` skills include a `requires:` array.
- Each SKILL.md ≤ 500 lines.
- `_artifacts/` files (`domain_map.yaml`, `skill_spec.md`, `skill_tree.yaml`) parse and are non-empty.
- Client-specific scalar fields (`type`, `library`, `library_version`) live under a nested `metadata:` key, not top-level. (This nesting requirement is new as of Intent ≥0.1 — older skill files written against Intent 0.0.x had these fields top-level and will fail validation until migrated.)

If validation reports the `metadata:` nesting error, auto-fix it instead of hand-editing every file:

```bash
pnpm exec intent validate packages/gmt/skills --fix
```

To bump every skill's `metadata.library_version` in one pass instead of hand-editing each SKILL.md (step 3's version bump):

```bash
pnpm exec intent validate packages/gmt/skills --set-version <next-version>
```

Fix any remaining reported issues before stopping.

### 9. Sanity-check staleness

```bash
pnpm exec intent stale packages/gmt/skills
```

This compares `library_version` in skill frontmatter against installed package version. It should report no version drift after step 3 (or the `--set-version` shortcut above).

### 10. Run the test suite

Skills don't have unit tests, but breaking changes in skill code examples should be caught by ensuring the underlying methods compile + tests still pass:

```bash
pnpm test:gmt
```

## Rules

- **Never invent function names.** Every function mentioned in a SKILL.md must exist in `packages/gmt/src/`. Cross-check with `grep` or by reading `src/<domain>/<sub>/index.ts` barrel exports.
- **Never demote semantic precision in `description`.** Mention concrete function names and concept keywords — the description is what agents route on.
- **Use `'burglekitt/gmt:packages/gmt/src/...'` for `sources:` paths.** This is the `Owner/repo:path` form Intent expects.
- **Keep ICU notes consistent.** Use the wording established in `format-date-time` / `zoned-date-ops` / `format-relative-time`. Don't paraphrase — agents searching for "small-icu" / "full-icu" rely on the canonical phrasing.
- **Don't bump `library_version` to a version that isn't going to ship.** Cross-check against `package.json` + the latest changeset's bump level.
- **Don't delete a skill** without asking the user first. Removing a skill breaks downstream consumers' skill-to-task mappings.

## Output

End by printing a short summary:

- Which skill files were modified/created (with their paths)
- Which `_artifacts/` files were updated
- The output of `intent validate` (pass/fail count)
- Any unresolved questions for the maintainer (e.g. "should X be its own skill?")
