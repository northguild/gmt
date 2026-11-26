/**
 * @vitest-environment jsdom
 */
import { screen, within } from "@testing-library/dom";
import { expectNoAxeViolations } from "~/test/render-widget";
import { html } from "../../builders";
import { renderHtml, type Fixture } from "../../test-fixture";
import {
  barGeometry,
  barTicks,
  laneGeometry,
  scaleStack,
  stackKey,
  type PatternIds,
  type StackView,
} from "./scale-stack";

let page: Fixture;

const ids: PatternIds = { solid: "t-solid", hatch: "t-hatch", dots: "t-dots" };

const view = (over: Partial<StackView> = {}): StackView => ({
  label: "TAI − UTC 10 s, TT − TAI 20 s, TCG − TT 5 s",
  laneLabel: "TCG − TT against the year, from −1 s to 5 s",
  reach: 40,
  values: { steps: 10, constant: 20, drift: 5 },
  chips: [
    { key: "steps", name: "TAI − UTC", value: "10 s", words: "steps" },
    { key: "constant", name: "TT − TAI", value: "20 s", words: "constant" },
    { key: "drift", name: "TCG − TT", value: "5 s", words: "drifts" },
  ],
  lane: {
    points: [
      { year: 1972, value: -1 },
      { year: 2000, value: 1 },
      { year: 3000, value: null },
      { year: 9999, value: 5 },
    ],
    cursor: { year: 2000, value: 1 },
    yearMin: 1972,
    yearMax: 9999,
  },
  axisName: "seconds ahead of UTC",
  laneName: "TCG − TT, seconds",
  format: (s) => `${s} s`,
  keyWords: {
    steps: "steps at each inserted second",
    constant: "constant",
    drift: "drifts with time",
  },
  ...over,
});

const show = (v: StackView) => {
  page = renderHtml(html`<div>${scaleStack(v, ids)}</div>`);
};

describe("barGeometry", () => {
  it("lays the pieces end to end, each as wide as its share of the reach", () => {
    const [steps, constant, drift] = barGeometry(
      { steps: 10, constant: 20, drift: 5 },
      40,
    );
    expect(steps).toMatchObject({ from: 0, to: 25, negative: false });
    expect(constant).toMatchObject({ from: 25, to: 75 });
    expect(drift).toMatchObject({ from: 75, to: 87.5 });
    expect(steps!.to - steps!.from).toBeCloseTo(
      (constant!.to - constant!.from) / 2,
    );
  });

  it("draws a negative drift back from the end of TT", () => {
    const drift = barGeometry({ steps: 10, constant: 20, drift: -4 }, 40).find(
      (s) => s.key === "drift",
    )!;
    expect(drift.negative).toBe(true);
    expect(drift.to).toBe(75);
    expect(drift.from).toBe(65);
  });

  it("leaves a missing piece out without moving the others", () => {
    const segments = barGeometry(
      { steps: null, constant: 20, drift: null },
      40,
    );
    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({ key: "constant", from: 0, to: 50 });
  });

  it("never draws past the reach", () => {
    const [seg] = barGeometry({ steps: 100, constant: null, drift: null }, 40);
    expect(seg!.to).toBe(100);
  });

  it("draws nothing wide when the reach is zero", () => {
    const [seg] = barGeometry({ steps: 5, constant: null, drift: null }, 0);
    expect(seg).toMatchObject({ from: 0, to: 0 });
  });
});

describe("barTicks", () => {
  it("steps by 1, 2 or 5 times a power of ten, from 0 to inside the reach", () => {
    const ticks = barTicks(246);
    expect(ticks[0]).toEqual({ seconds: 0, at: 0 });
    expect(ticks.length).toBeLessThanOrEqual(8);
    expect(ticks.at(-1)!.seconds).toBeLessThanOrEqual(246);
    const step = ticks[1]!.seconds;
    expect([1, 2, 5].includes(step / 10 ** Math.floor(Math.log10(step)))).toBe(
      true,
    );
  });

  it("has a single tick for an empty scale", () => {
    expect(barTicks(0)).toEqual([{ seconds: 0, at: 0 }]);
  });
});

describe("laneGeometry", () => {
  const g = laneGeometry(view().lane);

  it("keeps zero inside the field and stands the extremes at its edges", () => {
    expect(g.min).toEqual({ level: 0, value: -1 });
    expect(g.max).toEqual({ level: 100, value: 5 });
    expect(g.zero).toBeCloseTo(100 / 6);
  });

  it("breaks the line where the library gave no value", () => {
    expect(g.path.match(/M/g)).toHaveLength(2);
  });

  it("ticks every 1000 years inside the range and marks the odd thousands minor", () => {
    expect(g.ticks.map((t) => t.year)).toEqual([
      2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000,
    ]);
    expect(g.ticks.find((t) => t.year === 3000)!.minor).toBe(true);
    expect(g.ticks.find((t) => t.year === 4000)!.minor).toBe(false);
  });

  it("puts the cursor at the reader's year and level, or nowhere", () => {
    expect(g.cursor!.at).toBeCloseTo(((2000 - 1972) / (9999 - 1972)) * 100);
    expect(g.cursor!.level).toBeCloseTo((2 / 6) * 100);
    expect(laneGeometry({ ...view().lane, cursor: null }).cursor).toBeNull();
  });

  it("has no extremes when every value is missing", () => {
    const none = laneGeometry({
      ...view().lane,
      points: [{ year: 2000, value: null }],
    });
    expect(none.min).toBeNull();
    expect(none.path).toBe("");
  });
});

describe("scaleStack", () => {
  it("is two named images, with the same values in a list and the three patterns in words", async () => {
    show(view());
    const bar = screen.getByRole("img", { name: view().label });
    expect(bar).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: view().laneLabel }),
    ).toBeInTheDocument();
    const list = screen
      .getAllByRole("list")
      .find((l) => within(l).queryByText(/TAI − UTC 10 s, steps/) !== null)!;
    expect(within(list).getAllByRole("listitem")).toHaveLength(3);
    const key = screen.getByRole("list", { name: "Key" });
    for (const words of Object.values(view().keyWords)) {
      expect(within(key).getByText(words)).toBeInTheDocument();
    }
    await expectNoAxeViolations(page.host);
  });

  it("keeps three chips, one per piece, in their order", () => {
    show(view());
    const names = ["TAI − UTC", "TT − TAI", "TCG − TT"];
    const found = names.map((n) => screen.getAllByText(n)[0]!);
    for (let i = 1; i < found.length; i++) {
      expect(
        found[i - 1]!.compareDocumentPosition(found[i]!) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
  });

  it("writes the lane's two extreme readings and its year ticks as text", () => {
    show(view());
    expect(screen.getAllByText("-1 s").length).toBeGreaterThan(0);
    expect(screen.getByText("2000")).toBeInTheDocument();
    expect(screen.getByText("9000")).toBeInTheDocument();
  });

  it("draws with no pieces and no cursor when the reading has none", async () => {
    show(
      view({
        label: "No stack to draw",
        values: { steps: null, constant: null, drift: null },
        lane: { ...view().lane, cursor: null },
      }),
    );
    expect(
      screen.getByRole("img", { name: "No stack to draw" }),
    ).toBeInTheDocument();
    await expectNoAxeViolations(page.host);
  });

  it("stackKey alone names the three patterns", () => {
    page = renderHtml(stackKey(view(), ids));
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });
});
