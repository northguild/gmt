---
name: npm-publish
description: Find package tags that haven't reached npm and publish the ones the user picks, through the CI publish pipeline. Use when the user asks to "do the release", "publish the packages", "ship gmt", or "release <package>".
argument-hint: "[package…]"
---

Ship packages by publishing their **GitHub Release**. That is the event
`.github/workflows/publish.yml` listens for, so the release goes through exactly
the same pipeline as clicking Publish in the GitHub UI — build, test, `npm pack
--dry-run`, `npm publish` via trusted publishing, Discord announcement.

**Despite the name, you never run `npm publish` yourself — and running it would
be a bug, not a shortcut.** CI runs it, from a clean checkout of the tag, with a
provenance attestation via trusted publishing. A local publish produces a
different artifact, unsigned, from whatever happens to be in your working tree.
This skill's job is to trigger that pipeline and watch it, nothing more.

[PUBLISHING.md](../../../PUBLISHING.md) is the source of truth for the release
flow; if anything here contradicts it, follow PUBLISHING.md and say so.

## What this skill does not do

It does not run `npm publish`. It does not bump versions.

It only releases versions that have **already been bumped, merged, and tagged**.
It never runs `changeset version`, never edits a `package.json` version, and
never creates a tag. Those happen on a PR, and tags are created by
`tag-on-version-change.yml` when that PR lands on `main`.

So if nothing is releasable, the answer is "the version bump hasn't merged yet" —
say that and stop. Do not bump anything to give yourself something to release.

This must also run from a normal local shell using the user's `gh` auth. An event
triggered by a workflow's `GITHUB_TOKEN` does not start another workflow run, so
publishing a release from inside Actions would publish it and silently run nothing.

## Steps

### 1. Find what's releasable

```bash
node .agents/skills/npm-publish/scripts/list-releasable.mjs
```

Returns a JSON array of every package tag whose version is **not yet on npm** —
npm is the source of truth, not the presence of a draft release. Each entry has
`tag`, `name`, `dir`, `version`, `latestOnNpm`, and a `state`:

| `state` | Meaning | What to do |
| --- | --- | --- |
| `draft` | Normal path — `tag-on-version-change.yml` left a draft. | Publish the draft (step 3). |
| `none` | Tag exists, no release. Draft deleted, or tagged by a local `changeset:publish`. | Create the release, then publish it (step 3). |
| `published` | **The release already went out and `publish.yml` failed.** | Do **not** create another release. Re-run the failed run — see [references/recovery.md](references/recovery.md). |

Empty array means nothing to release. Say so and stop.

### 2. Ask which packages to release

Present the releasable entries with `AskUserQuestion`, `multiSelect: true` — one
option per package, so the user picks by name rather than typing tags:

- **label**: `@northguild/gmt 1.16.0`
- **description**: what it supersedes and what it ships, e.g.
  `1.15.0 → 1.16.0 · latest · Promote shared unit types to the public API`

Pull the summary line from `gh release view "$TAG" --json body --jq .body` for
`draft`/`published` entries, or from the top `packages/<dir>/CHANGELOG.md` entry
for `none`. Say `next` rather than `latest` for anything the user wants shipped
as a prerelease.

There are four publishable packages and `AskUserQuestion` allows four options, so
they always fit. If that ever stops being true, list them numbered and ask
instead of silently dropping any.

If the user named packages as arguments, still show the picker but preselect
nothing beyond those, and say which releasable packages you're leaving out.
**Never skip this question** — it is the release gate. Never infer approval from
the original request.

### 3. Publish, one at a time

For `state: draft`:

```bash
gh release edit "$TAG" --draft=false
```

For `state: none`, create it first from the changelog entry, then publish — mirror
what `tag-on-version-change.yml` would have done, including `--latest` only for
`@northguild/gmt`:

```bash
awk '/^## /{f++} f==1' "packages/$DIR/CHANGELOG.md" | tail -n +2 > "$NOTES"
gh release create "$TAG" --verify-tag --title "$TAG" --notes-file "$NOTES" --latest=false
```

For a prerelease, set the flag in the **same** command that publishes —
`publish.yml` reads `github.event.release.prerelease` off the publish event, so
marking it afterwards is too late and it will already have gone out as `latest`:

```bash
gh release edit "$TAG" --prerelease --draft=false
```

### 4. Watch each run

```bash
gh run list --workflow=publish.yml --event=release --limit 5 \
  --json databaseId,status,conclusion,displayTitle,createdAt
gh run watch <databaseId> --exit-status
```

A run sitting in `waiting` needs approval on the `release` environment — that is
expected, not a hang. Tell the user and wait.

Finish one package before starting the next, so a failure can't be mistaken for
another package's.

### 5. Report

Per package: version, dist-tag, run URL, and whether the Discord announcement
fired. Confirm with `npm view "$NAME@$VERSION" version` rather than trusting the
workflow's green check alone.

On failure, see [references/recovery.md](references/recovery.md).

## Rules

- Never bump a version, edit a manifest, or create a tag to produce something to
  release.
- Never run `npm publish` locally to "unblock" a failed CI publish. The pipeline
  publishes with provenance from a clean tag checkout; a local publish produces a
  different artifact and no attestation.
- Never delete or re-tag a **published** release, and never use `--force` on a
  release tag. npm versions are immutable; recover forward with a new patch.
- Never create a second release for a tag whose release is already `published` —
  that state means the publish failed, and the fix is a re-run.
- Deleting a stale draft is fine, but ask first.
