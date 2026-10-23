#!/usr/bin/env python3
"""
One-shot data-prep for a clock-change checker's map boundary polygons (CORE-88, CORE-89).

This script is NOT part of the dox build pipeline. Run it manually when the pinned
`timezone-boundary-builder` release or the tzdb release below changes:

    uv run --with shapely python apps/dox/scripts/prepare-region-boundaries.py --region canada
    uv run --with shapely python apps/dox/scripts/prepare-region-boundaries.py --region morocco

`--region` names a row of REGIONS: the zone.tab country codes (or `"frame"`), an optional map
frame, the simplify tolerance, the size budget, whether the zones file carries each zone's zone.tab
coordinate, and the two files it writes. Adding a region is adding a row.

Steps:
  1. Download `timezones.geojson.zip` from the pinned TBB_TAG release of
     https://github.com/evansiroky/timezone-boundary-builder (the comprehensive set,
     not the `-1970` one) and unzip `combined.json`.
  2. Read `zone.tab` from the pinned TZDB release of tzdata and keep every row whose
     country column is one of the region's codes (`CA` for Canada). Not `zone1970.tab`: its CA rows include
     America/Toronto (CA,BS), America/Panama, America/Puerto_Rico and America/Phoenix,
     whose shapes cover other countries, and tbb has no country outline to clip with.
     The comprehensive set gives each Canadian locality its own Canada-only feature.
     (The Canada reasoning; `zone1970.tab` is wrong for any region for the same reason.
     Morocco: it folds Mauritania into Africa/Abidjan, a shape that covers twelve countries.)
     A region with a frame also drops every zone whose shape does not meet the frame
     (a PT row such as Atlantic/Azores that lies outside it).
     A region whose countries are `"frame"` takes every zone.tab row, whatever its country, whose
     shape meets `land_frame`: the map then shows a zone for every piece of land in its box (Mali,
     France, Italy), never a bordered patch with none. `land_frame` is wider than the box, so a
     zone can meet it and still have no land inside the drawn box (Niger and Tunisia lie outside
     the Morocco box). The region's `box` row states the projection that draws the box, and the
     script drops every zone with no land inside it and names each one it drops.
  3. Download `ne_10m_land.geojson` from Natural Earth at the pinned NE_TAG
     (https://github.com/nvkelso/natural-earth-vector, public domain). The tbb shapes include
     each zone's territorial sea, which draws the Canaries and the Arctic islands as blobs and
     fills Hudson Bay; the land cuts every zone back to its coast.
  4. Clip the land and each zone to the region's `land_frame` (`shapely.clip_by_rect`), simplify
     both (topology preserved, winding fixed), snap them to a 0.001-degree grid, and intersect each
     zone with the land. The land the zones leave uncovered inside `land_frame` is one extra
     feature, written first, `{"land": "other"}`: Mali, France, the United States. It is the
     difference, never all the land, so no coastline is stored twice. Land parts under the
     region's `min_area` (square degrees) are dropped from the zones and from that feature.
     `land_frame` must cover the whole drawn box, so that no shape or land edge ends inside it.
     The file must stay under the region's budget.
  5. Write
       <region boundaries>  (FeatureCollection; the land feature, then one feature per zone, tzid only)
       <region zones>       ({ tzdb, zones: [...] }, sorted; plus `coords: { id: [lon, lat] }`
                             from zone.tab when the region asks for it)
     Canada: apps/dox/public/timezone-boundaries-canada.json and apps/dox/src/lib/canada-zones.json.
     Morocco: apps/dox/public/timezone-boundaries-morocco.json and
     apps/dox/src/lib/morocco-region-zones.json.

The boundary file is a derived database offered to the public, so it carries the ODbL
notice as RFC 7946 §6.1 foreign members, like the two sibling files.

The repo's formatter checks the output, so finish with
`pnpm exec oxfmt --write <the two files written>`
(the files roughly double when pretty-printed; re-check the formatted boundary file against the
region's formatted limit). If a file is over budget, raise the tolerance or `min_area`; never the budget.

For offline iteration, `--tbb-file` and `--land-file` read local copies of `combined.json` and
`ne_10m_land.geojson` instead of downloading them; the committed files come from the pinned tags.

Requires shapely. Exits non-zero if a selected id has no feature or the file is over budget.
"""

from __future__ import annotations

import argparse
import io
import math
import json
import os
import sys
import tarfile
import tempfile
import urllib.request
import zipfile
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]

