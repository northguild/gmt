# Slice 2 — boundary-data: US zone shapes, state shapes, zone list

Index: [index.md](index.md). Read `apps/dox/scripts/prepare-region-boundaries.py` from the top:
its docstring is the runbook. Also read the boundary-file runbook in
[built.md](../../../dox/built.md), in the CORE-89 and Morocco sections.

## A `us` row in `REGIONS`

| Key | Value | Why |
| --- | ----- | --- |
| `countries` | `["US", "AS", "GU", "MP", "PR", "UM", "VI"]` | the `zone.tab` codes. UM gives Midway and Wake, which are kept in the zone list and dropped from the drawing (see below) |
| `frame` | `None` | the composite projection draws parts, not one box |
| `land_frame` | `None` (new: no single box). Cut land per part instead | the land feature is cut to the parts' bounding boxes, from the table in [feature-map-kit.md](feature-map-kit.md) |
| `box` | `None` | |
| `min_area`, `tolerance` | start at `0.01`, `0.02`. Tune until the budget holds | the lower 48 need more detail than Canada's north |
| `budget` | `300 * 1024` compact | the formatted file must stay under 400 KB (409,600 bytes) |
| `coords` | `True` | ring markers for small zones (Metlakatla, Pago Pago, Guam, Saipan, St Thomas) |
| `boundaries` | `apps/dox/public/timezone-boundaries-us.json` | zones layer |
| `zones` | `apps/dox/src/lib/us-region-zones.json` | the page's, Worker's and tool schema's zone list |

Keep `NE_TAG = "v5.1.2"`, `TBB_TAG = "2026e"` and `TZDB = "2026e"`. Release 2026f changed Cuba
only, and a bump would rebuild the other regions' files for no change. If a later release
changes a US zone, phase 2 bumps the pin.

**Midway and Wake.** Keep both in the file's `zones` list, and also name them in a new
`"undrawn": ["Pacific/Midway", "Pacific/Wake"]` key. The file otherwise keeps the existing shape
(`tzdb`, `zones`, `coords`). Leave the two zones out of the boundary file. The list shows them,
and the caption under the map explains why.

**Links.** `America/St_Thomas` is a `zone.tab` row but a link in the tz database. Keep the
`zone.tab` name, as the script does for every region. If tbb has no feature under that name,
the script fails loudly and the builder reports it. Do not substitute `America/Puerto_Rico`
silently.

## The state layer (new output)

Add a second output for this row only, behind a new optional row key, `"states"`:

```py
"states": {
    "admin1": "ne_10m_admin_1_states_provinces",  # adm0_a3 == "USA": 50 states + DC
    "admin0": ["PRI", "VIR", "GUM", "MNP", "ASM"],  # ne_10m_admin_0_countries, by adm0_a3
    "key": "postal",  # NE's two-letter code; admin-0 rows get PR, VI, GU, MP, AS
    "out": REPO_ROOT / "apps/dox/public/state-boundaries-us.json",
},
```

- Fetch both layers from `natural-earth-vector` at `NE_TAG`, the same way `LAND_URL` is
  fetched.
- Keep only `{ postal, name }` as properties. Take `name` from NE's `name` field.
- Simplify with the row's tolerance and write it formatted with oxfmt, like the zone file. The
  budget is 300 KB compact.
- Natural Earth is public domain, so the file carries no ODbL notice. Add the foreign member
  `"source": "Natural Earth 5.1.2 admin-0 and admin-1, public domain"`.
- 56 features in all: 50 states, DC and five territories. Assert the count in the script and
  stop with an error otherwise.

## Credits — `apps/dox/src/lib/data-credits.ts`

- Add `STATE_BOUNDARIES`, a Natural Earth entry: "State and territory outlines: Natural Earth
  5.1.2, public domain".
- The Sunshine Protection Act page's credits list `TZ_BOUNDARIES` (ODbL), `COASTLINES` and `STATE_BOUNDARIES`.
- Extend `data-credits.test.ts` so the new entry is linked and labelled.

## `scripts/boundary-data.test.ts` (extend)

Add US point checks, read from the committed files with no network:

| Point `[lon, lat]` | File | Expected |
| ------------------ | ---- | -------- |
| Window Rock `[-109.05, 35.67]` | zones | `America/Denver` (Navajo Nation) |
| Phoenix `[-112.07, 33.45]` | zones | `America/Phoenix` |
| Second Mesa, Hopi `[-110.50, 35.80]` | zones | `America/Phoenix` |
| Indianapolis `[-86.16, 39.77]` | zones | `America/Indiana/Indianapolis` |
| Honolulu `[-157.86, 21.31]` | zones | `Pacific/Honolulu` |
| San Juan `[-66.11, 18.47]` | zones | `America/Puerto_Rico` |
| Boise `[-116.20, 43.62]` | states | `ID` |
| Wilmington `[-75.55, 39.75]` | states | `DE` |
| Pago Pago `[-170.70, -14.28]` | states | `AS` |

Also assert:

- every feature in the zone file is an id in `zones` that is not in `undrawn`, and every such
  id has a feature;
- the zone file starts with the land feature;
- both files are under 409,600 bytes.

## Runbook

```sh
eval "$(fnm env)" && fnm use
cd apps/dox && python3 scripts/prepare-region-boundaries.py --region us
pnpm exec oxfmt public/timezone-boundaries-us.json public/state-boundaries-us.json src/lib/us-region-zones.json
```

The script downloads once into its cache and writes the three files. Commit-ready output is
formatted. Re-running the script for `canada` and `morocco` must leave their files unchanged:
run both and check `git diff --stat`, which is read-only.

## Done when

- The three files exist, are formatted and are within budget.
- The point table passes.
- Canada and Morocco outputs are unchanged.
- The credits test passes.
