import { diffDate } from "@northguild/gmt/plain/calculate";
import { formatDate } from "@northguild/gmt/plain/format";

export type Position =
  | "standard-all-year"
  | "daylight-if-allowed"
  | "standard-proposed";

/** A key of `SOURCES`. The page never shows it as a citation. */
export type SourceId = "crs-r45208" | "tzdb" | "ca-scr7";

/** Where each source sits in the research file. */
export const SOURCES: Readonly<Record<SourceId, string>> = {
  "crs-r45208": "research file, sections 3.3 and 4",
  tzdb: "research file, section 1.1",
  "ca-scr7": "research file, section 4.4",
};

/**
 * The states a daylight row waits on: at least `need` of `among` (postal codes) must do the same.
 * `among` is empty when the state's text names no list (Colorado: "other Mountain-time states").
 */
interface WaitsOn {
  need: number;
  among: readonly string[];
}

/** A state law for daylight time all year, if federal law allows it. */
interface DaylightRow {
  kind: "adopted";
  /** The state's postal code, as in `state-boundaries-us.json`. */
  postal: string;
  position: "daylight-if-allowed";
  measure: "law";
  /** The year the law was adopted. */
  year: number;
  /** What else must happen first, as effects; null when federal law alone is the premise. */
  condition: string | null;
  /** The states the law waits on; null when it waits on no other state. */
  waitsOn: WaitsOn | null;
  source: SourceId;
}

/** A state on standard time all year already, or one that proposed it. */
interface StandardRow {
  kind: "adopted";
  postal: string;
  position: "standard-all-year" | "standard-proposed";
  measure: "law" | "resolution";
  year: number;
  /** A fact about the place the pin states beside the position; null when there is none. */
  note: string | null;
  source: SourceId;
}

interface TerritoryRow {
  kind: "territory";
  postal: string;
  position: "standard-all-year";
  source: SourceId;
}

export type StateRow = DaylightRow | StandardRow | TerritoryRow;

/** The day the facts below were checked (a PlainDate string). */
export const PROPOSALS_CHECKED = "2026-11-13";

/** The day the national session these facts describe ends (a PlainDate string). */
export const SESSION_ENDS = "2027-01-03";

/** The research file on GitHub: the one place that cites law. */
export const SOURCES_URL =
  "https://github.com/northguild/gmt/blob/main/context/domination/research/us-permanent-daylight-time.md";