# One row per region: the `zone.tab` country codes (or "frame", every row whose shape meets
# `land_frame`) and the two files the region writes.
# `frame` is (west, south, east, north) in degrees, or None: it only drops the zones whose shape
# misses it. `land_frame` (same order) clips the land and the zones and must cover the drawn box.
# `min_area` is in square degrees.
REGIONS = {
    "canada": {
        "countries": ["CA"],
        "frame": None,
        # The longitude/latitude bounds of the drawn box (800 by 640, fitted to the zones), rounded out.
        "land_frame": (-177, 34, -5, 85),
        "box": None,
        "min_area": 0.02,
        "tolerance": 0.08,
        "budget": 400 * 1024,  # compact bytes; oxfmt roughly doubles it, so re-check the formatted file
        "coords": False,
        "boundaries": REPO_ROOT / "apps/dox/public/timezone-boundaries-canada.json",
        "zones": REPO_ROOT / "apps/dox/src/lib/canada-zones.json",
    },
    "morocco": {
        # Every zone whose shape meets the drawn box, so no land in the box is left without a zone.
        "countries": "frame",
        "frame": None,
        # The longitude/latitude bounds of the drawn box, rounded out. The box is the frame
        # (-19, 20.5, 5, 44.5) projected, so in the conic its sides lie 3.7 degrees outside it.
        "land_frame": (-23, 19, 9, 45.5),
        # The drawn box: the frame (west, south, east, north) fitted to an 800 by 860 drawing in a
        # Lambert conformal conic (`moroccoProjection` in `morocco-map.ts`, the same numbers: standard
        # parallels, central meridian, latitude of origin). `morocco-map.test.ts` checks that every
        # zone has land inside the box that code draws.
        "box": {
            "frame": (-19, 20.5, 5, 44.5),
            "parallels": (24.5, 40.5),
            "central_meridian": -7,
            "origin_lat": 32.5,
            "size": (800, 860),
        },
        "min_area": 0,
        "tolerance": 0.005,
        "budget": 300 * 1024,  # the formatted file must stay under 400 KB (409600 bytes)
        "coords": True,
        "boundaries": REPO_ROOT / "apps/dox/public/timezone-boundaries-morocco.json",
        "zones": REPO_ROOT / "apps/dox/src/lib/morocco-region-zones.json",
    },
}

NE_TAG = "v5.1.2"
TBB_TAG = "2026e"
TZDB = "2026e"

RELEASE_URL = (
    "https://github.com/evansiroky/timezone-boundary-builder/releases/download/"
    f"{TBB_TAG}/timezones.geojson.zip"
)
LAND_URL = (
    "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/"
    f"{NE_TAG}/geojson/ne_10m_land.geojson"
)
TZDATA_URL = f"https://data.iana.org/time-zones/releases/tzdata{TZDB}.tar.gz"

# The ODbL notice (ODbL 1.0 §4.2-4.4), as GeoJSON foreign members. Wording follows
# the timezone-boundary-builder README § Licenses at tag TBB_TAG.
NOTICE = {
    "source": f"timezone-boundary-builder {TBB_TAG}, timezones.geojson.zip",
    "attribution": "© OpenStreetMap contributors, timezone-boundary-builder",
    "license": "ODbL-1.0",
    "licenseUrl": "https://opendatacommons.org/licenses/odbl/1-0/",
    "landSource": f"Natural Earth {NE_TAG}, ne_10m_land (public domain)",
}

COORD_DECIMALS = 3
GRID = 10**-COORD_DECIMALS


def download_combined() -> dict:
    with tempfile.TemporaryDirectory() as tmp:
        zip_path = os.path.join(tmp, "timezones.geojson.zip")
        print(f"Downloading {RELEASE_URL} ...")
        urllib.request.urlretrieve(RELEASE_URL, zip_path)
        with zipfile.ZipFile(zip_path) as zf:
            with zf.open("combined.json") as f:
                return json.load(f)


def download_land() -> dict:
    print(f"Downloading {LAND_URL} ...")
    with urllib.request.urlopen(LAND_URL) as resp:
        return json.load(resp)


def load_json(path: str) -> dict:
    with open(path) as f:
        return json.load(f)


def parse_iso6709(text: str) -> tuple[float, float]:
    """zone.tab's `+DDMM+DDDMM` or `+DDMMSS+DDDMMSS` as (lon, lat) in decimal degrees."""
    split = max(text.rfind("+"), text.rfind("-"))
    lat_text, lon_text = text[:split], text[split:]

    def one(part: str, degree_digits: int) -> float:
        sign = -1.0 if part[0] == "-" else 1.0
        digits = part[1:]
        degrees = int(digits[:degree_digits])
        minutes = int(digits[degree_digits : degree_digits + 2])
        seconds = int(digits[degree_digits + 2 :] or 0)
        return sign * (degrees + minutes / 60 + seconds / 3600)

    return (round(one(lon_text, 3), COORD_DECIMALS), round(one(lat_text, 2), COORD_DECIMALS))


