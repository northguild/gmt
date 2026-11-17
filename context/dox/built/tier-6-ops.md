# Runbooks: weekly sweep, local chat, deploy, Not doing

Part of [built/index.md](index.md). Dev server, gates, baseline, Firefox: [tier-6-runbooks.md](tier-6-runbooks.md).

## The weekly gate sweep

`.github/workflows/dox-gates-weekly.yml` runs every page, three browsers, both themes, and files `dox-gate` issues.

- Triggers: a Sunday cron (`41 4 * * 0`) and `workflow_dispatch` with `force_finding` (also files one `[dry run]` issue). It always runs; there is no skip rule. The workflow stays disabled until the owner says to enable it. Claude never enables it and dispatches a run only when asked.
- Locally, `/dox-full-sweep` runs `pnpm --filter dox gates --all --tier weekly --browsers chromium,firefox,webkit --themes dark,light` on request. It warns first that it takes 2 to 3 hours on a laptop, prints a findings summary and files no issues. It runs weekly-tier gates only: `globe-smoke`, `html-diff` and `visual-diff` are tier `local` (the diff gates also need `--baseline`). A gate with `fullBrowsers` gets every page in those browsers and the sample pages in the others; a gate whose `browsers` leave out an engine is dropped for it.
- On every Dox story, `dox-tester` runs the same command without `--all` on the pages the branch changes, in three browsers, and quotes the result. The PR job checks those pages in Chromium only.
- Legs: `pnpm --filter dox gates --all --tier weekly --browsers <b> --themes dark,light --retries 1 --shard i/n`, `timeout-minutes: 90`, `fail-fast: false`. `--shard` splits each gate's sorted page list round-robin, so every leg of a browser runs every gate on its share of the pages.
  - Under `--all`, Chromium gets every page of every gate. WebKit and Firefox get every page of `grow-measure`, `readout-still`, `data-credits-check` and `canada-layout-check`, plus the six-page sample of the three a11y gates (`fullBrowsers`). `contrast-measure` is Chromium-only. The two clock-still gates have one page each (shard 1 only).
  - Layout: chromium 6 legs, webkit 3, firefox 3 (12). The sizing keeps each leg under about 40 local minutes, about 75 on a runner at twice the time; five Chromium legs leave no margin under the 90-minute timeout. Record the slowest real leg here after the first runs.
- Report: job `report` (`issues: write`) downloads the newest `dox-gates-<leg>-<run id>` artifact of each leg (`summary.json`, `*.ndjson`) and runs `apps/dox/scripts/gates/file-issues.mjs --legs <all twelve>`.
  - Only `FAIL` rows file; `FLAKY` is listed in the step summary.
  - The key is `<gate>:<rule>:<page>:<target>`. The target is the element's identity key (tier 2, "Element identity"), never a class or an `nth` position. Browsers, widths and themes are not in the key, so one issue tables every place a finding was seen.
  - A leg with no readable `summary.json` is sorted by its job (`gh api .../runs/<id>/jobs`, read only then). If its `Check the summary was written` step passed, the upload or download lost the file and the leg joins the one `dox-gate:not-uploaded:all:` issue. Otherwise it files `dox-gate:could-not-run:<leg>` with how the job ended and the first step that did not succeed. A job list that cannot be read files could-not-run with the cause unknown.
  - A `FAIL` with no structured finding files `<gate>:unstructured:all:` with its log tail.
- Issues: label `dox-gate` only (created when missing, with `dox-gate-dry-run`) and no issue type. The first body line is `<!-- dox-gate key="..." -->` (`"`, `>` and `--` in a key are written as entities). An open `dox-gate` issue with the same marker gets a comment on the lowest-numbered match; otherwise a new issue opens.
  - Flood guard: more than 10 new issues in one run opens none and files one `dox-gate:flood` issue (a comment if already open). Its body groups held-back findings by `gate:rule:page` (largest first, `TABLE_ROWS` 40 rows and a count of the rest) with the run URL and leg artifacts (kept 14 days). Each run comments there until ten or fewer remain, then each is filed on its own.
  - `fitBody` cuts every other body and comment to 60,000 characters on a line boundary; `file-issues` exits 1 before any write when one still passes GitHub's 65,536. Comments on already-open findings still go out.
  - Nothing is closed automatically: whoever fixes a finding closes its issue.
- Dry run: `node apps/dox/scripts/gates/file-issues.mjs --print --dry-run-finding <summary.json>` plans against the live open-issue list (needs `gh` signed in), prints one line per action and files nothing. `--offline` makes no `gh` call and implies `--print`. Outside GitHub Actions it only plans; without `--print` it exits 2 ("run with --print locally; issues are filed by the weekly workflow"). An unreadable summary path (without `--legs`) or one with no leg folder also exits 2. Use a summary with no `FAIL` row, since a local `--all` summary plans as one flood issue. In CI, dispatch with `force_finding`: one `[dry run]` issue appears (key `dry-run:synthetic:/:body`, label `dox-gate-dry-run`); a second dispatch comments on it.

## Local dev and chat

