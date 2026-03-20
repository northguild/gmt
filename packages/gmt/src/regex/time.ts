// regex patterns exported for usage
export const hour: RegExp = /^(0[0-9]|1[0-9]|2[0-3])$/;
export const minute: RegExp = /^[0-5][0-9]$/;
export const second: RegExp = /^[0-5][0-9]$/;
export const fractionalSecond: RegExp = /^[0-9]{1,9}$/;
// Backward-compatible alias; prefer fractionalSecond for new usage.
export const millisecond: RegExp = fractionalSecond;

// ISO 8601 local time (extended): HH:mm[:ss[.fffffffff]]
export const plainTime: RegExp =
  /^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9](?::[0-5][0-9](?:[.,][0-9]{1,9})?)?$/;
