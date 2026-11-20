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

## Chat apps (MCP)

The same tools are offered to chat apps and editors through a remote MCP server on the Dox Worker. Reader guide: `guides/integration/chat-apps.mdx`. Deploy checks and the rate-rule runbook: [tier-6-ops.md](tier-6-ops.md#after-a-deploy).

- **Endpoint and scopes.** `POST https://northguild.dev/gmt/api/mcp` lists every tool, and `POST /gmt/api/mcp/<industry>` lists the tools whose page carries that tag, one scope for each id in `INDUSTRY_TAG_IDS` (`core` is its own scope). Reason: a chat app sends every listed description on every turn, so a short list is cheaper. An unknown scope answers 404 `{ error: "unknown-scope", scopes }`; GET and DELETE answer 405. `worker/index.ts` routes it and `worker/mcp.ts` serves it.
- **No trailing slash.** `run_worker_first` in `wrangler.jsonc` holds `!/gmt/*/`, and a negative pattern always wins, so the assets answer `POST /gmt/api/mcp/` with 405 before the Worker runs. `worker/index.ts` matches the path without a slash, a test pins it, and every URL in the guide and the smoke rows has none.
- **One run path.** `executePageTool(def, input, { signal, base, checkJson })` in `page-tool.ts` is the whole of a run. WebMCP passes `base` as a lazy getter over `location.href`, so `location` is read only when a run has a link; MCP passes `SITE_URL`, so a chat app always gets a link on the live site. Reason: one input gives one `PageToolResult` on every surface. A fix for a difference goes in this path, never in `server.ts`.
- **The list is generated.** `scripts/build-mcp-tools.ts` (run by `generate`) imports every tool module once and writes `src/generated/mcp-tools.json` (the listing plus slug, industries and example), `mcp-tool-loaders.ts` (`MCP_TOOL_LOADERS`, name to `import()`) and `tool-industries.json`. `tools/list` reads the JSON and never evaluates a tool module; `tools/call` loads only the module it calls. Reason: evaluating every tool module costs far more CPU than the Free plan's 10 ms a request.
- **Low-level `Server` over `createMcpHandler`.** `src/lib/mcp/server.ts` builds a `Server` from `@modelcontextprotocol/server` (v2). The SDK marks `Server` deprecated (a TS hint) and we use it on purpose: the page tools already own the JSON Schema, the `safeParse` validation and the refusal shape, which `McpServer.registerTool` would redo. A later npm stdio package would reuse the factory.
- **JSON mode.** `createMcpHandler(..., { responseMode: "json", maxRequestBodySize: 65_536, keepAliveMs: 0 })`. A `2026-07-28` exchange gets a JSON body. The SDK answers a 2025-era request (`mcp-protocol-version: 2025-06-18`) as one SSE `event: message`, which Streamable HTTP clients accept, so a check must parse either form (`worker/mcp.test.ts` and the smoke rows do). A `2026-07-28` request without the `_meta` envelope gets 400.
- **`serverInfo`** is `{ name: "gmt-dox-tools", title: "GMT tools", version: gmtVersion }`, with the version from `src/generated/versions.ts`.
- **Limits.** 413 over 64 KiB, chunked bodies included. 429 with `retry-after` and `{ error: "rate-limited", retryable: true }` at `MCP_RATE_LIMIT` (300 calls a minute for each IP) counted in each Worker instance, which is why the dashboard rule in tier 6 is the real cap. `resetRateLimitState()` goes in `afterEach` of a test that fills it.
- **The SDK stays out of the browser.** Nothing under `src/components/`, `src/pages/` or `src/lib/webmcp/` imports `src/lib/mcp/` or `@modelcontextprotocol/*`; `src/lib/mcp/graph.test.ts` holds it.
- **Size.** The tool modules roughly double the gzipped Worker. It must stay under the Free plan's 3 MiB; measure it with `pnpm exec wrangler deploy --dry-run` in `apps/dox` after adding tools.
- **Traps.**
  - Lazy loading is the CPU budget. A static import of `MCP_TOOL_LOADERS`' modules, or of `tools/*`, into the Worker brings the cost back.
  - Validation is zod's `safeParse` in `executePageTool`, and a refusal is an ordinary tool result (`ok: false`, with `isError: true`), never a protocol error, so the model can read it and correct the call.
  - Tool modules read `import.meta.env.DEV` only in `toModelContextTool`; the shared path stays free of `document`, `window` and `location`.
  - The generated files are gitignored, so a fresh checkout needs `generate` before the Worker's tests or a build.
- **Not offered.** Prompts, resources, MCP Apps and any tool that is not a page tool.
- **Reader guide check.** `src/lib/mcp/guide.test.ts` reads the guide: each MCP URL starts with `SITE_URL` plus `/api/mcp` and has no trailing slash, each scope id is in `INDUSTRY_TAG_IDS`, and each tool name is in `mcp-tools.json`.

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