- `pnpm dox:dev` (site and chat Worker) or `pnpm dox:dev:site` (site only), both at `http://localhost:4321/gmt/`. No site build is needed: the Worker reads `/gmt/retrieval-chunks.json` from `astro dev` through `DOX_ASSETS_ORIGIN`.
- Content edits hot-reload. gmt source edits regenerate the reference in place (`src/lib/gmt-reference-watch.ts`); a new export needs a restart. `generate` steps skip when their inputs are unchanged, and `upstream refresh` makes no network calls while its live file is under 6 h old (`UPSTREAM_REFRESH=force`).
- `dev-all.mjs` only stops its own children. If another `astro dev` holds this project's lock (per project, not per port) it exits; run `astro dev stop` first. A taken Worker port needs `DOX_WORKER_PORT` (default 8787).
- Astro proxies `/gmt/api/...` to the Worker (`src/lib/dev-worker-proxy.ts`). The proxy key is `^/api`, not `/gmt/api`, because Astro's dev base middleware strips `/gmt` before Vite's proxy runs; `rewrite` puts the base back. `dev-worker-proxy.test.ts` starts the real `astro dev` CLI against a stub Worker and fails if Astro reorders its middleware.
- Local chat: `pnpm dev:chat` (build, then `wrangler dev`), or `npx wrangler dev --port 8799` with `dist/` built. `.dev.vars` holds `NORTHGUILD_GMT_GEMINI_API_KEY` and `DOX_DEV_KEY` (`.dev.vars.example`).
- Dev bypass: `npx wrangler secret put DOX_DEV_KEY` in production, the same value in `.dev.vars` locally, then visit `/gmt/api/brains?key=<secret>` once per browser. It exempts you from the visitor cap, never from the shared pool.
- Probe brains (spends real quota):

  ```bash
  cd apps/dox
  npx wrangler dev --port 8799 --var DOX_DEV_KEY:probe --var NORTHGUILD_GMT_GEMINI_API_KEY: \
    > /tmp/dox-wrangler.log 2>&1 &
  npx tsx scripts/probe-brains.ts --base http://localhost:8799/gmt \
    --log /tmp/dox-wrangler.log --out /tmp/probe.json   # --brains <ids> --attempts <n>
  ```

  Emptying the Gemini key stops a failing Workers AI brain falling back onto Gemini. The probe accepts only ids in `BRAINS`. A Workers AI probe over the standard starters: `--starters 4 --brains cf-gemma-4-26b,cf-glm-4.7-flash`.
- Refresh the Gemini list after Google ships models: `curl "https://generativelanguage.googleapis.com/v1beta/models?key=$NORTHGUILD_GMT_GEMINI_API_KEY"`, then probe. A 429 proves a model exists as well as a 200 does; drop anything that answers 404 or 400. Leave out the `-latest` aliases (their quota bucket is unknown).

## After a deploy

- `/dox/` loads, and a grounded answer's citation opens the right page.
- `/api/brains` counts move and survive a reload, and the badge reads `● live`.
- `curl -s <url>/dox/ | grep -c GEMINI` prints `0`.
- The first deploy with the `ai` binding confirms the CI token may bind Workers AI.

## Owed verification

- The Firefox and WebKit legs of `grow-measure`, `readout-still`, `data-credits-check`, `canada-clock-still`, `canada-stored-still`, `canada-layout-check`, `a11y-axe`, `a11y-tab-walk` and `a11y-media`, on a machine where Firefox launches.
- The runner's `--baseline` path for `html-diff` and `visual-diff` end to end on a real base tree.
- `html-diff` and `visual:diff` after the interval visualizer's `data-role="axis"` attribute, against a baseline from the commit before it.
- The tier 3 keyboard-only, reduced-preference and Firefox/Safari pass.
- The Dox PR jobs (`ci.yml`): `dox-site` uploads `dox-site`; each of the five `dox-gates` legs passes inside its limit with its build row `SKIP --no-build` (the `readout-still` leg needs a run that selects the Timetable Reader); the four `dox-table-fit` shards add up to the whole table-page list; a PR touching nothing under `apps/dox/` or `pnpm-lock.yaml` shows the jobs skipped.
- The weekly sweep, once the file is on `main`: a `force_finding` dispatch finishes every leg, Firefox included, and files one `[dry run]` issue with the marker on line 1; a second dispatch comments on it; every leg finishes inside 90 minutes.

## Not doing

- Chat: an every-page chat dock; a scrubber or playground chat tool; wiring `Sources` / `InlineCitation`; React Query or TanStack Form (`useChat` covers both); baking the whole corpus into the prompt; auto-linking bold phrases; a separate chat origin.
- Site: TypeDoc; Octane; Nextra; a custom domain; per-page OG images; a second discovery page beside the guides index; a feedback loop.
- Motion and 3D: a boot sequence, scanlines or grain; a full-bleed 3D globe behind panels (the globe stays an object on the page: the landing hero, `/tools/zoned-earth/` and the `/dox` rail); a photoreal Earth (the look is a grid globe).
- Audio and voice: a synced voice visualizer. No browser exposes `speechSynthesis` output to Web Audio ([WebAudio#1764](https://github.com/WebAudio/web-audio-api/issues/1764), [mediacapture-main#654](https://github.com/w3c/mediacapture-main/issues/654)).
