# Tier 0 reference pack — infrastructure (`DOX-A1`, `DOX-A2`)

Loaded by `dox-builder` for the workspace skeleton and the Cloudflare deploy. Does not
restate `dox-builder.md`'s universal invariants.

**Verified against the live repo and the npm registry on 2026-08-26.** Everything below was
checked by running the command, not read out of `context/dox/`. Where this pack contradicts
`context/dox/issues/DOX-A.md`, this pack is correct and the issue predates the finding.

---

## Verified findings that contradict the issue spec

### 1. The toolchain is `fnm`, and the shell is on Node 20

`node -v` → `v20.19.6`, resolved from `~/.local/state/fnm_multishells/...`. `.nvmrc` is
`24`. `astro@7.2.7` declares `engines.node: ">=22.12.0"`.

The issue says "`nvm use` first". **It is `fnm`.** And because shell state does not persist
between tool calls, the switch must be part of every compound command.

**`fnm use` on its own is a silent no-op in a non-interactive shell** — verified:

```console
$ fnm use && node -v
Using Node v24.19.0     ← claims success
v20.19.6                ← still on 20
```

It exits 0 while changing nothing, which is the worst possible failure shape. The env must
be eval'd first:

```bash
eval "$(fnm env)" && fnm use && pnpm install   # → v24.19.0, and pnpm exec node agrees
```

CI is unaffected — `actions/setup-node@v4` with `node-version: 22` resolves to the latest
22.x, which is above the floor, and the matrix also runs 24.

### 2. `oxlint.config.js` is never loaded — the `files.include` edit is a no-op

```console
$ pnpm exec oxlint --print-config
{ "plugins": ["unicorn", "typescript", "oxc"], ... }
```

Stock defaults. The repo's own `plugin` and `recommendedRules` from
`packages/gmt-oxlint/dist/index.js` are **absent**. Oxlint's discovery list is
`.oxlintrc.json`, `.oxlintrc.jsonc`, `oxlint.config.ts`, `oxlint.config.mts` — **`.js` is
not in it**, and root `package.json` runs bare `oxlint` with no `-c`.

Consequences:

- Adding `apps/**` to `files.include` does **nothing**. Land the edit because the story asks
  for it and it documents intent, but do not report it as the mechanism that lints the app.
- **The real mechanism is an explicit `lint` target in `apps/dox/project.json`** running
  `oxlint` with explicit paths. Without it, `nx run-many -t lint` resolves to exactly one
  task (`@northguild/gmt:lint`, the only project with a `lint` script) and stays green while
  ignoring the entire new app.
- This is a **pre-existing repo bug** — the GMT lint plugin is not running on `packages/**`
  either. It is out of scope for `DOX-A1`. File it separately; do not try to fix the root
  config inside this story.

### 3. The `@astrojs/markdown-remark` peer is **optional** — do not declare it

`context/dox/` says Starlight "peers on `astro ^7.0.2` _and_
`@astrojs/markdown-remark ^7.2.0` — the second peer is easy to miss" and instructs you to
verify both. Verified, and the instruction is wrong:

```console
$ npm view @astrojs/starlight@0.41.9 peerDependenciesMeta --json
{ "@astrojs/markdown-remark": { "optional": true } }
```

It is an **optional** peer. Starlight 0.41.9 depends on `@astrojs/markdown-satteri ^0.3.5`
directly, and `astro@7.2.7` ships `@astrojs/markdown-satteri@0.3.8` — the remark package is
the older path, kept as an optional peer for compatibility.

**Do not add `@astrojs/markdown-remark` to `apps/dox`.** Confirmed empirically: a full
`pnpm install` with only `astro` and `@astrojs/starlight` declared produces **no peer
warning** for it. Declaring it would pull a package the site does not use.

### 4. `prebuild` / `predev` never fire

`pnpm config get enable-pre-post-scripts` → `undefined` (pnpm 10 defaults it to false), and
there is no `.npmrc` in the repo.

