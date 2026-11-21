// temporal-polyfill (FullCalendar): the Temporal API, documented at
// https://tc39.es/proposal-temporal/docs/ (the package implements it; its README links there).
import { Temporal } from "temporal-polyfill";
import { temporalOps } from "../temporal-ops.mjs";
import { versionOf } from "../versions.mjs";

export default {
  id: "temporal-polyfill",
  name: "temporal-polyfill",
  version: versionOf("temporal-polyfill"),
  ops: temporalOps(Temporal),
};
