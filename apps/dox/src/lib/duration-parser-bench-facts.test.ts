/**
 * `durationFacts`: the facts the Duration Parser Bench draws and the tool reports, moved out of
 * the mount. It is `benchView` on the state's own text and locale, with no guard of its own.
 */
import { loadDurationBenchLib } from "./duration-bench-lib";
import {
  benchView,
  durationFacts,
  readArgs,
  REFUSAL_TEXT,
} from "./duration-parser-bench";

const lib = await loadDurationBenchLib();

describe("durationFacts", () => {
  it.each([
    { text: "2h 30m", locale: "en" },
    { text: "PT45M", locale: "de" },
    { text: "P1Y2M3DT4H5M6S", locale: "fr" },
    { text: " 2h", locale: "en" },
  ])("is benchView on the text $text in $locale", (args) => {
    const state = readArgs(args);
    expect(durationFacts(state, lib)).toEqual(
      benchView(lib, state.text, state.locale),
    );
  });

  it("gives the page's refusal for a text neither parser reads, and writes nothing else", () => {
    const view = durationFacts(readArgs({ text: "banana" }), lib);
    expect(view.parser).toBe("none");
    expect(view.refusal).toBe(REFUSAL_TEXT);
    expect(view.compact).toBeNull();
    expect(view.words).toBeNull();
  });

  it("reads a text the same way twice", () => {
    const state = readArgs({ text: "1h 15m", locale: "es" });
    expect(durationFacts(state, lib)).toEqual(durationFacts(state, lib));
  });
});