The issue asks for a version map generated "in a `prebuild`/`predev` step". Implemented
literally, **the script never runs**, the generated module fails to resolve, and the build
dies with a confusing "module not found" that points nowhere near the cause.

**Chain explicitly with `&&`, and make it an Nx target:**

```json
"build": "pnpm run generate && astro build",
"typecheck": "pnpm run generate && astro sync && astro check"
```

### 5. Nx infers nothing for an Astro app, and would misname it

No `project.json` exists anywhere in the repo today. `@nx/js/typescript` keys `build` on the
presence of `tsconfig.build.json`, which an Astro app will not have.

Two traps:

- Without `"name": "docs"` in `project.json`, Nx names the project `@gmt/docs` from
  `package.json`, and the DoD command `nx run docs:build` fails with "Cannot find project
  'docs'" — a one-word omission failing the story.
- Without `"nx": { "includedScripts": [] }` in `package.json`, **every** script becomes an
  inferred target and merges messily with the `project.json` definitions. `[]` is truthy, so
  it yields zero inferred script targets and makes `project.json` the single source of truth.
  Scripts stay in `package.json` so `pnpm --filter @gmt/docs build` still works standalone.

### 5b. `rm -rf .nx/cache` produces a **false green** — use `nx reset`

Nx keeps cached artifacts in `.nx/cache` and their metadata in `.nx/workspace-data`.
Deleting only the former leaves entries pointing at artifacts that no longer exist, and Nx
then reports:

```console
$ pnpm exec nx run docs:generate
 NX   Successfully ran target generate for project docs
Nx read the output from the cache instead of running the command for 1 out of 1 tasks.
```

…while `apps/dox/src/generated/` does not exist. The task never ran and nothing was
restored, but the exit code is 0. Observed directly while verifying `DOX-A1`.

**Always use `pnpm exec nx reset` to test a cold build**, never `rm -rf .nx/cache`. CI is
not affected — a fresh checkout has neither directory, so `ci.yml`'s existing
`rm -rf .nx/cache` step is harmless there — but any local "does this work from clean?"
check is worthless without `nx reset`. This matters most for `DOX-A3a`, whose Definition of
Done requires `docs:test` to pass on a clean checkout with no prior build.

### 6. `.oxfmtrc.json` is an allow-list the issue does not mention

Its `overrides` blocks cover `packages/**`, `docs/**`, `context/**`, `scripts/**`. Without a
matching `apps/**` entry, **`pnpm format` silently skips the entire new app.** Add one.

### 7. CI routing for `apps/**` works, but vacuously

Traced through all four jobs for an `apps/**`-only PR:

- `determine-affected` → `gmt_changed=false`, `non_gmt_changed=true`, `any_changed=true`.
- `build-lint` → **this is where docs work is actually validated.** `nx affected -t lint
typecheck build` picks up `docs`, and `dependsOn: ["^build"]` pulls in
  `@northguild/gmt:build` as a task dependency. The job's `rm -rf .nx/cache` step means the
  cold-cache build-order check is exercised on every run — which is what `DOX-A2` wants
  verified.
- `tests` → runs `nx affected -t test --exclude=@northguild/gmt,@northguild/gmt-oxlint`.
  `docs` has no `test` target, so zero tasks, exit 0. Note this job is **already** a no-op
  for every PR shape, since those two projects are the only ones with a `test` script.
- `gmt-matrix` → 20 jobs start and immediately echo-skip. Pre-existing.

Nothing breaks. The story's ask is to make the routing **explicit rather than accidental**:
add a `docs_changed` output plus a comment recording the intent. `DOX-A2`'s deploy workflow
needs exactly that signal anyway, so it is not throwaway work.

Also broaden the test-artifact collector to loop `packages apps` — it globs `packages/` only
today, so once `DOX-A3a` adds `docs:test` its artifacts would vanish silently.

---

