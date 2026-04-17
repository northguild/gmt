// ISO 8601 UTC datetime: <date>T<time>Z with optional fractional seconds
export const utcDateTime: RegExp =
  /^(?:\d{4}|[+-]\d{6})-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])T(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9](?::[0-5][0-9](?:[.,]\d{1,9})?)?[Zz]$/;
