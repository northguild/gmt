# Slice 12 — every zone in Morocco's box, and a ready signal for the browser checks

Runs after slice 11.

## Every zone the Morocco map's box shows (owner's request)

The owner found Mali drawn as a bordered patch with no zone: "this is like a lost region on the
map". The Morocco map picks its zones by country (`MA EH DZ MR ES PT GI`), so land in the box
that belongs to another country is drawn as plain land, and where zone borders surround it, it
reads as a missing zone.

- **The rule.** The Morocco map draws every zone whose shape meets its land frame, so no land
  inside the box is left without a zone. Canada's map keeps its country rule: land outside Canada
  there is the United States and Greenland, and it reads as abroad.
- **The data.** In `prepare-region-boundaries.py`, a region may name `"countries": "frame"`
  (or an equivalent flag) instead of a list: it then takes every tbb zone whose shape meets
  `land_frame`. With tbb 2026e and the frame (-23, 19, 9, 45.5), that adds `Africa/Bamako`,
  `Africa/Niamey`, `Africa/Tunis`, `Europe/Andorra`, `Europe/Monaco`, `Europe/Paris` and
  `Europe/Rome` to today's ten. Drop any zone with no land left inside the drawn box after
  clipping, and say which in the script's output. Regenerate the boundary file and
  `morocco-region-zones.json` (with `coords` from zone1970.tab, as today), then format both with
  `oxfmt`. The formatted boundary file stays under 409,600 bytes; if it does not, raise the
  tolerance for the new zones only, never the limit.
- **Kinds.** The Worker classifies the new zones from the runtime's data as it does today:
  Mali, Niger and Tunisia never change clocks; France, Andorra, Monaco and Italy change both
  years, like Spain. The legend counts follow.
- **Everything that reads the zone list** accepts the new zones: the Worker's map rows, the
  chat's `zone` check (the registry's `validate` reads the zone file), the permalink pin, the
  keyboard zone list beside the map, and the second-config and boundary-data tests. Update any
  test that counts ten zones to read the file.
- **Labels.** The new zones get a passing label on hover, focus or pin, as other unlisted zones
  do. Check every anchor sits inside its zone's land and no two permanent labels overlap, at
  400 px and at 1440 px.
- **Credits.** `data-credits.ts` and the data-credits check list the regenerated file unchanged
  in licence (ODbL-1.0 for tbb, public domain for Natural Earth).

## A ready signal for the browser checks

The clock-still and saved-times scripts guess when the page is ready by matching readout text.
On a busy machine the module chunks, the library import and the routed fetch can be slow, and a
script that measures too soon reads `NO SIGNAL`.

- In both mounts, set `root.dataset.state = "ready"` right after the first `clocks.tick()` that
  has the Worker's answer. Set `"error"` where the mount shows its error state.
- In `canada-clock-still.mjs` and `canada-stored-still.mjs`: keep the fake clock installed and
  paused before `goto`; wait with `page.waitForFunction` for `data-state` to be `ready` (real
  time, 60 s, then fail with the state it saw); remove the fake-time polling loop.
- Route by method: the GET fixture for GET, a saved-times fixture for POST. Today both scripts
  answer every method with the GET fixture.
- `canada-stored-still.mjs` picks the route and zone with `PATH.includes("morocco")`, so any other
  path gets Canada's silently. Take the region from a lookup keyed by path that throws on an
  unknown path.
- `blockOffSite` (`gate-checks.mjs`) routes every request through a function matcher. Route only
  off-site URLs (a URL pattern or glob), so same-site chunks are not intercepted.
- An error answer must not move the page either. At 375 px the status line ("The check could not
  finish.") wraps under the Check again button and the browser card grows 35 px (both checkers).
  Reserve the status line's room in `.gmt-clockcheck-actions` and in the saved-times controls from
  the start, so the card is the same height before the answer, after it and after an error. Check
  with the GET answered 200, 503 and 429, held until a snapshot is taken, at 1440, 1024 and 375 px:
  no card above or below moves. Add an error-answer row to `canada-stored-still.mjs`.
- Run each script 20 times in a row under load (two other builds running) with no failure, and
  record the count in the slice's hand-back.

## The tense follows the date (owner's request)

Both checkers word the change as still to come ("Stops changing clocks in 2026"). Morocco's last
change was on 20 September 2026 at 02:00 local time, so its page is already wrong; Canada's zones
do not turn their clocks back on 1 November 2026, so its page goes wrong that day. Every sentence
about the change must read true on the day it is read.

- **The instant.** Each stopped zone states the instant its change takes effect, once, with its
  facts: Morocco's two zones `2026-09-20T01:00:00Z` (the 2026c `Zone` line); Canada's the moment
  its old data turned the clocks back on 1 November 2026 at 02:00 local time (Vancouver 09:00Z,
  Edmonton and Inuvik 08:00Z, Winnipeg 07:00Z). A test pins each instant with the library. A
  region's sentences flip at its latest zone instant.
- **One helper.** `changeTense(nowMs, atMs)` in the shared module returns `"before"` or `"after"`
  (at the instant is `"after"`). Each region's text gives both forms of every tensed phrase; no
  shared file holds region words.
- **Live text** (in the page and the chat widget): the map legend and kind labels ("Stops changing
  clocks on 1 November 2026" / "Stopped changing clocks on 1 November 2026"; Morocco "… on 20
  September 2026"; the date is the zone's local date), the key points of both regions, Canada's
  browser-card note ("the four zones that stop changing their clocks"), and any other text the
  mounts write about the change. "Still changes clocks" and "Never changes clocks" stay as they
  are. The server renders the form for the build time; the mount sets the form for the page's
  clock (the clocks' own time source) on load, and again on the tick that crosses the instant.
- **Nothing moves when the tense flips.** Render both forms in one grid cell, the inactive one
  `visibility: hidden` and `aria-hidden="true"`, so the box is always the longer form's.
- **Text that runs no code** (each page's opening sentence, `description`, the chat tool
  descriptions in `worker/tools.ts`'s docs, and every text surface built from them) uses dated
  wording true on any day: "From 1 November 2026, … stay on −07:00 all year"; "Since 20
  September 2026 at 02:00 local time, …".
- **Tests.** `changeTense` at the instant −1 ms, at it, and +1 ms. Each mount, both regions, with
  the clock before and after its instant: every tensed phrase shows the right form and only that
  form is in the accessibility tree. A guard test that no checker string outside the region
  text files contains "Stops changing" or "Stopped changing".
- **Browser check.** Each page with a fake clock a day before and a day after its instant
  (Canada 2026-10-31 and 2026-11-02, Morocco 2026-09-19 and 2026-10-23), light and dark, at 1440
  and 375 px: element screenshots of the key points and the map legend. Then hold the clock 2 s
  before the instant and let it cross: the text flips and no card moves.

## Small fixes

- `deploy-smoke.mjs:403` says "five calls to the `morocco:` bucket". The PUT gets 405 before the
  bucket counts, so state the real count.
- `morocco-2026-clock-change.mdx` and `morocco-key-points.ts` say "at 02:00": say "at 02:00 local
  time".
- The Node row of `morocco-runtime-minimums.ts`: if `nodejs/node#64588` is the pull request that
  brought tz 2026c to the release the row names, cite it beside the release notes; if it is not,
  leave the row alone.

## Checks

- As slice 11, plus: the Morocco map at 1440, 1024, 400 and 375 px in light and dark, with no
  land in the box left without a zone; the boundary-data, data-credits and second-config tests;
  `deploy-smoke.mjs` against a local Worker (`wrangler dev` on a port other than 8787).
