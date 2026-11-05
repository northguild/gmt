---
story: CORE-92
status: draft
---

# Phase 0 — a local Firefox route through Docker (S)

**Why.** Playwright 1.63.0's Firefox (`firefox-1543`) fails on macOS 27.0.1 with "Could not
find profile folder". It fails the same way outside the sandbox and with another `TMPDIR`. The
older `firefox-1532` hangs. Firefox has never run on this Mac, and so every Firefox finding in
the weekly sweep was new.

The Playwright image runs a browser server. The gates connect to it and reach the host's static
server through Playwright's network tunnel. This was checked on this Mac: Firefox 155.0, Linux
x86_64, through `ws://127.0.0.1:3555/`.

## Files

- **New `apps/dox/scripts/lib/browser-launch.mjs`.**
  - It exports `launchBrowser(name, options = {})` and `firefoxEndpoint(env = process.env)`.
  - `firefoxEndpoint` returns the trimmed `GMT_PW_FIREFOX_WS`, or `null` when it is unset or
    empty. It throws on a value that is not a `ws://` or `wss://` URL.
  - `launchBrowser` takes `"chromium" | "firefox" | "webkit"`.
    - For `firefox` with an endpoint, it returns
      `firefox.connect(endpoint, { exposeNetwork: "<loopback>", timeout: 30_000 })`.
    - In every other case it returns `<engine>.launch(options)`, with no change in behaviour.
  - `<loopback>` matches `localhost`, `*.localhost`, `127.0.0.1` and `[::1]`, so the browser
    reaches `static-server.mjs` on `127.0.0.1:<port>`. This is Playwright 1.63
    `ConnectOptions.exposeNetwork`, documented in
    `playwright-core/types/types.d.ts` and at `/microsoft/playwright/v1.63.0`.
  - On connect, it writes one line to stderr: `firefox: connected to <endpoint> (<version>)`.
    That way a gate log shows the route was used.
  - JSDoc says why the module exists, links the `built.md` entry, and says how to retire it.
  - An unknown name throws, naming the three engines.
- **Every launch that can take Firefox goes through `launchBrowser`.** Its engine map and
  `firefox` import are removed. The call sites are:
  - `canada-layout-check.mjs:375`
  - `canada-clock-still.mjs:355`
  - `canada-stored-still.mjs:290`
  - `data-credits-check.mjs:359`
  - `grow-measure.mjs:1167`
  - `table-fit.mjs:204`
  - `readout-still.mjs:896`
  - `lib/a11y-sweep.mjs:201` (it serves `a11y-axe`, `a11y-tab-walk` and `a11y-media`; confirm
    that `a11y-media` uses it, and route it if not)

  Chromium-only launches (`contrast-measure`, `visual-snapshot`, `globe-smoke`,
  `build-favicons`, and the Chromium pre-passes at `canada-*:128/253/317`, `data-credits-check:304`,
  `grow-measure:1105` and `readout-still:844`) stay as they are.
- **New `apps/dox/scripts/firefox-server.mjs start|stop|check`.**
  - The version comes from the installed `@playwright/test` `package.json`, never typed in.
    `connect` refuses a server whose version is different.
  - Pure exports, tested:
    - `dockerRunArgs(version, port = 3555)` returns
      `["run","-d","--rm","--name","gmt-pw-fx","-p","127.0.0.1:<port>:<port>","--init","--ipc=host",
      "mcr.microsoft.com/playwright:v<version>-noble","/bin/sh","-c",
      "cd /tmp && npx -y playwright@<version> run-server --port <port> --host 0.0.0.0"]`.
    - `dockerStopArgs()` returns `["stop","gmt-pw-fx"]`.
  - `start` runs `docker run` with `spawnSync`, then waits up to 60 s for the port to accept a
    WebSocket connection, polling every 250 ms on an awaited TCP connect, never a sleep. If the
    container is already running, it says so and exits 0. If the `docker` command is missing or
    the daemon is down, it exits 1 with one plain line.
  - `stop` runs `docker stop gmt-pw-fx`. It exits 0 when no such container exists.
  - `check` needs `GMT_PW_FIREFOX_WS`. It serves `dist` with `serveStatic(DIST, 0)`, as `gates.mjs:541` does, then calls
    `launchBrowser("firefox")` and opens `http://127.0.0.1:<port>/gmt/`.
    - It prints `Firefox <version> (Linux) reached <url>` and exits 0 when the response is 200
      and `document.title` is not empty. Without `dist/gmt/index.html`, it exits 1 and says to
      build first.
    - In a `finally`, it closes the page, the browser and the server.
    - This is the pre-check that the container can reach the host's loopback.
- **`apps/dox/package.json`.** Add `"firefox-server": "node scripts/firefox-server.mjs"`.
- **The CI workflows are not changed.** `GMT_PW_FIREFOX_WS` is unset there, so `launchBrowser`
  calls `firefox.launch()` as before. The route stays dormant and isolated.

## Tests (Vitest, node; each closes what it opens)

- **New `scripts/lib/browser-launch.test.ts`.** Inject fake engines through a second parameter,
  `launchBrowser(name, options, { engines, env })`.
  - When the variable is unset, `firefox.launch(options)` is called once and `connect` is never
    called.
  - When it is set, `connect` is called with the endpoint and
    `{ exposeNetwork: "<loopback>", timeout: 30000 }`, and `launch` is never called.
  - Chromium and WebKit call `launch` whether the variable is set or not.
  - An empty value counts as unset.
  - A value such as `http://x` throws.
  - An unknown engine throws.
- **New `scripts/firefox-server.test.ts`.**
  - `dockerRunArgs("1.63.0")` matches the command above exactly.
  - The image tag and the `npx` version both come from the version passed.
  - The version read from the installed package matches `/^\d+\.\d+\.\d+$/`.
- **`scripts/gate-checks.test.ts`.** Add one test: no file under `scripts/` except
  `lib/browser-launch.mjs` imports `firefox` from `@playwright/test`. That stops a new gate from
  launching Firefox past the route.

## Red-first

`GMT_PW_FIREFOX_WS=ws://127.0.0.1:3555/ pnpm --filter dox gates --no-build --only table-fit
--browsers firefox --pages /tools/timetable-reader/` fails to launch before the change, with the
profile-folder error. After the change, it connects and runs.

## built.md entry

Put it under **Runbooks**, next to the weekly sweep entry, as "Firefox on macOS 27 (Docker
route)". It says:

- **Why.** Playwright 1.63's Firefox does not launch on macOS 27 ("Could not find profile
  folder"), inside or outside the sandbox.
- **How to run.** `pnpm --filter dox firefox-server start`, then
  `export GMT_PW_FIREFOX_WS=ws://127.0.0.1:3555/`, then any gate with `--browsers firefox`, then
  `pnpm --filter dox firefox-server stop`.
- **What it measures.** This is Linux Firefox, the same engine family the weekly legs run. It is
  not macOS Firefox.
- **How to retire it.** After each Playwright bump, run
  `node -e 'import("@playwright/test").then(async({firefox})=>{const b=await firefox.launch();console.log(b.version());await b.close()})'`
  from `apps/dox`. If it prints a version, delete `firefoxEndpoint` and the connect branch,
  `firefox-server.mjs`, its test, the package script and this entry. Keep `launchBrowser` and
  the import test as the single launch seam.
