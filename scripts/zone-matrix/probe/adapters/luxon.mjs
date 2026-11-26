// Luxon 3.7.2.
// Parsing:   https://moment.github.io/luxon/#/parsing?id=iso-8601
// Zones:     https://moment.github.io/luxon/#/zones?id=specifying-a-zone
// Math:      https://moment.github.io/luxon/#/math
// Luxon has no plain date type; `DateTime.fromISO(string)` with no zone option is the machine's zone.
import { DateTime } from "luxon";
import {
  hoursText,
  instantText,
  localText,
  nextDate,
  wallText,
} from "../adapter-util.mjs";
import { versionOf } from "../versions.mjs";

const wall = (d) =>
  wallText(d.year, d.month, d.day, d.hour, d.minute, d.second);
const local = (d) =>
  localText(
    d.year,
    d.month,
    d.day,
    d.hour,
    d.minute,
    d.second,
    Math.round(d.offset * 60),
  );
const inZone = (instant, zone) =>
  DateTime.fromISO(instant, { setZone: true }).setZone(zone);
const startMs = (zone, date) =>
  DateTime.fromISO(date, { zone }).startOf("day").toMillis();

export default {
  id: "luxon",
  name: "Luxon",
  version: versionOf("luxon"),
  ops: {
    plainDate: ({ date }) => DateTime.fromISO(date).toFormat("yyyy-MM-dd"),
    plainDateTime: ({ wall: w }) => wall(DateTime.fromISO(w)),
    plainDateAddDays: ({ date, days }) =>
      DateTime.fromISO(date).plus({ days }).toFormat("yyyy-MM-dd"),
    instantFromWall: ({ zone, wall: w }) =>
      instantText(DateTime.fromISO(w, { zone }).toMillis()),
    startOfDay: ({ zone, date }) => instantText(startMs(zone, date)),
    localAt: ({ zone, instant }) => local(inZone(instant, zone)),
    addDaysZoned: ({ zone, instant, days }) =>
      local(inZone(instant, zone).plus({ days })),
    hoursInDay: ({ zone, date }) =>
      hoursText(startMs(zone, date), startMs(zone, nextDate(date))),
    utcFields: ({ instant }) =>
      wall(DateTime.fromISO(instant, { zone: "utc" })),
  },
};
