// @vitest-environment jsdom
import { rangePct, setControlValue } from "./widget-ui";

describe("rangePct", () => {
  it("maps min, mid and max", () => {
    expect(rangePct(0, 0, 240)).toBe(0);
    expect(rangePct(120, 0, 240)).toBe(50);
    expect(rangePct(240, 0, 240)).toBe(100);
  });
  it("clamps out-of-range values", () => {
    expect(rangePct(-5, 0, 10)).toBe(0);
    expect(rangePct(50, 0, 10)).toBe(100);
  });
  it("is 0 when max <= min", () => {
    expect(rangePct(5, 5, 5)).toBe(0);
    expect(rangePct(5, 10, 0)).toBe(0);
  });
});

describe("setControlValue", () => {
  const select = (role: string, options: string[]) => {
    const el = document.createElement("select");
    el.dataset["role"] = role;
    for (const o of options) {
      const opt = document.createElement("option");
      opt.value = o;
      opt.textContent = o;
      el.append(opt);
    }
    return el;
  };

  it("adds an option for an open-ended list: a zone, an offset, a day count", () => {
    for (const role of [
      "zone",
      "time-zone",
      "start-zone",
      "zone-2",
      "offset-1",
      "days",
    ]) {
      const el = select(role, ["a", "b"]);
      setControlValue(el, "America/Nuuk");
      expect(el.value, role).toBe("America/Nuuk");
      expect(el.options.length, role).toBe(3);
    }
  });

  it("keeps an enum select strict: a value it does not offer changes nothing", () => {
    for (const role of [
      "roll",
      "preset",
      "mode-1",
      "basis",
      "disambiguation",
    ]) {
      const el = select(role, ["following", "preceding"]);
      el.value = "preceding";
      setControlValue(el, "banana");
      expect(el.value, role).toBe("preceding");
      expect(el.options.length, role).toBe(2);
    }
  });

  it("takes a value an enum select does offer", () => {
    const el = select("roll", ["following", "preceding"]);
    setControlValue(el, "preceding");
    expect(el.value).toBe("preceding");
  });

  it("an empty value on a select with no blank option selects nothing", () => {
    const el = select("zone", ["a", "b"]);
    setControlValue(el, "");
    expect(el.selectedIndex).toBe(-1);
    expect(el.options.length).toBe(2);
  });

  it("sets an input's value as given", () => {
    const input = document.createElement("input");
    setControlValue(input, "2024-06-15");
    expect(input.value).toBe("2024-06-15");
  });
});
