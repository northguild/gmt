/**
 * The probe's four experiments and the questions in them. Nothing here holds an answer: the answers
 * come from `build-cases.mjs`, which asks the Temporal specification through two implementations.
 *
 * Each experiment is a plain question, what we feed in, and a function that lists its cases. A case
 * is `{ op, args, input, group }`; `input` is the line a person reads.
 */
import { Temporal } from "@js-temporal/polyfill";

/** The ten zones of the `gmt-matrix` job in ci.yml; `run.mjs` reads the live list and checks it. */
export const CI_ZONES_FOR_BUILD = [
  "Pacific/Niue",
  "America/New_York",
  "UTC",
  "Europe/London",
  "Asia/Kolkata",
  "Asia/Kathmandu",
  "Asia/Shanghai",
  "Australia/Lord_Howe",
  "Pacific/Chatham",
  "Pacific/Apia",
];

const text = (pdt) => pdt.toString({ smallestUnit: "second" });

/** Every offset change of `zone` from `fromYear` to `toYear` (inclusive). */
export function transitions(zone, fromYear, toYear) {
  const out = [];
  let z = Temporal.PlainDate.from({
    year: fromYear,
    month: 1,
    day: 1,
  }).toZonedDateTime(zone);
  const end = Temporal.PlainDate.from({
    year: toYear + 1,
    month: 1,
    day: 1,
  }).toZonedDateTime(zone);
  for (;;) {
    const next = z.getTimeZoneTransition("next");
    if (!next || Temporal.ZonedDateTime.compare(next, end) >= 0) return out;
    const before = next.subtract({ nanoseconds: 1 }).offsetNanoseconds;
    const after = next.offsetNanoseconds;
    out.push({ at: next.toInstant(), before, after });
    z = next;
  }
}

/** A wall time as the zone showed it just before (`before`) or just after (`after`) a change. */
const wallAt = (t, side) =>
  t.at
    .toZonedDateTimeISO("UTC")
    .toPlainDateTime()
    .add({ nanoseconds: t[side] });

const MINUTE = 60_000_000_000;

/** Three wall times inside the hole a change leaves (gap) or the repeat it makes (overlap). */
function holeWalls(t) {
  const length = Math.abs(t.after - t.before);
  const start = wallAt(t, t.after > t.before ? "before" : "after");
  const minutes = Math.floor(length / MINUTE);
  if (minutes < 2) return [];
  const picks = [...new Set([0, Math.floor(minutes / 2), minutes - 1])];
  return picks.map((m) => text(start.add({ minutes: m })));
}

const DST_ZONES = [
  ["America/New_York", 2000, 2030],
  ["Europe/London", 2000, 2030],
  ["Europe/Helsinki", 2000, 2030],
  ["Australia/Sydney", 2000, 2030],
  ["Australia/Lord_Howe", 2000, 2030],
  ["Pacific/Chatham", 2000, 2030],
  ["America/Sao_Paulo", 2000, 2018],
  ["Pacific/Apia", 2000, 2021],
];

function holeCases(kind) {
  const cases = [];
  for (const [zone, from, to] of DST_ZONES) {
    for (const t of transitions(zone, from, to)) {
      const isGap = t.after > t.before;
      if (isGap !== (kind === "gap")) continue;
      for (const wall of holeWalls(t)) {
        cases.push({
          op: "instantFromWall",
          args: { zone, wall },
          input: `${zone} ${wall.replace("T", " ").slice(0, 16)}`,
          group: zone,
        });
      }
    }
  }
  return cases;
}

