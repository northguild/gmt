# Recovering a failed release

Load this only when a `publish.yml` run has failed. Read the failing step's log
first — `gh run view <id> --log-failed` — and match it below.

The tag and the GitHub Release survive a failed run. Almost every fix is
"correct the cause, then re-run the same job":

```bash
gh run rerun <databaseId> --failed
```

Nothing needs recreating, and the release should not be deleted.

## By failing step

### `Resolve package from release tag`

The workflow rejected the tag before doing anything. Its error message says
which of the three guards tripped:

- **not a package tag** — the release was created against something that isn't
  `@northguild/<pkg>@<version>`. A hand-made release, or an old `@burglekitt`
  tag. Delete the release; do not try to make the workflow accept it.
- **resolves to packages/… which does not exist** — package renamed or removed
  since the tag was cut.
- **claims X but package.json is at Y** — the release points at a commit whose
  manifest disagrees. Usually a release created against the wrong tag. Delete the
  release and publish the correct draft.

Re-running will not help in any of these cases. Nothing was published.

### `Install dependencies`

`pnpm install --frozen-lockfile` failed, meaning `pnpm-lock.yaml` at that tag is
out of sync with the manifests. This has to be fixed on `main` and re-released
under a new version — the tag's tree is what CI publishes and it cannot be
amended. Nothing was published.

### `Build` or `Test`

A real failure at the tagged commit. Fix on `main`, ship a new patch version.
Do not re-run hoping for a different result, and do not publish locally to route
around it. Nothing was published.

### `Publish to npm`

Read the npm error code:

- **`EPUBLISHCONFLICT` / "cannot publish over the previously published version"** —
  that version is already on npm, so this release was redundant. Nothing changed
  on npm. Delete the stale draft or release so it isn't retried.
- **`ENEEDAUTH` / 401 / 403** — the package has no trusted-publisher entry, or it
  doesn't match. Check on npmjs.com that the package's trusted publisher names
  org `northguild`, repo `gmt`, workflow `publish.yml`, environment `release`.
  Fix it there and re-run; no code change needed.
- **"Provenance generation … repository"** — that package's `package.json` is
  missing its `repository` field (or it doesn't match this repo). Trusted
  publishing always generates provenance, so the field is mandatory. Fix on
  `main` and ship a new patch.

### `Announce on Discord`

**The package is already published.** This step runs last and its failure does
not roll anything back — never re-run the whole workflow to retry the
announcement, because the publish step will then fail on `EPUBLISHCONFLICT` and
make the run look worse than it is.

Confirm the publish landed with `npm view "$NAME@$VERSION" version`, tell the
user it shipped but the announcement didn't, and check `DISCORD_WEBHOOK` in the
`release` environment.

## If a broken version reached npm

npm versions are immutable. Do not attempt to unpublish as a first resort — it
breaks anyone who already installed it, and npm restricts it heavily.

Recover forward: fix on `main`, cut a new patch, release it normally. If the bad
version must not be installed by default, deprecate it and confirm `latest`
points somewhere sane:

```bash
npm deprecate "$NAME@$VERSION" "Broken release, use <newer> instead"
npm dist-tag ls "$NAME"
```

Both need the user's own npm login and are outward-facing — **ask before running
either**, and never guess at the deprecation message.
