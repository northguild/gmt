# CORE-88 — Core: The Canada 2026 clock-change checker in Dox

**Scope:** Dox gains the Canada 2026 clock-change checker at `/gmt/check/canada-2026-clock-change`, with live clocks and a clickable map of Canada's zones, computed by the Dox Worker. Every drawing of third-party data credits it from an info button. Dox, the READMEs, the skills and the agent prompt do not link or describe the hosted server. Adds no library function.

## Gap

In 2026 British Columbia, Alberta, the Northwest Territories and Manitoba stop changing their clocks, and tzdb 2026b to 2026e record it (Morocco's change is in 2026c). The first clock change that no longer happens is on 2026-11-01. A runtime whose tz data predates those releases still applies the old change, and nothing in Dox lets a reader see whether theirs does, or which of their stored times moved.

## Scope

- **The Canada 2026 clock-change checker** at `/gmt/check/canada-2026-clock-change`, MIT like the rest of Dox, with its chat pill and widget registration:
  - **Is your runtime current?** The UTC offset of `America/Vancouver`, `America/Edmonton`, `Africa/Casablanca`, `America/Inuvik` and `America/Winnipeg` at `2026-11-02T12:00:00Z`, in three columns: tzdb 2026e (`-07:00`, `-06:00`, `+00:00`, `-06:00`, `-05:00`), the Dox Worker, and the reader's browser (`Intl` only). An alert when the Worker column disagrees with 2026e. A one-line Node probe readers run where their own code runs.
  - **Which clock changes are left?** Every offset change in 2026 and 2027 for those zones, plus `America/Toronto` for contrast, at the local time it happens.
  - **Which stored times moved?** Up to 50 lines and 20,000 bytes of stored zoned strings, each classified by `classifyStoredZoned`. A line with no zone takes the zone picked from the four Canadian zones plus `America/Toronto`. Form fields are read with `typeof value === "string"`, so a file posted in a text field counts as empty.
  - **Clocks.** One crystal clock per Canadian zone (`renderCrystalClock`), driven by the Worker's offsets and transitions, ticked on the client from UTC now. Only the browser column reads the browser's `Intl`.
  - **Map.** Canada only, one shape per IANA zone from tzdb's `zone.tab` (country `CA`, 23 zones, each Canada-only), labelled by zone id, coloured by `getDstTransitions` for 2026 and 2027: stopped changing in 2026, still changes in 2027, or no change in 2026 or 2027. Clicking a zone pins its clock, current offset, last and next change ("none" where it stopped) and the tzdb release that recorded the change. A list of zone buttons gives keyboard access, as `TimezoneMap.astro` does; at 375 px a map that doesn't fit falls back to the list. Statistics Canada Lambert conformal conic: `geoConicConformal`, standard parallels 49° and 77°, central meridian −91.866667°.
- **The boundary data.** A script modelled on `scripts/prepare-globe-boundaries.py` filters timezone-boundary-builder's release to the Canadian zones at a finer tolerance. Every boundary script pins the release it downloads, and each derived file names that release and stays under ODbL, apart from the MIT code.
- **The data credits.** Every page that draws third-party data (the Globe, `TimezoneMap`, the Canada map and the NASA imagery) credits it with an info button on the drawing itself, which opens a closed-by-default credits panel; nothing else shows on the page. The Globe's button is the fourth of its control stack (`+`, `−`, `⊙`, info), in the page and in chat; `TimezoneMap` and the Canada map each carry one in the drawing's corner, styled like the stack's buttons. The Canada map is not drawn below 520 px of section width, so no credit shows there. The boundary credit reads "Time zone boundaries © OpenStreetMap contributors, timezone-boundary-builder, ODbL", or wording checked against the release's current licence.
## Design notes

- **Computed by the Worker at request time.** The checker exists because runtime tz data goes stale, and Node's own data lags tzdb, so nothing it shows is computed at build time. The Worker column, the transitions and the stored-time lines come from a Dox Worker endpoint under `/gmt/api/` that calls the workspace `@northguild/gmt` on workerd. It may reuse `worker/rate-limit.ts`, and it calls no other service.
- **Stored times last.** The stored-time check uses `classifyStoredZoned` (`CORE-83`). It runs on the Worker, so it reads the Worker's tz data.
- **Prior art.** The first checker page was written in another repo and later removed from it. Its layout code is not copied, and it called `String()` on a posted file, which the `typeof` rule above replaces.

## What gmt provides (do not re-implement)

- The site at `northguild.dev/gmt` and its Worker (`CORE-86`)
- `classifyStoredZoned` (`CORE-83`)
- `getTimeZoneOffset`, `getDstTransitions` and the zone helpers the checker's Worker endpoint calls

## Verification

- The checker page and `/gmt/api/canada-clock-change` answer 200 live.
- On the deployed Worker, the checker's Worker column matches tzdb 2026e for all five zones.
- The credits panel opens from the info button on every Globe, on `TimezoneMap` and on the drawn Canada map, and lists the ODbL credit.
- The checker, its clocks and its map work keyboard-only and at 375 px.
- `pnpm run validate` stays green.

## Decisions

**Endpoint** (`apps/dox/worker/canada-clock-change.ts`, routed from `routeApi`)

- `GET /gmt/api/canada-clock-change` answers `200 application/json` with `cache-control: no-store`: `now`, the `probe` rows (five zones at `2026-11-02T12:00:00Z`), the 2026 and 2027 `transitions` and one `zones` row per id in `src/lib/canada-zones.json`. Everything is computed at request time on workerd; nothing comes from the build and the page calls no other service.
- HEAD is supported. It answers as GET with no body: the same status, headers and rate-limit bucket. Other methods get `405` with `Allow: GET, HEAD, POST`.
- Each map zone has exactly one `kind`, decided once from `getDstTransitions` for 2026 and 2027: `stopped-2026`, `changes-2027` or `none-2026-2027`. "Never changed" is not a class: Whitehorse, Dawson, Fort Nelson, Regina and Swift Current stopped long ago, and Atikokan, Creston and Blanc-Sablon had no 2026 change.
- `POST` takes `multipart/form-data` or `x-www-form-urlencoded` with `lines` and `zone`. A field is read with `typeof value === "string"`, so a file posted in a text field counts as empty; `String(value)` is never used. A bad zone or a body that is not a form is `400`; an empty `lines` is `200` with no rows.
- The POST body is read as a stream capped at 65,536 bytes; a larger body is `413`, and a body that ends early is `400` like any body that is not a form. `content-length` is not trusted. The order is size, rate-limit bucket, zone.
- The stored-times cap is 50 lines and 20,000 bytes. 50 is measured on workerd: about 0.15 ms per line (50 lines 7.0 to 7.4 ms, 200 lines 29.4 ms), against the 10 ms CPU limit of the Workers Free plan. `\r\n` and `\r` become `\n` before the bytes are counted, because a `FormData` body sends every line break as CR LF. `truncated` is true only when a dropped part holds a non-blank character.
- Rate limit: `canada:<clientId>`, 20 calls in 60 seconds, shared by GET, HEAD and POST. A refused call is `429` with `retry-after` in seconds and `{ error, retryable: true }`. The limit is per isolate, so it is blunt protection and not a global limit.
- A line takes its zone from the text, then from the picked zone: a line with `[` is used as written; `<time> <Zone>` becomes `<time>[<Zone>]`; one token takes the picked zone; anything else is not a stored time. The site guesses no zone.
- The Worker imports `classifyStoredZoned` from `@northguild/gmt/zoned/classify` only.

**Tests and checks**

- Node 24 carries tz 2026c, not 2026e, so no unit test asserts a 2026e offset. Tests compare the Worker with the library in the test runtime. Only `deploy-smoke.mjs` checks the five 2026e offsets on the deployed Worker; when a later tzdb changes one of those zones again, that row fails, and the fix is a page update.
- `kind` in a test is computed from `getDstTransitions`, never typed.

**Map**

- The projection is EPSG:3347: `geoConicConformal` with parallels 49 and 77, central meridian -91.866667 and origin 63.390675. The same projection is Statistics Canada's Lambert.
- The zone list comes from tzdb 2026e `zone.tab` rows whose country is `CA` (23), not `zone1970.tab`, whose Canadian rows include zones that span other countries. The comprehensive timezone-boundary-builder set gives each of these its own Canada-only shape.
- The zone list is the keyboard path and the single tab stop; shapes are `tabindex="-1"` buttons. Below 520 px the map is not drawn and the list stays.
- Classes are words and patterns (hatch, solid, dots), never colour alone.

**Boundary data and credits**

- Every boundary script pins timezone-boundary-builder `2026e`, and every boundary file names its source and carries `attribution`, `license` (`ODbL-1.0`) and `licenseUrl` members. The Canada file is under 400 KB.
- The credits button is a native `popover` button, closed by default, and nothing else shows on the page. On the Globe it is the fourth button of the control stack; on a map with no stack it is a glass square in the drawing's corner, where the land and the zone dots do not reach. The panel opens beside the stack or above the corner button, inside the viewport at 375 px and never over a control. No page carries a footer button.
- The credit text lives with the drawing, not in a footer line.

**Stored times and the audit**

- "Which stored times moved?" reads lines with the Dox Worker's rules, and the Stored Time Audit reads up to 12 lines with the browser's. They answer different questions, so each row links to the audit with that line as its seed (a value over 80 characters gets no link). The section reuses the audit's pure helpers and not its day strip.
- Results are words; no colour carries a verdict, and no totals are shown, because a total would not be a library call.
- The results area has a fixed-height placeholder so the form never moves when results arrive.

**Registration**

- A new Dox tool is registered in every list of `context/dox/built.md` (chat starter, widget, Worker tool, permalink kind).

## Authority

- IANA tzdb `NEWS`, releases 2026b to 2026e, for the Canadian and Moroccan rule changes; tzdb 2026e `zone.tab` for the zone list.
- timezone-boundary-builder release 2026e and its ODbL 1.0 licence for the shapes.
- EPSG:3347 (IOGP registry) for the projection.
- RFC 6585 section 4 for 429; RFC 9110 section 10.2.3 for `Retry-After`; WHATWG HTML 4.10.22.8 for CR LF in form data; RFC 9557 section 4.1 for zone names.
