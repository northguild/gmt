import { Temporal, Intl as TemporalIntl } from "@js-temporal/polyfill";

// Detects whether the running Node has full ICU (all locales) or a stripped
// ICU build. Locale-specific output from ICU-driven formatters
// (Intl.DateTimeFormat, Intl.RelativeTimeFormat) varies significantly between
// full and small/partial ICU runtimes; tests that assert exact locale strings
// need to know which environment they're in.
//
// Probe strategy: assert all of the locale features our test goldens depend
// on. A naive single-locale probe (e.g. just Spanish month names) is not
// sufficient — some Node builds (notably vite-plus's Node 24) ship partial
// ICU data: month names work for Spanish, but Korean day periods (오후/오전)
// fall back to "PM"/"AM", and Portuguese day periods short-fall to "p.m."
// instead of the full-ICU "da tarde". The probe checks all of:
//   - Spanish month name ("enero")
//   - Korean day period ("오후")
//   - Portuguese long day period ("da tarde")
// If any one falls back to a stripped form, treat the runtime as not-full.
//
// CONTRIBUTOR NOTE: if you add a `hasFullIcu ? "fullValue" : "partialValue"`
// ternary that depends on a locale feature NOT represented in this probe
// (e.g. Turkish long timezone names, Hebrew dual-form pluralization), extend
// the probe below to assert that feature too. Otherwise the probe could
// return `true` on a partial-ICU runtime that happens to have data for the
// existing probe features but not yours, and your test would fail silently
// on that runtime.
const PROBE_AFTERNOON = Temporal.PlainDateTime.from("2024-02-03T14:30:00");
const PROBE_JANUARY = Temporal.PlainDate.from("1970-01-10");

export const hasFullIcu =
  new TemporalIntl.DateTimeFormat("es", { month: "long" }).format(
    PROBE_JANUARY,
  ) === "enero" &&
  new TemporalIntl.DateTimeFormat("ko-KR", { hour: "numeric", hour12: true })
    .format(PROBE_AFTERNOON)
    .includes("오후") &&
  new TemporalIntl.DateTimeFormat("pt-PT", { hour: "numeric", hour12: true })
    .format(PROBE_AFTERNOON)
    .includes("da tarde");
