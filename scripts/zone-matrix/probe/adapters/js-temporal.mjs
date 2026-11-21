// @js-temporal/polyfill: the Temporal API, https://tc39.es/proposal-temporal/docs/
// It is also one of the two sources of the expected answers, so it can only disagree with itself
// by a bug the other Temporal would not share; the cases were kept only where both agreed.
import { Temporal } from "@js-temporal/polyfill";
import { temporalOps } from "../temporal-ops.mjs";
import { versionOf } from "../versions.mjs";

export default {
  id: "js-temporal",
  name: "@js-temporal/polyfill",
  version: versionOf("@js-temporal/polyfill"),
  ops: temporalOps(Temporal),
};
