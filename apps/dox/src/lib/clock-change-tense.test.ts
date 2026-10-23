/**
 * @vitest-environment jsdom
 *
 * The tense of the dated clock-change checkers (CORE-89): which form is true on a given day, the
 * date and time each region states, and the guard that no checker string names a tense of its own.
 * The library is the real one, passed in as the parameter.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { installJsdomShims } from "~/test/jsdom-shims";
import { CANADA_MOMENTS } from "./canada-clock-change";
import { renderCanadaClockChangeTemplate } from "./canada-clock-change-mount";
import { loadClockLib } from "./clock-change-mount";
import { REGION_KEY, changeTense, momentWords } from "./clock-change-tense";
import { canadaTenseAt, moroccoTense } from "./clock-change-tense.fixture";
import { MOROCCO_CHANGES, MOROCCO_MOMENTS } from "./morocco-clock-change";
import { renderMoroccoClockChangeTemplate } from "./morocco-clock-change-mount";

installJsdomShims();

const lib = await loadClockLib();
const ms = (utc: string) => lib.convertUtcToUnix(utc)!;

describe("changeTense", () => {
  const at = ms("2026-09-20T01:00:00Z");
  it("is before 1 ms ahead of the moment, and after at it and past it", () => {
    expect(changeTense(lib, at - 1, at)).toBe("before");
    expect(changeTense(lib, at, at)).toBe("after");
    expect(changeTense(lib, at + 1, at)).toBe("after");
  });
});

describe("the stated moments, pinned with the library", () => {
  it("writes Morocco's change as 02:00 local, 01:00 UTC", () => {
    expect(momentWords(lib, MOROCCO_MOMENTS[REGION_KEY]!)).toEqual({
      local: "20 September 2026 at 02:00",
      utc: "01:00",
    });
  });

  it("keeps Morocco's change equal to the stated change it duplicates", () => {
    const first = MOROCCO_CHANGES[0]!;
    for (const moment of Object.values(MOROCCO_MOMENTS)) {
      expect(moment).toEqual({ at: first.at, from: first.from });
    }
  });

  it("writes each Canadian zone at 02:00 on its own clock", () => {
    for (const [key, moment] of Object.entries(CANADA_MOMENTS)) {
      expect(momentWords(lib, moment)?.local, key).toBe(
        "1 November 2026 at 02:00",
      );
    }
  });

  it("makes the Canadian region's moment the latest zone's", () => {
    const latest = Math.max(
      ...Object.entries(CANADA_MOMENTS)
        .filter(([key]) => key !== REGION_KEY)
        .map(([, m]) => ms(m.at)),
    );
    expect(ms(CANADA_MOMENTS[REGION_KEY]!.at)).toBe(latest);
  });
});

/** The text of every tensed slot's true form, and the count of true forms per slot. */
function trueForms(root: ParentNode): { texts: string[]; perSlot: number[] } {
  const slots = [...root.querySelectorAll(".gmt-tense")];
  return {
    texts: slots.map(
      (s) =>
        s.querySelector(":scope > [data-form]:not([aria-hidden])")
          ?.textContent ?? "",
    ),
    perSlot: slots.map(
      (s) =>
        s.querySelectorAll(":scope > [data-form]:not([aria-hidden])").length,
    ),
  };
}

describe("the checkers read true on the day they are read", () => {
  it("Morocco: states the change in the past tense only, with no two-form cell", async () => {
    document.body.innerHTML = renderMoroccoClockChangeTemplate({
      keyPoints: true,
      tense: moroccoTense,
    });
    expect(document.body.querySelector(".gmt-tense")).toBeNull();
    expect(document.body.querySelector("[data-form]")).toBeNull();
    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/Stops changing/);
    expect(text).toContain(
      "Stopped changing clocks on 20 September 2026 at 02:00 local time (01:00 UTC)",
    );
    expect(text).toContain(
      "stopped changing their clocks. Since 20 September 2026 at 02:00 local time they stay on UTC+00 all year.",
    );
  });

  it("Canada: before shows the future form, after the past form", async () => {
    for (const [now, stem] of [
      ["2026-10-31T12:00:00Z", "Stops changing clocks on"],
      ["2026-11-02T12:00:00Z", "Stopped changing clocks on"],
    ] as const) {
      document.body.innerHTML = renderCanadaClockChangeTemplate({
        keyPoints: true,
        tense: await canadaTenseAt(now),
      });
      const { texts, perSlot } = trueForms(document.body);
      expect(perSlot.every((n) => n === 1)).toBe(true);
      expect(texts.some((t) => t.startsWith(stem))).toBe(true);
    }
  });
});

describe("no checker string names a tense of its own", () => {
  it("keeps the class verbs in the tense module", () => {
    const src = join(import.meta.dirname, "..");
    const hits = readdirSync(src, { recursive: true, encoding: "utf8" })
      .filter((f) => /\.(?:ts|tsx|astro)$/.test(f))
      .filter((f) => !/\.test\.|\.fixture\.|clock-change-tense\.ts$/.test(f))
      .filter((f) =>
        /Stops changing clocks|Stopped changing clocks/.test(
          readFileSync(join(src, f), "utf8"),
        ),
      );
    expect(hits).toEqual([]);
  });
});
