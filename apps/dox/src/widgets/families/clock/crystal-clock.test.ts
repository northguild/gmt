/**
 * @vitest-environment jsdom
 *
 * `crystalClock`: the face as a night-light button around a decorative svg, or as a named
 * image. Names, states and the pressed toggle are read the way a person meets them; the dial
 * geometry is read from `highlightPaths` and the markup string, never from the node tree.
 */
import { screen, within } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { html } from "~/widgets/builders";
import { renderHtml } from "~/widgets/test-fixture";
import {
  CLOCK_OUTER,
  bindClockToggle,
  crystalClock,
  crystalClockName,
  handAngles,
  handTip,
  highlightPaths,
} from "./crystal-clock";

const base = {
  id: "entry",
  hour: 1,
  minute: 30,
  label: "Entry clock",
  sublabel: "01:30, minus 04:00, New York",
};

function pair() {
  return html`${crystalClock(base)}${crystalClock({ ...base, id: "exit", label: "Exit clock" })}`;
}

function numbers(d: string): number[] {
  return (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
}

/** The polar formula recomputed here, so the test is not an echo of the builder. */
function expectedPoint(radius: number, deg: number): [number, number] {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [50 + radius * Math.cos(rad), 50 + radius * Math.sin(rad)];
}

describe("handAngles and handTip", () => {
  it("puts both hands at 12 at 00:00", () => {
    expect(handAngles(0, 0)).toEqual({ hourDeg: 0, minuteDeg: 0 });
  });

  it("turns the hour hand a quarter at 03:00", () => {
    expect(handAngles(3, 0)).toEqual({ hourDeg: 90, minuteDeg: 0 });
  });

  it("sits the hour hand halfway between 9 and 10 at 09:30", () => {
    expect(handAngles(9, 30)).toEqual({ hourDeg: 285, minuteDeg: 180 });
  });

  it("folds a 24-hour 12 onto the same face as 00:00", () => {
    expect(handAngles(12, 0)).toEqual({ hourDeg: 0, minuteDeg: 0 });
  });

  it("brings both hands almost back to 12 at 23:59", () => {
    const { hourDeg, minuteDeg } = handAngles(23, 59);
    expect(hourDeg).toBeCloseTo(359.5, 5);
    expect(minuteDeg).toBeCloseTo(354, 5);
  });

  it("points the minute hand straight up at 12, longer than the hour hand", () => {
    const minute = handTip("minute", 0);
    const hour = handTip("hour", 0);
    expect(Number(minute.x2)).toBeCloseTo(50, 1);
    expect(Number(minute.y2)).toBeLessThan(Number(hour.y2));
  });
});

describe("CLOCK_OUTER", () => {
  it("is a regular dodecagon of twelve vertices", () => {
    const points = CLOCK_OUTER.trim().split(/\s+/);
    expect(points).toHaveLength(12);
    for (const p of points) expect(p).toMatch(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/);
  });
});

describe("the night-light toggle", () => {
  it("wraps the face in an un-pressed button that carries the one name", () => {
    renderHtml(crystalClock(base));
    expect(
      screen.getByRole("button", {
        name: "Entry clock, 01:30, minus 04:00, New York. Light up the face.",
        pressed: false,
      }),
    ).toBeInTheDocument();
  });

  it("leaves the svg inside decorative, with no second image", () => {
    renderHtml(crystalClock(base));
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("draws a named image and no button with glowable: false", () => {
    renderHtml(crystalClock({ ...base, glowable: false }));
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(
      screen.getByRole("img", {
        name: "Entry clock, 01:30, minus 04:00, New York",
      }),
    ).toBeInTheDocument();
  });

  it("falls back to the bare label with no sublabel", () => {
    renderHtml(crystalClock({ ...base, sublabel: undefined, glowable: false }));
    expect(
      screen.getByRole("img", { name: "Entry clock" }),
    ).toBeInTheDocument();
  });

  it("toggles each clock on its own, by click and by keyboard", async () => {
    const user = userEvent.setup();
    const { host } = renderHtml(pair());
    const controller = new AbortController();
    bindClockToggle(host, controller.signal);
    const entry = within(host).getByRole("button", { name: /^Entry clock/ });
    const exit = within(host).getByRole("button", { name: /^Exit clock/ });

    await user.click(entry);
    expect(entry).toBePressed();
    expect(exit).not.toBePressed();

    entry.focus();
    await user.keyboard("{Enter}");
    expect(entry).not.toBePressed();
    await user.keyboard(" ");
    expect(entry).toBePressed();
    controller.abort();
  });

  it("stops listening on abort", async () => {
    const user = userEvent.setup();
    const { host } = renderHtml(crystalClock(base));
    const controller = new AbortController();
    bindClockToggle(host, controller.signal);
    controller.abort();
    const button = within(host).getByRole("button");
    await user.click(button);
    expect(button).not.toBePressed();
  });
});

describe("the accessible name", () => {
  it("folds the highlight's words in and never the seconds", () => {
    const name = crystalClockName({
      ...base,
      hour: 0,
      minute: 0,
      second: 42,
      sublabel: "00:00, minus 05:00, New York",
      highlight: {
        fromHour: 2,
        fromMinute: 0,
        toHour: 3,
        toMinute: 0,
        kind: "skipped",
      },
    });
    expect(name).toBe(
      "Entry clock, 00:00, minus 05:00, New York. 02:00–03:00 never shown",
    );
  });
});

describe("the highlight sector", () => {
  it("draws a skipped hour as one wedge from the centre, at the hour's own angles", () => {
    const [d, ...rest] = highlightPaths({
      fromHour: 2,
      fromMinute: 0,
      toHour: 3,
      toMinute: 0,
      kind: "skipped",
    });
    expect(rest).toHaveLength(0);
    // M cx cy L x1 y1 A r r 0 largeArc sweep x2 y2 Z
    const [cx, cy, x1, y1, r, , , largeArc, sweep, x2, y2] = numbers(d!);
    expect(cx).toBeCloseTo(50, 1);
    expect(cy).toBeCloseTo(50, 1);
    expect(largeArc).toBe(0);
    expect(sweep).toBe(1);
    const [ex1, ey1] = expectedPoint(r!, 60);
    const [ex2, ey2] = expectedPoint(r!, 90);
    expect(x1).toBeCloseTo(ex1, 1);
    expect(y1).toBeCloseTo(ey1, 1);
    expect(x2).toBeCloseTo(ex2, 1);
    expect(y2).toBeCloseTo(ey2, 1);
  });

  it("draws a repeated hour as two concentric arcs with no centre point", () => {
    const paths = highlightPaths({
      fromHour: 1,
      fromMinute: 0,
      toHour: 2,
      toMinute: 0,
      kind: "repeated",
    });
    expect(paths).toHaveLength(2);
    const [outer, inner] = paths.map((d) => numbers(d));
    expect(outer![2]).not.toBeCloseTo(inner![2]!, 1);
    // M x1 y1 A r r 0 largeArc sweep x2 y2
    const [x1, y1, r, , , , , x2, y2] = outer!;
    const [ex1, ey1] = expectedPoint(r!, 30);
    const [ex2, ey2] = expectedPoint(r!, 60);
    expect(x1).toBeCloseTo(ex1, 1);
    expect(y1).toBeCloseTo(ey1, 1);
    expect(x2).toBeCloseTo(ex2, 1);
    expect(y2).toBeCloseTo(ey2, 1);
  });

  it("titles the sector with the hour's words, once for a wedge and once per arc", () => {
    renderHtml(
      crystalClock({
        ...base,
        highlight: {
          fromHour: 1,
          fromMinute: 0,
          toHour: 2,
          toMinute: 0,
          kind: "repeated",
        },
      }),
    );
    expect(
      screen.getAllByText("01:00–02:00 shown twice", { selector: "title" }),
    ).toHaveLength(2);
  });

  it("draws no title with no highlight", () => {
    renderHtml(crystalClock(base));
    expect(
      screen.queryAllByText(/never shown|shown twice/, { selector: "title" }),
    ).toHaveLength(0);
  });
});

describe("the glass and its ids", () => {
  const ids = (markup: string): string[] =>
    [...markup.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]!);

  it("suffixes every def id with the caller's id", () => {
    const found = ids(crystalClock({ ...base, id: "exit" }).toString());
    expect(found).toHaveLength(4);
    for (const id of found) expect(id.endsWith("-exit")).toBe(true);
  });

  it("never repeats an id between two clocks on one page", () => {
    const all = [
      ...ids(crystalClock({ ...base, id: "entry" }).toString()),
      ...ids(crystalClock({ ...base, id: "exit" }).toString()),
    ];
    expect(new Set(all).size).toBe(all.length);
  });

  it("pins the shadow filter to the viewBox so collinear hands never empty it", () => {
    // At 00:00, 06:00, 12:00 and 18:00 the two hands are collinear and their own bounding box
    // is empty. A filter region in the hands' box would paint nothing; a viewBox region cannot.
    const markup = crystalClock({ ...base, hour: 0, minute: 0 }).toString();
    expect(markup).toMatch(
      /<filter [^>]*filterUnits="userSpaceOnUse"[^>]*x="0"[^>]*y="0"[^>]*width="100"[^>]*height="100"/,
    );
  });
});
