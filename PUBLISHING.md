# Publishing to npm

There are two paths, and the automated one is the default:

| Path                                        | When to use it                                                                |
| ------------------------------------------- | ----------------------------------------------------------------------------- |
| [Automated](#automated-release-the-default) | Every normal release. Merge the version bump, publish a draft release, done.   |
| [Manual](#manual-release-fallback)          | CI is down, npm auth is broken, or you need to publish something out-of-band.  |

Packages (each independently versioned):

| Package dir           | npm name                 |
| --------------------- | ------------------------ |
| `packages/gmt`        | `@northguild/gmt`        |
| `packages/gmt-biome`  | `@northguild/gmt-biome`  |
| `packages/gmt-eslint` | `@northguild/gmt-eslint` |
| `packages/gmt-oxlint` | `@northguild/gmt-oxlint` |

Because versions are independent, tags are per-package and always look like
`@northguild/<pkg>@<version>` (e.g. `@northguild/gmt@1.15.0`). There is no
repo-wide `vX.Y.Z` tag, and nothing in either path invents one.

---

## One-time setup

### For the automated path (maintainers / repo admins)

**npm auth — trusted publishing (OIDC).** There is no npm token in this repo.
`publish.yml` requests `id-token: write` and npm exchanges that for a
short-lived credential, so there is nothing stored to leak or rotate.

Configure it once per package. From the CLI, logged in as a member of the
`@northguild` org (`npm login --auth-type=web` for passkey/SSO):

```bash
for P in gmt gmt-oxlint gmt-biome gmt-eslint; do
  npm trust github "@northguild/$P" \
    --file publish.yml \
    --repo northguild/gmt \
    --env release \
    --allow-publish
done
```

Every `npm trust` call — `list` included — requires its own fresh 2FA browser
round-trip, so expect four separate authentications, and expect the loop above
to stop and wait each time. There is no way to batch them, and an agent cannot
run them on your behalf.

`--file` is the workflow's basename and `--env` must match `environment: release`
in `publish.yml` — both are matched exactly when npm validates the OIDC token, so
renaming either the workflow file or the environment breaks every publish until
the trust entries are updated to match.

Check and manage what's configured with:

```bash
npm trust list "@northguild/gmt"     # show the current entry
npm trust revoke "@northguild/gmt" --id=<trust-id>
```

The same settings are available on npmjs.com → the package → Settings → Trusted
Publisher → GitHub Actions, if you'd rather click: organization `northguild`,
repository `gmt`, workflow `publish.yml`, environment `release`.

All four packages need their own trusted-publisher entry, and each package
allows only one at a time. A package without one fails at the `npm publish` step
with a 401; the other three are unaffected, since each release publishes exactly
one package.

> **Provenance:** trusted publishing automatically generates a provenance
> attestation for every public package in a public repo — it is not opt-in. npm
> requires a public `repository` field matching the publishing source to do
> that, so **every publishable `packages/*/package.json` must keep its
> `repository` block**, `directory` included. Dropping it breaks that package's
> release. ([npm docs](https://docs.npmjs.com/generating-provenance-statements))

**Discord.** `DISCORD_WEBHOOK` is set in the `release` environment and points at
the `#gmt` channel. If it is ever unset the announcement step is skipped and the
publish still succeeds. The old repo-level Discord webhook on `release` events
has been deleted — it fired the moment a release was published, including on
releases whose npm publish then failed.

**If you ever need to fall back to a token:** add `NPM_TOKEN` (an npm
**Automation** token, publish scope only) to the `release` environment.
`publish.yml` already reads it as `NODE_AUTH_TOKEN` and will use it when OIDC
isn't available. Never print/echo it in logs, PRs, or forked workflows.

Both secrets belong to the protected `release` GitHub Environment (Settings →
Environments → `release`), not to repo-level secrets, so publishing is gated by
whatever reviewers that environment requires. Restrict who can approve its runs.

Docs: [npm trusted publishers](https://docs.npmjs.com/trusted-publishers) · [GitHub Environments](https://docs.github.com/en/actions/deployment/targeting-specific-environments/using-environments-for-deployments)

### For the manual path

- Ensure you're a member of the `@northguild` npm org.
- Run `npm whoami` to confirm you're logged in locally. If not, `npm login` (or `npm login --auth-type=web` for passkey/SSO).
- Run `gh auth login` once, for creating GitHub Releases later.

---

## Contributor flow (every feature branch)

Identical for both paths.

1. Finish your code changes.
2. If you changed `packages/gmt/src/`'s public API surface, update the TanStack Intent agent skills in `packages/gmt/skills/` (via the `/tanstack-intent` skill) in the same branch — see [CONTRIBUTING.md](./CONTRIBUTING.md#keeping-agent-skills-current-tanstack-intent). Skills ship inside the published npm package, so stale skills would go out immediately on the next publish.
3. Record release intent:

   ```bash
   pnpm run changeset:add
   ```

   Interactive: pick the changed package(s), pick `patch|minor|major`, write a one-line summary.

4. Commit the generated `.changeset/*.md` file with your code and push the PR.

A changeset is just a markdown file recording what changed and the intended bump — it doesn't publish anything by itself.

---

## Automated release (the default)

Two workflows split the job. Neither one publishes on its own — a human still
decides when a package ships, by publishing its GitHub Release.

```
main: "Version Packages" commit
        │
        ▼
  tag-on-version-change.yml   ──►  git tag @northguild/<pkg>@<ver>
  (push to main touching             + draft GitHub Release, notes from CHANGELOG.md
   packages/*/package.json)
        │
        ▼
  you publish the draft release  ◄── the "release form" — this is the go/no-go
        │
        ▼
  publish.yml                  ──►  build, test, npm pack --dry-run,
  (on: release published)            npm publish, Discord announcement
```

### Steps

1. **Bump versions on a branch and open a PR.**

   ```bash
   pnpm run changeset status      # see what's pending
   pnpm run changeset:version     # bump + changelogs + sync Intent skill versions
   git add .
   git commit -m "Version Packages"
   ```

   `changeset:version` runs `changeset version` and then
   `node scripts/sync-intent-version.mjs`, which syncs all skill `library_version`
   fields to the new gmt version automatically — no separate step needed.

2. **Merge the PR to `main`.** `tag-on-version-change.yml` fires on any push to
   `main` that touches a `packages/*/package.json`. For each non-private package
   whose `version` actually moved, it:
   - creates and pushes the annotated tag `@northguild/<pkg>@<version>`, and
   - opens a **draft** GitHub Release for that tag, titled with the tag and with
     notes taken from that package's newest `CHANGELOG.md` entry. Only
     `@northguild/gmt` is marked as the repo's "latest" release.

   Packages whose version didn't change are skipped, and a tag that already
   exists is never recreated — so re-running the workflow is safe. `apps/dox` is
   private and never tagged.

3. **Review and publish the draft.** Go to
   [Releases](https://github.com/northguild/gmt/releases), open the draft, check
   the notes, and hit **Publish release**. Tick *Set as a pre-release* if this
   should go out under the `next` dist-tag instead of `latest`.

   Publish one draft per package you actually want to ship. Leaving a draft
   unpublished ships nothing; the tag stays put and you can publish it later.

   Or run the **`/release` skill**, which does the same thing from your terminal.
   It finds every package tag whose version isn't on npm yet, asks you to pick
   which ones to ship from a list showing each version, then publishes them and
   watches the runs. It publishes the same GitHub Release via `gh`, so the
   pipeline and the approvals are identical; it is not a shortcut past them, and
   it never bumps a version or creates a tag.

4. **`publish.yml` takes over.** On `release: published` it:
   - checks out the released **tag** (not `main`, so a moved `main` can't leak in);
   - derives the package from the tag name and **fails loudly** if the tag isn't
     `@northguild/<pkg>@<version>`, if that package dir doesn't exist, or if the
     version in the tag doesn't match `packages/<pkg>/package.json`;
   - installs, builds (`--if-present`), and runs that package's own test suite;
   - prints `npm pack --dry-run` so the tarball contents are in the log;
   - runs `npm publish --access public --tag latest` (or `next` for a prerelease),
     which under trusted publishing also attaches a provenance attestation;
   - posts to the `#gmt` Discord channel with the version and a link to the release.

   If it fails, fix the cause and re-run the job from the Actions UI — the
   release and tag are already in place, so nothing needs recreating.

### Publishing a tag that already exists

Same thing, minus step 1 and 2: go to Releases → **Draft a new release**, pick the
existing `@northguild/<pkg>@<version>` tag from the dropdown, write notes, publish.
`publish.yml` doesn't care how the release was created.

---

## Manual release (fallback)

Publishing from your own machine with your npm login. Run these in order, from
repo root.

```bash
# 1. See what's pending
pnpm run changeset status

# 2. Bump versions, update changelogs, and sync TanStack Intent skill
#    versions to match the new gmt version — all in one step
pnpm run changeset:version
git add .
git commit -m "Version Packages"
git push

# 3. Build packages that need a build before publish
#    (gmt-oxlint builds itself automatically via its `prepack` script)
pnpm --filter @northguild/gmt run build

# 4. Sanity-check package contents before they go out
for PKG in gmt gmt-biome gmt-eslint gmt-oxlint; do
  echo "== $PKG =="
  (cd "packages/$PKG" && npm pack --dry-run)
done

# 5. Publish + tag (Changesets creates one git tag per published package,
#    e.g. @northguild/<pkg>@<new-version>)
npm whoami   # confirm you're logged in as the right user
pnpm run changeset:publish
git push --follow-tags
```

> **Note:** step 2 pushes the version bump straight to `main`, which will trigger
> `tag-on-version-change.yml` and create tags + draft releases for you. That's
> harmless — `changeset:publish` in step 5 skips tags that already exist. Just
> **delete the leftover draft releases** afterwards, or you'll have drafts that
> would re-publish an already-published version if someone opens them later.

### GitHub Releases after a manual publish

`changeset:publish` creates git tags but not GitHub Releases. This creates one
release per tag `changeset:publish` just made, in one pass. Run it right after
`git push --follow-tags`, in the same shell session — it relies on `HEAD`
still being the version-bump commit (nothing in steps 3–5 creates a new
commit, so this holds as long as you haven't done anything else in between):

```bash
for TAG in $(git tag --points-at HEAD); do
  PKG=${TAG#@northguild/}   # "@northguild/gmt-oxlint@1.1.2" -> "gmt-oxlint@1.1.2"
  PKG=${PKG%@*}             # "gmt-oxlint@1.1.2" -> "gmt-oxlint"

  NOTES="/tmp/release-notes-$PKG.md"
  awk '/^## /{f++} f==1' "packages/$PKG/CHANGELOG.md" | sed '1,2d' > "$NOTES"

  LATEST_FLAG=--latest=false
  [ "$PKG" = "gmt" ] && LATEST_FLAG=--latest   # only the headline package

  gh release create "$TAG" --title "$TAG" --notes-file "$NOTES" $LATEST_FLAG
done
```

Notes:

- The tag is quoted (`"$TAG"`) since it contains `@` and `/`, which GitHub URL-encodes in the release URL; that's expected.
- Only `@northguild/gmt` gets `--latest`; every other package gets `--latest=false` automatically.
- If `HEAD` has moved since publishing (e.g. you made another commit first), fall back to `git tag --sort=-creatordate | head -n <count>` to find the right tags manually.
- **Publishing these releases will trigger `publish.yml`**, which will try to
  `npm publish` a version you just published by hand and fail on `EPUBLISHCONFLICT`.
  That's noisy but harmless. To avoid it, publish via the automated path instead,
  or create the releases as drafts (`--draft`) and leave them.

### Single package, no Changesets publish step

```bash
cd packages/gmt
npm publish --access public
```

Then create and push tags yourself, since this skips Changesets' auto-tagging:

```bash
pnpm exec changeset tag
git push --follow-tags
```

---

## Adding a new publishable package

**No CI change is needed.** `tag-on-version-change.yml` globs
`packages/*/package.json` and skips private ones, `publish.yml` derives the
package from the release tag, and the `/release` skill reads the same glob — none
of them carries a hardcoded package list. Drop the directory in and they pick it
up.

Everything that *does* need doing is on the npm side, and none of it fails at
build or lint time — it fails at `npm publish`, after the tag and release already
exist:

1. **Give the manifest the metadata provenance requires.** `repository` (with
   `directory`), plus `homepage` and `bugs` to match the other packages:

   ```json
   "repository": {
     "type": "git",
     "url": "https://github.com/northguild/gmt.git",
     "directory": "packages/<new-pkg>"
   }
   ```

   Without `repository`, trusted publishing cannot generate its provenance
   attestation and the publish fails. See the Provenance note under
   [One-time setup](#for-the-automated-path-maintainers--repo-admins).

2. **Set `publishConfig`.** Scoped packages are private by default:

   ```json
   "publishConfig": { "access": "public", "registry": "https://registry.npmjs.org/" }
   ```

3. **Publish version 1 by hand, locally.** A trusted-publisher configuration
   attaches to a package that exists on the registry, so the very first publish
   cannot come from CI:

   ```bash
   cd packages/<new-pkg>
   npm publish --access public
   ```

4. **Then configure trust, so every later release is automated:**

   ```bash
   npm trust github "@northguild/<new-pkg>" \
     --file publish.yml --repo northguild/gmt --env release --allow-publish
   npm trust list "@northguild/<new-pkg>"   # confirm it took
   ```

5. **Add it to the package table** at the top of this file.

From the next version onward it releases like everything else: bump, merge, pick
it in `/release` or publish its draft.

---

## First release (initial `1.0.0`)

Same as the flows above, with one difference: in step 3 of the contributor flow,
pick `major` for each package you're taking to `1.0.0`.

---

## Semver cheat-sheet

- `patch` — bug fix (`1.0.0 → 1.0.1`)
- `minor` — new feature, backwards-compatible (`1.0.0 → 1.1.0`)
- `major` — breaking change or initial stable release (`0.x → 1.0.0`)