## `DOX-A1` build notes

### Target definitions

All targets are `nx:run-commands` with `cwd: "{projectRoot}"` and `forwardAllArgs: false`
(`nx:run-commands` defaults `forwardAllArgs` to `true`, which would append stray CLI flags
to `astro build`).

- `build`, `dev`, `typecheck` all take `dependsOn: ["^build", "generate"]`. `^build` builds
  `@northguild/gmt` first; **`generate` is a sibling task and must be listed explicitly** —
  Nx does not chain it via `^`.
- `typecheck` **must** carry an explicit `dependsOn` to override `nx.json`'s
  `targetDefaults.typecheck.dependsOn: ["^typecheck"]`. Left as the default, it waits on
  gmt's `tsc --noEmit` across 504 source files while still not producing the `dist/` the
  docs actually need — slow _and_ wrong.
- Cache inputs must include `{workspaceRoot}/packages/*/package.json`. The version map's
  real input lives outside `{projectRoot}`, and `namedInputs.default` is
  `{projectRoot}/**/*` + `sharedGlobals` — so without it, a version bump leaves `docs:build`
  cached and the site ships a stale badge, exactly what the story forbids.
- `typecheck` runs `astro sync && astro check`, in that order. `.astro/` is gitignored, so
  `astro:content` types do not exist on a clean checkout. `@astrojs/check` and `typescript`
  must be devDependencies — Astro does not bundle the checker.
- **No `test` target in `DOX-A1`.** `DOX-A3a` introduces `docs:test` together with the
  committed stub and Vitest alias it needs; adding one now means a `vitest.config.ts` and a
  `vitest.workspace.ts` entry that A3a would immediately rewrite. `vitest.workspace.ts`
  currently defines only the `gmt` project, and whether `docs` joins it is A3a's call.

### `tsconfig.json`

Extends `astro/tsconfigs/strict`. Add `"nx": { "addTypecheckTarget": false }` — Nx's
documented escape hatch — or the plugin infers a `tsc --build --emitDeclarationOnly`
typecheck target, which is nonsense for Astro, and attaches the `@nx/js:typescript-sync`
generator to it.

Do **not** set `"types"`. Leaving it unset lets `.astro/types.d.ts` supply `astro/client`.

### Version map script

`apps/dox/scripts/generate-version-map.mjs`, following `scripts/sync-intent-version.mjs`'s
shape. Emits a **typed module** (`src/generated/versions.ts` exporting `packageVersions` and
`gmtVersion`), not JSON, so consumers get autocomplete and type errors. Write idempotently —
skip the write when content is unchanged, so `astro dev` does not HMR-thrash and Nx does not
see a spurious output change.

Lives in `apps/dox/scripts/`, not root `scripts/`: Nx's `default` named input is
`{projectRoot}/**/*`, so a root-level script would not invalidate the docs cache when
edited, and it belongs next to `DOX-A3a`'s future `build-reference.ts`.

**Gitignored, not committed** — deliberately breaking symmetry with `DOX-A3a`'s stub
pattern. A3a commits stubs so tests can import generated modules on a clean checkout; A1 has
no tests, and a stub version map would render a _wrong_ version badge, which is the precise
failure the story exists to prevent. Flag the asymmetry in the PR so A3a does not assume it.

### Starlight 0.41 API shapes

- `social` is an **array** of `{ icon, label, href }`. The old object form
  (`social: { github: "…" }`) was removed and fails with a Zod error, not a helpful message.
- Sidebar entries use `{ slug: "install" }`, not `{ link: "/install" }`.
- Set `site:` or `@astrojs/sitemap` (a Starlight dependency) warns on every build. A
  placeholder hostname is fine until `DOX-A2` provisions the real one.
- `@astrojs/starlight/loaders` and `@astrojs/starlight/schema` are both present in 0.41.9's
  exports map — `docsLoader()` and `docsSchema()` import from there.
