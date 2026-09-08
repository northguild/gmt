# Publishing to npm

Nobody logs into npm, and nothing is published from a laptop. Publishing is
triggered by exactly one thing: **a push to `main` that moves a version in a
`packages/*/package.json`.**

That only happens when you deliberately make it happen, in a release PR of your
own. Merging feature PRs — however many, carrying however many changesets —
never publishes anything.

| Package dir           | npm name                 |
| --------------------- | ------------------------ |
| `packages/gmt`        | `@northguild/gmt`        |
| `packages/gmt-biome`  | `@northguild/gmt-biome`  |
| `packages/gmt-eslint` | `@northguild/gmt-eslint` |
| `packages/gmt-oxlint` | `@northguild/gmt-oxlint` |

Each is versioned independently, so tags are per-package —
`@northguild/gmt@1.15.0`. There is no repo-wide `vX.Y.Z` tag.

---

## The flow

### 1. As you work: describe each change

In the branch where you changed something publishable:

```bash
pnpm run changeset:add
```

Pick the changed package(s), pick `patch|minor|major`, write the description.

**This writes a markdown file and nothing else.** It does not touch any
`package.json` and does not bump anything — the bump level you pick is recorded
as intent, to be applied later. Commit the generated `.changeset/*.md` with your
code.

**That description ships.** It becomes the `CHANGELOG.md` entry and the GitHub
Release notes, word for word — so write it for someone installing the package,
not for yourself. `/changelog` will polish it against your diff.

If you changed `packages/gmt/src/`'s public API surface, also update the
TanStack Intent skills in `packages/gmt/skills/` (via `/tanstack-intent`) in the
same branch — see [CONTRIBUTING.md](./CONTRIBUTING.md#agent-skills). They ship
inside the tarball.

### 2. Merge as usual. Nothing is published.

Merge that PR, and the next one, and the one after that. Changesets pile up on
`main` unreleased. The `Release` workflow runs on each push and decides there is
nothing to do; its summary says so.

Stay in this step as long as you like.

### 3. When you want to release: make a release PR

Branch from up-to-date `main` and run:

```bash
pnpm run changeset:version
```

This is the command that bumps. It consumes every pending `.changeset/*.md`,
writes the new versions into `package.json`, prepends the `CHANGELOG.md`
entries, deletes the changeset files it used, and — if `@northguild/gmt` itself
was bumped — pins the Intent skills' `library_version` to the new version.

It only edits files. Nothing is committed, tagged or published.

Commit the result, open a PR, and read it: **the diff is the release.** Those
version numbers and that CHANGELOG text are exactly what goes to npm. It is an
ordinary PR, so the ordinary required checks run on it.

**Merging it publishes.** CI packs the tarballs, publishes to npm with
provenance, pushes the tags, cuts the GitHub Releases, and posts to #gmt.

Keep the release PR pure — version bumps and changelogs only. If it also adds a
new changeset, the workflow sees pending changesets and declines to publish.

---

## Notes on step 3

**Everything pending ships together.** `changeset:version` consumes every
changeset on `main`; there is no per-package pick at release time. To hold a
package back, don't merge its changeset yet.

**Bumps don't stack.** Versions are computed from the current version plus all
pending changesets, highest level winning. Three `minor` changesets against
`1.2.0` give `1.3.0`, not `1.5.0`.

**Never hand-edit a version in `package.json`.** `changeset:version` owns those
numbers. If one looks wrong, the changeset that produced it was wrong.

**A changeset-less PR still ships.** Its code is on `main`, so it goes out with
the next release — silently, with no changelog entry and no version attributed
to it. Fine for CI and docs; a trap for a bug fix.

## When it goes wrong

**The publish run failed.** Fix the cause and re-run the failed job from the
Actions UI. A re-run is safe — already-published versions are skipped.

**Never run `npm publish` locally to unblock it.** It skips the provenance
attestation and ships whatever is in your working tree.

**A publish died and no run is left to retry.** Actions → Release → Run
workflow. A manual dispatch bypasses the version guard deliberately.

**Nothing happened when I merged.** Check the run's summary — it says what it
decided and why. If it reports pending changesets, you merged a feature PR, not
a release PR.

**You want a human click between merge and npm.** Add required reviewers to the
`release` environment (Settings → Environments → `release`).

---

## Adding a new publishable package

No CI change is needed — nothing carries a package list. The work is all on the
npm side, and none of it fails until `npm publish`, after the version is already
committed.

1. **`repository`, with `directory`** (plus `homepage` and `bugs`, to match the
   others). Provenance can't be generated without it:

   ```json
   "repository": {
     "type": "git",
     "url": "https://github.com/northguild/gmt.git",
     "directory": "packages/<new-pkg>"
   }
   ```

2. **`publishConfig`** — scoped packages are private by default:

   ```json
   "publishConfig": { "access": "public", "registry": "https://registry.npmjs.org/" }
   ```

3. **Publish version 1 by hand.** The one exception to "nothing is published
   from a laptop", once per package ever — trust attaches to a package that
   already exists on the registry.

   ```bash
   cd packages/<new-pkg>
   npm publish --access public
   ```

4. **Grant CI trust**, logged in as a member of the `@northguild` org
   (`npm login --auth-type=web` for passkey/SSO):

   ```bash
   npm trust github "@northguild/<new-pkg>" --file release.yml --repo northguild/gmt --env release --allow-publish
   npm trust list "@northguild/<new-pkg>"   # confirm it took
   ```

   Every `npm trust` call — `list` included — needs its own fresh 2FA browser
   round-trip, so expect to authenticate twice. An agent can't run these for
   you. Without this step the package's first CI publish fails with a 401 while
   the others carry on.

5. **Add it to the package table** at the top of this file.

Renaming `release.yml` or the `release` environment invalidates every existing
trust entry — all four packages would need re-registering.

## One-time setup (admins)

Done once for the repo, and already in place. If a fresh clone of this setup is
ever needed:

- **npm trusted publishing** for each of the four packages — step 4 above. This
  is the only credential the pipeline needs; there is no npm token anywhere.
- **`DISCORD_WEBHOOK`** in the `release` environment, pointing at #gmt. Unset
  just skips the announcement.

Only the publish job enters the `release` environment, so publishing — and
nothing else — inherits whatever approval that environment requires. Restrict
who can approve its runs.

## Semver cheat-sheet

- `patch` — bug fix (`1.0.0 → 1.0.1`)
- `minor` — new feature, backwards-compatible (`1.0.0 → 1.1.0`)
- `major` — breaking change, or an initial stable `1.0.0` release (`0.x → 1.0.0`)
