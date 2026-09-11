/**
 * The ways Dox can show an instant — each one a single `@northguild/gmt` call.
 *
 * The reset clock in the composer and the header clock are the places in the
 * chat where a real instant sits on screen, so they double as a sampler of the
 * library: the reader picks a format, sees the output, and sees the exact call
 * that produced it, linked to that function's reference page.
 *
 * ## Why every preset is in the UTC domain
 *
 * Both instants these presets render are already UTC ISO strings: the resets
 * `/api/brains` sends, and "now" from gmt's `getUtcNow()`. So every preset is a
 * direct call on that string — `formatCalendarUtc`, `formatRelativeUtc`,
 * `formatUtc`, `formatHttp`, `convertUtcToZoned`, `convertUtcToUnix` — with no
 * conversion first. A unix base needed a round trip for half the presets; a
 * zoned base would fix a zone into the value itself. UTC keeps one value type
 * and leaves the zone a rendering choice.
 *
 * `zoned` says whether the zone changes the output. A relative distance, a
 * Unix epoch and an HTTP date are the same everywhere, and the zone picker says
 * so instead of pretending to do something.
 *
 * `Intl.RelativeTimeFormat` has exactly three styles — long, short and narrow —
 * which is why there is no "medium" relative preset.
 */
import {
  convertUtcToUnix,
  convertUtcToZoned,
  formatCalendarUtc,
  formatHttp,
  formatRelativeUtc,
  formatUtc,
} from "@northguild/gmt";

export interface ResetFormatContext {
  /** IANA zone the reader chose. Ignored by presets that are not `zoned`. */
  timeZone: string;
  /** BCP 47 locale for the localised presets. */
  locale: string;
  /** "Now", as a UTC ISO string from `getUtcNow()` — the `reference` for the
   * relative and calendar presets, passed explicitly so a render is
   * deterministic and a test can pin it. */
  now: string;
}

export type ResetFormatId =
  | "calendar"
  | "local"
  | "relative-long"
  | "relative-short"
  | "relative-narrow"
  | "iso-zoned"
  | "utc"
  | "http"
  | "unix-ms"
  | "unix-s";

export interface ResetFormat {
  id: ResetFormatId;
  label: string;
  /** The gmt function behind this preset, as the reader would import it. */
  fnName: string;
  /** That function's reference page. */
  route: string;
  /** Whether the chosen zone changes the output. */
  zoned: boolean;
  /** The instant, rendered. `""` when `value` is not a valid UTC instant —
   * gmt's own sentinel, passed straight through. */
  format: (value: string, ctx: ResetFormatContext) => string;
  /** The call as the reader could write it. `reference` is left out: it
   * defaults to now, which is what it is set to here. */
  call: (ctx: ResetFormatContext) => string;
}

/** The reader-facing preset. Human wording that depends on the zone, so the
 * zone picker matters from the first click. */
export const DEFAULT_RESET_FORMAT_ID: ResetFormatId = "calendar";

const quote = (value: string): string => JSON.stringify(value);

function relative(
  style: "long" | "short" | "narrow",
  label: string,
): ResetFormat {
  return {
    id: `relative-${style}`,
    label,
    fnName: "formatRelativeUtc",
    route: "/reference/utc/format/formatRelativeUtc",
    zoned: false,
    format: (value, { locale, now }) =>
      formatRelativeUtc(value, locale, { style, reference: now }),
    call: ({ locale }) =>
      `formatRelativeUtc(resetsAt, ${quote(locale)}, { style: ${quote(style)} })`,
  };
}

function unix(unit: "milliseconds" | "seconds", label: string): ResetFormat {
  return {
    id: unit === "milliseconds" ? "unix-ms" : "unix-s",
    label,
    fnName: "convertUtcToUnix",
    route: "/reference/utc/convert/convertUtcToUnix",
    zoned: false,
    format: (value) => {
      const epoch = convertUtcToUnix(value, unit);
      return epoch === null ? "" : String(epoch);
    },
    call: () =>
      unit === "milliseconds"
        ? "convertUtcToUnix(resetsAt)"
        : 'convertUtcToUnix(resetsAt, "seconds")',
  };
}

export const RESET_FORMATS: readonly ResetFormat[] = [
  {
    id: "calendar",
    label: "Calendar",
    fnName: "formatCalendarUtc",
    route: "/reference/utc/format/formatCalendarUtc",
    zoned: true,
    format: (value, { timeZone, locale, now }) =>
      formatCalendarUtc(value, locale, { timeZone, reference: now }),
    call: ({ timeZone, locale }) =>
      `formatCalendarUtc(resetsAt, ${quote(locale)}, { timeZone: ${quote(timeZone)} })`,
  },
  {
    id: "local",
    label: "Local date-time",
    fnName: "formatUtc",
    route: "/reference/utc/format/formatUtc",
    zoned: true,
    format: (value, { timeZone, locale }) =>
      formatUtc(value, locale, { timeZone, includeTimeZoneName: true }),
    call: ({ timeZone, locale }) =>
      `formatUtc(resetsAt, ${quote(locale)}, { timeZone: ${quote(timeZone)}, includeTimeZoneName: true })`,
  },
  relative("long", "Relative long"),
  relative("short", "Relative short"),
  relative("narrow", "Relative narrow"),
  {
    id: "iso-zoned",
    label: "ISO 8601 zoned (RFC 9557)",
    fnName: "convertUtcToZoned",
    route: "/reference/utc/convert/convertUtcToZoned",
    zoned: true,
    format: (value, { timeZone }) => convertUtcToZoned(value, timeZone),
    call: ({ timeZone }) => `convertUtcToZoned(resetsAt, ${quote(timeZone)})`,
  },
  {
    id: "utc",
    label: "UTC date-time",
    fnName: "formatUtc",
    route: "/reference/utc/format/formatUtc",
    zoned: false,
    format: (value, { locale }) =>
      formatUtc(value, locale, { timeZone: "UTC", includeTimeZoneName: true }),
    call: ({ locale }) =>
      `formatUtc(resetsAt, ${quote(locale)}, { timeZone: "UTC", includeTimeZoneName: true })`,
  },
  {
    id: "http",
    label: "HTTP date",
    fnName: "formatHttp",
    route: "/reference/utc/format/formatHttp",
    zoned: false,
    format: (value) => formatHttp(value),
    call: () => "formatHttp(resetsAt)",
  },
  unix("milliseconds", "Unix milliseconds"),
  unix("seconds", "Unix seconds"),
];

export function isResetFormatId(value: unknown): value is ResetFormatId {
  return RESET_FORMATS.some((preset) => preset.id === value);
}

/** The preset for `id`, or the default one for an unknown id (a stale value
 * in storage, say). */
export function findResetFormat(id: string): ResetFormat {
  return (
    RESET_FORMATS.find((preset) => preset.id === id) ??
    (RESET_FORMATS.find(
      (preset) => preset.id === DEFAULT_RESET_FORMAT_ID,
    ) as ResetFormat)
  );
}

/**
 * The preset to render a live "now" clock with.
 *
 * A relative distance from now to now is always "now", which is no clock at
 * all, so the relative presets fall back to the calendar one. Every other
 * preset renders the current instant as it would a reset.
 */
export function liveClockFormat(id: string): ResetFormat {
  const preset = findResetFormat(id);
  return preset.fnName === "formatRelativeUtc"
    ? findResetFormat("calendar")
    : preset;
}