def region_zone_rows(countries: list[str] | str) -> dict[str, tuple[float, float]]:
    print(f"Downloading {TZDATA_URL} ...")
    with urllib.request.urlopen(TZDATA_URL) as resp:
        data = resp.read()
    with tarfile.open(fileobj=io.BytesIO(data), mode="r:gz") as tar:
        member = tar.extractfile("zone.tab")
        if member is None:
            raise SystemExit("zone.tab is not in the tzdata archive")
        text = member.read().decode("utf-8")
    rows = {}
    for line in text.splitlines():
        if not line or line.startswith("#"):
            continue
        cols = line.split("\t")
        if countries == "frame" or cols[0] in countries:
            rows[cols[2]] = parse_iso6709(cols[1])
    return rows


def drawn_box(spec: dict):
    """The geographic outline (a shapely polygon) of the drawn box: the frame fitted into the
    drawing's size in a spherical Lambert conformal conic, as d3's `geoConicConformal` does, then
    the drawing's rectangle taken back to longitude and latitude."""
    from shapely.geometry import Polygon

    west, south, east, north = spec["frame"]
    y0, y1 = (math.radians(p) for p in spec["parallels"])
    lam0 = math.radians(spec["central_meridian"])
    n = math.log(math.cos(y0) / math.cos(y1)) / math.log(
        math.tan((math.pi / 2 + y1) / 2) / math.tan((math.pi / 2 + y0) / 2)
    )
    f = math.cos(y0) * math.tan(math.pi / 4 + y0 / 2) ** n / n

    def forward(lon: float, lat: float) -> tuple[float, float]:
        r = f / math.tan((math.pi / 2 + math.radians(lat)) / 2) ** n
        a = n * (math.radians(lon) - lam0)
        return (r * math.sin(a), f - r * math.cos(a))  # y up

    def inverse(x: float, y: float) -> tuple[float, float]:
        r = math.copysign(math.hypot(x, f - y), n)
        a = math.atan2(x, abs(f - y)) * (1 if f - y > 0 else -1)
        return (
            math.degrees(a / n + lam0),
            math.degrees(2 * math.atan((f / r) ** (1 / n)) - math.pi / 2),
        )

    # The frame's edges, sampled every half degree, as the TypeScript fit does.
    edge = []
    k = 0
    while west + 0.5 * k <= east:
        edge += [forward(west + 0.5 * k, south), forward(west + 0.5 * k, north)]
        k += 1
    k = 0
    while south + 0.5 * k <= north:
        edge += [forward(west, south + 0.5 * k), forward(east, south + 0.5 * k)]
        k += 1
    xs, ys = [p[0] for p in edge], [p[1] for p in edge]
    width, height = spec["size"]
    scale = min(width / (max(xs) - min(xs)), height / (max(ys) - min(ys)))
    cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    half_w, half_h = width / scale / 2, height / scale / 2
    steps = 200
    ring = []
    for i in range(steps):  # west, north, east, south sides
        t = i / steps
        ring.append(inverse(cx - half_w + 2 * half_w * t, cy + half_h))
    for i in range(steps):
        t = i / steps
        ring.append(inverse(cx + half_w, cy + half_h - 2 * half_h * t))
    for i in range(steps):
        t = i / steps
        ring.append(inverse(cx + half_w - 2 * half_w * t, cy - half_h))
    for i in range(steps):
        t = i / steps
        ring.append(inverse(cx - half_w, cy - half_h + 2 * half_h * t))
    return Polygon(ring)


def polygons(geom) -> list:
    """The areas of any shapely result, flattened: clips and intersections can leave stray lines
    and points, or a GeometryCollection."""
    from shapely.geometry import Polygon

    if geom.is_empty:
        return []
    if isinstance(geom, Polygon):
        return [geom]
    return [p for part in getattr(geom, "geoms", []) for p in polygons(part)]


def prepare(geom, clip: tuple, tolerance: float):
    """Clip to `clip`, simplify (topology preserved) and snap to the output grid."""
    from shapely import clip_by_rect, make_valid, set_precision
    from shapely.geometry import MultiPolygon

    parts = polygons(clip_by_rect(make_valid(geom), *clip))
    if not parts:
        return MultiPolygon()
    shape = MultiPolygon(parts).simplify(tolerance, preserve_topology=True)
    return make_valid(set_precision(shape, GRID))


def finish(geom, min_area: float) -> dict | None:
    """Drop the parts under `min_area`, fix winding (d3-geo wants clockwise exteriors, as the
    globe script does) and return GeoJSON, or None when nothing is left."""
    from shapely.geometry import MultiPolygon, mapping
    from shapely.geometry.polygon import orient

    parts = [p for p in polygons(geom) if p.area >= min_area]
    if not parts:
        return None
    s = parts[0] if len(parts) == 1 else MultiPolygon(parts)
    s = MultiPolygon([orient(p, sign=-1.0) for p in polygons(s)]) if len(parts) > 1 else orient(s, sign=-1.0)
    out = mapping(s)
    out["coordinates"] = round_coords(out["coordinates"])
    return out