/** Plain date and time strings read back on each machine zone setting. */
function hostCases() {
  const cases = [];
  const seen = new Set();
  const add = (c) => {
    const key = JSON.stringify([c.op, c.args]);
    if (!seen.has(key)) {
      seen.add(key);
      cases.push(c);
    }
  };
  for (const zone of CI_ZONES_FOR_BUILD) {
    for (const t of transitions(zone, 1986, 2030)) {
      if (t.after <= t.before) continue;
      const walls = holeWalls(t);
      for (const wall of walls.length
        ? [walls[0], walls[1] ?? walls[0]]
        : [text(wallAt(t, "before"))]) {
        add({
          op: "plainDateTime",
          args: { wall },
          input: `time ${wall.replace("T", " ").slice(0, 16)}`,
          group: "A wall time that is missing on one machine zone",
        });
      }
    }
  }
  for (const wall of [
    "2025-01-15T09:30:00",
    "2025-07-15T09:30:00",
    "2000-02-29T00:00:00",
    "2025-12-31T23:59:59",
  ])
    add({
      op: "plainDateTime",
      args: { wall },
      input: `time ${wall.replace("T", " ")}`,
      group: "A wall time every machine has",
    });
  const dates = [];
  for (
    let d = Temporal.PlainDate.from("2011-12-27");
    Temporal.PlainDate.compare(d, "2012-01-03") <= 0;
    d = d.add({ days: 1 })
  )
    dates.push(d.toString());
  for (let m = 1; m <= 12; m += 1)
    dates.push(
      `2025-${String(m).padStart(2, "0")}-15`,
      `2024-${String(m).padStart(2, "0")}-01`,
    );
  dates.push("2024-02-29", "1999-12-31", "2000-01-01", "2038-01-19");
  for (const date of dates) {
    add({
      op: "plainDate",
      args: { date },
      input: `date ${date}`,
      group: "A calendar date",
    });
    add({
      op: "plainDateAddDays",
      args: { date, days: 1 },
      input: `date ${date} + 1 day`,
      group: "A calendar date plus one day",
    });
  }
  for (const instant of [
    "1970-01-01T00:00:00Z",
    "1900-01-01T00:00:00Z",
    "2011-12-30T10:00:00Z",
    "2025-03-09T07:30:00Z",
    "2025-10-04T15:45:00Z",
    "2038-01-19T03:14:07Z",
    "2100-07-01T12:00:00Z",
  ])
    add({
      op: "utcFields",
      args: { instant },
      input: `instant ${instant}`,
      group: "An instant read in UTC",
    });
  return cases;
}

const ODD_ZONES = [
  "Pacific/Apia",
  "Australia/Lord_Howe",
  "Asia/Kathmandu",
  "Pacific/Chatham",
];

