/**
 * @vitest-environment jsdom
 *
 * `crystal-clock.ts` is pure geometry: hand angles from an hour and a
 * minute, and an SVG string. No gmt import, no DOM read — `DOMParser` here
 * is only this test's own well-formedness check.
 */
/// <reference types="vitest/globals" />
import {
  CLOCK_OUTER,
  bindClockGlow,
  handAngles,
  renderCrystalClock,
} from "./crystal-clock";

describe("handAngles", () => {
  it("00:00 — both hands at 12", () => {
    expect(handAngles(0, 0)).toEqual({ hourDeg: 0, minuteDeg: 0 });
  });

  it("03:00 — hour hand a quarter turn, minute hand at 12", () => {
    expect(handAngles(3, 0)).toEqual({ hourDeg: 90, minuteDeg: 0 });
  });

  it("09:30 — the hour hand sits halfway between 9 and 10", () => {
    expect(handAngles(9, 30)).toEqual({ hourDeg: 285, minuteDeg: 180 });
  });

  it("12:00 — a 24-hour 12 folds onto the same face as 00:00", () => {
    expect(handAngles(12, 0)).toEqual({ hourDeg: 0, minuteDeg: 0 });
  });

  it("23:59 — both hands almost back at 12", () => {
    const { hourDeg, minuteDeg } = handAngles(23, 59);
    expect(hourDeg).toBeCloseTo(359.5, 5);
    expect(minuteDeg).toBeCloseTo(354, 5);
  });
});

describe("CLOCK_OUTER", () => {
  it("is a regular dodecagon — exactly 12 vertices", () => {
    const points = CLOCK_OUTER.trim().split(/\s+/);
    expect(points).toHaveLength(12);
    for (const p of points) expect(p).toMatch(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/);
  });
});

describe("renderCrystalClock", () => {
  // glowable: false here so these assertions target the bare <svg> — the
  // night-light button wrapper (the default) has its own describe block
  // below, since it changes where the accessible name and role live.
  const base = {
    id: "test",
    hour: 1,
    minute: 30,
    label: "Entry clock",
    glowable: false,
  };

  it("renders a well-formed <svg>", () => {
    const svg = renderCrystalClock(base);
    const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
    expect(doc.querySelector("parsererror")).toBeNull();
    expect(doc.querySelector("svg")).not.toBeNull();
  });

  it("carries role=img and an accessible name built from label and sublabel", () => {
    const svg = renderCrystalClock({
      ...base,
      sublabel: "01:30, minus 04:00, New York",
    });
    const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
    const root = doc.querySelector("svg")!;
    expect(root.getAttribute("role")).toBe("img");
    expect(root.getAttribute("aria-label")).toBe(
      "Entry clock, 01:30, minus 04:00, New York",
    );
  });

  it("falls back to the bare label with no sublabel", () => {
    const svg = renderCrystalClock(base);
    const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
    expect(doc.querySelector("svg")!.getAttribute("aria-label")).toBe(
      "Entry clock",
    );
  });

  it("draws the bezel outline and the dial — no Dox-mark facet ring, no spokes", () => {
    const svg = renderCrystalClock(base);
    expect(svg).not.toContain("gmt-crystal-clock-ring");
    expect(svg).not.toContain("gmt-crystal-clock-facet");
  });

  it("draws twelve ticks, four of them major", () => {
    const svg = renderCrystalClock(base);
    const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
    const ticks = doc.querySelectorAll(".gmt-crystal-clock-tick");
    expect(ticks).toHaveLength(12);
    expect(doc.querySelectorAll(".gmt-crystal-clock-tick--major")).toHaveLength(
      4,
    );
  });

  it.each(["normal", "repeated", "skipped", "naive"] as const)(
    "marks the %s state on the root element",
    (state) => {
      const svg = renderCrystalClock({ ...base, state });
      const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
      const root = doc.querySelector("svg")!;
      expect(root.getAttribute("data-state")).toBe(state);
      expect(root.getAttribute("class")).toContain(
        `gmt-crystal-clock--${state}`,
      );
    },
  );

  it("defaults to the normal state", () => {
    const svg = renderCrystalClock(base);
    expect(svg).toContain('data-state="normal"');
  });
});

