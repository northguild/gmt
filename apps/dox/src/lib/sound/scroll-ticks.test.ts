// @vitest-environment jsdom
import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { scrolled, wheelOn } from "~/test/render-widget";
import { pitchOfRows, scrollTicks } from "./scroll-ticks";

const cue = vi.fn();
vi.mock("./cue", () => ({ cue: (...args: unknown[]) => cue(...args) }));

/* jsdom lays nothing out and never scrolls: each row is given a 40 px box, the region a 40 px
   view of the 160 px list (so 120 px of scroll), and the reader's wheel and the scroll it causes
   come from the kit's wheel and scroll helpers. */
function draw(): { region: HTMLElement; rows: HTMLElement[] } {
  const field = document.createElement("input");
  field.setAttribute("aria-label", "Elsewhere");
  const region = document.createElement("div");
  region.setAttribute("role", "region");
  region.setAttribute("aria-label", "Zones");
  region.tabIndex = 0;
  const list = document.createElement("ul");
  for (const name of ["A", "B", "C", "D"]) {
    const row = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = name;
    row.append(button);
    list.append(row);
  }
  region.append(list);
  document.body.replaceChildren(field, region);
  Object.defineProperty(region, "scrollHeight", { value: 160 });
  Object.defineProperty(region, "clientHeight", { value: 40 });
  const rows = screen.getAllByRole("listitem");
  rows.forEach((row, i) => {
    row.getBoundingClientRect = () => new DOMRect(0, i * 40, 200, 40);
  });
  return { region: screen.getByRole("region"), rows };
}

function scrollTo(region: HTMLElement, top: number): void {
  region.scrollTop = top;
  scrolled(region);
}

describe("scrollTicks", () => {
  let life: AbortController;
  beforeEach(() => {
    cue.mockClear();
    life = new AbortController();
  });
  afterEach(() => {
    life.abort();
    document.body.replaceChildren();
  });

  it("ticks once per row the reader scrolls past, by direction and place, and not for a scroll made for them", () => {
    const { region, rows } = draw();
    const ticks = scrollTicks(region, {
      rowPitch: () => pitchOfRows(rows),
      signal: life.signal,
    });
    wheelOn(region, { deltaY: 50 });
    scrollTo(region, 50);
    scrollTo(region, 70);
    scrollTo(region, 85);
    scrollTo(region, 30);
    expect(cue.mock.calls).toEqual([
      ["listNext", 50 / 120],
      ["listNext", 85 / 120],
      ["listPrev", 30 / 120],
    ]);
    cue.mockClear();
    ticks.quiet();
    scrollTo(region, 0);
    expect(cue).not.toHaveBeenCalled();
  });

  it("hands the scroll back to code on a key or a press outside", async () => {
    const { region, rows } = draw();
    scrollTicks(region, {
      rowPitch: () => pitchOfRows(rows),
      signal: life.signal,
    });
    const user = userEvent.setup();
    wheelOn(region, { deltaY: 50 });
    await user.click(screen.getByRole("textbox"));
    scrollTo(region, 50);
    wheelOn(region, { deltaY: 50 });
    await user.keyboard("x");
    scrollTo(region, 90);
    expect(cue).not.toHaveBeenCalled();
  });

  it("with keys, ticks for the browser's own key scroll, not a key a control takes or one typed", async () => {
    const { region, rows } = draw();
    scrollTicks(region, {
      rowPitch: () => pitchOfRows(rows),
      keys: true,
      signal: life.signal,
    });
    const user = userEvent.setup();
    const button = screen.getByRole("button", { name: "A" });
    button.addEventListener("keydown", (event) => {
      if (event.key === "ArrowUp") event.preventDefault();
    });
    region.focus();
    await user.keyboard("{ArrowDown}");
    scrollTo(region, 40);
    button.focus();
    await user.keyboard("{PageDown}");
    scrollTo(region, 80);
    expect(cue.mock.calls).toEqual([
      ["listNext", 40 / 120],
      ["listNext", 80 / 120],
    ]);
    cue.mockClear();
    await user.keyboard("{ArrowUp}");
    scrollTo(region, 40);
    screen.getByRole("textbox").focus();
    await user.keyboard("{ArrowDown}");
    scrollTo(region, 0);
    expect(cue).not.toHaveBeenCalled();
  });

  it("is silent once its signal is aborted", () => {
    const { region, rows } = draw();
    scrollTicks(region, {
      rowPitch: () => pitchOfRows(rows),
      signal: life.signal,
    });
    life.abort();
    wheelOn(region, { deltaY: 50 });
    scrollTo(region, 50);
    expect(cue).not.toHaveBeenCalled();
  });
});

describe("pitchOfRows", () => {
  const at = (top: number, height = 30): Element => {
    const el = document.createElement("li");
    el.getBoundingClientRect = () => new DOMRect(0, top, 100, height);
    return el;
  };

  it("measures from one row's top to the next row below it, skipping rows beside it", () => {
    expect(pitchOfRows([at(0), at(0), at(48), at(48)])).toBe(48);
  });

  it("falls back to the first row's height, or 0 with no rows", () => {
    expect(pitchOfRows([at(0, 36)])).toBe(36);
    expect(pitchOfRows([])).toBe(0);
  });
});
