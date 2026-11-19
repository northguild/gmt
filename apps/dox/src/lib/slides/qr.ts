/**
 * A QR code made at build time with `lean-qr`, as the parts `QrCode.astro` draws in the deck's
 * colours: the data modules as one path, the three finder patterns ("eyes") as bevelled
 * octagons, and a clear square in the middle for a logo.
 *
 * Error correction is H, so the code still reads with the logo over its middle: the hole is about
 * 30 % of the side (under 10 % of the modules), well inside the 30 % of codewords H can restore.
 * The code is at most version 6. From version 7 an alignment pattern sits in the centre, where the
 * hole is, and `lean-qr` throws at build time if an address needs more.
 *
 * The quiet zone is four modules (ISO/IEC 18004). The code may be drawn light on dark: ISO/IEC
 * 18004 allows reflectance reversal, and phone scanners read it.
 */
import { correction, generate } from "lean-qr";

/** The quiet zone every side, in modules (ISO/IEC 18004). */
export const QUIET_ZONE = 4;

/** The largest version: version 7 puts an alignment pattern under the logo. */
export const MAX_VERSION = 6;

/** A finder pattern's side, in modules. */
const EYE = 7;

/** The share of the side the logo hole aims for. */
const HOLE_SHARE = 0.3;

export interface QrModel {
  /** Modules on a side, without the quiet zone. */
  size: number;
  /** The view box's side: the modules plus the quiet zone on both sides. */
  extent: number;
  /** Every dark data module outside the eyes and the hole, as one path of unit squares. */
  modules: string;
  /** The three finder patterns, ring and pupil each a bevelled octagon (even-odd fill). */
  eyes: string;
  /** The clear square for the logo, in view-box units. */
  hole: { x: number; y: number; side: number };
}

/** An octagon: the square at (`x`, `y`) of side `w` with each corner cut by `c` at 45°. */
const octagon = (x: number, y: number, w: number, c: number): string =>
  `M${x + c} ${y}h${w - 2 * c}l${c} ${c}v${w - 2 * c}l${-c} ${c}h${2 * c - w}l${-c} ${-c}v${2 * c - w}z`;

/**
 * The hole's side in modules: odd, so it centres on the grid, near `HOLE_SHARE` of the side, and
 * clear of the bottom-right alignment pattern (versions 2 to 6 have it at `size - 9` to `size - 5`).
 */
function holeSide(size: number, version: number): number {
  let side = 2 * Math.round((size * HOLE_SHARE - 1) / 2) + 1;
  const end = (s: number) => (size + s) / 2 - 1;
  while (version >= 2 && end(side) >= size - 9) side -= 2;
  return side;
}

export function qrModel(url: string): QrModel {
  const code = generate(url, {
    minCorrectionLevel: correction.H,
    maxVersion: MAX_VERSION,
  });
  const { size } = code;
  const version = (size - 17) / 4;
  const side = holeSide(size, version);
  const at = (size - side) / 2;

  const corners = [
    { x: 0, y: 0 },
    { x: size - EYE, y: 0 },
    { x: 0, y: size - EYE },
  ];
  const inEye = (x: number, y: number) =>
    corners.some((e) => x >= e.x && x < e.x + EYE && y >= e.y && y < e.y + EYE);
  const inHole = (x: number, y: number) =>
    x >= at && x < at + side && y >= at && y < at + side;

  let modules = "";
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (code.get(x, y) && !inEye(x, y) && !inHole(x, y)) {
        modules += `M${x + QUIET_ZONE} ${y + QUIET_ZONE}h1v1h-1z`;
      }
    }
  }

  const eyes = corners
    .map(({ x, y }) => {
      const ex = x + QUIET_ZONE;
      const ey = y + QUIET_ZONE;
      return (
        octagon(ex, ey, 7, 1) +
        octagon(ex + 1, ey + 1, 5, 0.5) +
        octagon(ex + 2, ey + 2, 3, 0.5)
      );
    })
    .join("");

  return {
    size,
    extent: size + 2 * QUIET_ZONE,
    modules,
    eyes,
    hole: { x: at + QUIET_ZONE, y: at + QUIET_ZONE, side },
  };
}

/** The LinkedIn logo, 24 × 24 (Simple Icons 13.0.0, CC0): the rounded square with "in" cut out. */
export const LINKEDIN_LOGO =
  "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z";
