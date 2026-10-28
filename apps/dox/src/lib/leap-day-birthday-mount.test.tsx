/**
 * @vitest-environment jsdom
 *
 * Leap-Day Birthday end to end. The loader hands the widget the real library
 * wrapped in a recorder, so the printed calls can be checked against the calls
 * that ran.
 */
import { vi } from "vitest";
import { installJsdomShims } from "~/test/jsdom-shims";
import type { MonthDayLib } from "./month-day-lib";
import { monthDayLib } from "~/test/month-day-lib";

const recorded: { name: string; args: unknown[] }[] = [];

vi.mock("./month-day-lib", () => ({
  loadMonthDayLib: async () => {
    const wrapped = {} as Record<string, unknown>;
    for (const [name, fn] of Object.entries(monthDayLib)) {
      wrapped[name] = (...args: unknown[]) => {
        recorded.push({ name, args });
        return (fn as (...a: unknown[]) => unknown)(...args);
      };
    }
    return wrapped as unknown as MonthDayLib;
  },
}));

const { mountLeapDayBirthday, renderLeapDayBirthdayTemplate } =
  await import("./leap-day-birthday-mount");
const { LEAP_PRESETS, ROW_COUNT } = await import("./leap-day-birthday");

installJsdomShims();

const q = <T extends HTMLElement = HTMLElement>(
  root: HTMLElement,
  role: string,
) => root.querySelector(`[data-role="${role}"]`) as T;
const fire = (el: Element, type: "input" | "change") =>
  el.dispatchEvent(new Event(type, { bubbles: true }));
const text = (el: Element | null) =>
  (el?.textContent ?? "").replace(/\s+/gu, " ").trim();
const plate = (root: HTMLElement, role: string) =>
  text(q(root, `${role}-text`));
const rows = (root: HTMLElement) => [
  ...root.querySelectorAll<HTMLTableRowElement>("tbody tr"),
];
const cell = (row: HTMLElement, i: number) =>
  text(row.querySelectorAll("td")[i]!.querySelector(".gmt-leap-date"));
const verdict = (row: HTMLElement) =>
  row.querySelectorAll("td")[2]!.dataset["verdict"];

async function mount(args = {}) {
  const root = document.createElement("div");
  root.innerHTML = renderLeapDayBirthdayTemplate(args);
  document.body.append(root);
  const handle = await mountLeapDayBirthday(
    root,
    args,
    new AbortController().signal,
  );
  return { root, handle };
}

function set(root: HTMLElement, role: string, value: string) {
  const el = q<HTMLInputElement | HTMLSelectElement>(root, role);
  el.value = value;
  fire(el, role === "locale" || role === "preset" ? "change" : "input");
}

beforeEach(() => {
  recorded.length = 0;
});
afterEach(() => {
  document.body.innerHTML = "";
});

describe("the plates and the rows", () => {
  it("29 February in 2023 reads 28 February, moved earlier, with the naive column refused", async () => {
    const { root } = await mount({ value: "--02-29", year: 2023 });
    expect(plate(root, "stored")).toBe("--02-29");
    expect(plate(root, "reads")).toBe("February 29");
    expect(plate(root, "in-year")).toBe("2023-02-28");
    const first = rows(root)[0]!;
    expect(cell(first, 1)).toBe("2023-02-28");
    expect(verdict(first)).toBe("moved earlier");
    expect(cell(first, 3)).toContain("NO SIGNAL");
    expect(cell(first, 4)).toBe("2023-03-01");
    expect(verdict(rows(root)[1]!)).toBe("kept");
  });

  it("always draws eight rows with five cells, in every state", async () => {
    const { root } = await mount();
    for (const preset of LEAP_PRESETS) {
      set(root, "preset", preset.id);
      expect(rows(root)).toHaveLength(ROW_COUNT);
      for (const row of rows(root)) {
        expect(row.querySelectorAll("td")).toHaveLength(5);
      }
    }
    set(root, "year", "x");
    expect(rows(root)).toHaveLength(ROW_COUNT);
  });

  it("clicks every preset and keeps the preset menu in step", async () => {
    const { root } = await mount();
    for (const preset of LEAP_PRESETS) {
      set(root, "preset", preset.id);
      expect(q<HTMLSelectElement>(root, "preset").value).toBe(preset.id);
      expect(q<HTMLInputElement>(root, "value").value).toBe(preset.value);
    }
    set(root, "value", "12-25");
    expect(q<HTMLSelectElement>(root, "preset").value).toBe("custom");
  });

  it("a typed year moves the slider and the rows", async () => {
    const { root } = await mount({ value: "--02-29", year: 2023 });
    set(root, "year", "2096");
    expect(q<HTMLInputElement>(root, "year-slider").value).toBe("2096");
    expect(rows(root)[0]!.querySelectorAll("td")[0]!.textContent).toBe("2096");
    expect(verdict(rows(root)[0]!)).toBe("kept");
    const moved = rows(root).filter((r) => verdict(r) === "moved earlier");
    expect(
      moved.map((r) => r.querySelectorAll("td")[0]!.textContent),
    ).toContain("2100");
  });
});

