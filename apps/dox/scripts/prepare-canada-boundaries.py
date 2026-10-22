#!/usr/bin/env python3
"""
One-shot data-prep for the Canada clock-change map's boundary polygons (CORE-88).

This script is NOT part of the dox build pipeline. Run it manually when the pinned
`timezone-boundary-builder` release or the tzdb release below changes:

    uv run --with shapely python scripts/prepare-canada-boundaries.py

Steps:
  1. Download `timezones.geojson.zip` from the pinned TBB_TAG release of
     https://github.com/evansiroky/timezone-boundary-builder (the comprehensive set,
     not the `-1970` one) and unzip `combined.json`.
  2. Read `zone.tab` from the pinned TZDB release of tzdata and keep every row whose
     country column is exactly `CA`. Not `zone1970.tab`: its CA rows include
     America/Toronto (CA,BS), America/Panama, America/Puerto_Rico and America/Phoenix,
     whose shapes cover other countries, and tbb has no country outline to clip with.
     The comprehensive set gives each Canadian locality its own Canada-only feature.
  3. Simplify each kept polygon with shapely (winding fix, topology preserved),
     coordinates rounded to 3 decimals. The file must stay under SIZE_BUDGET_BYTES.
  4. Write
       apps/dox/public/timezone-boundaries-canada.json  (FeatureCollection, tzid only)
       apps/dox/src/lib/canada-zones.json               ({ tzdb, zones: [...] }, sorted)

The boundary file is a derived database offered to the public, so it carries the ODbL
notice as RFC 7946 §6.1 foreign members, like the two sibling files.

The repo's formatter checks the output, so finish with
`pnpm exec oxfmt --write apps/dox/public/timezone-boundaries*.json apps/dox/src/lib/canada-zones.json`
(the files roughly double when pretty-printed; re-check the Canada file is still under budget).

Requires shapely. Exits non-zero if a selected id has no feature or the file is over budget.
"""

from __future__ import annotations

import io
import json
import os
import sys
import tarfile
import tempfile
import urllib.request
import zipfile
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
BOUNDARIES_PATH = REPO_ROOT / "apps/dox/public/timezone-boundaries-canada.json"
ZONES_PATH = REPO_ROOT / "apps/dox/src/lib/canada-zones.json"

TBB_TAG = "2026e"
TZDB = "2026e"

RELEASE_URL = (
    "https://github.com/evansiroky/timezone-boundary-builder/releases/download/"
    f"{TBB_TAG}/timezones.geojson.zip"
)
TZDATA_URL = f"https://data.iana.org/time-zones/releases/tzdata{TZDB}.tar.gz"

# The ODbL notice (ODbL 1.0 §4.2-4.4), as GeoJSON foreign members. Wording follows
# the timezone-boundary-builder README § Licenses at tag TBB_TAG.
NOTICE = {
    "source": f"timezone-boundary-builder {TBB_TAG}, timezones.geojson.zip",
    "attribution": "© OpenStreetMap contributors, timezone-boundary-builder",
    "license": "ODbL-1.0",
    "licenseUrl": "https://opendatacommons.org/licenses/odbl/1-0/",
}

SIMPLIFY_TOLERANCE_DEG = 0.02
COORD_DECIMALS = 3
SIZE_BUDGET_BYTES = 400 * 1024  # compact bytes; oxfmt roughly doubles it, so re-check the formatted file


def download_combined() -> dict:
    with tempfile.TemporaryDirectory() as tmp:
        zip_path = os.path.join(tmp, "timezones.geojson.zip")
        print(f"Downloading {RELEASE_URL} ...")
        urllib.request.urlretrieve(RELEASE_URL, zip_path)
        with zipfile.ZipFile(zip_path) as zf:
            with zf.open("combined.json") as f:
                return json.load(f)


def canadian_zone_ids() -> list[str]:
    print(f"Downloading {TZDATA_URL} ...")
    with urllib.request.urlopen(TZDATA_URL) as resp:
        data = resp.read()
    with tarfile.open(fileobj=io.BytesIO(data), mode="r:gz") as tar:
        member = tar.extractfile("zone.tab")
        if member is None:
            raise SystemExit("zone.tab is not in the tzdata archive")
        text = member.read().decode("utf-8")
    ids = []
    for line in text.splitlines():
        if not line or line.startswith("#"):
            continue
        cols = line.split("\t")
        if cols[0] == "CA":
            ids.append(cols[2])
    return sorted(ids)


def simplify(geom: dict) -> dict | None:
    """Simplify and fix winding (d3-geo wants clockwise exteriors), as the globe script does."""
    from shapely.geometry import MultiPolygon, Polygon, mapping, shape
    from shapely.geometry.polygon import orient

    s = shape(geom).simplify(SIMPLIFY_TOLERANCE_DEG, preserve_topology=True)
    if s.is_empty:
        return None
    if isinstance(s, Polygon):
        s = orient(s, sign=-1.0)
    elif isinstance(s, MultiPolygon):
        s = MultiPolygon([orient(p, sign=-1.0) for p in s.geoms])
    return mapping(s)


def round_coords(node):
    if isinstance(node, (list, tuple)):
        if node and isinstance(node[0], (int, float)):
            return [round(c, COORD_DECIMALS) for c in node]
        return [round_coords(n) for n in node]
    return node


def main() -> int:
    ids = canadian_zone_ids()
    print(f"zone.tab {TZDB}: {len(ids)} rows with country CA")

    data = download_combined()
    by_tzid = {
        f["properties"]["tzid"]: f
        for f in data["features"]
        if f.get("properties", {}).get("tzid")
    }
    missing = [z for z in ids if z not in by_tzid]
    if missing:
        print(f"ERROR: no feature for {missing}", file=sys.stderr)
        return 1

    features = []
    for tzid in ids:
        geom = simplify(by_tzid[tzid]["geometry"])
        if geom is None:
            print(f"ERROR: {tzid} is empty after simplify", file=sys.stderr)
            return 1
        geom["coordinates"] = round_coords(geom["coordinates"])
        features.append(
            {"type": "Feature", "properties": {"tzid": tzid}, "geometry": geom}
        )

    out = {"type": "FeatureCollection", **NOTICE, "features": features}
    BOUNDARIES_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(BOUNDARIES_PATH, "w") as f:
        json.dump(out, f, separators=(",", ":"), ensure_ascii=False)
    size = os.path.getsize(BOUNDARIES_PATH)
    print(
        f"Wrote {BOUNDARIES_PATH} — {len(features)} zones, {size} bytes "
        f"(tolerance {SIMPLIFY_TOLERANCE_DEG} deg, budget {SIZE_BUDGET_BYTES})"
    )

    with open(ZONES_PATH, "w") as f:
        json.dump({"tzdb": TZDB, "zones": ids}, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print(f"Wrote {ZONES_PATH}")

    if size > SIZE_BUDGET_BYTES:
        print(f"ERROR: {size} bytes is over the {SIZE_BUDGET_BYTES} budget", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