- Pages using imports must be `.mdx`, not `.md`.

### Content sourcing

Port from `packages/gmt/README.md`; do not re-derive. Its figures (312,220 test executions,
15,611 tests, 17 locales) are audited.

| Page             | Source                                                        |
| ---------------- | ------------------------------------------------------------- |
| `index.mdx`      | Hero from README:3–11; four cards from "Why GMT" README:13–23 |
| `install.mdx`    | README:25–33, plus Package Layout README:151–179              |
| `core-rules.mdx` | README:44–58, plus Design Philosophy README:37–42             |

Populate every page's `description` frontmatter — `DOX-A3b` generates its `llms.txt` nav
index from titles and descriptions.

The sentinel fallback list (README:53–58) deserves visual weight — an `<Aside
type="caution">` rather than a plain list. The no-throw contract is the single most
surprising thing about the library.

---

## `DOX-A2` notes

**Re-verified against the live repo and Cloudflare's own current docs on 2026-08-26,
during `DOX-A2` planning.** The issue's `assets` config is wrong in one specific way —
see finding 1 below.

### 1. `binding: "ASSETS"` with no `main` is inert — omit it

The issue spec says: `directory: "./dist"`, `binding: "ASSETS"`, `not_found_handling:
"404-page"`, no `main`. Cloudflare's own migration guide (verified via ctx7,
`/websites/developers_cloudflare_workers`, "Configure Workers static asset directory"):

> "Omit the ASSETS binding if the Worker does not have a main script."

A `binding` exists so a Worker's own script can read `env.ASSETS`. With no `main` script,
nothing consumes the binding — it does nothing. The confirmed minimal config for this
tier:

```jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "gmt-dox",
  "compatibility_date": "2026-08-26",
  "assets": {
    "directory": "./dist",
    "not_found_handling": "404-page",
  },
}
```

Add `binding: "ASSETS"` back in Tier 6, alongside the `main` script that will actually
read it for `/api/*`. `compatibility_date` and `name` are required top-level fields
regardless of assets-only status — the issue's snippet omitted them.

One Worker serves both the site and, later, `/api/*` in the same isolate. This removes
CORS entirely, the second pipeline, and `DOX-C1`'s corpus-location question.

### 2. The project is named `dox`, not `docs`

