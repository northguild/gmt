/** @vitest-environment jsdom */
import { textOf } from "~/test/deck-events";
import { CHAR_MS, ROLL_MS, rollText, rolled, typeOut } from "./type-out";

function frames() {
  const callbacks: Array<(stamp: number) => void> = [];
  return {
    callbacks,
    win: {
      requestAnimationFrame: (cb: (stamp: number) => void) =>
        callbacks.push(cb),
      cancelAnimationFrame: vi.fn(),
    },
  };
}

describe("typing a line", () => {
  it("writes the whole line at once under reduced motion", () => {
    const el = document.createElement("span");
    const done = vi.fn();
    typeOut({ el, text: "node -e", win: window, reduced: true, done });
    expect(textOf(el)).toBe("node -e");
    expect(done).toHaveBeenCalledOnce();
  });

  it("adds characters as frames pass, then reports done", () => {
    const el = document.createElement("span");
    const { callbacks, win } = frames();
    const done = vi.fn();
    typeOut({ el, text: "abcd", win, reduced: false, done });
    expect(textOf(el)).toBe("");
    callbacks.shift()!(0);
    callbacks.shift()!(CHAR_MS * 2);
    expect(textOf(el)).toBe("ab");
    expect(done).not.toHaveBeenCalled();
    callbacks.shift()!(CHAR_MS * 4);
    expect(textOf(el)).toBe("abcd");
    expect(done).toHaveBeenCalledOnce();
  });

  it("stops when told", () => {
    const el = document.createElement("span");
    const { callbacks, win } = frames();
    typeOut({ el, text: "abcd", win, reduced: false })();
    callbacks.shift()!(CHAR_MS * 4);
    expect(textOf(el)).toBe("");
  });
});

describe("rolling a counter", () => {
  it("keeps separators, changes digits and lands on the end", () => {
    const mid = rolled("2124-03-20", 0.5);
    expect(mid[4]).toBe("-");
    expect(mid).not.toBe("2124-03-20");
    expect(rolled("2124-03-20", 1)).toBe("2124-03-20");
  });

  it("lands on the end value and reports done", () => {
    const el = document.createElement("span");
    const { callbacks, win } = frames();
    const done = vi.fn();
    rollText({ el, end: "1870", win, reduced: false, done });
    callbacks.shift()!(0);
    callbacks.shift()!(ROLL_MS);
    expect(textOf(el)).toBe("1870");
    expect(done).toHaveBeenCalledOnce();
  });

  it("shows the end at once under reduced motion", () => {
    const el = document.createElement("span");
    rollText({ el, end: "3", win: window, reduced: true });
    expect(textOf(el)).toBe("3");
  });

  it("keeps one character per tile in a split-flap row", () => {
    const el = document.createElement("span");
    for (let i = 0; i < 4; i += 1) {
      const tile = document.createElement("span");
      tile.dataset["tile"] = "";
      el.append(tile);
    }
    rollText({ el, end: "   3", win: window, reduced: true });
    expect(Array.from(el.children, (t) => t.textContent)).toEqual([
      " ",
      " ",
      " ",
      "3",
    ]);
    expect(el.children).toHaveLength(4);
  });

  it("spins a blank flap with the others, then lands it empty", () => {
    const el = document.createElement("span");
    for (let i = 0; i < 4; i += 1) {
      const tile = document.createElement("span");
      tile.dataset["tile"] = "";
      if (i < 3) tile.dataset["blank"] = "";
      el.append(tile);
    }
    const { callbacks, win } = frames();
    rollText({ el, end: "   3", win, reduced: false });
    callbacks.shift()!(0);
    callbacks.shift()!(ROLL_MS / 2);
    for (const tile of Array.from(el.children).slice(0, 3))
      expect(tile.textContent).toMatch(/^\d$/);
    callbacks.shift()!(ROLL_MS);
    expect(Array.from(el.children, (t) => t.textContent)).toEqual([
      " ",
      " ",
      " ",
      "3",
    ]);
  });
});