describe("NO SIGNAL against an empty result", () => {
  it("a value no reader accepts is NO SIGNAL on every plate and cell", async () => {
    const { root } = await mount({ value: "--02-30" });
    for (const role of ["stored", "reads", "in-year"]) {
      expect(q(root, role).hasAttribute("data-signal")).toBe(true);
      expect(plate(root, role)).toContain("NO SIGNAL");
    }
    for (const row of rows(root)) {
      expect(cell(row, 1)).toContain("NO SIGNAL");
      expect(verdict(row)).toBe("no date");
    }
    expect(text(q(root, "reason"))).toContain("NO SIGNAL");
  });

  it("a year the library cannot place is NO SIGNAL while the stored plate still reads", async () => {
    const { root } = await mount({ value: "--12-25" });
    set(root, "year", "2024.5");
    expect(plate(root, "stored")).toBe("--12-25");
    expect(q(root, "in-year").hasAttribute("data-signal")).toBe(true);
    for (const row of rows(root)) expect(verdict(row)).toBe("no date");
  });

  it("a kept date is a correct answer and is never NO SIGNAL", async () => {
    const { root } = await mount({ value: "12-25", year: 2025 });
    expect(q(root, "in-year").hasAttribute("data-signal")).toBe(false);
    expect(plate(root, "in-year")).toBe("2025-12-25");
    expect(verdict(rows(root)[0]!)).toBe("kept");
    expect(cell(rows(root)[0]!, 3)).toBe("2025-12-25");
  });
});

describe("the printed calls", () => {
  it("print the library calls that ran, in the order they ran", async () => {
    const { root } = await mount({ value: "--02-29", year: 2023 });
    recorded.length = 0;
    set(root, "year", "2023");
    // One render ran: its calls are the recorder's, in order. The printed
    // frame is the readers, the locale form and the first row's calls; the
    // later rows' calls follow the first row's in the recorder.
    const lines = (q(root, "calls").textContent ?? "").split("\n");
    const parsed = lines.map((l) => {
      const m = /^(\w+)\((.*)\); \/\/ /u.exec(l);
      return {
        name: m![1]!, // The arguments are printed as source, options objects included.
        args: new Function(`return [${m![2]!}]`)() as unknown[],
      };
    });
    expect(parsed[0]!.name).toBe("isValidMonthDay");
    expect(parsed.map((c) => c.name)).toEqual(
      recorded.slice(0, parsed.length).map((c) => c.name),
    );
    for (const [i, call] of parsed.entries()) {
      expect(call.args, lines[i]).toEqual(recorded[i]!.args);
    }
  });

  it("print every call of the first row only", async () => {
    const { root } = await mount({ value: "--02-29", year: 2023 });
    const lines = (q(root, "calls").textContent ?? "").split("\n");
    expect(lines.filter((l) => l.startsWith("monthDayToDate("))).toHaveLength(
      1,
    );
  });
});

describe("permalink state", () => {
  it("is the preset while the controls match one and the three strings otherwise", async () => {
    const { root, handle } = await mount();
    expect(handle.getPermalinkState?.()).toEqual({ preset: "leap-day-birth" });
    set(root, "value", "--02-29");
    set(root, "year", "2023");
    set(root, "locale", "fr-FR");
    expect(handle.getPermalinkState?.()).toEqual({
      value: "--02-29",
      year: "2023",
      locale: "fr-FR",
    });
  });

  it("reopens the state a link names, an unknown locale included", async () => {
    const { root } = await mount({
      value: "--02-29",
      year: "2023",
      locale: "xx-YY",
    });
    expect(q<HTMLSelectElement>(root, "locale").value).toBe("xx-YY");
    expect(q<HTMLInputElement>(root, "year").value).toBe("2023");
  });
});
