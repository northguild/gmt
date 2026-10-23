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
- Run each script 20 times in a row under load (two other builds running) with no failure, and
  record the count in the slice's hand-back.

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