/** `2026-11-13` as `13 November 2026`, written by the library. */
export function longDate(plainDate: string): string {
  return formatDate(plainDate, "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const daylight = (
  postal: string,
  year: number,
  condition: string | null = null,
  waitsOn: WaitsOn | null = null,
): StateRow => ({
  kind: "adopted",
  postal,
  position: "daylight-if-allowed",
  measure: "law",
  year,
  condition,
  waitsOn,
  source: "crs-r45208",
});

const territory = (postal: string): StateRow => ({
  kind: "territory",
  postal,
  position: "standard-all-year",
  source: "tzdb",
});

const WEST_UT = ["AZ", "CA", "CO", "ID", "MT", "NV", "NM", "OR", "WA", "WY"];
const WEST_WY = ["CO", "ID", "MT", "NE", "ND", "SD", "UT", "WY"];
const WEST_MT = ["ID", "MT", "ND", "SD", "UT", "WY"];

export const STATES: readonly StateRow[] = [
  // Daylight time all year, if federal law allows it. A row with no condition waits on federal
  // law alone. A row with a condition states its own route, which is not always a change in
  // federal law (Delaware: a move to Atlantic time; Montana: either).
  daylight("FL", 2018),
  daylight(
    "DE",
    2019,
    "only if New York, Pennsylvania, New Jersey and Maryland do the same, and only if the state is moved to Atlantic time",
    { need: 4, among: ["NY", "PA", "NJ", "MD"] },
  ),
  daylight("ME", 2019),
  daylight(
    "OR",
    2019,
    "only if California and Washington both do the same. Not the part of the state on Mountain time. Lapses if not in force by 1 December 2029",
    { need: 2, among: ["CA", "WA"] },
  ),
  daylight(
    "TN",
    2019,
    "only after the state certifies the change and confirms it by a further vote",
  ),
  daylight("WA", 2019),
  daylight(
    "ID",
    2020,
    "only the part of the state on Pacific time, and only once Washington changes",
    { need: 1, among: ["WA"] },
  ),
  daylight("LA", 2020),
  daylight("SC", 2020),
  daylight(
    "UT",
    2020,
    "only if at least four other western states do the same",
    { need: 4, among: WEST_UT },
  ),
  daylight(
    "WY",
    2020,
    "only if at least four western states, Wyoming included, do the same",
    { need: 4, among: WEST_WY },
  ),
  daylight("AL", 2021),
  daylight("GA", 2021),
  daylight("MN", 2021),
  daylight("MS", 2021),
  daylight(
    "MT",
    2021,
    "only if at least four western states, Montana included, do the same, and either federal law changes or the state is moved to Central time",
    { need: 4, among: WEST_MT },
  ),
  daylight(
    "CO",
    2022,
    "only if at least four other Mountain-time states do the same",
    { need: 4, among: [] },
  ),
  daylight("OK", 2024),
  daylight("TX", 2025),

  // Standard time all year already, by the tz data.
  {
    kind: "adopted",
    postal: "AZ",
    position: "standard-all-year",
    measure: "law",
    year: 1968,
    note: "The Navajo Nation, in the north-east, keeps daylight time.",
    source: "crs-r45208",
  },
  {
    kind: "adopted",
    postal: "HI",
    position: "standard-all-year",
    measure: "law",
    year: 1967,
    note: null,
    source: "crs-r45208",
  },
  territory("PR"),
  territory("VI"),
  territory("GU"),
  territory("MP"),
  territory("AS"),

  // Standard time all year proposed.
  {
    kind: "adopted",
    postal: "CA",
    position: "standard-proposed",
    measure: "resolution",
    year: 2026,
    note: "A resolution states the health case for standard time all year. Proposals to make it law passed neither chamber.",
    source: "ca-scr7",
  },
];

/** The national proposal, in effects only. */
export const NATIONAL: { effects: readonly string[] } = {
  effects: [
    "End the twice-yearly change and keep every zone one hour later than its standard time today, all year.",
    "Start on the day it becomes law. It sets no later start date.",
    "A state or area that was already on standard time all year before the day it becomes law could keep its current time.",
    `As of ${longDate(PROPOSALS_CHECKED)} it had passed one chamber and was waiting in a committee of the other.`,
  ],
};

/** The 56 postal codes of the places the map draws: the 50 states, DC and five territories. */
export const STATE_CODES: readonly string[] = [
  "AK",
  "AL",
  "AR",
  "AS",
  "AZ",
  "CA",
  "CO",
  "CT",
  "DC",
  "DE",
  "FL",
  "GA",
  "GU",
  "HI",
  "IA",
  "ID",
  "IL",
  "IN",
  "KS",
  "KY",
  "LA",
  "MA",
  "MD",
  "ME",
  "MI",
  "MN",
  "MO",
  "MP",
  "MS",
  "MT",
  "NC",
  "ND",
  "NE",
  "NH",
  "NJ",
  "NM",
  "NV",
  "NY",
  "OH",
  "OK",
  "OR",
  "PA",
  "PR",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VA",
  "VI",
  "VT",
  "WA",
  "WI",
  "WV",
  "WY",
];

/**
 * How old the data is, as words that follow "Last checked on 13 November 2026,": "today" or
 * "30 days ago". On or after `SESSION_ENDS` it adds a sentence saying the session ended.
 * `today` is a PlainDate string, so a test fixes it.
 */
export function ageWords(today: string): string {
  const raw = diffDate(PROPOSALS_CHECKED, today, "days");
  const days = typeof raw === "number" && raw > 0 ? raw : 0;
  const age =
    days === 0 ? "today" : `${days} ${days === 1 ? "day" : "days"} ago`;
  const ended = diffDate(SESSION_ENDS, today, "days");
  return typeof ended === "number" && ended >= 0
    ? `${age}. The national session this describes ended on ${longDate(SESSION_ENDS)}. Positions may have changed since.`
    : age;
}
