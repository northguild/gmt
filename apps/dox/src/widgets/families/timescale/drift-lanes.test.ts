/**
 * @vitest-environment jsdom
 */
import { screen, within } from "@testing-library/dom";
import { expectNoAxeViolations } from "~/test/render-widget";
import { html } from "../../builders";
import { renderHtml, type Fixture } from "../../test-fixture";
import {
  DRIFT_TICKS,
  FLOOR,
  driftGeometry,
  driftKey,
  driftLanes,
  keepApart,
  levelOf,
  type DriftView,
} from "./drift-lanes";

let page: Fixture;

const view = (over: Partial<DriftView> = {}): DriftView => ({
  lines: [
    {
      key: "jd",
      name: "Single JD",
      series: 1,
      points: [
        { year: 1972, ns: 17_000n },
        { year: 2000, ns: 17_000n },
        { year: 9999, ns: 38_000n },
      ],
    },
    {
      key: "mjd",
      name: "MJD",
      series: 2,
      points: [
        { year: 1972, ns: 160n },
        { year: 9999, ns: 17_000n },
      ],
    },
    {
      key: "parts",
      name: "Two-part JD",
      series: 4,
      points: [
        { year: 1972, ns: 0n },
        { year: 9999, ns: 0n },
      ],
    },
  ],
  cursorYear: 2000,
  yearMin: 1972,
  yearMax: 9999,
  label: "Drift from 1972 to 9999, on a log axis from 1 ns to 100 µs.",
  ...over,
});

const show = (v: DriftView) => {
  page = renderHtml(html`<div>${driftLanes(v)}</div>`);
};

describe("levelOf", () => {
  it("puts 1 ns on the floor band's top edge and 100 µs on the field's", () => {
    expect(levelOf(1n)).toBe(FLOOR);
    expect(levelOf(100_000n)).toBeCloseTo(100);
  });

  it("is logarithmic: each decade is the same height", () => {
    const step = levelOf(10n) - levelOf(1n);
    expect(levelOf(1_000n) - levelOf(100n)).toBeCloseTo(step);
    expect(levelOf(100_000n) - levelOf(10_000n)).toBeCloseTo(step);
  });

  it("puts nothing on the floor band, and clamps what is past the axis", () => {
    expect(levelOf(0n)).toBe(FLOOR / 2);
    expect(levelOf(10n ** 9n)).toBe(100);
  });
});

describe("keepApart", () => {
  it("leaves labels that are already apart where they are", () => {
    expect(keepApart([10, 40, 80])).toEqual([10, 40, 80]);
  });

  it("pushes close labels apart, in their order, inside the field", () => {
    const out = keepApart([98, 99, 100, 50]);
    const sorted = [...out].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i]! - sorted[i - 1]!).toBeGreaterThanOrEqual(12);
    }
    expect(Math.max(...out)).toBeLessThanOrEqual(100);
    expect(out[3]).toBeLessThan(out[0]!);
  });

  it("gives the same answer for the same input", () => {
    expect(keepApart([5, 5, 5])).toEqual(keepApart([5, 5, 5]));
  });
});

describe("driftGeometry", () => {
  const g = driftGeometry(view());

  it("draws each series as a step path that holds a sample until the next", () => {
    const jd = g.lines.find((l) => l.key === "jd")!;
    expect(jd.path.startsWith("M0 ")).toBe(true);
    expect(jd.path.match(/H/g)).toHaveLength(2);
    expect(jd.path.match(/V/g)).toHaveLength(2);
  });

  it("puts a drift of nothing on the floor band, for every sample", () => {
    const parts = g.lines.find((l) => l.key === "parts")!;
    expect(parts.end).toBe(FLOOR / 2);
    expect(parts.path).toBe("M0 92H100V92");
  });

  it("labels the four decades from 1 ns to 100 µs", () => {
    expect(g.yTicks.map((t) => t.label)).toEqual(
      DRIFT_TICKS.map((t) => t.label),
    );
  });

  it("puts the cursor at the reader's year, or nowhere", () => {
    expect(g.cursor).toBeCloseTo(((2000 - 1972) / (9999 - 1972)) * 100, 2);
    expect(driftGeometry(view({ cursorYear: null })).cursor).toBeNull();
  });

  it("does not move the axis when the data changes", () => {
    const other = driftGeometry(
      view({
        lines: [{ key: "jd", name: "Single JD", series: 1, points: [] }],
      }),
    );
    expect(other.yTicks).toEqual(g.yTicks);
    expect(other.xTicks).toEqual(g.xTicks);
  });
});

describe("driftLanes", () => {
  it("is one named image with a key that names every series", async () => {
    show(view());
    expect(screen.getByRole("img", { name: view().label })).toBeInTheDocument();
    const key = screen.getByRole("list", { name: "Key" });
    for (const name of ["Single JD", "MJD", "Two-part JD"]) {
      expect(within(key).getByText(name)).toBeInTheDocument();
    }
    await expectNoAxeViolations(page.host);
  });

  it("writes the axis in words: the decades, the floor band and the end years", () => {
    show(view());
    for (const t of DRIFT_TICKS) {
      expect(screen.getByText(t.label)).toBeInTheDocument();
    }
    expect(screen.getByText("exact")).toBeInTheDocument();
    expect(screen.getByText("1972")).toBeInTheDocument();
    expect(screen.getByText("9999")).toBeInTheDocument();
  });

  it("draws with no samples and no cursor", async () => {
    show(view({ lines: [], cursorYear: null, label: "Nothing measured" }));
    expect(
      screen.getByRole("img", { name: "Nothing measured" }),
    ).toBeInTheDocument();
    await expectNoAxeViolations(page.host);
  });

  it("driftKey alone lists the series", () => {
    page = renderHtml(driftKey(view()));
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });
});
