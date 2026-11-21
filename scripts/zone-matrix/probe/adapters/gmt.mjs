// GMT, from the build already in packages/gmt/dist (never rebuilt here).
// Docs: the Dox reference pages for these functions; every function takes and returns strings.
//   convertPlainDateTimeToZoned, convertZonedToUtc, convertUtcToZoned, getTimeZoneOffset,
//   addZoned, addDate, getHoursInZonedDay.
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const dist = fileURLToPath(
  new URL("../../../../packages/gmt/dist/index.js", import.meta.url),
);
const g = await import(pathToFileURL(dist).href);

const fail = (what, value) => {
  if (value === "" || value === null)
    throw new Error(`${what} returned an empty answer`);
  return value;
};
const seconds = (zoned) => zoned.slice(0, 19);
const instantOf = (utc) => utc.replace(/\.000Z$/, "Z");
const local = (zoned, zone) => {
  const utc = fail("convertZonedToUtc", g.convertZonedToUtc(zoned));
  return `${seconds(zoned)}${fail("getTimeZoneOffset", g.getTimeZoneOffset(zone, utc))}`;
};
const startOfDayText = (zone, date) =>
  instantOf(
    fail(
      "convertZonedToUtc",
      g.convertZonedToUtc(
        fail(
          "convertPlainDateTimeToZoned",
          g.convertPlainDateTimeToZoned(`${date}T00:00:00`, zone),
        ),
      ),
    ),
  );
const startZoned = (zone, date) =>
  fail(
    "convertPlainDateTimeToZoned",
    g.convertPlainDateTimeToZoned(`${date}T00:00:00`, zone),
  );

export default {
  id: "gmt",
  name: "GMT",
  version: JSON.parse(
    readFileSync(
      fileURLToPath(
        new URL("../../../../packages/gmt/package.json", import.meta.url),
      ),
      "utf8",
    ),
  ).version,
  ops: {
    plainDate: ({ date }) => fail("addDate", g.addDate(date, { days: 0 })),
    plainDateTime: ({ wall }) =>
      seconds(fail("addDateTime", g.addDateTime(wall, { seconds: 0 }))),
    plainDateAddDays: ({ date, days }) =>
      fail("addDate", g.addDate(date, { days })),
    instantFromWall: ({ zone, wall }) =>
      instantOf(
        fail(
          "convertZonedToUtc",
          g.convertZonedToUtc(
            fail(
              "convertPlainDateTimeToZoned",
              g.convertPlainDateTimeToZoned(wall, zone),
            ),
          ),
        ),
      ),
    startOfDay: ({ zone, date }) => startOfDayText(zone, date),
    localAt: ({ zone, instant }) =>
      local(
        fail("convertUtcToZoned", g.convertUtcToZoned(instant, zone)),
        zone,
      ),
    addDaysZoned: ({ zone, instant, days }) =>
      local(
        fail(
          "addZoned",
          g.addZoned(
            fail("convertUtcToZoned", g.convertUtcToZoned(instant, zone)),
            { days },
          ),
        ),
        zone,
      ),
    hoursInDay: ({ zone, date }) =>
      String(
        fail(
          "getHoursInZonedDay",
          g.getHoursInZonedDay(startZoned(zone, date)),
        ),
      ),
    utcFields: ({ instant }) =>
      seconds(
        fail("convertUtcToPlainDateTime", g.convertUtcToPlainDateTime(instant)),
      ),
  },
};
