# Workspace integration — the four easy-to-miss files

> Extracted from `overview.md` §4 on 2026-09-02. **Load only on `DOX-A1`** — every
> other story consumes the result.
>
> See also: [overview.md](../overview.md).

`apps/` does not exist and is not a workspace glob. Confirmed unchanged on 2026-08-26.

1. **`pnpm-workspace.yaml`** — add `- 'apps/*'`
2. **root `package.json`** — the `"workspaces"` array duplicates the glob; add `apps/*`
   there too
3. **`oxlint.config.js`** — note the **`.js` extension**; the superseded plan said
   `oxlint.config.ts`, which does not exist. `files.include` currently lists
   `packages/**`, `docs/**`, `context/**`, `scripts/**`; add `apps/**`. Also add
   `apps/dox/dist`, `apps/dox/.astro`, and the generated reference directory to
   `files.ignore` — generated MDX and `.astro` files should not be linted.
4. **`apps/dox/project.json`** — **required, unlike `packages/*`.** Nx infers
   `build`/`typecheck` from `@nx/js/typescript` keyed on the presence of
   `tsconfig.build.json`, which an Astro app will not have. Declare `build`, `dev`, and
   `typecheck` explicitly, with `dependsOn: ["^build"]` so `@northguild/gmt` is built
   before the docs site consumes it.

Two more constraints:

- **`apps/dox` must not extend `tsconfig.base.json`.** The base sets
  `composite: true`, `emitDeclarationOnly: true`, `module: nodenext`, and
  `customConditions: ["@northguild/source"]` — all wrong for an Astro app. Extend
  `astro/tsconfigs/strict` instead.
- **Import `@northguild/gmt` from its built `dist`, not from source.** The
  `@northguild/source` custom condition exists, but matching it would require
  configuring Vite's `resolve.conditions`; letting Nx build the package first is fewer
  moving parts. **Import at module granularity** (`@northguild/gmt/plain/calculate`),
  **never at namespace granularity** (`@northguild/gmt/plain`) and never per-function —
  see §1: the exports map sets `"./plain/*/*": null`, and the namespace barrels re-export
  the 2.98 MB polyfill.

Node `>=22.12` (Astro 7's floor — declare it on `apps/dox`), pnpm `10.32.1`. **Check the
local shell before starting `DOX-A1`** — `.nvmrc` is `24`, but a shell can easily be on an
older Node that predates Astro 7's floor; `nvm use` first.

**CI classification note.** `.github/workflows/ci.yml`'s `determine-affected` job
classifies changes by grepping `^packages/gmt/`. Anything under `apps/**` lands in
`non_gmt_changed` and runs the `tests` job, not the `gmt-matrix` job — confirm that is the
intended routing for `apps/dox` changes in `DOX-A1` rather than leaving it accidental.
