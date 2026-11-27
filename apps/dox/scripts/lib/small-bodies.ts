/**
 * The small bodies of the Minor Planet Center's bright file for the run year, with JPL's fitted H
 * and G, and Pluto from the Distant file, as `scripts/prepare-sky-orbits.ts` writes them into
 * `sky-orbits.json`.
 */
import { createHash } from "node:crypto";
import { convertUnixToUtc } from "@northguild/gmt/unix/convert";
import { parseYearFromUnix } from "@northguild/gmt/unix/parse";
import { fail, readPinnedSource } from "../prepare-source.mjs";
import type { Orbits } from "../../src/lib/ephemeris";
import { fetchPhotometry } from "./jpl-sbdb";
import {
  MPC_PINS,
  mpcUrl,
  parseMpcRow,
  peakMagnitude,
  selectBright,
} from "./mpc-bright";

/** `x` rounded to `digits` decimals, as a number. */
export const fixed = (x: number, digits: number) => Number(x.toFixed(digits));

/** The small bodies of the run year's MPC file: their elements, kept for `elementDays`, and the file as the credit sidecar names it. */
export async function readSmall(
  now: number,
  limit: number,
  elementDays: number,
) {
  const year = String(parseYearFromUnix(now, { timeZone: "UTC" }));
  const pin = MPC_PINS[year];
  if (!pin)
    fail(
      "prepare-sky-orbits",
      `no pinned MPC file for ${year}: add its size and sha256 to MPC_PINS`,
    );
  const url = mpcUrl(year);
  const data = await readPinnedSource({
    name: "prepare-sky-orbits mpc",
    url,
    ...pin!,
    flag: "mpc",
  });
  const rows = selectBright(data.toString("latin1"), limit);
  const small: Orbits["small"] = {};
  const bodies: Record<string, { peak: number; H: number; G: number }> = {};
  for (const { name, G: _default, H: _mpc, ...elements } of rows) {
    const id = name.toLowerCase();
    /* The file's G is a default on every row: H and G are JPL's fitted pair. */
    const { H, G } = await fetchPhotometry(name);
    const peak = fixed(peakMagnitude({ H, ...elements }), 2);
    (small as Record<string, unknown>)[id] = {
      ...elements,
      days: elementDays,
      H,
      G,
    };
    bodies[id] = { peak, H, G };
  }
  return {
    small,
    file: { year, url, bytes: pin!.bytes, sha256: pin!.sha256 },
    bodies,
  };
}

/** The MPC's file of distant minor planets, the Pluto row's home: rolling, so it is recorded, not pinned. */
const DISTANT_URL =
  "https://www.minorplanetcenter.net/iau/Ephemerides/Distant/Soft00Distant.txt";

/** One URL's bytes. */
type Download = (url: string) => Promise<Buffer>;

const download: Download = async (url) => {
  const response = await fetch(url);
  if (!response.ok)
    throw new Error(`prepare-sky-orbits: ${url}: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
};

/**
 * Pluto from the MPC's Distant file: its two-body elements, kept for `elementDays`, and the
 * sidecar's record of the file (URL, the run instant it was read at, size and sha256), because the
 * file changes under its URL. The row is picked by name, as `selectBright` keeps only bodies bright
 * enough for the H, G system's limit and Pluto is not one. The row's H and G are not kept: Pluto's
 * magnitude is `DWARF_ABSOLUTE`'s (`magnitude.ts`).
 */
export async function readDistant(
  now: number,
  elementDays: number,
  read: Download = download,
) {
  const data = await read(DISTANT_URL);
  const row = data
    .toString("latin1")
    .split("\n")
    .flatMap((line) => parseMpcRow(line) ?? [])
    .find((r) => r.name === "Pluto");
  if (!row) throw new Error(`${DISTANT_URL} has no Pluto row`);
  const { name: _name, H: _H, G: _G, ...elements } = row;
  return {
    small: { pluto: { ...elements, days: elementDays } },
    source: {
      title: "MPC distant minor planets, osculating elements",
      publisher: "IAU Minor Planet Center",
      page: "https://www.minorplanetcenter.net/iau/Ephemerides/Distant/",
      file: {
        url: DISTANT_URL,
        fetched: convertUnixToUtc(now),
        bytes: data.length,
        sha256: createHash("sha256").update(data).digest("hex"),
      },
      elementDays,
      bodies: ["pluto"],
    },
  };
}
