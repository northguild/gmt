// ANSI SQL / ODBC timestamp literal: space-separated (never "T"), always
// zero-padded (unlike RFC 2822's lenient 1-2 digit day), with an optional
// fractional-seconds component. This checks *shape* only — `parseSql` still
// hands the extracted string to `Temporal.PlainDateTime.from` for real
// calendar validation, same as GMT's other `isValid*` + `Temporal.*.from`
// pairs.
export const sqlDateTime: RegExp =
  /^(?:\d{4}|[+-]\d{6})-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01]) (0[0-9]|1[0-9]|2[0-3]):[0-5][0-9](?::[0-5][0-9](?:\.[0-9]{1,9})?)?$/;
