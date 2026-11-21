// Day.js 1.11.23 with the utc and timezone plugins.
// Parsing:      https://day.js.org/docs/en/parse/string
// Plugins:      https://day.js.org/docs/en/plugin/utc  https://day.js.org/docs/en/plugin/timezone
// Zone parsing: https://day.js.org/docs/en/timezone/parsing-in-zone
// A string with no zone is parsed with `dayjs(string)`: the machine's zone.
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";
import {
  hoursText,
  instantText,
  localText,
  nextDate,
  wallText,
} from "../adapter-util.mjs";
import { versionOf } from "../versions.mjs";

dayjs.extend(utc);
dayjs.extend(timezone);

const wall = (d) =>
  wallText(d.year(), d.month() + 1, d.date(), d.hour(), d.minute(), d.second());
const local = (d) =>
  localText(
    d.year(),
    d.month() + 1,
    d.date(),
    d.hour(),
    d.minute(),
    d.second(),
    Math.round(d.utcOffset() * 60),
  );
const inZone = (instant, zone) => dayjs.utc(instant).tz(zone);
const startMs = (zone, date) => dayjs.tz(date, zone).startOf("day").valueOf();

export default {
  id: "dayjs",
  name: "Day.js",
  version: versionOf("dayjs"),
  ops: {
    plainDate: ({ date }) => dayjs(date).format("YYYY-MM-DD"),
    plainDateTime: ({ wall: w }) => wall(dayjs(w)),
    plainDateAddDays: ({ date, days }) =>
      dayjs(date).add(days, "day").format("YYYY-MM-DD"),
    instantFromWall: ({ zone, wall: w }) =>
      instantText(dayjs.tz(w, zone).valueOf()),
    startOfDay: ({ zone, date }) => instantText(startMs(zone, date)),
    localAt: ({ zone, instant }) => local(inZone(instant, zone)),
    addDaysZoned: ({ zone, instant, days }) =>
      local(inZone(instant, zone).add(days, "day")),
    hoursInDay: ({ zone, date }) =>
      hoursText(startMs(zone, date), startMs(zone, nextDate(date))),
    utcFields: ({ instant }) => wall(dayjs.utc(instant)),
  },
};
