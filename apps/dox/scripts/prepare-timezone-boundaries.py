#!/usr/bin/env python3
"""
One-shot data-prep for the timezone-map boundary polygons.

This script is NOT part of the dox build pipeline. Run it manually when the
upstream `timezone-boundary-builder` dataset is updated and you want to
refresh `apps/dox/public/timezone-boundaries.json`.

Steps:
  1. Download the latest `timezones.geojson.zip` release from
     https://github.com/evansiroky/timezone-boundary-builder
  2. Extract `combined.json` and filter to the 10 timezones the gmt
     test suite covers (see TIMEZONES below).
  3. Map `UTC` -> `Etc/UTC` (the boundary dataset uses the latter).
  4. Douglas-Peucker-simplify each polygon with shapely at 0.02 deg
     (~2.2 km at the equator) to keep the asset small.
  5. Write the filtered FeatureCollection to
     `apps/dox/public/timezone-boundaries.json`.

Requires: `uv run --with shapely python scripts/prepare-timezone-boundaries.py`
(or any venv with shapely installed).
"""

from __future__ import annotations

import json
import os
import sys
import tempfile
import urllib.request
import zipfile
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
OUTPUT_PATH = (
    REPO_ROOT / "apps/dox/public/timezone-boundaries.json"
)

RELEASE_URL = (
    "https://github.com/evansiroky/timezone-boundary-builder/releases/latest/"
    "download/timezones.geojson.zip"
)

# IANA IDs in apps/dox/src/lib/timezones.ts mapped to the tzid values used
# in the boundary dataset (UTC -> Etc/UTC, the rest match verbatim).
TIMEZONES = {
    "Pacific/Niue": "Pacific/Niue",
    "America/New_York": "America/New_York",
    "UTC": "Etc/UTC",
    "Europe/London": "Europe/London",
    "Asia/Kolkata": "Asia/Kolkata",
    "Asia/Kathmandu": "Asia/Kathmandu",
    "Asia/Shanghai": "Asia/Shanghai",
    "Australia/Lord_Howe": "Australia/Lord_Howe",
    "Pacific/Chatham": "Pacific/Chatham",
    "Pacific/Apia": "Pacific/Apia",
}
WANTED = set(TIMEZONES.values())

SIMPLIFY_TOLERANCE_DEG = 0.02


def download_combined() -> dict:
    with tempfile.TemporaryDirectory() as tmp:
        zip_path = os.path.join(tmp, "timezones.geojson.zip")
        print(f"Downloading {RELEASE_URL} ...")
        urllib.request.urlretrieve(RELEASE_URL, zip_path)
        with zipfile.ZipFile(zip_path) as zf:
            with zf.open("combined.json") as f:
                return json.load(f)


def filter_features(data: dict) -> list[dict]:
    return [f for f in data["features"] if f["properties"].get("tzid") in WANTED]


def simplify(geom: dict) -> dict | None:
    from shapely.geometry import shape, mapping

    if geom["type"] == "Polygon":
        rings = [r for r in geom["coordinates"] if len(r) >= 4]
        if not rings:
            return None
        s = shape({"type": "Polygon", "coordinates": rings})
    elif geom["type"] == "MultiPolygon":
        polys = [p for p in geom["coordinates"] if any(len(r) >= 4 for r in p)]
        if not polys:
            return None
        s = shape({"type": "MultiPolygon", "coordinates": polys})
    else:
        return geom

    s = s.simplify(SIMPLIFY_TOLERANCE_DEG, preserve_topology=True)
    if s.is_empty:
        return None
    return mapping(s)


def main() -> int:
    data = download_combined()
    features = filter_features(data)
    print(f"Kept {len(features)} of {len(data['features'])} features")

    seen: set[str] = set()
    for feat in features:
        new_geom = simplify(feat["geometry"])
        if new_geom is None:
            print(f"  skipping {feat['properties']['tzid']} (empty after simplify)")
            continue
        feat["geometry"] = new_geom
        seen.add(feat["properties"]["tzid"])

    missing = WANTED - seen
    if missing:
        print(f"WARNING: missing timezones in dataset: {sorted(missing)}", file=sys.stderr)

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    out = {"type": "FeatureCollection", "features": features}
    with open(OUTPUT_PATH, "w") as f:
        json.dump(out, f, separators=(",", ":"))
    print(f"Wrote {OUTPUT_PATH} ({os.path.getsize(OUTPUT_PATH)} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
