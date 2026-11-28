# Runbooks: dev, gates, baseline, Firefox

Part of [built/index.md](index.md). The weekly sweep, deploy checks and Not doing: [tier-6-ops.md](tier-6-ops.md).

## Dev server traps

- **Vite scans `src/lib` at startup** (`optimizeDeps.entries`, `astro.config.mjs`). Astro scans only `.jsx/.tsx/.vue/.svelte/.html`, so a package reached only from an `.astro` script (`@tanstack/charts`, `d3-geo`) is found late, Vite re-bundles and force-reloads every open page, and a widget chunk in flight fails with "Failed to fetch dynamically imported module". Keep the entries when adding a widget.
- **gmt is not pre-bundled in dev, on purpose.** Pre-bundling a linked package would need a dev-server restart after every gmt rebuild to avoid stale code.
- **A build or a second Astro command breaks a running `astro dev`, in two ways.**
  - The library's `dist`: the dev server aliases `@northguild/gmt` to `packages/gmt/dist` (`gmtPkg` and `resolve.alias`, `astro.config.mjs`). `pnpm --filter @northguild/gmt build` and `pnpm run validate` rewrite `dist`; until the build ends, open pages cannot load gmt modules. Reload after it ends. Build the library when no one reads a dev page, and build a gate baseline in its own worktree.
  - Vite's dependency cache: every Astro or Vite process in the checkout shares `apps/dox/node_modules/.vite/deps` unless `DOX_VITE_CACHE_DIR` names another (`cacheDir`). A second process rewrites the folder under the running server, which then answers `504 (Outdated Optimize Dep)` on every page until restarted. Reloading does not help. **Every Astro or Vite command an agent runs in `apps/dox` sets `DOX_VITE_CACHE_DIR` to a private folder**, for example `DOX_VITE_CACHE_DIR=$SP/vite-cache pnpm --filter @gmt/dox build`. That covers `astro`, the app's `build`, `check`, `typecheck`, `dev`, `dev:site`, `dev:chat`, `preview`, and the root `validate`. Vitest and `node` gate scripts that only read a built `dist` need nothing.
  - A page in the 504 state shows no "could not load" notice, because the failed import is a static import of the page script and the widget's mount never runs (tier 2, "A widget that cannot load says so"). Dead widgets with no notice on every page mean restart the dev server.

## The a11y gates

