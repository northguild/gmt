---
name: tooling-migration-pnpm-nx
description: Planned next-branch work — upgrade pnpm globally, remove nx, make pnpm audit work
metadata:
  type: project
---

Planned for a dedicated branch off `main` (decided 2026-09-04, not yet started). A full handoff
brief was written this session — recreate from the points below if not fed in.

Scope, suggested order (each its own commit):

1. **Remove nx.** Only `gmt`, `gmt-oxlint`, `dox` have real tasks; all packages already have plain
   scripts (`apps/dox/package.json` has a full parallel set). Replace `nx affected` with the
   path-based gating `ci.yml` already does by hand, or `pnpm --filter '...[origin/main]'`. Delete
   `nx.json`, `apps/dox/project.json`, nx devDeps, `nrwl/nx-set-shas`. Re-encode the dox
   `build`→`typecheck` ordering (astro race fix) as a plain script chain.
2. **Upgrade pnpm** (repo pins `pnpm@10.32.1`). `latest` = 11.25.0; `latest-12` = 12.3.1 (opt-in).
   User wants latest, even 12, for security. Global install via the standalone script only
   (`get.pnpm.io/install.sh`) → `~/.local/share/pnpm`; NOT `npm i -g`, NOT as a global pnpm
   package. `corepack disable` on fnm Node versions after. Bump `packageManager` + `version:` in
   all 3 workflows. Isolated lockfile-regen commit. User will feed pnpm docs + wants ctx7 used.
3. **pnpm audit in CI** — no workflow runs it today.

Why: `pnpm audit` on the repo = 31 findings (12 high), ~26 transitive via **nx** (`@nx/js@22.6.4`
pins `nx@22.6.4` → `axios@1.12.0` + babel toolchain). None ship in published tarballs. Removing nx
clears most; a verified quick-fix (nx→22.7.9 + ~12 semver-major-bounded `pnpm-workspace.yaml`
overrides) got audit to 0 with the monorepo green, but was reverted — redo properly post-nx.

Also: `typescript@latest` is now 7.0.2 (native port). `packages/gmt-eslint` needs
`"typescript": "^5.9.3"` added or it warns on the tseslint peer.

See [[pnpm-audit-local-and-overrides-gotchas]].
