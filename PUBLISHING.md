# Publishing to npm

**Nobody authenticates at npm to make a release, and nothing is published from a
laptop.** CI publishes every package with a short-lived OIDC credential (npm
trusted publishing), which also attaches a provenance attestation. There is no
npm token in this repo.

Releasing is two ordinary code reviews:

1. Merge a feature PR that carries a `.changeset/*.md`.
2. Merge the **"Version Packages"** PR a bot opens for you.

The second merge is the go/no-go — it shows the exact versions and the exact
changelog text, with CI running on it, before anything reaches npm. There is no
release form and no third step.

Packages (each independently versioned):

| Package dir           | npm name                 |
| --------------------- | ------------------------ |
| `packages/gmt`        | `@northguild/gmt`        |
| `packages/gmt-biome`  | `@northguild/gmt-biome`  |
| `packages/gmt-eslint` | `@northguild/gmt-eslint` |
| `packages/gmt-oxlint` | `@northguild/gmt-oxlint` |

Because versions are independent, tags are per-package and always look like
`@northguild/<pkg>@<version>` (e.g. `@northguild/gmt@1.15.0`) — Changesets' own
format. There is no repo-wide `vX.Y.Z` tag.

---

## The flow

`.github/workflows/release.yml` runs on every push to `main` and picks one of
three modes via `changesets/action/select-mode`:

```
feature PR: code + .changeset/*.md
        │  merge
        ▼
  mode: version  ──►  opens/updates the "Version Packages" PR
        │              (bumps package.json, writes CHANGELOG.md,
        │               deletes the consumed changeset files)
        │  merge  ◄── THE GO/NO-GO
        ▼
  mode: publish  ──►  build, test, pack, npm publish via OIDC,
                      push git tags, create GitHub Releases,
                      announce on Discord

  mode: none     ──►  nothing to release; the run does nothing
```

`version` fires when pending changesets exist on `main`. `publish` fires when
they don't but a package's version isn't on npm yet. So a push that only
touches docs resolves to `none` and costs a few seconds.

### 1. Record intent (every feature branch)

