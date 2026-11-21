// @internationalized/date 3.12.4.
// Docs: https://react-spectrum.adobe.com/internationalized/date/ (CalendarDate, CalendarDateTime,
// ZonedDateTime, `toZoned`, `parseAbsolute`). It has a plain date and a plain date-time type, so a
// string with no zone never reads the machine's zone.
import {
  parseAbsolute,
  parseDate,
  parseDateTime,
  toZoned,
} from "@internationalized/date";
import {
  hoursText,
  instantText,
  localText,
  nextDate,
} from "../adapter-util.mjs";
import { versionOf } from "../versions.mjs";

const secondsOf = (d) => d.toString().slice(0, 19);
const local = (z) =>
  localText(
    z.year,
    z.month,
    z.day,
    z.hour,
    z.minute,
    z.second,
    Math.round(z.offset / 1000),
  );
const inZone = (instant, zone) => parseAbsolute(instant, zone);
const startMs = (zone, date) =>
  toZoned(parseDate(date), zone).toDate().getTime();

export default {
  id: "internationalized-date",
  name: "@internationalized/date",
  version: versionOf("@internationalized/date"),
  ops: {
    plainDate: ({ date }) => parseDate(date).toString(),
    plainDateTime: ({ wall }) => secondsOf(parseDateTime(wall)),
    plainDateAddDays: ({ date, days }) =>
      parseDate(date).add({ days }).toString(),
    instantFromWall: ({ zone, wall }) =>
      instantText(toZoned(parseDateTime(wall), zone).toDate().getTime()),
    startOfDay: ({ zone, date }) => instantText(startMs(zone, date)),
    localAt: ({ zone, instant }) => local(inZone(instant, zone)),
    addDaysZoned: ({ zone, instant, days }) =>
      local(inZone(instant, zone).add({ days })),
    hoursInDay: ({ zone, date }) =>
      hoursText(startMs(zone, date), startMs(zone, nextDate(date))),
    utcFields: ({ instant }) => secondsOf(parseAbsolute(instant, "UTC")),
  },
};
