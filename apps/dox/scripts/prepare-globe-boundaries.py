#!/usr/bin/env python3
"""
One-shot data-prep for the DOX-E1a globe's timezone-boundary demarcation.

This script is NOT part of the dox build pipeline. Run it manually when the
upstream `timezone-boundary-builder` dataset is updated and you want to refresh
`apps/dox/public/timezone-boundaries-globe.json`.

Unlike `prepare-timezone-boundaries.py` (which keeps only the 10 CI-matrix zones
at high fidelity for the flat `TimezoneMap`), this keeps *every* zone but
simplifies hard — the globe renders at a few hundred CSS pixels and spins, so
~0.2 degree (~22 km) polygons read as clean borders while keeping the asset
small enough to fetch lazily after the globe is already interactive.

Steps:
  1. Download the latest `timezones.geojson.zip` release from
     https://github.com/evansiroky/timezone-boundary-builder
  2. Simplify every polygon with shapely at SIMPLIFY_TOLERANCE_DEG,
     preserving topology.
  3. Write a compact FeatureCollection of `{ properties: { tzid }, geometry }`
     to apps/dox/public/timezone-boundaries-globe.json

The globe maps IANA ids to these `tzid` values verbatim, except `UTC` -> `Etc/UTC`
(the dataset uses the latter). Zones with no boundary polygon simply get no
demarcation outline; the globe still plots and clocks them.

Requires: `uv run --with shapely python scripts/prepare-globe-boundaries.py`
(or any venv with shapely installed). tzdb / the boundary builder release
several times a year — this is not a one-time import.
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
OUTPUT_PATH = REPO_ROOT / "apps/dox/public/timezone-boundaries-globe.json"

RELEASE_URL = (
    "https://github.com/evansiroky/timezone-boundary-builder/releases/latest/"
    "download/timezones.geojson.zip"
)

SIMPLIFY_TOLERANCE_DEG = 0.2


def download_combined() -> dict:
    with tempfile.TemporaryDirectory() as tmp:
        zip_path = os.path.join(tmp, "timezones.geojson.zip")
        print(f"Downloading {RELEASE_URL} ...")
        urllib.request.urlretrieve(RELEASE_URL, zip_path)
        with zipfile.ZipFile(zip_path) as zf:
            with zf.open("combined.json") as f:
                return json.load(f)


# Drop polygon parts smaller than this after simplification — over-simplified
# slivers (degenerate 3-4 point rings) otherwise render as visual noise.
MIN_PART_AREA_DEG2 = 0.02


def clean_geometry(geom):
    """Make a geometry safe for a d3-geo orthographic canvas fill.

    Two fixes:
      * **Winding.** d3-geo's convention is the *opposite* of GeoJSON's — it
        wants clockwise exterior rings (same as `world-atlas`). The upstream
        dataset mixes both windings, and shapely's `simplify()` does not
        preserve orientation, so a wrongly-wound ring makes d3 fill the whole
        visible hemisphere. `orient(..., sign=-1.0)` forces CW exteriors.
      * **Slivers.** Simplifying at ~0.2 deg collapses tiny exclaves to
        near-zero-area triangles; drop them.
    """
    from shapely.geometry import MultiPolygon, Polygon
    from shapely.geometry.polygon import orient

    def keep(poly: "Polygon") -> bool:
        return poly.area >= MIN_PART_AREA_DEG2

    if isinstance(geom, Polygon):
        return orient(geom, sign=-1.0)
    if isinstance(geom, MultiPolygon):
        parts = [orient(p, sign=-1.0) for p in geom.geoms if keep(p)]
        if not parts:
            # Everything was a sliver — keep the largest so the zone still shows.
            parts = [orient(max(geom.geoms, key=lambda p: p.area), sign=-1.0)]
        return MultiPolygon(parts)
    return geom


def main() -> int:
    from shapely.geometry import mapping, shape

    data = download_combined()
    features: list[dict] = []
    for feat in data["features"]:
        tzid = feat.get("properties", {}).get("tzid")
        if not tzid:
            continue
        geom = shape(feat["geometry"]).simplify(
            SIMPLIFY_TOLERANCE_DEG, preserve_topology=True
        )
        if geom.is_empty:
            print(f"  skipping {tzid} (empty after simplify)")
            continue
        features.append(
            {
                "type": "Feature",
                "properties": {"tzid": tzid},
                "geometry": mapping(clean_geometry(geom)),
            }
        )

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    out = {"type": "FeatureCollection", "features": features}
    with open(OUTPUT_PATH, "w") as f:
        json.dump(out, f, separators=(",", ":"))
    print(
        f"Wrote {OUTPUT_PATH} — {len(features)} zones, "
        f"{os.path.getsize(OUTPUT_PATH)} bytes"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
