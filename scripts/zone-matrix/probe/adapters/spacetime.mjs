// Spacetime 7.17.1.
// Docs: https://github.com/spencermountain/spacetime#readme (constructing, `goto`, `add`, `startOf`,
// `epoch`, `timezone().current.offset`). `spacetime(string)` with no zone is the machine's zone.
import spacetime from "spacetime";
import {
  hoursText,
  instantText,
  localText,
  nextDate,
  wallText,
} from "../adapter-util.mjs";
import { versionOf } from "../versions.mjs";

const wall = (s) =>
  wallText(s.year(), s.month() + 1, s.date(), s.hour(), s.minute(), s.second());
const local = (s) =>
  localText(
    s.year(),
    s.month() + 1,
    s.date(),
    s.hour(),
    s.minute(),
    s.second(),
    Math.round(s.timezone().current.offset * 3600),
  );
const inZone = (instant, zone) => spacetime(instant).goto(zone);
const startMs = (zone, date) => spacetime(date, zone).startOf("day").epoch;

export default {
  id: "spacetime",
  name: "Spacetime",
  version: versionOf("spacetime"),
  ops: {
    plainDate: ({ date }) => spacetime(date).format("iso-short"),
    plainDateTime: ({ wall: w }) => wall(spacetime(w)),
    plainDateAddDays: ({ date, days }) =>
      spacetime(date).add(days, "day").format("iso-short"),
    instantFromWall: ({ zone, wall: w }) =>
      instantText(spacetime(w, zone).epoch),
    startOfDay: ({ zone, date }) => instantText(startMs(zone, date)),
    localAt: ({ zone, instant }) => local(inZone(instant, zone)),
    addDaysZoned: ({ zone, instant, days }) =>
      local(inZone(instant, zone).add(days, "day")),
    hoursInDay: ({ zone, date }) =>
      hoursText(startMs(zone, date), startMs(zone, nextDate(date))),
    utcFields: ({ instant }) => wall(spacetime(instant).goto("UTC")),
  },
};