describe("the ice-glass pane", () => {
  const base = {
    id: "entry",
    hour: 1,
    minute: 30,
    label: "Entry clock",
    glowable: false,
  };

  it("is present, clipped to the bezel, and sits over the hands", () => {
    const svg = renderCrystalClock(base);
    const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
    const glass = doc.querySelector(".gmt-crystal-clock-glass");
    expect(glass).not.toBeNull();
    expect(glass!.getAttribute("clip-path")).toMatch(/^url\(#/);
    expect(
      glass!.querySelector(".gmt-crystal-clock-glass-tint"),
    ).not.toBeNull();
    expect(
      glass!.querySelector(".gmt-crystal-clock-glass-sheen"),
    ).not.toBeNull();

    // Both glass layers are painted on the bezel's own outer polygon —
    // never a smaller, separate shape — so the ice reaches the frame on
    // every side instead of floating inside it.
    for (const layer of glass!.querySelectorAll(
      ".gmt-crystal-clock-glass-tint, .gmt-crystal-clock-glass-sheen",
    )) {
      expect(layer.getAttribute("points")).toBe(CLOCK_OUTER);
    }

    // The glass group is the last thing drawn, after the hands' <g>.
    const svgRoot = doc.querySelector("svg")!;
    const children = [...svgRoot.children];
    expect(children.indexOf(glass!)).toBeGreaterThan(
      children.findIndex((el) =>
        el.classList.contains("gmt-crystal-clock-hands"),
      ),
    );
  });

  it("wraps the hands in a group carrying the drop-shadow filter", () => {
    const svg = renderCrystalClock(base);
    const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
    const hands = doc.querySelector(".gmt-crystal-clock-hands")!;
    expect(hands.tagName.toLowerCase()).toBe("g");
    expect(hands.getAttribute("filter")).toMatch(
      /^url\(#gmt-crystal-shadow-entry\)$/,
    );
    expect(hands.querySelectorAll(".gmt-crystal-clock-hand")).toHaveLength(2);
    expect(doc.querySelector("feDropShadow")).not.toBeNull();
  });

  it("pins the shadow filter to the viewBox in userSpaceOnUse, not the hands' own (collapsible) bounding box", () => {
    // Regression (owner found): at 00:00, 06:00, 12:00 and 18:00 the hour
    // and minute hands are exactly collinear, so the filtered <g>'s own
    // bounding box has zero width or height. The default
    // objectBoundingBox filter units size the filter region from that
    // box, so it went empty and the whole group — both hands — rendered
    // as nothing. A region pinned to the viewBox in user-space units never
    // depends on the hands' own geometry.
    const svg = renderCrystalClock({ ...base, hour: 0, minute: 0 });
    const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
    const filter = doc.querySelector("filter")!;
    expect(filter.getAttribute("filterUnits")).toBe("userSpaceOnUse");
    expect(filter.getAttribute("x")).toBe("0");
    expect(filter.getAttribute("y")).toBe("0");
    expect(filter.getAttribute("width")).toBe("100");
    expect(filter.getAttribute("height")).toBe("100");
  });

  it("suffixes every glass def id with the caller's id", () => {
    const svg = renderCrystalClock({ ...base, id: "exit" });
    const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
    for (const defId of [
      "gmt-crystal-clip-exit",
      "gmt-crystal-tint-exit",
      "gmt-crystal-sheen-exit",
      "gmt-crystal-shadow-exit",
    ]) {
      expect(doc.getElementById(defId), defId).not.toBeNull();
    }
  });

  it("never collides between two clocks rendered on the same page", () => {
    const entry = renderCrystalClock({ ...base, id: "entry" });
    const exit = renderCrystalClock({ ...base, id: "exit" });
    const doc = new DOMParser().parseFromString(
      `<svg xmlns="http://www.w3.org/2000/svg">${entry}${exit}</svg>`,
      "image/svg+xml",
    );
    expect(doc.querySelector("parsererror")).toBeNull();

    const ids = [...doc.querySelectorAll("[id]")].map((el) => el.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("the highlight sector", () => {
  const base = {
    id: "entry",
    hour: 0,
    minute: 0,
    label: "Entry clock",
    glowable: false,
  };

  function numbers(d: string): number[] {
    return (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
  }

  /** The same polar formula the module uses internally, recomputed here
   *  independently so the test isn't just echoing the implementation. */
  function expectedPoint(radius: number, deg: number): [number, number] {
    const rad = ((deg - 90) * Math.PI) / 180;
    return [50 + radius * Math.cos(rad), 50 + radius * Math.sin(rad)];
  }

  it("draws a skipped hour as one pie-wedge outline from the centre, at the hour's own angles", () => {
    const svg = renderCrystalClock({
      ...base,
      highlight: {
        fromHour: 2,
        fromMinute: 0,
        toHour: 3,
        toMinute: 0,
        kind: "skipped",
      },
    });
    const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
    const paths = doc.querySelectorAll(".gmt-crystal-clock-highlight");
    expect(paths).toHaveLength(1);
    expect(
      paths[0]!.classList.contains("gmt-crystal-clock-highlight--skipped"),
    ).toBe(true);

    // M cx cy L x1 y1 A r r 0 largeArc sweep x2 y2 Z
    const [cx, cy, x1, y1, r, , , largeArc, sweep, x2, y2] = numbers(
      paths[0]!.getAttribute("d")!,
    );
    expect(cx).toBeCloseTo(50, 1);
    expect(cy).toBeCloseTo(50, 1);
    expect(largeArc).toBe(0); // a one-hour sweep (30°) is never the large arc
    expect(sweep).toBe(1); // clockwise, 2:00 to 3:00

    // 2:00 is 60° clockwise from 12; 3:00 is 90°.
    const [ex1, ey1] = expectedPoint(r!, 60);
    const [ex2, ey2] = expectedPoint(r!, 90);
    expect(x1).toBeCloseTo(ex1, 1);
    expect(y1).toBeCloseTo(ey1, 1);
    expect(x2).toBeCloseTo(ex2, 1);
    expect(y2).toBeCloseTo(ey2, 1);

    expect(paths[0]!.querySelector("title")!.textContent).toBe(
      "02:00–03:00 never shown",
    );
  });

  it("draws a repeated hour as two concentric arc-only paths, at the hour's own angles", () => {
    const svg = renderCrystalClock({
      ...base,
      highlight: {
        fromHour: 1,
        fromMinute: 0,
        toHour: 2,
        toMinute: 0,
        kind: "repeated",
      },
    });
    const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
    const paths = doc.querySelectorAll(".gmt-crystal-clock-highlight");
    expect(paths).toHaveLength(2);
    for (const p of paths) {
      expect(
        p.classList.contains("gmt-crystal-clock-highlight--repeated"),
      ).toBe(true);
      // M x1 y1 A r r 0 largeArc sweep x2 y2 — no centre point, unlike skipped.
      expect(p.getAttribute("d")!.trim().startsWith("M")).toBe(true);
    }
    // The two arcs are at different radii (concentric, not overlapping).
    const radii = [...paths].map((p) => numbers(p.getAttribute("d")!)[2]!);
    expect(radii[0]).not.toBeCloseTo(radii[1]!, 1);

    // 1:00 is 30°; 2:00 is 60°.
    // M x1 y1 A r r 0 largeArc sweep x2 y2
    const [x1, y1, r, , , , , x2, y2] = numbers(paths[0]!.getAttribute("d")!);
    const [ex1, ey1] = expectedPoint(r, 30);
    const [ex2, ey2] = expectedPoint(r, 60);
    expect(x1).toBeCloseTo(ex1, 1);
    expect(y1).toBeCloseTo(ey1, 1);
    expect(x2).toBeCloseTo(ex2, 1);
    expect(y2).toBeCloseTo(ey2, 1);

    expect(paths[0]!.querySelector("title")!.textContent).toBe(
      "01:00–02:00 shown twice",
    );
  });

  it("draws nothing with no highlight", () => {
    const svg = renderCrystalClock(base);
    expect(svg).not.toContain("gmt-crystal-clock-highlight");
  });

  it("folds the highlight's own label into the accessible name", () => {
    const svg = renderCrystalClock({
      id: "entry",
      hour: 0,
      minute: 0,
      label: "Entry clock",
      sublabel: "00:00, minus 05:00, New York",
      highlight: {
        fromHour: 2,
        fromMinute: 0,
        toHour: 3,
        toMinute: 0,
        kind: "skipped",
      },
    });
    const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
    expect(doc.querySelector("button")!.getAttribute("aria-label")).toBe(
      "Entry clock, 00:00, minus 05:00, New York. 02:00–03:00 never shown. Light up the face.",
    );
  });
});

describe("the night light", () => {
  const base = {
    id: "entry",
    hour: 1,
    minute: 30,
    label: "Entry clock",
    sublabel: "01:30, minus 04:00, New York",
  };

  it("wraps the face in a toggle button by default, un-pressed", () => {
    const root = document.createElement("div");
    root.innerHTML = renderCrystalClock(base);
    const button = root.querySelector("button")!;
    expect(button.type).toBe("button");
    expect(button.getAttribute("aria-pressed")).toBe("false");
    expect(button.getAttribute("aria-label")).toBe(
      "Entry clock, 01:30, minus 04:00, New York. Light up the face.",
    );
    expect(button.querySelector("svg.gmt-crystal-clock")).not.toBeNull();
  });

  it("makes the inner svg decorative once it's wrapped", () => {
    const root = document.createElement("div");
    root.innerHTML = renderCrystalClock(base);
    const svg = root.querySelector("svg")!;
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.hasAttribute("role")).toBe(false);
    expect(svg.hasAttribute("aria-label")).toBe(false);
  });

  it("renders no button at all with glowable: false", () => {
    const root = document.createElement("div");
    root.innerHTML = renderCrystalClock({ ...base, glowable: false });
    expect(root.querySelector("button")).toBeNull();
    expect(root.querySelector("svg")!.getAttribute("role")).toBe("img");
  });

  it("toggles aria-pressed and the glow class on click, independently per clock", () => {
    const root = document.createElement("div");
    root.innerHTML =
      renderCrystalClock(base) +
      renderCrystalClock({ ...base, id: "exit", label: "Exit clock" });
    document.body.append(root);
    const controller = new AbortController();
    bindClockGlow(root, controller.signal);

    const [entryButton, exitButton] = [...root.querySelectorAll("button")];
    const entrySvg = entryButton!.querySelector("svg")!;
    const exitSvg = exitButton!.querySelector("svg")!;

    entryButton!.click();
    expect(entryButton!.getAttribute("aria-pressed")).toBe("true");
    expect(entrySvg.classList.contains("gmt-crystal-clock--glow")).toBe(true);
    // The other clock is untouched.
    expect(exitButton!.getAttribute("aria-pressed")).toBe("false");
    expect(exitSvg.classList.contains("gmt-crystal-clock--glow")).toBe(false);

    entryButton!.click();
    expect(entryButton!.getAttribute("aria-pressed")).toBe("false");
    expect(entrySvg.classList.contains("gmt-crystal-clock--glow")).toBe(false);

    root.remove();
  });

  it("toggles on keyboard activation — a real <button> turns Enter/Space into a click, which is what the delegated handler listens for", () => {
    const root = document.createElement("div");
    root.innerHTML = renderCrystalClock(base);
    document.body.append(root);
    const controller = new AbortController();
    bindClockGlow(root, controller.signal);

    const button = root.querySelector("button")!;
    button.focus();
    // jsdom does not synthesize a click from a keyboard Enter/Space on a
    // button the way every real browser does, so this calls the same
    // click() a real keypress would produce — proof the handler reacts to
    // it, not a re-test of the browser's own native button semantics.
    button.click();
    expect(button.getAttribute("aria-pressed")).toBe("true");

    root.remove();
  });

  it("removes the listener on abort", () => {
    const root = document.createElement("div");
    root.innerHTML = renderCrystalClock(base);
    document.body.append(root);
    const controller = new AbortController();
    bindClockGlow(root, controller.signal);
    controller.abort();

    const button = root.querySelector("button")!;
    button.click();
    expect(button.getAttribute("aria-pressed")).toBe("false");

    root.remove();
  });

  it("never mentions the trademarked name this feature is inspired by", () => {
    const svg = renderCrystalClock(base);
    expect(svg.toLowerCase()).not.toContain("indiglo");
  });
});
