# Publishing to npm

Releasing is two merges. Nobody logs into npm, and nothing is published from a
laptop.

1. **Merge a PR that carries a `.changeset/*.md`.** This publishes nothing.
2. **Merge the "Version Packages" PR** a bot opens for you. This ships.

Between them, a bot collects the pending changesets into one PR that bumps the
versions and writes the `CHANGELOG.md` entries. Merging that PR is the go/no-go:
CI publishes to npm, pushes tags, creates GitHub Releases, and posts to #gmt.

Merging an ordinary feature PR can never publish anything.

| Package dir           | npm name                 |
| --------------------- | ------------------------ |
| `packages/gmt`        | `@northguild/gmt`        |
| `packages/gmt-biome`  | `@northguild/gmt-biome`  |
| `packages/gmt-eslint` | `@northguild/gmt-eslint` |
| `packages/gmt-oxlint` | `@northguild/gmt-oxlint` |

Each is versioned independently, so tags are per-package —
`@northguild/gmt@1.15.0`. There is no repo-wide `vX.Y.Z` tag.

---

## If you changed code

Write a changeset. That's your whole part in a release.

1. If you changed `packages/gmt/src/`'s public API surface, update the TanStack
   Intent skills in `packages/gmt/skills/` (via `/tanstack-intent`) in the same
   branch — see [CONTRIBUTING.md](./CONTRIBUTING.md#agent-skills). They ship
   inside the tarball.

2. Record the change:

   ```bash
   pnpm run changeset:add
   ```

   Pick the changed package(s), pick `patch|minor|major`, write the description.

   **That description ships.** It becomes the `CHANGELOG.md` entry and the
   GitHub Release notes, word for word — so write it for someone installing the
   package, not for yourself. `/changelog` will polish it against your diff.

3. Commit the generated `.changeset/*.md` with your code.

Never hand-edit a version in `package.json`. The bot owns those.

## If you're shipping

Open the **Version Packages** PR and read it — the bumps and the CHANGELOG text
are what's about to go out. Merging it publishes those packages.

Not ready? Leave it open. It keeps updating itself as more changesets land, so
a release can accumulate.

Everything the PR bumped ships together; there's no per-package pick. To hold a
package back, hold back its changeset.

## When it goes wrong

**The publish run failed.** Fix the cause and re-run the failed job from the
Actions UI. A re-run is safe — already-published versions are skipped.

**Never run `npm publish` locally to unblock it.** It skips the provenance
attestation and ships whatever is in your working tree.

**A publish died and no run is left to retry.** Actions → Release → Run
workflow.

**Nothing happened when I merged.** Check the run's summary — it says what it
decided to do and why.

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

- **npm trusted publishing** for each of the four packages — step 4 above.
- **Settings → Actions → General → Workflow permissions:** tick "Allow GitHub
  Actions to create and approve pull requests."
- **A release-bot GitHub App** in the `northguild` org (Contents read/write,
  Pull requests read/write, installed on `northguild/gmt` only). Its App ID goes
  in a variable `RELEASE_BOT_APP_ID`, its private key in a secret
  `RELEASE_BOT_PRIVATE_KEY`. Without it the Version Packages PR opens with no CI
  and can never be merged.
- **`DISCORD_WEBHOOK`** in the `release` environment, pointing at #gmt. Unset
  just skips the announcement.

Both secrets live in the protected `release` environment, so publishing inherits
whatever approval that environment requires. Restrict who can approve its runs.

## Semver cheat-sheet

- `patch` — bug fix (`1.0.0 → 1.0.1`)
- `minor` — new feature, backwards-compatible (`1.0.0 → 1.1.0`)
- `major` — breaking change, or an initial stable `1.0.0` release (`0.x → 1.0.0`)
