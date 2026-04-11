# Publishing to npm

This is the canonical, up-to-date guide for publishing packages from this monorepo.
Primary workflow: publish locally from your machine using your npm login/passkey. GitHub
Actions publishing is optional — if you enable it the environment name is `release`.

---

## What is a Changeset?

A changeset is a tiny markdown file (created by `changeset add`) that records:
- which package(s) changed, and
- the intended bump: `patch`, `minor`, or `major`.

Changesets are committed on your feature branch as part of the PR. They do not publish anything by themselves.

---

## Packages

| Package dir | npm name |
| --- | --- |
| `packages/gmt` | `@burglekitt/gmt` |
| `packages/gmt-biome` | `@burglekitt/gmt-biome` |
| `packages/gmt-eslint` | `@burglekitt/gmt-eslint` |
| `packages/gmt-oxlint` | `@burglekitt/gmt-oxlint` |

Each package is independently versioned.

---

## One-time setup

- Ensure the `@burglekitt` npm org exists and you are a member (or ask an owner to invite you).
- Ensure you can publish locally from your machine: run `npm whoami`. If not logged in, run `npm login` or `npm login --auth-type=web` (for passkey/SSO).

> No GitHub secrets are required for local publishing. If you want GitHub Action publishing, see the Optional section below (environment name: `release`).

---

## Day-to-day contributor flow (what you do in a feature branch)

1. Finish your code changes on the feature branch.
2. Record release intent for the affected package(s):

```bash
pnpm run changeset:add
```

- The CLI is interactive: select which package(s) your change touches (space to toggle), pick `patch|minor|major`, and write a one-line summary.
- Commit the generated file in `.changeset/` alongside your code and push the PR.

---

## Maintainer release flow (recommended: run from your machine)

1. Inspect pending changesets:

```bash
pnpm run changeset status
```

2. Apply version bumps and update changelogs (locally) or merge the automatic Version PR:

```bash
pnpm run changeset:version
git add .
git commit -m "Version Packages"
git push
```

3. Build any packages that require a build before publish:

```bash
# build gmt (Nx)
pnpm exec nx run @burglekitt/gmt:build

# build gmt-oxlint
cd packages/gmt-oxlint && pnpm run build && cd ../..
```

4. Dry-run the npm package contents (recommended):

```bash
cd packages/gmt && npm pack --dry-run && cd ../..
cd packages/gmt-biome && npm pack --dry-run && cd ../..
cd packages/gmt-eslint && npm pack --dry-run && cd ../..
cd packages/gmt-oxlint && npm pack --dry-run && cd ../..
```

5. Publish (preferred: local; see options below).

---

## Publish options

Option A — Local publish (recommended):

```bash
# confirm you're logged in
npm whoami

# publish all pending packages (Changesets handles per-package logic)
pnpm run changeset:publish
```

When you run `pnpm run changeset:publish` locally it will call `npm publish --access public` for each package with an unpublished version and will create git tags for each package it publishes.

If you publish packages via the `publish.yml` GitHub Actions workflow (the optional Actions route), that workflow runs `npm publish` but does **not** create git tags. After a successful Actions publish, create and push tags locally:

```bash
pnpm exec changeset tag
git push --follow-tags
```

Option B — Manual per-package publish (local):

```bash
# from a package folder (after build)
cd packages/gmt
npm publish --access public
```

- If you publish manually, create tags with `pnpm exec changeset tag` and push them.

Option C — GitHub Actions publish (optional):

If you publish from GitHub Actions, use an npm Automation token with the minimal required permission (publish). Store the token as a repository secret named `NPM_TOKEN` or (preferably) in a protected GitHub Environment called `release`. In Actions map the secret to the Node auth environment variable:

```yaml
env:
  NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

Security checklist for Actions-based publishing:

- Create an npm Automation token limited to publish scope; avoid broad or long-lived tokens.
- Store the token in a protected environment or as a repo secret and restrict who can approve environment-protected workflow runs (use GitHub Environment approvals).
- Never print or echo `NPM_TOKEN` (or `NODE_AUTH_TOKEN`) in workflow logs or steps; avoid exposing it in PRs or forked workflows.
- Prefer local publishing where possible; if using Actions require explicit environment approvals and limit who can trigger the `release` environment.

Relevant docs:

- npm Automation tokens: https://docs.npmjs.com/creating-and-viewing-authentication-tokens
- GitHub Environments & Secrets: https://docs.github.com/en/actions/deployment/targeting-specific-environments/using-environments-for-deployments

This is optional — local publishing works with your local npm auth/passkey and requires no repo secrets.

---

## Tags (monorepo behavior)

- Tags are package-scoped in this repo, e.g. `@burglekitt/gmt@1.0.0`.
`changeset:publish` (when run locally) creates these tags automatically. If you published via the `publish.yml` workflow or used `npm publish` directly, run the following to create and push tags:

```bash
pnpm exec changeset tag
git push --follow-tags
```

---

## First release (initial `1.0.0`)

If you want to publish initial stable `1.0.0` packages:

1. On your feature branch, run `pnpm run changeset:add`, select the packages, and choose `major` (or pick `major` meaning 1.0.0).
2. Commit and merge the PR to `main`.
3. On `main`, run `pnpm run changeset:version` (or merge the Version PR).
4. Build packages and run `pnpm run changeset:publish` locally. That will publish packages and create tags.

---

## Semver cheat-sheet

- `patch` — bug fix (e.g. `1.0.0 → 1.0.1`)
- `minor` — new feature, backwards-compatible (e.g. `1.0.0 → 1.1.0`)
- `major` — breaking change or initial stable release (e.g. `0.x → 1.0.0`)

---

## Quick reference (copyable)

```bash
# On feature branch
pnpm run changeset:add
git add .changeset/
git commit -m "add changeset"

# After main has changesets merged
pnpm run changeset:version
git add .
git commit -m "Version Packages"
git push

# Build (if needed)
pnpm exec nx run @burglekitt/gmt:build
cd packages/gmt-oxlint && pnpm run build && cd ../..

# Dry-run
cd packages/gmt && npm pack --dry-run && cd ../..

# Publish locally (recommended)
pnpm run changeset:publish
pnpm exec changeset tag
git push --follow-tags
```

---

If you want, I can now either (a) remove the optional `publish.yml` workflow from the repo, or (b) leave it in place and mark it as optional in docs. Which would you prefer?
