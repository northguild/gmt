/**
 * @vitest-environment jsdom
 *
 * `crystal-clock.ts` is the entry point the other widgets import: the geometry re-exported from
 * the clock family, the face as a string, the delegated toggle and the in-place update. The
 * face itself is tested in `widgets/families/clock/crystal-clock.test.ts`.
 */
import { screen, within } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import {
  CLOCK_OUTER,
  bindClockGlow,
  handAngles,
  renderCrystalClock,
  updateCrystalClock,
} from "./crystal-clock";

const base = {
  id: "entry",
  hour: 1,
  minute: 30,
  label: "Entry clock",
  sublabel: "01:30, minus 04:00, New York",
};

/** The face, written into a host the way a string-building caller does. */
function host(markup: string): HTMLElement {
  const el = document.createElement("div");
  document.body.append(el);
  // The markup is `renderCrystalClock`'s own output: builder text, escaped at its source.
  el.insertAdjacentHTML("beforeend", markup);
  return el;
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("the re-exported geometry", () => {
  it("keeps handAngles", () => {
    expect(handAngles(9, 30)).toEqual({ hourDeg: 285, minuteDeg: 180 });
  });

  it("keeps the twelve-vertex outline", () => {
    expect(CLOCK_OUTER.trim().split(/\s+/)).toHaveLength(12);
  });
});

describe("renderCrystalClock", () => {
  it("gives the face as a toggle button named for its time and zone", () => {
    host(renderCrystalClock(base));
    expect(
      screen.getByRole("button", {
        name: "Entry clock, 01:30, minus 04:00, New York. Light up the face.",
        pressed: false,
      }),
    ).toBeInTheDocument();
  });

  it("gives a named image with glowable: false", () => {
    host(renderCrystalClock({ ...base, glowable: false }));
    expect(
      screen.getByRole("img", {
        name: "Entry clock, 01:30, minus 04:00, New York",
      }),
    ).toBeInTheDocument();
  });
});

describe("bindClockGlow", () => {
  it("toggles each face on its own and stops on abort", async () => {
    const user = userEvent.setup();
    const root = host(
      renderCrystalClock(base) +
        renderCrystalClock({ ...base, id: "exit", label: "Exit clock" }),
    );
    const controller = new AbortController();
    bindClockGlow(root, controller.signal);
    const entry = within(root).getByRole("button", { name: /^Entry clock/ });
    const exit = within(root).getByRole("button", { name: /^Exit clock/ });

    await user.click(entry);
    expect(entry).toBePressed();
    expect(exit).not.toBePressed();

    controller.abort();
    await user.click(exit);
    expect(exit).not.toBePressed();
  });
});

describe("updateCrystalClock", () => {
  it("draws the face the first time", () => {
    const el = document.createElement("div");
    document.body.append(el);
    updateCrystalClock(el, base);
    expect(
      within(el).getByRole("button", { name: /^Entry clock, 01:30/ }),
    ).toBeInTheDocument();
  });

  it("keeps the same button, its focus and its night light across a tick, and renames it", async () => {
    const user = userEvent.setup();
    const el = document.createElement("div");
    document.body.append(el);
    const controller = new AbortController();
    bindClockGlow(el, controller.signal);
    updateCrystalClock(el, base);

    const before = within(el).getByRole("button");
    await user.click(before);
    expect(before).toHaveFocus();

    updateCrystalClock(el, {
      ...base,
      minute: 31,
      sublabel: "01:31, minus 04:00, New York",
    });
    const after = within(el).getByRole("button");
    expect(after).toBe(before);
    expect(after).toHaveFocus();
    expect(after).toBePressed();
    expect(after).toHaveAccessibleName(
      "Entry clock, 01:31, minus 04:00, New York. Light up the face.",
    );
    controller.abort();
  });

  it("renames a bare image face in place", () => {
    const el = document.createElement("div");
    document.body.append(el);
    updateCrystalClock(el, { ...base, glowable: false });
    updateCrystalClock(el, {
      ...base,
      glowable: false,
      sublabel: "01:31, minus 04:00, New York",
    });
    expect(
      within(el).getByRole("img", {
        name: "Entry clock, 01:31, minus 04:00, New York",
      }),
    ).toBeInTheDocument();
  });
});
