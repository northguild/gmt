#!/usr/bin/env node
/**
 * One-shot data-prep for the globe's IANA-zone -> latitude/longitude table.
 *
 * This script is NOT part of the dox build pipeline (`pnpm generate`). Run it
 * manually when the upstream tzdb is updated and you want to refresh
 * `apps/dox/src/lib/tz-coordinates.ts`.
 *
 * Nothing in `@northguild/gmt` maps an IANA timezone identifier to a
 * coordinate — `getTimeZones()` returns identifiers only — so DOX-E1a vendors
 * tzdb's public-domain data. tzdb releases several times a year; this is not
 * a one-time import.
 *
 * Two files, both from the upstream tz repo:
 *
 *   - `zone.tab` — one row per zone with a real per-country coordinate.
 *     (`zone1970.tab`, tried first, is the *smaller* table: it merges any
 *     zones whose clocks have agreed since 1970 into one row, so e.g.
 *     `Atlantic/Reykjavik` never appears — only its 1970-equivalent
 *     `Africa/Abidjan` does. `zone.tab` keeps every zone distinct.)
 *   - `backward` — the Link table (old/alias name -> canonical name). Which
 *     spelling `Intl.supportedValuesOf('timeZone')` returns for a renamed
 *     zone (`Asia/Calcutta` vs `Asia/Kolkata`, `Europe/Kiev` vs
 *     `Europe/Kyiv`, …) differs by browser/ICU version, so every alias gets
 *     its target's coordinate copied in. Verified (2026-09-04): this closes
 *     100% of the gap against Node's `Intl.supportedValuesOf('timeZone')`.
 *
 * `zone.tab` / `backward` columns: see the comments each file carries.
 *
 * Run as: node apps/dox/scripts/prepare-tz-coordinates.mjs
 */

import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const TZ_TAB_URL = "https://raw.githubusercontent.com/eggert/tz/main/zone.tab";
const BACKWARD_URL =
  "https://raw.githubusercontent.com/eggert/tz/main/backward";

// tzdb has no zone.tab row for these — they are not tied to a country — but
// readers can still land on them, and (0, 0) is the conventional "no real
// place" marker for UTC on a map.
const UTC_SEED = { lat: 0, lng: 0 };

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = resolve(__dirname, "..", "src", "lib", "tz-coordinates.ts");

/**
 * Parse one ISO 6709 `±DDMM[SS]±DDDMM[SS]` pair into decimal degrees.
 * @param {string} field
 * @returns {{ lat: number, lng: number }}
 */
function parseCoordinates(field) {
  const match = field.match(/^([+-]\d{4,6})([+-]\d{5,7})$/);
  if (!match) throw new Error(`unparseable coordinates: ${field}`);
  return { lat: toDecimal(match[1]), lng: toDecimal(match[2]) };
}

/**
 * @param {string} token `±` followed by DDMM, DDMMSS, DDDMM, or DDDMMSS
 * @returns {number}
 */
function toDecimal(token) {
  const sign = token[0] === "-" ? -1 : 1;
  const digits = token.slice(1);
  // Longitude tokens carry a 3-digit degree field, latitude a 2-digit one.
  const degLen = digits.length === 5 || digits.length === 7 ? 3 : 2;
  const degrees = Number(digits.slice(0, degLen));
  const minutes = Number(digits.slice(degLen, degLen + 2));
  const seconds = Number(digits.slice(degLen + 2)) || 0;
  return round(sign * (degrees + minutes / 60 + seconds / 3600));
}

/** @param {number} n */
function round(n) {
  return Math.round(n * 1e4) / 1e4;
}

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`fetch ${url} failed: ${response.status}`);
  return response.text();
}

const [zoneTab, backward] = await Promise.all([
  fetchText(TZ_TAB_URL),
  fetchText(BACKWARD_URL),
]);

/** @type {Map<string, { lat: number, lng: number }>} */
const coords = new Map();
coords.set("Etc/UTC", UTC_SEED);
coords.set("Etc/GMT", UTC_SEED);
coords.set("UTC", UTC_SEED);
coords.set("GMT", UTC_SEED);

for (const line of zoneTab.split("\n")) {
  if (!line || line.startsWith("#")) continue;
  const [, coordinates, id] = line.split("\t");
  coords.set(id, parseCoordinates(coordinates));
}

// Resolve every `Link target linkname` onto the target's coordinate. A link
// can point to another link, so iterate to a fixed point (a handful of
// passes suffices; tzdb's link graph is shallow).
let pending = backward
  .split("\n")
  .filter((line) => line.startsWith("Link"))
  .map((line) => {
    const [, target, linkName] = line.split(/\s+/).filter(Boolean);
    return { target, linkName };
  });
for (let pass = 0; pending.length > 0 && pass < 10; pass++) {
  const unresolved = [];
  for (const { target, linkName } of pending) {
    if (coords.has(linkName)) continue;
    const targetCoord = coords.get(target);
    if (targetCoord) coords.set(linkName, targetCoord);
    else unresolved.push({ target, linkName });
  }
  if (unresolved.length === pending.length) break; // no progress; give up
  pending = unresolved;
}

const rows = [...coords.entries()]
  .map(([id, { lat, lng }]) => ({ id, lat, lng }))
  .sort((a, b) => a.id.localeCompare(b.id));

// `git log -1 --format=%cs -- apps/dox/src/lib/tz-coordinates.ts` shows when this
// was last refreshed — no need to stamp a date the code rule (no `Date`) forbids.

const body = rows
  .map(
    (r) => `  { id: ${JSON.stringify(r.id)}, lat: ${r.lat}, lng: ${r.lng} },`,
  )
  .join("\n");

const file = `// GENERATED by apps/dox/scripts/prepare-tz-coordinates.mjs — do not edit by hand.
//
// IANA timezone identifier -> principal-location latitude/longitude, vendored
// from tzdb's public-domain \`zone.tab\` (per-zone coordinates) merged with
// \`backward\` (every alias -> its target's coordinate, so whichever spelling a
// browser's \`Intl.supportedValuesOf('timeZone')\` returns still resolves).
// Nothing in \`@northguild/gmt\` maps a zone identifier to a coordinate, so
// DOX-E1a's globe needs this table.
//
// Sources: ${TZ_TAB_URL}
//          ${BACKWARD_URL}
// Rows:    ${rows.length}
//
// tzdb releases several times a year. Re-run the prep script to refresh:
//   node apps/dox/scripts/prepare-tz-coordinates.mjs

export interface ZoneCoordinate {
  id: string;
  lat: number;
  lng: number;
}

export const TZ_COORDINATES: readonly ZoneCoordinate[] = [
${body}
];
`;

writeFileSync(outPath, file);
console.log(`[tz-coordinates] wrote ${rows.length} zones to ${outPath}`);
