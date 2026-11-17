# Tier 2: page tools (WebMCP)

Part of [built/index.md](index.md). Tool rules: [tier-2-tools.md](tier-2-tools.md). Deploy checks: [tier-6-ops.md](tier-6-ops.md#after-a-deploy).

Every tool page registers one tool that an agent in the reader's browser can list and call ([WebMCP](https://webmachinelearning.github.io/webmcp/): `document.modelContext.registerTool`). The tool is read-only (`readOnlyHint: true`) and never drives the widget on the page. It runs the pure function the page's own redraw runs and answers with the facts. In a browser without WebMCP the page loads nothing new and behaves as before.

## How it is built

- **The marker and the offer are split.** `route-data.ts` puts `<meta name="gmt-webmcp" content="<slug>">` and the origin-trial meta into the head of every `tools/<slug>` page and no other (`webmcpHeadEntries` in `head-tags.ts`). The component's script calls `offerPageTool("<slug>", () => import("../lib/webmcp/tools/<slug>"))` (`webmcp/offer.ts`), which returns before any import when the marker is missing, names another slug, or the browser has no model context. `offer.ts` imports only `model-context.ts`, so the landing page and every browser without WebMCP pay under 1 kB and fetch no tool chunk. `graph.test.ts` holds that import list.
- **The facts function is shared.** The tool and the mount call one function (`converterFacts`, `dstFacts`, `intervalFacts`, `readZonesAt`, `readZoneNow` and the others), so a tile and the tool's answer cannot disagree. Where a mount computed inline, the code was moved into the page's pure `src/lib/<page>.ts` and the mount calls it. A library the mount loads with a dynamic import gets a `load<X>Lib` (`loadConverterLib`, `loadDstLib`, `loadIntervalLib` in `lib/zones-lib.ts`) that the tool also awaits; a failed load resolves `unavailable` through `loadLibFor`.
- **Schemas live in `dox-tool-schemas.ts`, free of `ai`.** The tool's `input` is the chat tool's own `<doxTool>Input`, moved out of `dox-tools.ts`, which re-exports it. `coverage.test.ts` asserts the two are the same object, so the chat and the tool take one input.
- **`io: "input"`, and refinements go in `rules`.** The JSON Schema comes from `z.toJSONSchema(schema, { io: "input" })`, which keeps defaults optional and drops every `.refine`. `describeTool` therefore writes one sentence per refinement from the def's `rules`, and `coverage.test.ts` fails when `rules` is shorter than the schema's refinements.
- **Errors resolve and never reject.** `execute` safe-parses the input and answers `{ ok: false, error: "invalid-input", issues }` for a refusal and `{ ok: false, error: "unavailable" }` for a library that would not load. A sentinel from the library (an empty string, `null`, `false`, `[]`) is a result, with a note in `notes`; a legitimately empty answer (two intervals that share no time) is not a sentinel and has no note.
- **The link is a full URL.** A run sets `link` as the site path `encodeWidgetPermalink` returns. `toModelContextTool` resolves it against `location.href`, so the agent gets a URL on the page's own origin (localhost, a preview or the live site) that it can quote or pass on. `expectParity` checks every tool's link: same origin, and `decodeWidgetPermalink` reads its query.
- **Naming.** A name matches `^(compute|convert|decode|read|check|compare|list|find|schedule|resolve|build|measure)_[a-z0-9_]+$` and is at most 48 characters. A description is at most 1,000 characters, holds none of drag, click, slider, drawn, widget, shown or page, and no backtick, `*` or `#`. `describeTool` joins `returns`, the `when` line, the chat `args` line, each rule and `calls`; `argsSwaps` and `whenSwaps` replace a banned phrase and only when one is present.
- **Seeds are reported.** A value the call left out and the tool filled from the page's starting value or the clock is named in `input` and in a note (`seedNote`), so the agent can see what it was answered for.
- **The token is a deploy secret.** `ORIGIN_TRIAL_TOKENS` in `webmcp/origin-trial.ts` is parsed at build time from `WEBMCP_ORIGIN_TRIAL_TOKEN` (`parseOriginTrialTokens`: split on whitespace, blanks and repeats dropped, so an old and a new token can overlap). Only the "Build apps/dox" step of `deploy-dox.yml` sets it, from the repository secret of that name, so local, pull-request and weekly-gate builds emit no origin-trial meta. It is read through `process.env`, not `astro:env`, because Vitest reaches `route-data.ts` and cannot resolve `astro:env`. Without a token, `chrome://flags/#enable-webmcp-testing` still turns WebMCP on.
- **The globe tool loads through a hop.** `Globe.astro` also runs on the landing page, where the first-input budget is tight, so it offers `zoned-earth` through `webmcp/zoned-earth-hop.ts` (one `import()`, no static import, outside `tools/`) and the tool's preload table sits in the hop chunk and not in the Globe script. No other page needs one.
- **Reader guide.** `guides/integration/browser-agents.mdx` explains page tools to a reader, with the Cut-off Ruler's example call and its real answer. Regenerate that answer if the tool's result shape changes.

## The gate

- `coverage.test.ts` (names, descriptions, swaps, one module per page), the `parity-<group>.test.ts` files (the tool against the mounted page through `~/test/webmcp-parity`), `origin-trial.test.ts` (the parse, and the constant read from the variable), `head.dist.test.ts` (the built head: one marker per tool page, and the same origin-trial metas on every tool page and none elsewhere, with or without a token) and `scripts/webmcp.browser.test.ts` (every page in Chromium and WebKit, with a fake model context and with none).
- **The stylesheet guard judges the tool import only.** `head.dist.test.ts` walks a page's dynamic imports (through a hop) to the chunk that names the page and checks that import's own preload list against the sheets the page links. A mount's list is walked past: those sheets are the widget's business. It fails when it finds no tool import, so it cannot pass vacuously.

## Rules a new or edited page tool must still obey

- A facts function takes its input from the args only, never from drag or marker state, and a test passes every time argument explicitly so the page and the tool see one instant.
- A tool imports only the loader its page needs: `loadFinanceLib` (`finance-lib.ts`), `loadDayCountLib`, `loadHolidayLib` (`holiday-lib.ts`) and `loadPunctualityLib` (`punctuality-lib.ts`) each serve more than one page, and the tool never caches one.
- `result` holds the library's own strings, never an object or the escaped HTML the page renders; `json-safe.ts` and the parity test's JSON round trip enforce the first.
- Grid and handle geometry stay in the mount. `free-time-ledger` and `demurrage-clock` share terms, so their `returns` sentences must tell the two apart.
- Trap: the planner tool cannot import `multi-zone-scrubber.ts`. It carries its CSS, which the graph test refuses. The anchor and rounding helpers live in `src/lib/zone-anchor.ts`, `readZonesAt` lives in `zone-clock.ts`, and the step size in `zone-step.ts`.

## Runbook: renew the origin-trial token

No pull request is needed. The origin-trial console emails a link before the token expires.

1. Register `https://northguild.dev` there for the WebMCP trial and copy the new token.
2. Update the `WEBMCP_ORIGIN_TRIAL_TOKEN` repository secret of `northguild/gmt`. To let the old and new tokens overlap, put both in the secret, one per line, and drop the old one at the next renewal.
3. Redeploy: run `deploy-dox.yml` from the Actions tab (`workflow_dispatch`), or wait for the next deploy.
4. Check a live tool page's source for `<meta http-equiv="origin-trial" content="…">`, then run the page-tool checks in [tier-6-ops.md](tier-6-ops.md#after-a-deploy).

`chrome://flags/#enable-webmcp-testing` turns WebMCP on without any token.
