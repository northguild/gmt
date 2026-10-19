/**
 * The one module in `src` that names the Temporal implementation. Every other file, tests
 * included, imports from here, so the implementation can change in one place.
 */
export { Intl, Temporal, toTemporalInstant } from "@js-temporal/polyfill";
