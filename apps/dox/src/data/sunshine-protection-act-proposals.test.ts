import { readFileSync } from "node:fs";
import { hasDaylightSaving } from "@northguild/gmt/zoned/validate";
import {
  AGE_WORDS_HELD,
  ageWords,
  longDate,
  NATIONAL,
  PROPOSALS_CHECKED,
  SOURCES,
  SOURCES_URL,
  STATE_CODES,
  STATES,
} from "./sunshine-protection-act-proposals";

const boundaries = JSON.parse(
  readFileSync(
    new URL("../../public/state-boundaries-us.json", import.meta.url),
    "utf8",
  ),
) as { features: { properties: { postal: string } }[] };
const postals = boundaries.features.map((f) => f.properties.postal);

/** Test-only: the zone.tab zone of each place that stays on standard time. */
const ZONE_OF: Record<string, string> = {
  AZ: "America/Phoenix",
  HI: "Pacific/Honolulu",
  PR: "America/Puerto_Rico",
  VI: "America/St_Thomas",
  GU: "Pacific/Guam",
  MP: "Pacific/Saipan",
  AS: "Pacific/Pago_Pago",
};

describe("STATES", () => {
  it("has 19 daylight-if-allowed rows", () => {
    expect(
      STATES.filter((row) => row.position === "daylight-if-allowed"),
    ).toHaveLength(19);
  });

  it("lists no postal code twice", () => {
    const codes = STATES.map((row) => row.postal);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("uses only postal codes the map draws", () => {
    for (const row of STATES) expect(postals).toContain(row.postal);
  });

  it("gives every row a source that SOURCES knows", () => {
    for (const row of STATES) expect(SOURCES).toHaveProperty(row.source);
  });

  it("keeps each standard-all-year place on standard time in the tz data", () => {
    for (const row of STATES.filter(
      (r) => r.position === "standard-all-year",
    )) {
      expect(
        hasDaylightSaving(ZONE_OF[row.postal], {
          at: `${PROPOSALS_CHECKED}T12:00:00Z`,
        }),
      ).toBe(false);
    }
  });

  it("shows the Navajo Nation's zone does change its clocks", () => {
    expect(
      hasDaylightSaving("America/Denver", {
        at: `${PROPOSALS_CHECKED}T12:00:00Z`,
      }),
    ).toBe(true);
  });

  it("names no law, bill or body in any string", () => {
    const strings = [
      ...STATES.flatMap((row) => [
        ...("condition" in row && row.condition ? [row.condition] : []),
        ...("note" in row && row.note ? [row.note] : []),
      ]),
      ...NATIONAL.effects,
    ];
    for (const text of strings) {
      expect(text).not.toMatch(
        /\b(Act|H\.R\.|S\.\s?\d|bill|statute|Congress|Senate|House|U\.S\.C)\b/i,
      );
    }
  });

  it("tells a reader on California's pin that its voters already cleared the way for daylight time all year", () => {
    const ca = STATES.find((row) => row.postal === "CA");
    expect(ca && "note" in ca ? ca.note : null).toMatch(
      /2018 voters .* two-thirds vote once federal law allows it/,
    );
  });

  it("gives a state a condition and a list of states it waits on together, except Tennessee", () => {
    for (const row of STATES) {
      if (row.kind !== "adopted" || row.position !== "daylight-if-allowed")
        continue;
      if (row.postal === "TN") {
        expect(row.condition).not.toBeNull();
        expect(row.waitsOn).toBeNull();
      } else {
        expect(row.waitsOn === null).toBe(row.condition === null);
      }
      for (const code of row.waitsOn?.among ?? [])
        expect(STATE_CODES).toContain(code);
    }
  });

  it("builds the national proposal's dated line from the check date", () => {
    expect(NATIONAL.effects[3]).toBe(
      "As of 13 November 2026 it had passed one chamber and was waiting in a committee of the other.",
    );
  });
});

describe("STATE_CODES", () => {
  it("equals the postal codes in the boundary file", () => {
    expect(STATE_CODES).toHaveLength(56);
    expect([...STATE_CODES].sort()).toEqual([...postals].sort());
  });
});

describe("SOURCES_URL", () => {
  it("points at the research file", () => {
    expect(SOURCES_URL).toMatch(/us-permanent-daylight-time\.md$/);
  });
});

describe("ageWords", () => {
  it("says today on the day it was checked", () => {
    expect(ageWords("2026-11-13")).toBe("today");
  });

  it("counts days", () => {
    expect(ageWords("2026-11-14")).toBe("1 day ago");
    expect(ageWords("2026-12-13")).toBe("30 days ago");
  });

  it("adds the session-ended note on the last day", () => {
    expect(ageWords("2027-01-02")).not.toMatch(/ended/);
    expect(ageWords("2027-01-03")).toMatch(
      /The national session this describes ended on 3 January 2027\. Positions may have changed since\.$/,
    );
  });
});

describe("AGE_WORDS_HELD", () => {
  it("is the last day of the session and a five-digit age after it", () => {
    expect(AGE_WORDS_HELD).toEqual([
      ageWords("2027-01-02"),
      "99999 days ago. The national session this describes ended on 3 January 2027. Positions may have changed since.",
    ]);
    expect(AGE_WORDS_HELD[0]).toBe("50 days ago");
  });

  it("is at least as long as the age words on any day of either kind", () => {
    for (const day of ["2026-11-13", "2026-11-14", "2027-01-02"])
      expect(ageWords(day).length).toBeLessThanOrEqual(
        AGE_WORDS_HELD[0]!.length,
      );
    for (const day of ["2027-01-03", "2030-06-01", "2100-01-01"])
      expect(ageWords(day).length).toBeLessThanOrEqual(
        AGE_WORDS_HELD[1]!.length,
      );
  });
});

describe("longDate", () => {
  it("writes day, month and year", () => {
    expect(longDate("2026-11-13")).toBe("13 November 2026");
    expect(longDate("2027-01-03")).toBe("3 January 2027");
  });
});
