# Publishing to npm

Releasing is two merges. Nobody logs into npm, and nothing is published from a
laptop.

1. **Merge a PR that carries a `.changeset/*.md`.** This publishes nothing.
2. **Merge the "Version Packages" PR** a bot opens for you. This ships.

```
you merge a PR carrying a changeset
        │
        ▼
a bot opens (or updates) the "Version Packages" PR
        │        versions bumped, CHANGELOG.md written, CI running on it
        ▼
you merge that PR   ◄── the go/no-go
        │
        ▼
CI publishes to npm, pushes tags, creates GitHub Releases, posts to #gmt
```

Merging an ordinary feature PR can never publish anything, and never changes a
version on `main`. Only merging the Version Packages PR does.

Packages, each independently versioned:

| Package dir           | npm name                 |
| --------------------- | ------------------------ |
| `packages/gmt`        | `@northguild/gmt`        |
| `packages/gmt-biome`  | `@northguild/gmt-biome`  |
| `packages/gmt-eslint` | `@northguild/gmt-eslint` |
| `packages/gmt-oxlint` | `@northguild/gmt-oxlint` |

Tags are per-package — `@northguild/gmt@1.15.0` — because the versions are
independent. There is no repo-wide `vX.Y.Z` tag.

---

## If you changed code

Write a changeset. That's your whole part in a release.

