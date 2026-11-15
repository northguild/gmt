import { createPartsSynth } from "./weekYearSynth";
import type { WeekYearAnalysis } from "./weekYearText";

/*
 * CORE-112 (D23): parts built without calling the engine's `formatToParts` on the formatter. The
 * twins here are scripted stand-ins, so each row decides what the text fields are and the synth is
 * shown to name them from data, never to guess.
 */
const FIRST = 1705314030456;
const SECOND = 1705357230456;

const analysis: WeekYearAnalysis = {
  calendar: "gregory",
  timeZone: "UTC",
  numberingSystem: "latn",
  digits: new Set("0123456789"),
  reference: undefined as never,
  yearRuns: [],
  styles: [],
  labels: [],
  count: 0,
};

const resolved = {
  locale: "xx",
  calendar: "gregory",
  numberingSystem: "latn",
  timeZone: "UTC",
} as Intl.ResolvedDateTimeFormatOptions;

/** Twins whose month name equals the weekday name wherever `ties` says so. */
function scriptTwins(ties: (ms: number) => boolean) {
  vi.spyOn(Intl, "DateTimeFormat").mockImplementation(function (
    _locale: unknown,
    options: Intl.DateTimeFormatOptions,
  ) {
    return {
      resolvedOptions: () => ({}),
      formatToParts: (ms: number): Intl.DateTimeFormatPart[] => {
        if (options.weekday === "short" && options.month === undefined) {
          return [{ type: "weekday", value: "Mon" }];
        }
        if (
          options.month === "short" &&
          options.weekday === undefined &&
          options.day === undefined &&
          options.era === undefined
        ) {
          return [{ type: "month", value: ties(ms) ? "Mon" : "Jan" }];
        }
        return [];
      },
    };
  } as never);
}

const synth = () =>
  createPartsSynth(
    { weekday: "short", month: "short" },
    resolved,
    analysis,
    (ms) => ({
      text: ms === FIRST ? "Mon" : "Mon Jan",
      edits: [],
      runs: [],
    }),
  );

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createPartsSynth", () => {
  it("rejects a template date where two field types claim the same text and uses the next date", () => {
    scriptTwins((ms) => ms === FIRST);
    expect(synth()(SECOND)).toEqual([
      { type: "weekday", value: "Mon" },
      { type: "literal", value: " " },
      { type: "month", value: "Jan" },
    ]);
  });

  it("answers null when every template date has a tie", () => {
    scriptTwins(() => true);
    const answer = createPartsSynth(
      { weekday: "short", month: "short" },
      resolved,
      analysis,
      () => ({ text: "Mon", edits: [], runs: [] }),
    )(SECOND);
    expect(answer).toBeNull();
  });
});