`DOX-A1` landed `apps/dox/project.json` with `"name": "dox"` (not `"docs"` as the issue
text and `dox-tester.md`'s Tier-0 gate say), and root scripts are `dox:dev` / `dox:build`
/ `dox:preview`. Use `dox` in every Nx command (`pnpm exec nx run dox:build`, `nx show
projects --with-target build`, etc.) — `docs` will resolve to nothing. `dox-tester.md`
needs a one-line correction to match; not fixed as part of `DOX-A2` itself.

### 3. Starlight ships a default 404 page automatically

Confirmed via ctx7 (`/withastro/starlight`): Starlight injects a default 404 route with
no config needed. `dist/404.html` exists in the build output without adding
`src/content/docs/404.md`, so `not_found_handling: "404-page"` has something to serve
out of the box.

### 4. No Cloudflare secrets exist on the repo yet

`gh secret list` returned empty as of 2026-08-26 — `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID` are not configured. **This is a hard dependency for shipping the
MVP at all**, not just for the eventual chat. The user provisions these personally
(credential-bearing steps, not something an agent does): create a Cloudflare account,
note the Account ID, create an API token scoped to that one account via the "Edit
Cloudflare Workers" template, then `gh secret set CLOUDFLARE_API_TOKEN` / `gh secret set
CLOUDFLARE_ACCOUNT_ID`. Until this is done, the live-deploy DoD lines (live URL, links
resolve, Pagefind returns results) are correctly "not verified," not failed.

### 5. `wrangler-action@4.0.0` exact usage (verified via ctx7)

```yaml
permissions:
  contents: read # deployments: write is only needed when passing gitHubToken to create
  # Pages deployment records — this deploys a plain Worker and never passes gitHubToken.

steps:
  - uses: cloudflare/wrangler-action@v4
    with:
      apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
      accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
      workingDirectory: apps/dox
      command: deploy
      wranglerVersion: "4.126.0" # pin exact, matching the local devDependency
```

Decided: Worker name `gmt-dox`, deployed to the default `*.workers.dev` subdomain (no
custom domain yet). Deploy trigger is every push to `main` (no path filtering — Nx
caching keeps unaffected builds fast, and `wrangler deploy` is idempotent). No
`pull_request` trigger at all, which trivially satisfies the DoD's "does not run on PRs
from forks" line rather than needing a runtime guard.

`astro.config.mjs`'s `SITE` constant is a placeholder (`https://gmt.northguild.dev`) that
`DOX-A1` left for this story. Since the decision is `workers.dev`, not a custom domain,
the real URL (`https://gmt-dox.<subdomain>.workers.dev`) is only knowable once the user's
account subdomain is confirmed post-provisioning — left as a fast-follow commit, not a
blocker (the placeholder still satisfies `@astrojs/sitemap`'s requirement that `site` be
set, so build/lint/typecheck are unaffected).

**GitHub Pages was never enabled on this repo** (`gh api repos/northguild/gmt/pages` →
404, re-confirmed 2026-08-26), so there is nothing to migrate away from.

### Remaining items

- Verify `dependsOn: ["^build", "generate"]` actually orders the build correctly in CI,
  where the Nx cache is cold — the deploy workflow's own build step is the first place
  this runs against a genuinely cold cache in an environment the team doesn't control.
- Pagefind runs only in the production build, so the deployed site is the first place
  search can be tested.
- Adding `wrangler` as a devDependency may need a new `pnpm-workspace.yaml` allowBuilds
  entry (risk #2 below — `workerd` sometimes ships a postinstall). Verify during install;
  if needed, regenerate the lockfile in the same commit.

---

## Ordered risk list — most likely to bite first

1. **Node.** `fnm use &&` on every command. Failure surfaces at the first `astro` call, not
   at install, so the error points at the wrong thing.
2. **Lockfile + build-script approval.** CI runs `pnpm approve-builds --all` _before_
   `pnpm install --frozen-lockfile`, and `pnpm-workspace.yaml`'s `allowBuilds` lists only
   `esbuild` and `nx`. Astro's esbuild is already allowed and pagefind ships prebuilt
   platform binaries, so this should be clean — but if `allowBuilds` needs new entries, the
   lockfile must be regenerated **in the same commit** or `--frozen-lockfile` fails in CI.
3. **Nx sync generator.** Once `apps/dox/tsconfig.json` exists, `@nx/js:typescript-sync`
   may flag the workspace permanently out of sync on the story's own local DoD command (CI
   skips sync entirely). If it does, `nx.json`'s
   `sync.disabledTaskSyncGenerators: ["@nx/js:typescript-sync"]` is the fix — but **verify
   the behavior before editing `nx.json`**, do not change it speculatively. If someone
   accepts the sync prompt it writes a project reference into the Astro tsconfig and breaks
   the "not a composite TS project" gate. Note the repo is arguably already in this state
   via `packages/gmt-oxlint`, which is absent from root `tsconfig.json` references.
4. **`oxlint.config.js` is dead** (finding 2). Bites at review time, when someone assumes
   the `files.include` edit means the app is linted.
5. **`prebuild`/`predev` never fire** (finding 4).
6. **`astro check` on a clean checkout** needs `astro sync` first.
7. **Nx cache staleness on a version bump** — verify concretely: build, hand-bump a version,
   rebuild, confirm a cache miss. This is the only real proof the version badge cannot go
   stale.
8. **`project.json` name vs `package.json` name** (finding 5).
9. **Starlight config API drift** — `social` array form, `{ slug }` sidebar entries.