1. If you changed `packages/gmt/src/`'s public API surface, update the TanStack
   Intent skills in `packages/gmt/skills/` (via `/tanstack-intent`) in the same
   branch — see
   [CONTRIBUTING.md](./CONTRIBUTING.md#agent-skills).
   They ship inside the tarball, so stale skills would go out on the next
   publish.

2. Record the change:

   ```bash
   pnpm run changeset:add
   ```

   Pick the changed package(s), pick `patch|minor|major`, write the description.

   **That description ships.** It becomes the `CHANGELOG.md` entry and the
   GitHub Release notes, word for word — so write it for someone installing the
   package, not for yourself. `/changelog` will polish it against your diff if
   you'd rather not write it cold.

3. Commit the generated `.changeset/*.md` with your code.

Never hand-edit a version in `package.json`. The bot owns those.

## If you're shipping

Open the **Version Packages** PR and read it. It contains only what
`changeset version` produced:

- each affected `package.json` bumped, `patch|minor|major` resolved against that
  package's own current version;
- each affected `CHANGELOG.md` with a new section holding the changeset text;
- the consumed `.changeset/*.md` files deleted;
- every Intent skill's `library_version` re-pinned to the new `@northguild/gmt`
  version.

Merging it publishes those packages. Not ready? Leave it open — it keeps
updating itself as more changesets land, so you can let a release accumulate.

Everything the PR bumped ships together; there's no per-package pick. To hold a
package back, hold back its changeset.

## When it goes wrong

**The publish run failed.** Fix the cause and re-run the failed job from the
Actions UI. Nothing needs recreating, and a re-run is safe — already-published
versions are skipped.

**Never run `npm publish` locally to unblock it.** It produces a different,
unsigned artifact from whatever is in your working tree, and skips the
provenance attestation.

**A publish died partway and no run is left to retry.** Actions → Release → Run
workflow. A manual dispatch is allowed to publish a backlog; an ordinary push
isn't.

**Nothing happened when I merged.** Check the run's summary — it says which of
the three things it decided to do and why.

**You want a human click between merge and npm.** Add required reviewers to the
`release` environment (Settings → Environments → `release`). The publish then
waits for an approval in the Actions UI.

> Why the pipeline is shaped this way — the OIDC exchange, the version guard,
> the pinned action SHAs — is commented in
> [`.github/workflows/release.yml`](./.github/workflows/release.yml), next to
> the code it explains.

---

## One-time setup (repo admins)

Four things, none recurring. Until #1 is done **every publish fails with a
401**. Until #3 is done **the Version Packages PR can never be merged**.

### 1. npm trusted publishing

Once per package, logged in as a member of the `@northguild` org
(`npm login --auth-type=web` for passkey/SSO):

```bash
for P in gmt gmt-oxlint gmt-biome gmt-eslint; do
  npm trust github "@northguild/$P" \
    --file release.yml \
    --repo northguild/gmt \
    --env release \
    --allow-publish
done
```

Every `npm trust` call — `list` included — needs its own fresh 2FA browser
round-trip, so expect four separate authentications and expect the loop to stop
and wait each time. They can't be batched, and an agent can't run them for you.
**This is the last time anyone authenticates at npm for a release.**

`--file` is the workflow's basename and `--env` must match `environment: release`
in `release.yml`. npm matches both exactly, so **renaming the workflow file or
the environment breaks every publish** until all four entries are re-registered.

```bash
npm trust list "@northguild/gmt"                  # show the current entry
npm trust revoke "@northguild/gmt" --id=<trust-id>
```

The same settings live on npmjs.com → the package → Settings → Trusted Publisher
→ GitHub Actions. Each package allows exactly one entry; a package without one
fails its publish with a 401 while the others carry on.

> **Provenance:** trusted publishing attaches a provenance attestation to every
> public package in a public repo — not opt-in. npm requires a public
> `repository` field matching the publishing source, so **every publishable
> `packages/*/package.json` must keep its `repository` block**, `directory`
> included. Dropping it breaks that package's release.
> ([npm docs](https://docs.npmjs.com/generating-provenance-statements))

### 2. Let Actions open PRs

Settings → Actions → General → Workflow permissions → tick **"Allow GitHub
Actions to create and approve pull requests."** Without it the bot can't open
the Version Packages PR at all.

### 3. A release-bot GitHub App

`main` requires 25 status checks, and GitHub never starts a workflow run for
events triggered by the built-in `GITHUB_TOKEN`. So a version PR opened with
that token would report *zero* of the 25 forever and nobody could merge it. App
tokens do trigger runs; that's the whole reason the App exists.

Create a GitHub App in the `northguild` org (Settings → Developer settings →
GitHub Apps → New):

- **Repository permissions:** Contents read/write, Pull requests read/write.
  Nothing else.
- Install it on `northguild/gmt` only, and generate a private key.

Then put the App ID in a **variable** named `RELEASE_BOT_APP_ID` and the private
key in a **secret** named `RELEASE_BOT_PRIVATE_KEY` (Settings → Secrets and
variables → Actions). `release.yml` fails fast with a readable error if the
variable is missing, rather than opening an unmergeable PR.

> A fine-grained PAT with the same two permissions works identically. Less
> setup, worse trade: PATs are long-lived, belong to a person, and expire on
> their own schedule.

### 4. Discord

`DISCORD_WEBHOOK` lives in the `release` environment and points at `#gmt`. If
it's unset the announcement is skipped and the publish still succeeds.

Both secrets belong to the protected `release` environment rather than to
repo-level secrets, so publishing inherits whatever approval that environment
requires. Restrict who can approve its runs.

Docs: [npm trusted publishers](https://docs.npmjs.com/trusted-publishers) · [GitHub Environments](https://docs.github.com/en/actions/deployment/targeting-specific-environments/using-environments-for-deployments) · [changesets/action](https://github.com/changesets/action)

---

## Adding a new publishable package

**No CI change is needed** — nothing carries a package list; Changesets
discovers workspace packages and skips private ones.

The work is all on the npm side, and none of it fails at build or lint time. It
fails at `npm publish`, after the version is already committed:

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
   from a laptop", once per package ever: a trusted-publisher entry attaches to
   a package that already exists on the registry, so the first publish can't
   come from CI.

   ```bash
   cd packages/<new-pkg>
   npm publish --access public
   ```

4. **Then configure trust**, so every later release is automated:

   ```bash
   npm trust github "@northguild/<new-pkg>" \
     --file release.yml --repo northguild/gmt --env release --allow-publish
   npm trust list "@northguild/<new-pkg>"   # confirm it took
   ```

5. **Add it to the package table** at the top of this file.

## Semver cheat-sheet

- `patch` — bug fix (`1.0.0 → 1.0.1`)
- `minor` — new feature, backwards-compatible (`1.0.0 → 1.1.0`)
- `major` — breaking change, or an initial stable `1.0.0` release (`0.x → 1.0.0`)