- Three gates, tier `pr`, run on the sample in every engine and on all pages in Chromium only (`fullBrowsers`):
  - `a11y-axe` (`scripts/a11y-axe.mjs`, `@axe-core/playwright` 4.13.0, tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`; 1440 and 390 wide, both themes).
  - `a11y-tab-walk`: every focusable shows a focus indicator, nothing traps, each `[role=slider]` and range moves on arrow keys, no interactive element is skipped.
  - `a11y-media`: with `prefers-reduced-transparency` no `backdrop-filter` and a fill alpha of at least 0.9; with forced colours every control keeps an edge.
- axe-core 4.13.0 tags no rules `wcag22a`, and `wcag22aa` holds `target-size` only. 2.2 criteria axe cannot test (focus not obscured, dragging alternatives, consistent help) stay with `a11y-tab-walk` and the tier 3 pass.
- `scripts/a11y-axe-exclusions.json` (empty) is the only place a rule or selector may be waived; a change to it runs `a11y-axe` on the sample (`inputIndex()` in the registry).
- `scripts/lib/a11y-sweep.mjs` settles transitions before each read (a clock row mid-fade reads as a false colour finding) and waits for every `.gmt-grow[data-growing]` to release (a region still easing is clipped at a stale height, a false `target-size` and `focus-obscured`).
- `a11y-tab-walk` counts up to eight Tab presses through one date field's segments as one stop (`collapseStops`, `SEGMENT_CAP`; more is a trap), tests the centre of every box of a wrapped link, and looks again 300 ms after a `focus-obscured`.
- Fixes a change must not undo:
  - Scrollable `pre` and `.gmt-widget table` get `tabindex=0`, `role=region` and a label while they overflow (`src/lib/scroll-regions.ts`; the `/dox/` transcript the same in `DoxChat.tsx`).
  - Running prose links are underlined (`gmt-content.css`, `dox.css`).
  - `--sl-color-text-accent` is `--gmt-cyan-ink`.
  - The globe list's `aria-activedescendant` only names a rendered row (`syncActiveDescendant`).
  - Dwell-ledger handles are 24px wide and lean 8px outward.
  - The light hero has its own `background-color`, because axe cannot read a `border-image` band.
  - The `/dox/` licence note lives inside the chat shell (`.gmt-hive-licence`); the Starlight footer omits it there.
- `contrast-measure` (the 7:1 gate) measures only text coloured `--gmt-ice-dim`; `a11y-axe` `color-contrast` (4.5:1) covers all text.

## Run the gates

`pnpm --filter dox gates` builds `packages/gmt` only when its `dist` is missing, builds the site with `DOX_VITE_CACHE_DIR=apps/dox/.gates/vite-cache` (unless set), serves `dist` on a free port and runs the selected gates one after another (the clock-still gates flake under load). Each gate writes `GATE_REPORT=.gates/<gate>.ndjson` and a log at `.gates/<gate>.log`. A failed gate runs again once on its failing pages (`--retries`): a pass is `FLAKY`, a second failure `FAIL`. Everything lands in `apps/dox/.gates/` (git-ignored) with `summary.json` and a `lock` a second run refuses (exit 2).

- Exit 0: no FAIL (`FLAKY` and `SKIP` pass). Exit 1: a gate failed or measured nothing. Exit 2: usage, a live lock, a failed build or a gate that exited 2.
- Options: `--plan` (print the selection, run nothing), `--only`, `--skip`, `--pages` (replaces the diff selection), `--browsers`, `--themes`, `--tier pr|weekly|local` (default `local`), `--shard i/n` (every n-th page of each gate's sorted list; a costed gate's pages are dealt costliest first, each to the leg with the fewest minutes so far), `--no-build` (needs `dist/gmt/index.html`), `--json`, `--against <ref>` (diff base, default `origin/main`, else `main`), `--all` (every page of every gate).
- `globe-smoke` is `SKIP needs a GPU` when `CI` is set. `html-diff` and `visual-diff` are `SKIP` without `--baseline <path to a built base apps/dox>`: `html-diff` captures in the base and compares here; `visual-diff` serves the base `dist` on a second port for `before`, runs `after` here, then `diff`.
- A child process running 90 minutes is stopped (`timed out after 90m`). `--deadline <minutes>` caps the whole run, for CI, where a job killed at its own limit leaves no summary: the gate in flight is stopped (`stopped at the <n>m deadline`), the rest are `not run`, each is a `FAIL` row with `outOfTime: true`, and `summary.json` is still written with `deadlineMinutes`. A full `--all --tier pr --browsers chromium` sweep takes about two hours on the author's machine; a diff-driven run takes minutes. `--plan` shows what a run would do.

## Firefox on macOS 27 (Docker route)

Playwright 1.63's Firefox does not launch on macOS 27 ("Could not find profile folder"). Every launch goes through `scripts/lib/browser-launch.mjs`. When `GMT_PW_FIREFOX_WS` names a Playwright run-server, Firefox connects to it and reaches the static server through `exposeNetwork: "<loopback>"`. With it unset (CI) Firefox launches as usual, and a gate log shows the route with one `firefox: connected to ...` line on stderr.

- Run it: `pnpm --filter dox firefox-server start`, then `export GMT_PW_FIREFOX_WS=ws://127.0.0.1:3555/`, then any gate with `--browsers firefox` (`firefox-server check` proves the container reaches a built `dist`), then `pnpm --filter dox firefox-server stop`. The container image and `run-server` version come from the installed `@playwright/test`; `connect` refuses another version.
- It measures Linux Firefox, the engine the weekly legs run, not macOS Firefox.
- Retire it after a Playwright bump if this prints a version, run from `apps/dox`: `node -e 'import("@playwright/test").then(async({firefox})=>{const b=await firefox.launch();console.log(b.version());await b.close()})'`. Then delete `firefoxEndpoint` and the connect branch, `firefox-server.mjs`, its test, the package script and this section. Keep `launchBrowser` and the test that allows only `lib/browser-launch.mjs` to import `firefox`.
- Where Firefox cannot launch, record it as blocked; never bypass the sandbox.

## A gate baseline

A baseline is a clean worktree of the commit the branch is based on. `html-diff.mjs capture` and `visual:before` run in a detached worktree at `git merge-base HEAD origin/main` with its own install, library build and site build; `html-diff.mjs compare`, `visual:after` and `visual:diff` run in the branch. Not local `main` (it can lag `origin/main`), and not the working tree with changes set aside (a stash is shared by every worktree; leftover generated files make a baseline unclean). Build both in private trees under the session scratchpad (`$SP`; `$W` is the worktree). Never touch port 4321, `apps/dox/dist` or the worktree's `packages/gmt/dist`.

```bash
BASE=$(git -C "$W" merge-base HEAD origin/main)
mkdir -p "$SP/base" && git -C "$W" archive "$BASE" | tar -x -C "$SP/base"
mkdir -p "$SP/after" && rsync -a --exclude node_modules --exclude dist --exclude .git \
  --exclude .astro --exclude .visual --exclude .wrangler "$W"/ "$SP/after"/
# In each tree (keep the fnm prefix: the base tree may predate the Node pin):
cd "$SP/<tree>" && eval "$(fnm env)" && fnm use && pnpm install --frozen-lockfile \
  && pnpm --filter @northguild/gmt build \
  && pnpm --filter @northguild/gmt-oxlint build \
  && DOX_VITE_CACHE_DIR="$SP/vite-<tree>" pnpm --filter @gmt/dox build
# Serve the branch build for the browser gates, then stop it:
python3 -m http.server 48391 --bind 127.0.0.1 --directory "$SP/after/apps/dox/dist"
# The site is under the base: open http://127.0.0.1:48391/gmt/
```

- A scratch tree has no `.git`; the site build reads history for page dates through `GIT_DIR` and `GIT_WORK_TREE`, set to the worktree's git directory on the build command alone. Never export them and never set them for a test run: `git init` under `GIT_DIR` writes `core.worktree` into the shared `.git/config`, and a fixture's `git commit` lands on the real branch. Tests that make a fixture repository drop every inherited `GIT_*` variable (`released-exports.test.ts`, `commit-dates.test.ts`).
- `scripts/head-tags.test.ts` runs `git ls-files` and `git log` at load, so it fails in a scratch tree. Run that file alone with `GIT_DIR` and `GIT_WORK_TREE` inline, never the whole suite.
- Re-run the `rsync` and the site build of `$SP/after` after any change.
- Core Web Vitals (`scripts/web-vitals.mjs`, by hand, never in CI): serve a built `dist` with gzip (`npx serve@14.2.4 -l <port> apps/dox/dist`), then from `apps/dox` run `node scripts/web-vitals.mjs --origin http://127.0.0.1:<port> [--live https://northguild.dev]`. It prints Lighthouse medians of three runs (LCP, CLS, TBT) and INP under 4x CPU throttling; `--live` adds PageSpeed Insights and CrUX. `PSI_API_KEY` in the environment raises the quota and is never written to a file.
