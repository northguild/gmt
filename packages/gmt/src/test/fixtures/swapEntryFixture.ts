import { writeSync } from "node:fs";

/**
 * Stands in for the swap entry in `boundedChild.test.ts`. A child that loads it writes one result
 * line, `swap-entry-fixture-loaded`, to stdout, where the bounded child reads its results, so the test can
 * tell it from a child that loaded the real polyfill. It is not a working Temporal: the child
 * usually dies on the first call that needs one, and the marker is already out by then.
 */
// The test file holds its own copy of the marker: importing this file would print it there.
writeSync(1, `${JSON.stringify({ value: "swap-entry-fixture-loaded", ms: 0 })}\n`);

export const Temporal = {};
export const Intl = globalThis.Intl;
export const toTemporalInstant = () => undefined;