def round_coords(node):
    if isinstance(node, (list, tuple)):
        if node and isinstance(node[0], (int, float)):
            return [round(c, COORD_DECIMALS) for c in node]
        return [round_coords(n) for n in node]
    return node


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[1])
    parser.add_argument("--region", required=True, choices=sorted(REGIONS))
    parser.add_argument("--tbb-file", help="a local combined.json, instead of the download")
    parser.add_argument("--land-file", help="a local ne_10m_land.geojson, instead of the download")
    args = parser.parse_args()
    region = REGIONS[args.region]
    boundaries_path: Path = region["boundaries"]
    zones_path: Path = region["zones"]

    rows = region_zone_rows(region["countries"])
    ids = sorted(rows)
    named = region["countries"] if region["countries"] == "frame" else ",".join(region["countries"])
    print(f"zone.tab {TZDB}: {len(ids)} rows" + ("" if named == "frame" else f" with country {named}"))
    tolerance: float = region["tolerance"]
    budget: int = region["budget"]
    frame = region["frame"]
    land_frame = region["land_frame"]
    min_area: float = region["min_area"]
    from shapely import make_valid
    from shapely.geometry import box, shape
    from shapely.ops import unary_union

    data = load_json(args.tbb_file) if args.tbb_file else download_combined()
    by_tzid = {
        f["properties"]["tzid"]: f
        for f in data["features"]
        if f.get("properties", {}).get("tzid")
    }
    missing = [z for z in ids if z not in by_tzid]
    if missing:
        print(f"ERROR: no feature for {missing}", file=sys.stderr)
        return 1
    if region["countries"] == "frame":
        land_box = box(*land_frame)
        outside = [z for z in ids if not shape(by_tzid[z]["geometry"]).intersects(land_box)]
        print(f"Zones whose shape meets the land frame {land_frame}: {len(ids) - len(outside)} of {len(ids)} rows")
        ids = [z for z in ids if z not in outside]
    elif frame is not None:
        frame_box = box(*frame)
        outside = [z for z in ids if not shape(by_tzid[z]["geometry"]).intersects(frame_box)]
        if outside:
            print(f"Dropped (shape does not meet the frame): {outside}")
        ids = [z for z in ids if z not in outside]

    box_outline = drawn_box(region["box"]) if region["box"] else None

    land_data = load_json(args.land_file) if args.land_file else download_land()
    land = prepare(
        unary_union([make_valid(shape(f["geometry"])) for f in land_data["features"]]),
        land_frame,
        tolerance,
    )

    zone_shapes = {}
    for tzid in ids:
        zone = prepare(shape(by_tzid[tzid]["geometry"]), land_frame, tolerance)
        zone_shapes[tzid] = make_valid(zone.intersection(land))

    # The land no zone of the region covers. The difference, not all the land.
    other = make_valid(land.difference(unary_union(list(zone_shapes.values()))))
    other_geom = finish(other, min_area)
    if other_geom is None:
        print("ERROR: no land is left outside the zones", file=sys.stderr)
        return 1
    features = [
        {"type": "Feature", "properties": {"land": "other"}, "geometry": other_geom}
    ]
    dropped = []
    for tzid in list(ids):
        geom = finish(zone_shapes[tzid], min_area)
        if geom is not None and box_outline is not None:
            # A zone whose land lies wholly outside the drawn box has nothing to draw.
            if zone_shapes[tzid].intersection(box_outline).area <= 0:
                geom = None
        if geom is None:
            if region["countries"] != "frame":
                print(f"ERROR: {tzid} is empty after clipping to the land", file=sys.stderr)
                return 1
            dropped.append(tzid)
            ids.remove(tzid)
            continue
        features.append(
            {"type": "Feature", "properties": {"tzid": tzid}, "geometry": geom}
        )

    if dropped:
        print(f"Dropped (no land left inside the drawn box after clipping): {dropped}")
    out = {"type": "FeatureCollection", **NOTICE, "features": features}
    boundaries_path.parent.mkdir(parents=True, exist_ok=True)
    with open(boundaries_path, "w") as f:
        json.dump(out, f, separators=(",", ":"), ensure_ascii=False)
    size = os.path.getsize(boundaries_path)
    print(
        f"Wrote {boundaries_path} — {len(features) - 1} zones and the land, {size} bytes "
        f"(tolerance {tolerance} deg, min_area {min_area}, budget {budget})"
    )

    zones_out: dict = {"tzdb": TZDB, "zones": ids}
    if region["coords"]:
        zones_out["coords"] = {z: list(rows[z]) for z in ids}
    with open(zones_path, "w") as f:
        json.dump(zones_out, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print(f"Wrote {zones_path}")

    if size > budget:
        print(f"ERROR: {size} bytes is over the {budget} budget", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