function oddCases() {
  const cases = [];
  const add = (c) => cases.push(c);
  const instants = new Set();
  for (const zone of [
    ...ODD_ZONES,
    "Asia/Kolkata",
    "America/St_Johns",
    "Pacific/Marquesas",
  ]) {
    for (const year of [2024, 2025]) {
      for (let month = 1; month <= 12; month += 1) {
        for (const day of [1, 15]) {
          instants.add(
            `${zone}|${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T03:17:00Z`,
          );
        }
      }
    }
  }
  for (const zone of ODD_ZONES) {
    for (const t of transitions(zone, 2010, 2026)) {
      // The last second before a change and the first after it.
      instants.add(
        `${zone}|${t.at.subtract({ seconds: 1 }).toString({ smallestUnit: "second" })}`,
      );
      instants.add(`${zone}|${t.at.toString({ smallestUnit: "second" })}`);
    }
  }
  for (const key of instants) {
    const [zone, instant] = key.split("|");
    add({
      op: "localAt",
      args: { zone, instant },
      input: `${zone} at ${instant.replace("T", " ").replace(":00Z", "Z")}`,
      group: `Clock reading in ${zone}`,
    });
  }
  for (const zone of ODD_ZONES) {
    for (const t of transitions(zone, 2010, 2026)) {
      const local = t.at.toZonedDateTimeISO(zone);
      for (const shift of [-1, 0, 1]) {
        const date = local.toPlainDate().add({ days: shift }).toString();
        const start = Temporal.PlainDate.from(date).toZonedDateTime(zone);
        if (start.toPlainDate().toString() === date) {
          add({
            op: "hoursInDay",
            args: { zone, date },
            input: `${zone} ${date}: hours in the day`,
            group: `Length of a day in ${zone}`,
          });
        }
        add({
          op: "startOfDay",
          args: { zone, date },
          input: `${zone} ${date}: start of day`,
          group: `Start of day in ${zone}`,
        });
      }
      const before = local
        .subtract({ days: 1 })
        .with({ hour: 12, minute: 0, second: 0 });
      add({
        op: "addDaysZoned",
        args: {
          zone,
          instant: before.toInstant().toString({ smallestUnit: "second" }),
          days: 1,
        },
        input: `${zone} ${text(before.toPlainDateTime()).replace("T", " ").slice(0, 16)} + 1 day`,
        group: `One calendar day later in ${zone}`,
      });
    }
  }
  const extra = [
    [
      "startOfDay",
      { zone: "Pacific/Apia", date: "2011-12-30" },
      "Pacific/Apia 2011-12-30 (skipped): start of day",
    ],
    [
      "instantFromWall",
      { zone: "Pacific/Apia", wall: "2011-12-30T12:00:00" },
      "Pacific/Apia 2011-12-30 12:00 (skipped)",
    ],
    [
      "addDaysZoned",
      { zone: "Pacific/Apia", instant: "2011-12-29T22:00:00Z", days: 1 },
      "Pacific/Apia 2011-12-29 12:00 + 1 day",
    ],
    [
      "localAt",
      { zone: "Pacific/Apia", instant: "2011-12-30T09:59:59Z" },
      "Pacific/Apia at 2011-12-30 09:59:59Z",
    ],
    [
      "localAt",
      { zone: "Pacific/Apia", instant: "2011-12-30T10:00:00Z" },
      "Pacific/Apia at 2011-12-30 10:00:00Z",
    ],
    [
      "instantFromWall",
      { zone: "Asia/Manila", wall: "1844-12-31T12:00:00" },
      "Asia/Manila 1844-12-31 12:00 (skipped)",
    ],
    [
      "localAt",
      { zone: "Asia/Manila", instant: "1850-01-01T00:00:00Z" },
      "Asia/Manila at 1850-01-01 00:00Z",
    ],
    [
      "localAt",
      { zone: "Asia/Manila", instant: "1844-06-01T00:00:00Z" },
      "Asia/Manila at 1844-06-01 00:00Z",
    ],
    [
      "instantFromWall",
      { zone: "Asia/Kathmandu", wall: "1986-01-01T00:05:00" },
      "Asia/Kathmandu 1986-01-01 00:05 (skipped)",
    ],
    [
      "localAt",
      { zone: "Africa/Monrovia", instant: "1972-01-06T00:00:00Z" },
      "Africa/Monrovia at 1972-01-06 00:00Z",
    ],
    [
      "localAt",
      { zone: "Europe/London", instant: "1970-01-01T00:00:00Z" },
      "Europe/London at 1970-01-01 00:00Z",
    ],
    [
      "localAt",
      { zone: "America/New_York", instant: "2100-07-01T12:00:00Z" },
      "America/New_York at 2100-07-01 12:00Z",
    ],
  ];
  for (const [op, args, input] of extra)
    add({ op, args, input, group: "Famous odd cases" });
  return cases;
}

export const EXPERIMENTS = [
  {
    id: "gaps",
    number: 1,
    title: "Clocks jump forward",
    question: "What time is a wall-clock time that never happens?",
    fed: "Times inside the hour (or day) that spring-forward clocks skip, in 8 zones, 2000 to 2030.",
    cases: () => holeCases("gap"),
  },
  {
    id: "overlaps",
    number: 2,
    title: "Clocks fall back",
    question: "Which moment is a wall-clock time that happens twice?",
    fed: "Times inside the hour that fall-back clocks repeat, in 8 zones, 2000 to 2030.",
    cases: () => holeCases("overlap"),
  },
  {
    id: "host",
    number: 3,
    title: "Your laptop's zone changes the answer",
    question: "Does the answer change with the zone of the machine?",
    fed: "Dates and times with no zone, read back on 10 different machine zone settings.",
    cases: hostCases,
  },
  {
    id: "odd",
    number: 4,
    title: "Odd zones",
    question: "Does it get the clock right where the rules are unusual?",
    fed: "Apia (skipped 30 Dec 2011), Lord Howe (30-minute DST), Kathmandu (+05:45), Chatham (+12:45) and more.",
    cases: oddCases,
  },
];
