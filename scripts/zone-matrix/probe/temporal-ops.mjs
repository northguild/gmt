/**
 * The ten questions of the probe, answered with a Temporal implementation (`Temporal` is passed in,
 * so the same code answers with `@js-temporal/polyfill`, with Node's native `Temporal` and, as an
 * adapter, with `temporal-polyfill`). Every call names its zone, so the machine's zone is never read.
 *
 * Answer formats (the same for every adapter):
 *   plainDate        "2025-01-15"
 *   plainDateTime    "2025-03-30T01:30:00"
 *   instants         "2025-03-30T01:30:00Z"
 *   localAt etc.     "2025-03-30T02:30:00+01:00" (an offset with seconds keeps them: "-00:44:30")
 *   hoursInDay       "23.5"
 * Docs: https://tc39.es/proposal-temporal/docs/zoneddatetime.html
 */
export const secondsText = (pdt) => pdt.toString({ smallestUnit: "second" });

export function temporalOps(T) {
  const localText = (zdt) =>
    `${secondsText(zdt.toPlainDateTime())}${zdt.offset}`;
  const at = (instant, zone) =>
    T.Instant.from(instant).toZonedDateTimeISO(zone);
  // Midnight of a date; when the zone skipped it, the first instant of the next day that exists.
  const startOf = (date, zone) => T.PlainDate.from(date).toZonedDateTime(zone);
  return {
    plainDate: ({ date }) => T.PlainDate.from(date).toString(),
    plainDateTime: ({ wall }) => secondsText(T.PlainDateTime.from(wall)),
    plainDateAddDays: ({ date, days }) =>
      T.PlainDate.from(date).add({ days }).toString(),
    instantFromWall: ({ zone, wall }) =>
      T.PlainDateTime.from(wall)
        .toZonedDateTime(zone, { disambiguation: "compatible" })
        .toInstant()
        .toString(),
    startOfDay: ({ zone, date }) => startOf(date, zone).toInstant().toString(),
    localAt: ({ zone, instant }) => localText(at(instant, zone)),
    addDaysZoned: ({ zone, instant, days }) =>
      localText(at(instant, zone).add({ days })),
    hoursInDay: ({ zone, date }) => String(startOf(date, zone).hoursInDay),
    utcFields: ({ instant }) =>
      secondsText(at(instant, "UTC").toPlainDateTime()),
  };
}

export const OPS = [
  "plainDate",
  "plainDateTime",
  "plainDateAddDays",
  "instantFromWall",
  "startOfDay",
  "localAt",
  "addDaysZoned",
  "hoursInDay",
  "utcFields",
];
