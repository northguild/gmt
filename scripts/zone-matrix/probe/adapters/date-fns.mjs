// date-fns 4.4.0 with @date-fns/tz 1.5.0.
// Parsing:    https://date-fns.org/docs/parseISO
// Time zones: https://date-fns.org/docs/Time-Zones  (the `in` option and `TZDate`)
// `parseISO(string)` with no `in` option is the machine's zone.
import { addDays, format, parseISO, startOfDay } from "date-fns";
import { TZDate, tz } from "@date-fns/tz";
import {
  hoursText,
  instantText,
  localText,
  nextDate,
  wallText,
} from "../adapter-util.mjs";
import { versionOf } from "../versions.mjs";

const wall = (d) =>
  wallText(
    d.getFullYear(),
    d.getMonth() + 1,
    d.getDate(),
    d.getHours(),
    d.getMinutes(),
    d.getSeconds(),
  );
const local = (d) =>
  localText(
    d.getFullYear(),
    d.getMonth() + 1,
    d.getDate(),
    d.getHours(),
    d.getMinutes(),
    d.getSeconds(),
    // The probe feeds date-fns its own documented API; the repository rule that bans this call is for code that has GMT.
    // oxlint-disable-next-line @northguild/gmt-oxlint/no-date-getTimezoneOffset
    Math.round(-d.getTimezoneOffset() * 60),
  );
const inZone = (instant, zone) => new TZDate(parseISO(instant).getTime(), zone);
const startMs = (zone, date) =>
  startOfDay(parseISO(date, { in: tz(zone) }), { in: tz(zone) }).getTime();

export default {
  id: "date-fns",
  name: "date-fns",
  version: `${versionOf("date-fns")} + @date-fns/tz ${versionOf("@date-fns/tz")}`,
  ops: {
    plainDate: ({ date }) => format(parseISO(date), "yyyy-MM-dd"),
    plainDateTime: ({ wall: w }) => wall(parseISO(w)),
    plainDateAddDays: ({ date, days }) =>
      format(addDays(parseISO(date), days), "yyyy-MM-dd"),
    instantFromWall: ({ zone, wall: w }) =>
      instantText(parseISO(w, { in: tz(zone) }).getTime()),
    startOfDay: ({ zone, date }) => instantText(startMs(zone, date)),
    localAt: ({ zone, instant }) => local(inZone(instant, zone)),
    addDaysZoned: ({ zone, instant, days }) =>
      local(addDays(inZone(instant, zone), days)),
    hoursInDay: ({ zone, date }) =>
      hoursText(startMs(zone, date), startMs(zone, nextDate(date))),
    utcFields: ({ instant }) =>
      wall(new TZDate(parseISO(instant).getTime(), "UTC")),
  },
};
