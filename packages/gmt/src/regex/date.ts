export const year: RegExp = /^(?:\d{4}|[+-]\d{6})$/;
export const month: RegExp = /^(0[1-9]|1[0-2])$/;
export const day: RegExp = /^(0[1-9]|[12][0-9]|3[01])$/;

// ISO 8601 calendar date (extended): YYYY-MM-DD or ±YYYYYY-MM-DD
export const plainDate: RegExp =
  /^(?:\d{4}|[+-]\d{6})-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/;
