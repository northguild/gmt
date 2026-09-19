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
  "Avoid date.getTimezoneOffset(). Timezone offsets change throughout the year, so use @northguild/gmt zoned methods instead.";

export const MSG_DATE_LIBRARY_IMPORT =
  "Avoid date libraries that wrap native Date (moment, dayjs, luxon, date-fns, spacetime). Use @northguild/gmt instead.";
