/**
 * `holidayFacts`: the year and the library's attribution of every date to its rule, moved out of
 * the mount's redraw. A year outside the range is the one refusal, and it makes no library call.
 */
import { loadHolidayLib } from "./holiday-lib";
import { attributeRules } from "./holiday-widgets";
import {
  BUILDER_PRESETS,
  holidayFacts,
  presetState,
  rulesOf,
  YEAR_MAX,
  YEAR_MIN,
} from "./holiday-rule-builder";

const lib = await loadHolidayLib();

const preset = BUILDER_PRESETS[0];
if (preset === undefined) throw new Error("no presets");

describe("holidayFacts", () => {
  it.each(BUILDER_PRESETS.map((p) => [p.id, p] as const))(
    "gives the year, the rules and the attribution for the %s preset",
    (_id, p) => {
      const state = presetState(p);
      const facts = holidayFacts(state, lib);
      expect(facts).toEqual({
        ok: true,
        year: p.year,
        rules: rulesOf(state),
        attribution: attributeRules(
          lib,
          {
            timeZone: state.zone,
            weekend: state.weekend,
            rules: rulesOf(state),
          },
          p.year,
        ),
      });
    },
  );

  it.each([
    ["too early", String(YEAR_MIN - 1)],
    ["too late", String(YEAR_MAX + 1)],
    ["blank", ""],
    ["not a number", "twenty"],
    ["not whole", "2024.5"],
  ])("refuses a year that is %s", (_why, year) => {
    const state = { ...presetState(preset), year };
    expect(holidayFacts(state, lib)).toEqual({ ok: false });
  });

  it("makes no library call for a refused year", () => {
    const untouched = new Proxy(
      {},
      {
        get(_target, name) {
          throw new Error(`the library was called: ${String(name)}`);
        },
      },
    );
    const state = { ...presetState(preset), year: "1800" };
    expect(holidayFacts(state, untouched as never)).toEqual({ ok: false });
  });

  it("accepts both ends of the range", () => {
    for (const year of [YEAR_MIN, YEAR_MAX]) {
      const facts = holidayFacts(
        { ...presetState(preset), year: String(year) },
        lib,
      );
      expect(facts.ok).toBe(true);
    }
  });
});
