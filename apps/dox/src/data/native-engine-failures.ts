/**
 * How many GMT tests give a wrong answer on each runtime's built-in `Temporal` and the right one on
 * the polyfill, counted from the weekly native run's list of known failures. /bundle-size states
 * these to say why GMT ships no build without the polyfill; the bugs behind them are listed on
 * /upstream under "Native engines".
 */
import { KNOWN_NATIVE_FAILURES } from "../../../../scripts/lib/native-suite-tags.mjs";

type Leg = "node" | "chromium" | "firefox" | "webkit";

const onLeg = (leg: Leg) =>
  String(KNOWN_NATIVE_FAILURES.filter((row) => row.legs.includes(leg)).length);

/** Counts as strings, ready for the page and its Markdown twin. One row is one test. */
export const nativeFailures = {
  total: String(KNOWN_NATIVE_FAILURES.length),
  node: onLeg("node"),
  chromium: onLeg("chromium"),
  firefox: onLeg("firefox"),
  webkit: onLeg("webkit"),
} as const;
