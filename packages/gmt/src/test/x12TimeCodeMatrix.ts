import type { X12TimeCode } from "../types/edi";

/**
 * What one X12 data element 623 (Time Code) definition states, written from the code list by
 * hand. `definition` is the dictionary's own text. A code whose definition is an ISO designator
 * states an offset: `minutes` is that designator as signed minutes from UTC (`P` is plus, `M` is
 * minus) and `offset` is the same amount as `±HH:MM`. A code whose definition is a zone name
 * states no offset: `zone` is X12's name with "Daylight Time", "Standard Time" or "Time" taken
 * off, and `daylight` is which of the three it was.
 */
export type X12TimeCodeExpectation =
  | { definition: string; minutes: number; offset: string }
  | { definition: string; zone: string; daylight: boolean | null };

/**
 * The 56 codes of X12 data element 623, release 008010 (`25`–`29` were added in release 006010),
 * keyed by the code union so that a code with no row fails typecheck. Shared by the tests of
 * `x12TimeCode` and of `parseX12DateTime`, which resolves a segment's time code through it.
 *
 * `GM` ("Greenwich Mean Time") and `UT` ("Universal Time Coordinate") are zero minutes: UN/ECE
 * Recommendation 7 ¶12 names one scale by both names, "Co-ordinated Universal Time (formerly
 * known as Greenwich Mean Time)".
 */
export const X12_TIME_CODE_EXPECTATIONS: Record<
  X12TimeCode,
  X12TimeCodeExpectation
> = {
  "01": { definition: "Equivalent to ISO P01", minutes: 60, offset: "+01:00" },
  "02": { definition: "Equivalent to ISO P02", minutes: 120, offset: "+02:00" },
  "03": { definition: "Equivalent to ISO P03", minutes: 180, offset: "+03:00" },
  "04": { definition: "Equivalent to ISO P04", minutes: 240, offset: "+04:00" },
  "05": { definition: "Equivalent to ISO P05", minutes: 300, offset: "+05:00" },
  "06": { definition: "Equivalent to ISO P06", minutes: 360, offset: "+06:00" },
  "07": { definition: "Equivalent to ISO P07", minutes: 420, offset: "+07:00" },
  "08": { definition: "Equivalent to ISO P08", minutes: 480, offset: "+08:00" },
  "09": { definition: "Equivalent to ISO P09", minutes: 540, offset: "+09:00" },
  "10": { definition: "Equivalent to ISO P10", minutes: 600, offset: "+10:00" },
  "11": { definition: "Equivalent to ISO P11", minutes: 660, offset: "+11:00" },
  "12": { definition: "Equivalent to ISO P12", minutes: 720, offset: "+12:00" },
  // The run counts down: the code rises as the distance from UTC falls.
  "13": {
    definition: "Equivalent to ISO M12",
    minutes: -720,
    offset: "-12:00",
  },
  "14": {
    definition: "Equivalent to ISO M11",
    minutes: -660,
    offset: "-11:00",
  },
  "15": {
    definition: "Equivalent to ISO M10",
    minutes: -600,
    offset: "-10:00",
  },
  "16": {
    definition: "Equivalent to ISO M09",
    minutes: -540,
    offset: "-09:00",
  },
  "17": {
    definition: "Equivalent to ISO M08",
    minutes: -480,
    offset: "-08:00",
  },
  "18": {
    definition: "Equivalent to ISO M07",
    minutes: -420,
    offset: "-07:00",
  },
  "19": {
    definition: "Equivalent to ISO M06",
    minutes: -360,
    offset: "-06:00",
  },
  "20": {
    definition: "Equivalent to ISO M05",
    minutes: -300,
    offset: "-05:00",
  },
  "21": {
    definition: "Equivalent to ISO M04",
    minutes: -240,
    offset: "-04:00",
  },
  "22": {
    definition: "Equivalent to ISO M03",
    minutes: -180,
    offset: "-03:00",
  },
  "23": {
    definition: "Equivalent to ISO M02",
    minutes: -120,
    offset: "-02:00",
  },
  "24": { definition: "Equivalent to ISO M01", minutes: -60, offset: "-01:00" },
  "25": {
    definition: "Equivalent to ISO M2:30",
    minutes: -150,
    offset: "-02:30",
  },
  "26": {
    definition: "Equivalent to ISO M3:30",
    minutes: -210,
    offset: "-03:30",
  },
  "27": {
    definition: "Equivalent to ISO P5:30",
    minutes: 330,
    offset: "+05:30",
  },
  "28": {
    definition: "Equivalent to ISO P9:30",
    minutes: 570,
    offset: "+09:30",
  },
  "29": {
    definition: "Equivalent to ISO P10:30",
    minutes: 630,
    offset: "+10:30",
  },
  AD: { definition: "Alaska Daylight Time", zone: "Alaska", daylight: true },
  AS: { definition: "Alaska Standard Time", zone: "Alaska", daylight: false },
  AT: { definition: "Alaska Time", zone: "Alaska", daylight: null },
  CD: { definition: "Central Daylight Time", zone: "Central", daylight: true },
  CS: { definition: "Central Standard Time", zone: "Central", daylight: false },
  CT: { definition: "Central Time", zone: "Central", daylight: null },
  ED: { definition: "Eastern Daylight Time", zone: "Eastern", daylight: true },
  ES: { definition: "Eastern Standard Time", zone: "Eastern", daylight: false },
  ET: { definition: "Eastern Time", zone: "Eastern", daylight: null },
  GM: { definition: "Greenwich Mean Time", minutes: 0, offset: "+00:00" },
  HD: {
    definition: "Hawaii-Aleutian Daylight Time",
    zone: "Hawaii-Aleutian",
    daylight: true,
  },
  HS: {
    definition: "Hawaii-Aleutian Standard Time",
    zone: "Hawaii-Aleutian",
    daylight: false,
  },
  HT: {
    definition: "Hawaii-Aleutian Time",
    zone: "Hawaii-Aleutian",
    daylight: null,
  },
  LT: { definition: "Local Time", zone: "Local", daylight: null },
  MD: {
    definition: "Mountain Daylight Time",
    zone: "Mountain",
    daylight: true,
  },
  MS: {
    definition: "Mountain Standard Time",
    zone: "Mountain",
    daylight: false,
  },
  MT: { definition: "Mountain Time", zone: "Mountain", daylight: null },
  ND: {
    definition: "Newfoundland Daylight Time",
    zone: "Newfoundland",
    daylight: true,
  },
  NS: {
    definition: "Newfoundland Standard Time",
    zone: "Newfoundland",
    daylight: false,
  },
  NT: { definition: "Newfoundland Time", zone: "Newfoundland", daylight: null },
  PD: { definition: "Pacific Daylight Time", zone: "Pacific", daylight: true },
  PS: { definition: "Pacific Standard Time", zone: "Pacific", daylight: false },
  PT: { definition: "Pacific Time", zone: "Pacific", daylight: null },
  TD: {
    definition: "Atlantic Daylight Time",
    zone: "Atlantic",
    daylight: true,
  },
  TS: {
    definition: "Atlantic Standard Time",
    zone: "Atlantic",
    daylight: false,
  },
  TT: { definition: "Atlantic Time", zone: "Atlantic", daylight: null },
  UT: { definition: "Universal Time Coordinate", minutes: 0, offset: "+00:00" },
};
