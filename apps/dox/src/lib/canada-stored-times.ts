/**
 * The stored-times check of the Canada 2026 clock-change checker (CORE-88). The shared logic
 * lives in `clock-check/stored-times.ts`; this module re-exports it and keeps `STORED_PRESET`,
 * Canada's own example lines.
 */
export * from "./clock-check/stored-times";

/**
 * The example lines. The first five are Toronto lines that give one of each kind on any tz
 * data; the last three are Canadian lines whose kind changed in 2026. The labels here never
 * claim a kind: the Worker's answer is what shows.
 */
export const STORED_PRESET: string = [
  "2026-07-01T12:00:00-04:00[America/Toronto]",
  "2026-11-01T01:30:00-04:00[America/Toronto]",
  "2026-07-01T12:00:00-05:00[America/Toronto]",
  "2026-11-01T01:30:00-06:00[America/Toronto]",
  "2027-03-14T02:30:00-05:00[America/Toronto]",
  "2026-11-15T09:00:00-08:00[America/Vancouver]",
  "2027-03-14T02:30:00-07:00[America/Edmonton]",
  "2026-11-01T01:30:00-05:00[America/Winnipeg]",
].join("\n");
