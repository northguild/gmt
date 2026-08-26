export const MSG_DATE_GLOBAL =
  "Avoid Date. Use @northguild/gmt getNow(), getUnixNow('milliseconds' | 'seconds'), getUtcNow(), or getZonedNow(timezone) instead.";

export const MSG_NEW_DATE =
  "Avoid new Date(). Use @northguild/gmt getUtcNow(), getNow(), or getZonedNow(timezone) instead.";

export const MSG_DATE_NOW =
  "Avoid Date.now(). Use @northguild/gmt getUnixNow('milliseconds' | 'seconds') or getNow() instead.";

export const MSG_DATE_UTC =
  "Avoid Date.UTC(). Use @northguild/gmt convertUtcDateTimeToUnix('YYYY-MM-DDTHH:mm:ss', 'milliseconds' | 'seconds') instead.";

export const MSG_DATE_PARSE =
  "Avoid Date.parse(). Use @northguild/gmt convertZonedToUnix(value) instead.";

export const MSG_GET_TIMEZONE_OFFSET =
  "Avoid date.getTimezoneOffset(). Timezone offsets change throughout the year, so use @northguild/gmt zoned methods instead.";