1. Finish your code changes.
2. If you changed `packages/gmt/src/`'s public API surface, update the TanStack
   Intent agent skills in `packages/gmt/skills/` (via the `/tanstack-intent`
   skill) in the same branch — see
   [CONTRIBUTING.md](./CONTRIBUTING.md#keeping-agent-skills-current-tanstack-intent).
   Skills ship inside the published npm package, so stale skills would go out on
   the next publish.
3. Record the intended bump:

   ```bash
   pnpm run changeset:add
   ```

   Interactive: pick the changed package(s), pick `patch|minor|major`, write the
   description. That description is the changelog entry and the GitHub Release
   notes, verbatim — write it for a consumer, not for yourself.

4. Commit the generated `.changeset/*.md` with your code and push the PR.

`/changelog` will polish a pending changeset against the diff and the existing
CHANGELOG style if you'd rather not write it cold.

A changeset publishes nothing by itself. It's a markdown file recording what
changed and the intended bump.

### 2. Merge the "Version Packages" PR

Once your feature PR lands, the `version` job opens (or updates) a PR titled
**Version Packages**, authored by `github-actions[bot]`. It contains exactly
what `pnpm run changeset:version` produces:

- each affected `package.json` bumped, resolving `patch|minor|major` against
  that package's own current version;
- each affected `CHANGELOG.md` with a new section holding your changeset text;
- the consumed `.changeset/*.md` files deleted;
- every TanStack Intent skill's `library_version` re-pinned to the new
  `@northguild/gmt` version, via `scripts/sync-intent-version.mjs`.

Review it like any PR. **Merging it ships those packages.** If you're not ready,
leave it open — it keeps updating itself as more changesets land.

### 3. CI publishes

On the "Version Packages" commit landing on `main`, the `publish` job:

- installs and runs `build` + `test` for every package under `packages/`, against
  the exact tree being packed;
- packs the tarballs (`changesets/action/pack`);
- publishes each one with a short-lived OIDC credential, attaching a provenance
  attestation (`changesets/action/publish`);
- pushes the `@northguild/<pkg>@<version>` git tags;
- creates a GitHub Release per tag, notes taken from `CHANGELOG.md`;
- posts what actually shipped to the `#gmt` Discord channel.

If it fails, fix the cause and **re-run the job from the Actions UI**. The
versions are already committed, so nothing needs recreating — and do not reach
for a local `npm publish`, which produces a different, unsigned artifact from
whatever is in your working tree. Re-running is safe: `changeset publish` skips
any version already on the registry.

> **Everything bumped ships.** Publishing is per-version-PR, not per-package: if
> a package's version moved, it goes out. That's deliberate — a package bumped
> on `main` but missing from npm is a broken state, not a held-back release. To
> hold something back, hold back its changeset, not its publish.

### Want a click between merge and npm?

Add required reviewers to the `release` GitHub Environment (Settings →
Environments → `release`). The publish job then waits for an approval in the
Actions UI. That's the gate without the release form.

---

## One-time setup (maintainers / repo admins)

Four things, none of them recurring. Until the first is done **every publish
fails with a 401**; until the third is done **the Version Packages PR can never
be merged**. Both failures are silent-ish and confusing, so do these before
relying on the flow.

### 1. npm trusted publishing

Configure it once per package, logged in as a member of the `@northguild` org
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

Every `npm trust` call — `list` included — requires its own fresh 2FA browser
round-trip, so expect four separate authentications, and expect the loop to stop
and wait each time. There is no way to batch them, and an agent cannot run them
on your behalf. **This is the last time anyone authenticates at npm for a
release.**

`--file` is the workflow's basename and `--env` must match `environment: release`
in `release.yml` — npm matches both exactly when validating the OIDC token, so
renaming either the workflow file or the environment breaks every publish until
all four entries are re-registered.

Check and manage what's configured with:

```bash
npm trust list "@northguild/gmt"     # show the current entry
npm trust revoke "@northguild/gmt" --id=<trust-id>
```

The same settings are on npmjs.com → the package → Settings → Trusted Publisher
→ GitHub Actions: organization `northguild`, repository `gmt`, workflow
`release.yml`, environment `release`.

All four packages need their own entry, and each package allows only one at a
time. A package without one fails at its `npm publish` with a 401.

> **Provenance:** trusted publishing generates a provenance attestation for
> every public package in a public repo — it is not opt-in. npm requires a
> public `repository` field matching the publishing source to do that, so
> **every publishable `packages/*/package.json` must keep its `repository`
> block**, `directory` included. Dropping it breaks that package's release.
> ([npm docs](https://docs.npmjs.com/generating-provenance-statements))

### 2. Let Actions open the version PR

Settings → Actions → General → Workflow permissions → tick **"Allow GitHub
Actions to create and approve pull requests."** Without it the `version` job
cannot open the Version Packages PR and the flow stalls at step 2.

### 3. A release-bot GitHub App

`main` is protected by a ruleset requiring **25 status checks**, all from
`ci.yml`. GitHub deliberately does not start a workflow run for events triggered
by the built-in `GITHUB_TOKEN` — it is the recursion guard. So a version PR
opened with `GITHUB_TOKEN` would report *zero* of those 25 checks, forever, and
nobody but an org admin could merge it. App tokens and PATs do trigger runs.

Create a GitHub App in the `northguild` org (Settings → Developer settings →
GitHub Apps → New):

- **Repository permissions:** Contents → Read and write, Pull requests → Read
  and write. Nothing else.
- Install it on `northguild/gmt` only.
- Generate a private key.

Then, on the repo: put the App's **App ID** in a *variable* named
`RELEASE_BOT_APP_ID` (Settings → Secrets and variables → Actions → Variables)
and the private key in a *secret* named `RELEASE_BOT_PRIVATE_KEY`.

`release.yml` fails fast with a readable error if `RELEASE_BOT_APP_ID` is
missing, rather than opening a PR nobody can merge.

> A fine-grained PAT with the same two permissions works identically — pass it
> as `github-token` instead of minting an App token. It's less setup and a
> worse trade: PATs are long-lived, belong to a person, and expire on their own
> schedule. App tokens last an hour and belong to the org.

### 4. Discord

`DISCORD_WEBHOOK` lives in the `release` environment and points at `#gmt`. If it
is unset the announcement step is skipped and the publish still succeeds.

Both secrets belong to the protected `release` environment, not to repo-level
secrets, so publishing is gated by whatever reviewers that environment requires.
Restrict who can approve its runs.

Docs: [npm trusted publishers](https://docs.npmjs.com/trusted-publishers) · [GitHub Environments](https://docs.github.com/en/actions/deployment/targeting-specific-environments/using-environments-for-deployments) · [changesets/action](https://github.com/changesets/action)

---

## Adding a new publishable package

**No CI change is needed.** `release.yml` carries no package list — Changesets
discovers workspace packages itself and skips private ones. Drop the directory
in and it's picked up.

Everything that *does* need doing is on the npm side, and none of it fails at
build or lint time — it fails at `npm publish`, after the version is already
committed:

1. **Give the manifest the metadata provenance requires.** `repository` (with
   `directory`), plus `homepage` and `bugs` to match the other packages:

   ```json
   "repository": {
     "type": "git",
     "url": "https://github.com/northguild/gmt.git",
     "directory": "packages/<new-pkg>"
   }
   ```

2. **Set `publishConfig`.** Scoped packages are private by default:

   ```json
   "publishConfig": { "access": "public", "registry": "https://registry.npmjs.org/" }
   ```

3. **Publish version 1 by hand, locally.** This is the one exception to "nothing
   is published from a laptop", and it happens once per package, ever: a
   trusted-publisher configuration attaches to a package that already exists on
   the registry, so the very first publish cannot come from CI.

   ```bash
   cd packages/<new-pkg>
   npm publish --access public
   ```

4. **Then configure trust, so every later release is automated:**

   ```bash
   npm trust github "@northguild/<new-pkg>" \
     --file release.yml --repo northguild/gmt --env release --allow-publish
   npm trust list "@northguild/<new-pkg>"   # confirm it took
   ```

5. **Add it to the package table** at the top of this file.

From the next version onward it releases like everything else.

---

## Semver cheat-sheet

- `patch` — bug fix (`1.0.0 → 1.0.1`)
- `minor` — new feature, backwards-compatible (`1.0.0 → 1.1.0`)
- `major` — breaking change, or an initial stable `1.0.0` release (`0.x → 1.0.0`)
