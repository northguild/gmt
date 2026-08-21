export const MSG_DATE_GLOBAL =
  "Avoid Date. Use @burglekitt/gmt getNow(), getUnixNow('milliseconds' | 'seconds'), getUtcNow(), or getZonedNow(timezone) instead.";

export const MSG_NEW_DATE =
  "Avoid new Date(). Use @burglekitt/gmt getUtcNow(), getNow(), or getZonedNow(timezone) instead.";

export const MSG_DATE_NOW =
  "Avoid Date.now(). Use @burglekitt/gmt getUnixNow('milliseconds' | 'seconds') or getNow() instead.";

export const MSG_DATE_UTC =
  "Avoid Date.UTC(). Use @burglekitt/gmt convertUtcDateTimeToUnix('YYYY-MM-DDTHH:mm:ss', 'milliseconds' | 'seconds') instead.";

export const MSG_DATE_PARSE =
  "Avoid Date.parse(). Use @burglekitt/gmt convertZonedToUnix(value) instead.";

export const MSG_GET_TIMEZONE_OFFSET =
  "Avoid date.getTimezoneOffset(). Timezone offsets change throughout the year, so use @burglekitt/gmt zoned methods instead.";
