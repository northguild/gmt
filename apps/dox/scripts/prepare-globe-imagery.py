#!/usr/bin/env python3
"""
One-shot data-prep for the DOX-E1d globe imagery (#293).

This script is NOT part of the dox build pipeline. Run it manually to rebuild
`apps/dox/public/earth-blue-marble.webp`, the Earth imagery the WebGPU globe
wraps around the sphere. The canvas-2D fallback never downloads it.

Source
------
NASA Earth Observatory, "Blue Marble: Next Generation with Topography and
Bathymetry", July 2004, the 5400x2700 (8 km/pixel) global JPEG:

    https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73751/
        world.topo.bathy.200407.3x5400x2700.jpg

Imagery by Reto Stöckli, NASA Earth Observatory (NASA Goddard Space Flight
Center). July, because the northern hemisphere holds most of the zones the
globe plots and is free of snow then.

Licence
-------
Public domain in the United States: a work of the US Government carries no
copyright there (17 U.S.C. § 105), and NASA's media guidelines say its content
"generally [is] not subject to copyright in the United States". The same
guidelines ask that "NASA should be acknowledged as the source of the
material". That is a request, not a condition of use; the site honours it with
one line at the foot of the Why GMT page (src/content/docs/why-gmt.mdx), off
the homepage. Two things the guidelines do rule out: using the
NASA insignia or logotype, which are not public domain, and implying that NASA
endorses the product. Neither is done here.

    https://www.nasa.gov/nasa-brand-center/images-and-media/

Steps
-----
  1. Download the source JPEG.
  2. Check it is 2:1, the shape of an equirectangular whole Earth. The shader
     also assumes column 0 is 180°W and row 0 is 90°N, which is how the Blue
     Marble is laid out; a different source has to be checked by eye.
  3. Resample to OUTPUT_SIZE with Lanczos. 4096 wide is a power of two, so the
     mip chain the renderer builds halves cleanly down to 1x1.
  4. Encode as lossy WebP and write it to OUTPUT_PATH.

Requires Pillow:

    uv run --with pillow python apps/dox/scripts/prepare-globe-imagery.py
"""

from __future__ import annotations

import io
import os
import sys
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
OUTPUT_PATH = REPO_ROOT / "apps/dox/public/earth-blue-marble.webp"

SOURCE_URL = (
    "https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73751/"
    "world.topo.bathy.200407.3x5400x2700.jpg"
)

OUTPUT_SIZE = (4096, 2048)

# Lossy WebP. 80 keeps the coastlines and relief shading clean at the sizes the
# globe draws, and the file near 0.5 MB.
WEBP_QUALITY = 80


def download(url: str) -> bytes:
    print(f"Downloading {url} ...")
    with urllib.request.urlopen(url) as response:
        return response.read()


def main() -> int:
    from PIL import Image

    image = Image.open(io.BytesIO(download(SOURCE_URL)))
    image.load()
    width, height = image.size
    if width != 2 * height:
        print(f"Expected a 2:1 equirectangular image, got {width}x{height}")
        return 1

    image = image.convert("RGB").resize(OUTPUT_SIZE, Image.Resampling.LANCZOS)

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    image.save(OUTPUT_PATH, "WEBP", quality=WEBP_QUALITY, method=6)
    print(
        f"Wrote {OUTPUT_PATH} — {OUTPUT_SIZE[0]}x{OUTPUT_SIZE[1]}, "
        f"{os.path.getsize(OUTPUT_PATH)} bytes"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
