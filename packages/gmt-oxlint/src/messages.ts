import type { BannedDateLibrary } from "./utils";

export const MSG_DATE_GLOBAL =
  "Avoid Date. Use @northguild/gmt getNow(), getUnixNow({ epochUnit: 'milliseconds' | 'seconds' }), getUtcNow(), or getZonedNow(timezone) instead.";

export const MSG_NEW_DATE =
  "Avoid new Date(). Use @northguild/gmt getUtcNow(), getNow(), or getZonedNow(timezone) instead.";

export const MSG_DATE_NOW =
  "Avoid Date.now(). Use @northguild/gmt getUnixNow({ epochUnit: 'milliseconds' | 'seconds' }) or getNow() instead.";

export const MSG_DATE_UTC =
  "Avoid Date.UTC(). Use @northguild/gmt convertUtcToUnix('YYYY-MM-DDTHH:mm:ssZ', { epochUnit: 'milliseconds' | 'seconds' }) instead.";

export const MSG_DATE_PARSE =
  "Avoid Date.parse(). Use @northguild/gmt convertZonedToUnix(value) instead.";

export const MSG_GET_TIMEZONE_OFFSET =
  "Avoid date.getTimezoneOffset(). Timezone offsets change throughout the year, so use @northguild/gmt getTimeZoneOffset(timeZone, instant) instead.";

const MIGRATE_URL = "https://northguild.dev/gmt/migrate/";

/** Points at the migration guide that maps the library's calls to gmt calls. */
const guideFor = (name: string, slug: string): string =>
  `${MIGRATE_URL}${slug}/ maps ${name} calls to their gmt replacements.`;

const MOMENT_GUIDE = guideFor("Moment.js", "moment");
const DATE_FNS_GUIDE = guideFor("date-fns", "date-fns");

/** The guide each banned package points at. spacetime has no guide of its own. */
const DATE_LIBRARY_GUIDES: Record<BannedDateLibrary, string> = {
  moment: MOMENT_GUIDE,
  "moment-timezone": MOMENT_GUIDE,
  dayjs: guideFor("Day.js", "dayjs"),
  luxon: guideFor("Luxon", "luxon"),
  "date-fns": DATE_FNS_GUIDE,
  "date-fns-tz": DATE_FNS_GUIDE,
  "@date-fns/tz": DATE_FNS_GUIDE,
  spacetime: `${MIGRATE_URL} lists the migration guides.`,
};

export const dateLibraryImportMessage = (lib: BannedDateLibrary): string =>
  `Avoid ${lib}: it wraps native Date. Use @northguild/gmt instead; ${DATE_LIBRARY_GUIDES[lib]}`;
