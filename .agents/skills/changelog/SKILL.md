---
name: changelog
description: Rewrite the pending changeset file(s) in .changeset/ with a polished, consumer-facing description. Use when the user asks to "update the changeset", "write the changelog entry", "improve the changeset description", or before running `pnpm run changeset:version`. Uses the diff vs main and the existing CHANGELOG.md entries to match established style.
argument-hint: "no arguments needed"
---

# Update Changeset Description

Improve the pending `.changeset/*.md` file(s) so the description that will land in `CHANGELOG.md` is accurate, concise, and consumer-focused. Run this skill after development is done but **before** running `pnpm run changeset:version` (which consumes and deletes the changeset files).

## Context

Changesets uses the description in `.changeset/<slug>.md` verbatim as the body of the version entry it writes into each affected package's `CHANGELOG.md`. The quality of that entry is determined entirely by what is in the changeset file before `changeset:version` is run.

The changeset file format is:

```markdown
---
"@burglekitt/<package>": minor   # or patch | major
---

<free-form markdown description>
```

The slug (e.g. `olive-shirts-leave`) is random and irrelevant — do not change it.

## Steps

See [references/steps.md](references/steps.md) for the full step-by-step (finding pending changesets, grounding in the branch diff, matching CHANGELOG style, writing the description, and confirming with the user).

## Rules

- **Do not change the frontmatter** (`---` block with package names and bump types). Those are set by `pnpm run changeset:add` and are authoritative.
- **Do not rename the changeset file.** The slug is random but tracked by git.
- **Do not run `changeset:version`** — that is the user's job after reviewing.
- **Never fabricate function names.** Every export named in the description must exist in `packages/*/src/`. Verify with `grep` if uncertain.
- **One changeset file per affected package group.** If multiple packages are in the same changeset file, the description must cover all of them, or note which packages are unaffected.
- **Internal-only changes** (skills, agent config, test infrastructure, README) do not warrant a changeset entry by themselves. If the changeset exists only because of those, flag it for the user.
