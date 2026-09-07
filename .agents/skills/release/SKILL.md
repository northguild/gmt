---
name: release
description: Publish pending release drafts to npm through the CI pipeline. Use when the user asks to "do the release", "publish the packages", "ship gmt", or "release <package>".
argument-hint: "[package…]"
---

Ship packages by publishing their **draft GitHub Release**. That is the event
`.github/workflows/publish.yml` listens for, so the release goes through exactly
the same pipeline as clicking Publish in the GitHub UI — build, test, `npm pack
--dry-run`, `npm publish` via trusted publishing, Discord announcement.

You never run `npm publish` yourself. CI does, from a clean checkout of the tag.

[PUBLISHING.md](../../../PUBLISHING.md) is the source of truth for the release
flow; if anything here contradicts it, follow PUBLISHING.md and say so.

## Preconditions

Drafts are created automatically by `tag-on-version-change.yml` when a
"Version Packages" commit lands on `main`. **If there are no drafts, there is
nothing to release** — the version bump hasn't merged yet. Say that and stop;
do not create tags or releases by hand to work around it.

This must run from a normal local shell using the user's `gh` auth. An event
triggered by a workflow's `GITHUB_TOKEN` does not start another workflow run, so
publishing a draft from inside Actions would publish the release and silently
run nothing.

## Steps

### 1. Preflight — never skip

```bash
git fetch --tags --prune origin
gh release list --json tagName,isDraft,isPrerelease --jq '.[] | select(.isDraft) | .tagName'
```

For each draft tag (`@northguild/<pkg>@<version>`), derive `NAME`, `VERSION`,
`DIR` and check all four:

| Check | Command | On failure |
| --- | --- | --- |
| Tag exists on the remote | `git rev-parse -q --verify "refs/tags/$TAG"` | Abort — the draft points at nothing. |
| Tag is on `main` | `git merge-base --is-ancestor "$TAG" origin/main` | Abort — the commit isn't on the release line. |
| Manifest agrees | `git show "$TAG:packages/$DIR/package.json"` → `.version` equals `$VERSION` | Abort — `publish.yml` will reject it anyway. |
| Not already on npm | `npm view "$NAME@$VERSION" version` (exit 0 = published) | **Do not publish.** See below. |

The npm check is the important one. A draft whose version is already on npm is
almost always debris from a manual `changeset:publish` (PUBLISHING.md documents
this collision). Publishing it fails the run with `EPUBLISHCONFLICT` and posts
nothing. Report it, and offer to delete the stale draft with
`gh release delete "$TAG"` — ask first, never delete unprompted.

### 2. Show the plan

Print one row per draft you intend to publish, and let the user see what they're
approving:

| Package | Version | On npm now | Ships as | Changelog |
| --- | --- | --- | --- | --- |
| `@northguild/gmt` | 1.16.0 | 1.15.0 | `latest` | Promote shared unit types… |

"On npm now" comes from `npm view "$NAME" version`. "Changelog" is the first
meaningful line of `gh release view "$TAG" --json body --jq .body`.

If the user named packages as arguments, filter to those and say which drafts
you're leaving alone.

### 3. Confirm

**Always ask before publishing, every time.** This is the release gate — the
user approves the specific list from step 2. Never infer approval from the
original request, and never publish a draft the user didn't name or see.

### 4. Publish

One at a time, checking each before moving on:

```bash
gh release edit "$TAG" --draft=false
```

For a prerelease, set the flag in the **same** command — `publish.yml` reads
`github.event.release.prerelease` off the publish event, so marking it afterwards
is too late and it will have already gone out under `latest`:

```bash
gh release edit "$TAG" --prerelease --draft=false
```

### 5. Watch the run

```bash
gh run list --workflow=publish.yml --event=release --limit 5 \
  --json databaseId,status,conclusion,displayTitle,createdAt
gh run watch <databaseId> --exit-status
```

The run may sit in `waiting` if the `release` environment requires approval —
that is expected, not a hang. Tell the user it needs their review and wait.

### 6. Report

Per package: published version, dist-tag, run URL, and whether the Discord
announcement fired. Confirm with `npm view "$NAME@$VERSION" version` rather than
trusting the workflow's green check alone.

If a run failed, see [references/recovery.md](references/recovery.md).

## Rules

- Never run `npm publish` locally to "unblock" a failed CI publish. The pipeline
  publishes with provenance from a clean tag checkout; a local publish produces a
  different artifact and no attestation.
- Never delete or re-tag a **published** release, and never use `--force` on a
  release tag. npm versions are immutable; recover forward with a new patch.
- Never publish a draft whose version already exists on npm.
- Don't create tags or drafts by hand. That is `tag-on-version-change.yml`'s job,
  and hand-made ones bypass the version/manifest agreement it guarantees.
- Publish sequentially, not in a batch. Each package is an independent release
  and one failing must not obscure the others.
