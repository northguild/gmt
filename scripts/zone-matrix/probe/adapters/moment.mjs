// Moment.js 2.31.0 with moment-timezone 0.6.6.
// Parsing:           https://momentjs.com/docs/#/parsing/string/
// Zones (add-on):    https://momentjs.com/timezone/docs/#/using-timezones/parsing-in-zone/
//                    https://momentjs.com/timezone/docs/#/using-timezones/converting-to-zone/
// Arithmetic:        https://momentjs.com/docs/#/manipulating/add/
// A date or date-time with no zone is parsed with `moment(string)`, which is the machine's zone,
// as the docs say. Moment has no plain date type.
import moment from "moment-timezone";
import {
  hoursText,
  instantText,
  localText,
  nextDate,
  wallText,
} from "../adapter-util.mjs";
import { versionOf } from "../versions.mjs";

const wall = (m) =>
  wallText(
    m.year(),
    m.month() + 1,
    m.date(),
    m.hours(),
    m.minutes(),
    m.seconds(),
  );
const local = (m) =>
  localText(
    m.year(),
    m.month() + 1,
    m.date(),
    m.hours(),
    m.minutes(),
    m.seconds(),
    Math.round(m.utcOffset() * 60),
  );
const inZone = (instant, zone) => moment.utc(instant).tz(zone);
const startMs = (zone, date) => moment.tz(date, zone).startOf("day").valueOf();

export default {
  id: "moment",
  name: "Moment.js",
  version: `${versionOf("moment")} + moment-timezone ${versionOf("moment-timezone")}`,
  ops: {
    plainDate: ({ date }) => moment(date).format("YYYY-MM-DD"),
    plainDateTime: ({ wall: w }) => wall(moment(w)),
    plainDateAddDays: ({ date, days }) =>
      moment(date).add(days, "days").format("YYYY-MM-DD"),
    instantFromWall: ({ zone, wall: w }) =>
      instantText(moment.tz(w, zone).valueOf()),
    startOfDay: ({ zone, date }) => instantText(startMs(zone, date)),
    localAt: ({ zone, instant }) => local(inZone(instant, zone)),
    addDaysZoned: ({ zone, instant, days }) =>
      local(inZone(instant, zone).add(days, "days")),
    hoursInDay: ({ zone, date }) =>
      hoursText(startMs(zone, date), startMs(zone, nextDate(date))),
    utcFields: ({ instant }) => wall(moment.utc(instant)),
  },
};
