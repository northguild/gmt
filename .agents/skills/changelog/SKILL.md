---
name: changelog
description: Rewrite the pending changeset file(s) in .changeset/ with a polished, consumer-facing description. Use when the user asks to "update the changeset", "write the changelog entry", "improve the changeset description", or before merging a PR that carries a changeset. Uses the diff vs main and the existing CHANGELOG.md entries to match established style.
argument-hint: "no arguments needed"
---

# Update Changeset Description

Improve the pending `.changeset/*.md` file(s) so the description that will land in `CHANGELOG.md` is accurate, concise, and consumer-focused. Run this skill after development is done and before the PR merges. Merging publishes nothing: the changeset sits on `main` until a maintainer runs `pnpm run changeset:version` in a separate release PR, which consumes the changeset files into `CHANGELOG.md` (see `.github/workflows/release.yml` and `PUBLISHING.md`). Polish it now, while the diff is fresh.

## Context

Changesets uses the description in `.changeset/<slug>.md` verbatim as the body of the version entry it writes into each affected package's `CHANGELOG.md`. The quality of that entry is determined entirely by what is in the changeset file before `changeset:version` is run.

The changeset file format is:

```markdown
---
"@northguild/<package>": minor   # or patch | major
---

<free-form markdown description>
```

The slug (e.g. `olive-shirts-leave`) is random and irrelevant — do not change it.

## Steps

See [references/steps.md](references/steps.md) for the full step-by-step (finding pending changesets, grounding in the branch diff, matching CHANGELOG style, writing the description, and confirming with the user).

## Rules

- **Do not change the frontmatter** (`---` block with package names and bump types) — but if the bump contradicts the [changeset rule](../../../context/coding-standards.md#changesets) (fix → `patch`, new API → `minor`), flag it to the user.
- **Do not rename the changeset file.** The slug is random but tracked by git.
- **Do not run `changeset:version`** — it bumps versions and consumes every pending changeset. It is a maintainer's deliberate release action, run in a release PR of its own. See [PUBLISHING.md](../../../PUBLISHING.md).
- **Never fabricate function names.** Every export named in the description must exist in `packages/*/src/`. Verify with `grep` if uncertain.
- **One changeset file per affected package group.** If multiple packages are in the same changeset file, the description must cover all of them, or note which packages are unaffected.
- **Internal-only changes** (skills, agent config, test infrastructure, README) do not warrant a changeset entry by themselves. If the changeset exists only because of those, flag it for the user.
