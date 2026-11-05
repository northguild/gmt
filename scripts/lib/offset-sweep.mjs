/**
 * The offset sweep (CORE-92): for every zone, one instant a day from 1970-01-01 to ten years past
 * the run date, compare a Temporal implementation's offset with `Intl`'s `longOffset` text.
 *
 * Pure functions, no I/O, no imports. The caller supplies both offset functions, so this module
 * never loads a polyfill. The sweep deliberately avoids the implementation's own transition search:
 * a brute force is the only check independent of it.
 */

const DAY_MS = 86_400_000;
/** 12:00 UTC, so a day's sample never sits on a midnight boundary. */
const NOON_MS = 43_200_000;
/** Zones listed in a result; `differingZones` still counts them all. */
const MAX_ZONES_LISTED = 50;
/** Runs listed per zone; `days` still counts them all. */
const MAX_RUNS_LISTED = 20;

/**
 * ECMA-402 FormatDateTimePattern leaves the offset text's form to the implementation; CLDR UTS #35
 * Part 4 (localized GMT format: `gmtFormat`, `gmtZeroFormat`, `hourFormat`) gives these three
 * shapes for `en`. Anything else is not readable.
 */
const LONG_OFFSET = /^GMT(?:([+-])(\d{2}):(\d{2})(?::(\d{2}))?)?$/;

/**
 * Read a `timeZoneName: "longOffset"` text.
 *
 * @param {string} text
 * @returns {number | null} seconds east of UTC, or `null` for any other text
 */
export function parseLongOffset(text) {
  const m = LONG_OFFSET.exec(text);
  if (!m) return null;
  if (m[1] === undefined) return 0;
  const hours = Number(m[2]);
  const minutes = Number(m[3]);
  const seconds = m[4] === undefined ? 0 : Number(m[4]);
  if (minutes > 59 || seconds > 59) return null;
  const total = hours * 3600 + minutes * 60 + seconds;
  if (total === 0) return 0;
  return m[1] === "-" ? -total : total;
}

/**
 * The days to sweep: epoch day 0 (1970-01-01, the tz database's POSIX-epoch partition) to the run
 * date plus ten years (`overflow: "constrain"`, so 29 February becomes 28 February).
 *
 * @param {{ add(d: { years: number }): { year: number, month: number, day: number,
 *   toString(): string } }} today a `Temporal.PlainDate`
 * @returns {{ from: string, through: string, firstDay: number, lastDay: number }}
 */
export function sweepSpan(today) {
  const end = today.add({ years: 10 });
  return {
    from: "1970-01-01",
    through: end.toString(),
    firstDay: 0,
    lastDay: daysFromCivil(end.year, end.month, end.day),
  };
}

/**
 * Epoch day of a proleptic Gregorian date: days from 1970-01-01. Integer arithmetic only (Howard
 * Hinnant's civil-days algorithm), so the sweep needs neither the implementation under test nor the
 * native `Date`, which the repo bans.
 */
function daysFromCivil(year, month, day) {
  const y = month <= 2 ? year - 1 : year;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const doy =
    Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

/** ISO date of an epoch day, by the inverse of {@link daysFromCivil}. */
function iso(epochDay) {
  const z = epochDay + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor(
    (doe -
      Math.floor(doe / 1460) +
      Math.floor(doe / 36524) -
      Math.floor(doe / 146096)) /
      365,
  );
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const day = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const month = mp < 10 ? mp + 3 : mp - 9;
  const year = yoe + era * 400 + (month <= 2 ? 1 : 0);
  const pad = (n, w) => String(n).padStart(w, "0");
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
}

/**
 * @typedef {{ from: string, through: string, intl: number, polyfill: number | null }} SweepRun
 * @typedef {{ zone: string, days: number, runs: SweepRun[], runsTruncated: boolean }} SweepZone
 */

/**
 * Compare the implementation's offset with Intl's, per zone and day.
 *
 * @param {{ zones: string[], firstDay: number, lastDay: number,
 *   implOffset: (zone: string, ms: number) => number,
 *   intlOffset: (zone: string, ms: number) => string }} input
 */
export function sweepOffsets({
  zones,
  firstDay,
  lastDay,
  implOffset,
  intlOffset,
}) {
  if (zones.length === 0)
    throw new Error('Intl.supportedValuesOf("timeZone") returned no zones');
  if (lastDay < firstDay)
    throw new Error(`lastDay ${lastDay} is before firstDay ${firstDay}`);

  /** @type {SweepZone[]} */
  const differing = [];
  let differingZones = 0;

  for (const zone of zones) {
    let days = 0;
    let runCount = 0;
    /** @type {SweepRun[]} */
    const runs = [];
    /** @type {SweepRun | null} */
    let open = null;

    for (let d = firstDay; d <= lastDay; d++) {
      const ms = d * DAY_MS + NOON_MS;
      const text = intlOffset(zone, ms);
      const intl = parseLongOffset(text);
      if (intl === null) {
        throw new Error(
          `Intl longOffset text for ${zone} on ${iso(d)} is "${text}", which the sweep cannot read`,
        );
      }
      let polyfill;
      try {
        polyfill = implOffset(zone, ms);
      } catch {
        polyfill = null;
      }
      if (polyfill === intl) {
        open = null;
        continue;
      }
      days++;
      if (open && open.intl === intl && open.polyfill === polyfill) {
        open.through = iso(d);
      } else {
        open = { from: iso(d), through: iso(d), intl, polyfill };
        runCount++;
        if (runs.length < MAX_RUNS_LISTED) runs.push(open);
      }
    }

    if (days === 0) continue;
    differingZones++;
    if (differing.length < MAX_ZONES_LISTED) {
      differing.push({
        zone,
        days,
        runs,
        runsTruncated: runCount > MAX_RUNS_LISTED,
      });
    }
  }

  return {
    from: iso(firstDay),
    through: iso(lastDay),
    zones: zones.length,
    days: lastDay - firstDay + 1,
    comparisons: zones.length * (lastDay - firstDay + 1),
    differingZones,
    differing,
    differingTruncated: differingZones > MAX_ZONES_LISTED,
  };
}
