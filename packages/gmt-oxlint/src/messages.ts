export const MSG_DATE_GLOBAL =
  "Aint nobody got time for Date. Use @burglekitt/gmt getNow(), getUnixNow('milliseconds' | 'seconds'), getUtcNow(), or getZonedNow(timezone) instead.";

export const MSG_NEW_DATE =
  "Aint nobody got time for new Date(). Use @burglekitt/gmt getUtcNow(), getNow(), or getZonedNow(timezone) instead.";

export const MSG_DATE_NOW =
  "Aint nobody got time for Date.now(). Use @burglekitt/gmt getUnixNow('milliseconds' | 'seconds') or getNow() instead.";

export const MSG_DATE_UTC =
  "Aint nobody got time for Date.UTC(). Use @burglekitt/gmt convertUtcDateTimeToUnix('YYYY-MM-DDTHH:mm:ss', 'milliseconds' | 'seconds') instead.";

export const MSG_DATE_PARSE =
  "Aint nobody got time for Date.parse(). Use @burglekitt/gmt convertZonedToUnix(value) instead.";

export const MSG_GET_TIMEZONE_OFFSET =
  "Aint nobody got time for date.getTimezoneOffset(). Timezone offsets change throughout the year, so use @burglekitt/gmt zoned methods instead.";
