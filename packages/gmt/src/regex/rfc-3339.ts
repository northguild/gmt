// RFC 3339 §5.6 date-time — the same field grammar as ISO 8601 but with a
// *mandatory* offset (Z or ±HH:MM) and a date/time separator that may be
// "T", "t", or " ". GMT's own zoned strings additionally carry a bracketed
// IANA zone annotation ("...+00:00[UTC]") that RFC 3339 does not permit,
// which is why this needs its own regex rather than reusing `plainDateTime`
// or `zoned`-style patterns (see roadmap J13's RFC 3339 go/no-go decision).
export const rfc3339DateTime: RegExp =
  /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])[Tt ](0[0-9]|1[0-9]|2[0-3]):([0-5][0-9]):([0-5][0-9])(\.[0-9]{1,9})?(Z|z|[+-][0-9]{2}:[0-9]{2})$/;
