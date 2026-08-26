# Publishing to npm

Primary workflow: publish locally from your machine using your npm login/passkey.
GitHub Actions publishing is optional (see [Alternatives](#alternatives) below).

Packages (each independently versioned):

| Package dir           | npm name                 |
| --------------------- | ------------------------ |
| `packages/gmt`        | `@northguild/gmt`        |
| `packages/gmt-biome`  | `@northguild/gmt-biome`  |
| `packages/gmt-eslint` | `@northguild/gmt-eslint` |
| `packages/gmt-oxlint` | `@northguild/gmt-oxlint` |

---

## One-time setup

- Ensure you're a member of the `@northguild` npm org.
- Run `npm whoami` to confirm you're logged in locally. If not, `npm login` (or `npm login --auth-type=web` for passkey/SSO).
- Run `gh auth login` once, for creating GitHub Releases later.

No GitHub secrets are required for local publishing.

---

## Contributor flow (every feature branch)

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

## Maintainer flow (releasing what's on `main`)

Run these in order, from repo root.

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
pnpm exec nx run @northguild/gmt:build

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

Step 2's `changeset:version` runs `changeset version` and then
`node scripts/sync-intent-version.mjs`, which syncs all skill `library_version`
fields to the new gmt version automatically — no separate step needed.

Then create GitHub Releases for what you just published — see below.

---

## GitHub Releases (after publishing)

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

---

## First release (initial `1.0.0`)

Same as the flows above, with one difference: in step 3 of the contributor flow,
pick `major` for each package you're taking to `1.0.0`.

---

## Alternatives

### Publishing via GitHub Actions instead of locally

Not used in this repo — publishing is done manually/locally. Documented here only
in case that ever changes.

If you do publish from Actions, use an npm Automation token scoped to publish
only, stored in a protected GitHub Environment called `release`:

```yaml
env:
  NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

- Never print/echo `NPM_TOKEN` or `NODE_AUTH_TOKEN` in logs, PRs, or forked workflows.
- Restrict who can approve `release` environment runs.
- The `publish.yml` workflow runs `npm publish` but does **not** create git tags. After a successful Actions publish, create and push them yourself:

  ```bash
  pnpm exec changeset tag
  git push --follow-tags
  ```

Docs: [npm Automation tokens](https://docs.npmjs.com/creating-and-viewing-authentication-tokens) · [GitHub Environments](https://docs.github.com/en/actions/deployment/targeting-specific-environments/using-environments-for-deployments)

### Manual per-package publish (no Changesets publish step)

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

## Semver cheat-sheet

- `patch` — bug fix (`1.0.0 → 1.0.1`)
- `minor` — new feature, backwards-compatible (`1.0.0 → 1.1.0`)
- `major` — breaking change or initial stable release (`0.x → 1.0.0`)
