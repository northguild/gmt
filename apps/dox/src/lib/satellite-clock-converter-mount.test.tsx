/**
 * @vitest-environment jsdom
 *
 * The Satellite Clock Converter end to end: template -> mount -> interact ->
 * assert, against the real `@northguild/gmt`. Values are from a run of the
 * built library, so a drift in the library or the widget fails here.
 */
import { afterEach, describe, expect, it } from "vitest";
import { installJsdomShims } from "~/test/jsdom-shims";
import { lib } from "~/test/gnss-lib";
import {
  CLOCK_PRESETS,
  GLO_NOTE,
  IRN_NOTE,
  SENTENCES,
  sliderPositions,
} from "./satellite-clock-converter";
import {
  mountSatelliteClockConverter,
  renderSatelliteClockConverterTemplate,
} from "./satellite-clock-converter-mount";
import { encodeWidgetPermalink, seedFromLocation } from "./widget-permalink";

installJsdomShims();

const REQUIRED_ROLES = [
  "preset",
  "preset-description",
  "value",
  "moment-slider",
  "moment-value",
  "frame",
  "heroes",
  "hero-utc",
  "hero-tai",
  "hero-next",
  "bars",
  "bar-list",
  "summary",
  "reason-aside",
  "clocks-table",
  "clocks-body",
  "footnote",
  "glo-note",
  "irn-note",
  "call-clocks",
  "copy-clocks",
  "clocks-output",
];

const CLOCKS = ["UTC", "TAI", "GPS", "GAL", "BDT", "QZS", "GLO", "IRN"];

/** The UTC plate each preset reads, from a run of the library; `null` is NO SIGNAL. */
const UTC: Record<string, string | null> = {
  "utc-2024": "2024-01-01T00:00:00Z",
  "galileo-first-instant": "1999-08-21T23:59:47Z",
  "beidou-reading": "2024-01-01T00:00:00Z",
  "tai-reading": "2026-01-01T00:00:00Z",
  "inside-leap-second": "2016-12-31T23:59:60Z",
  "before-beidou": "2005-12-31T23:59:59Z",
  "no-leap-second-that-day": null,
  "wrong-token": null,
};

const q = <T extends HTMLElement = HTMLElement>(
  root: HTMLElement,
  role: string,
) => root.querySelector(`[data-role="${role}"]`) as T;

async function mount(args = {}, templateArgs = args) {
  const root = document.createElement("div");
  root.innerHTML = renderSatelliteClockConverterTemplate(templateArgs);
  document.body.append(root);
  const controller = new AbortController();
  const handle = await mountSatelliteClockConverter(
    root,
    args,
    controller.signal,
  );
  return { root, handle, controller };
}

function choose(root: HTMLElement, role: string, value: string) {
  const el = q<HTMLSelectElement>(root, role);
  el.value = value;
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

function type(root: HTMLElement, value: string) {
  const el = q<HTMLInputElement>(root, "value");
  el.value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

function slide(root: HTMLElement, index: number) {
  const el = q<HTMLInputElement>(root, "moment-slider");
  el.value = String(index);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

const text = (root: HTMLElement, role: string) =>
  q(root, role).textContent ?? "";
const isSentinel = (root: HTMLElement, role: string) =>
  q(root, role).classList.contains("gmt-playground-sentinel");
const plateValue = (root: HTMLElement, role: string) =>
  q(root, role).querySelector(".gmt-punct-hero-value")!.textContent!;
const rows = (root: HTMLElement) => [
  ...root.querySelectorAll<HTMLElement>('[data-role="clocks-body"] tr'),
];
const cells = (row: HTMLElement) =>
  [...row.children].map((c) => {
    const lines = [...c.querySelectorAll(".gmt-clock-line")];
    const parts = lines.length > 0 ? lines : [c];
    return parts
      .map((l) => l.textContent!.replace(/\s+/g, " ").trim())
      .filter((t) => t !== "")
      .join(" ");
  });
const barRows = (root: HTMLElement) => [
  ...root.querySelectorAll<HTMLElement>('[data-role="bar-row"]'),
];

afterEach(() => {
  document.body.innerHTML = "";
});

describe("renderSatelliteClockConverterTemplate", () => {
  it("carries every role the mount looks up", () => {
    const root = document.createElement("div");
    root.innerHTML = renderSatelliteClockConverterTemplate();
    for (const role of REQUIRED_ROLES) {
      expect(root.querySelector(`[data-role="${role}"]`), role).not.toBeNull();
    }
  });

  it("is a widget root with the standard wrapper, and no class containing card but the wrapper", () => {
    const root = document.createElement("div");
    root.innerHTML = renderSatelliteClockConverterTemplate();
    const widget = root.firstElementChild as HTMLElement;
    expect(widget.className).toBe(
      "gmt-satellite-clock-converter gmt-widget not-content",
    );
    const cardClasses = [...root.querySelectorAll("[class]")]
      .flatMap((el) => [...el.classList])
      .filter((c) => c.includes("card"));
    expect(new Set(cardClasses)).toEqual(new Set(["gmt-widget-card"]));
  });

  it("renders four numbered sections, 2 and 3 wide, with three plates, eight bars and eight rows", () => {
    const root = document.createElement("div");
    root.innerHTML = renderSatelliteClockConverterTemplate();
    const sections = [...root.querySelectorAll(".gmt-widget-section")];
    expect(sections.map((s) => s.querySelector("h4")!.textContent)).toEqual([
      "1. Say what a clock reads",
      "2. How far each clock is from UTC",
      "3. The same instant on every clock",
      "4. What the library returns",
    ]);
    expect(
      sections.map((s) => s.classList.contains("gmt-widget-section--wide")),
    ).toEqual([false, true, true, false]);
    expect(root.querySelectorAll(".gmt-punct-hero")).toHaveLength(3);
    expect(barRows(root)).toHaveLength(8);
    expect(rows(root).map((r) => r.dataset["row"])).toEqual(CLOCKS);
  });

  it("limits the value to 64 characters", () => {
    const root = document.createElement("div");
    root.innerHTML = renderSatelliteClockConverterTemplate();
    expect(q<HTMLInputElement>(root, "value").maxLength).toBe(64);
  });

  it("escapes a hostile seed", () => {
    const root = document.createElement("div");
    root.innerHTML = renderSatelliteClockConverterTemplate({
      value: '"><img src=x onerror=alert(1)><script>x</script>',
    });
    expect(root.querySelector("img")).toBeNull();
    expect(root.querySelector("script")).toBeNull();
  });
});

describe("every preset, against the real library", () => {
  it("has an expectation for every preset", () => {
    expect(Object.keys(UTC).sort()).toEqual(
      CLOCK_PRESETS.map((p) => p.id).sort(),
    );
  });

  it.each(CLOCK_PRESETS.map((p) => [p.id]))("%s", async (id) => {
    const { root } = await mount();
    choose(root, "preset", id!);
    expect(q<HTMLSelectElement>(root, "preset").value).toBe(id);
    expect(root.querySelectorAll(".gmt-punct-hero")).toHaveLength(3);
    expect(barRows(root)).toHaveLength(8);
    expect(rows(root)).toHaveLength(8);
    if (UTC[id!] === null) {
      expect(isSentinel(root, "clocks-output")).toBe(true);
      expect(text(root, "clocks-output")).toBe("NO SIGNAL");
      expect(
        root.querySelector('[data-role="reason-aside"] p')!.textContent,
      ).not.toBe("");
      return;
    }
    expect(isSentinel(root, "clocks-output")).toBe(false);
    expect(plateValue(root, "hero-utc")).toBe(UTC[id!]);
    expect(text(root, "reason-aside")).toBe("");
    expect(text(root, "call-clocks")).toContain("utcToGnss");
  });
});

describe("the table", () => {
  it("reads the start of 2024 on every clock", async () => {
    const { root } = await mount({ preset: "utc-2024" });
    expect(rows(root).map(cells)).toEqual([
      ["UTC your reading", "2024-01-01T00:00:00Z", "the reference"],
      ["TAI", "2024-01-01T00:00:37 TAI", "37 s"],
      ["GPS", "2024-01-01T00:00:18 GPS", "18 s"],
      ["GAL", "2024-01-01T00:00:18 GAL", "18 s"],
      ["BDT", "2024-01-01T00:00:04 BDT", "4 s"],
      ["QZS", "2024-01-01T00:00:18 QZS", "18 s"],
      ["GLO", "2024-01-01T00:00:00 GLO", "0 s"],
      ["IRN derived", "2024-01-01T00:00:18 IRN", "18 s"],
    ]);
  });

  it("marks the reader's own clock as lit, in the table and the bars", async () => {
    const { root } = await mount({ preset: "beidou-reading" });
    const lit = rows(root).filter((r) => r.hasAttribute("data-reading"));
    expect(lit.map((r) => r.dataset["row"])).toEqual(["BDT"]);
    expect(lit[0]!.getAttribute("data-series")).toBe("1");
    expect(
      barRows(root)
        .filter((r) => r.hasAttribute("data-series"))
        .map((r) => r.dataset["row"]),
    ).toEqual(["BDT"]);
  });

  it("says written as under a reading the library spells differently", async () => {
    const { root } = await mount({ value: "2024-01-01T00:00:00+01:00" });
    expect(cells(rows(root)[0]!)[1]).toBe(
      "2024-01-01T00:00:00+01:00 written as 2023-12-31T23:00:00Z",
    );
    type(root, "2024-01-01T00:00:00Z");
    expect(cells(rows(root)[0]!)[1]).toBe("2024-01-01T00:00:00Z");
  });

  it("says no result for a clock that has not started, and why under the table", async () => {
    const { root } = await mount({ preset: "before-beidou" });
    const bdt = rows(root).find((r) => r.dataset["row"] === "BDT")!;
    expect(cells(bdt)).toEqual(["BDT", "no result", "no result"]);
    expect(text(root, "footnote")).toBe(
      "BDT: before this system's first instant.",
    );
    // A correct "no result" row is not a NO SIGNAL for the whole reading.
    expect(isSentinel(root, "clocks-output")).toBe(false);
  });

  it("says inside an inserted second where a duration cannot be taken", async () => {
    const { root } = await mount({ preset: "inside-leap-second" });
    const gps = rows(root).find((r) => r.dataset["row"] === "GPS")!;
    expect(cells(gps)).toEqual([
      "GPS",
      "2017-01-01T00:00:17 GPS",
      "inside an inserted second",
    ]);
    expect(plateValue(root, "hero-tai")).toBe("36 s");
  });

  it("keeps all eight rows, in order, when the reading goes to NO SIGNAL", async () => {
    const { root } = await mount({ preset: "utc-2024" });
    type(root, "garbage");
    expect(isSentinel(root, "clocks-output")).toBe(true);
    expect(rows(root).map((r) => r.dataset["row"])).toEqual(CLOCKS);
    expect(barRows(root)).toHaveLength(8);
    expect(text(root, "reason-aside")).toContain(SENTENCES.notAnInstant);
  });

  it("states the two page notes at all times", async () => {
    const { root } = await mount({ preset: "wrong-token" });
    expect(text(root, "glo-note")).toBe(GLO_NOTE);
    expect(text(root, "irn-note")).toBe(IRN_NOTE);
  });
});

describe("the bars", () => {
  it("draw each clock from UTC to its lead on one scale", async () => {
    const { root } = await mount({ preset: "utc-2024" });
    const size = (key: string) => {
      const fill = barRows(root)
        .find((r) => r.dataset["row"] === key)!
        .querySelector<HTMLElement>('[data-role="bar-fill"]')!;
      return {
        hidden: fill.hidden,
        size: fill.style.getPropertyValue("--size"),
      };
    };
    expect(size("TAI")).toEqual({ hidden: false, size: "100%" });
    expect(size("UTC").hidden).toBe(true);
    expect(size("GLO").hidden).toBe(true);
    expect(size("BDT").hidden).toBe(false);
    expect(parseFloat(size("GPS").size)).toBeCloseTo((18 / 37) * 100, 4);
    const chips = barRows(root).map(
      (r) => r.querySelector('[data-role="bar-value"]')!.textContent,
    );
    expect(chips).toEqual([
      "the reference",
      "37 s",
      "18 s",
      "18 s",
      "4 s",
      "18 s",
      "0 s",
      "18 s",
    ]);
  });

  it("are a labelled image with a hidden list, and nothing inside takes focus", async () => {
    const { root } = await mount({ preset: "utc-2024" });
    const drawing = q(root, "bars");
    expect(drawing.getAttribute("role")).toBe("img");
    expect(drawing.getAttribute("aria-label")).toContain("8 bars");
    expect(q(root, "bar-list").querySelectorAll("li")).toHaveLength(8);
    expect(
      drawing.querySelectorAll("a, button, input, select, [tabindex]"),
    ).toHaveLength(0);
  });
});

describe("the plates", () => {
  it("read UTC, TAI minus UTC and the next change", async () => {
    const { root } = await mount({ preset: "galileo-first-instant" });
    expect(plateValue(root, "hero-utc")).toBe("1999-08-21T23:59:47Z");
    expect(plateValue(root, "hero-tai")).toBe("32 s");
    expect(plateValue(root, "hero-next")).toBe("2005-12-31T23:59:60Z");
  });

  it("say none after this instant as a result, not a no-signal", async () => {
    const { root } = await mount({ preset: "utc-2024" });
    expect(plateValue(root, "hero-next")).toBe("none after this instant");
    expect(q(root, "hero-next").hasAttribute("data-empty")).toBe(false);
    expect(text(root, "hero-next")).toContain("these gaps stay as they are");
  });

  it("all read no result under a sentinel", async () => {
    const { root } = await mount({ preset: "wrong-token" });
    expect(
      [...root.querySelectorAll(".gmt-punct-hero")].every((p) =>
        p.hasAttribute("data-empty"),
      ),
    ).toBe(true);
  });
});

describe("the sentinel sentences", () => {
  it("are four different sentences for four different faults", async () => {
    const { root } = await mount({ preset: "utc-2024" });
    const sentences = new Set<string>();
    for (const value of [
      "2024-01-01T00:00:37 UTC",
      "2017-12-31T23:59:60Z",
      "1990-01-01T00:00:00 GAL",
      "garbage",
    ]) {
      type(root, value);
      expect(isSentinel(root, "clocks-output"), value).toBe(true);
      sentences.add(text(root, "reason-aside"));
    }
    expect(sentences.size).toBe(4);
  });

  it("an empty value is an empty state, never amber", async () => {
    const { root } = await mount({ preset: "utc-2024" });
    type(root, "");
    expect(isSentinel(root, "clocks-output")).toBe(false);
    expect(text(root, "clocks-output").trim()).toBe("");
    expect(text(root, "reason-aside")).toBe("");
    expect(text(root, "call-clocks")).not.toContain("utcToGnss");
    expect(rows(root)).toHaveLength(8);
  });
});

describe("the form", () => {
  it("opens on the first preset", async () => {
    const { root } = await mount();
    expect(q<HTMLSelectElement>(root, "preset").value).toBe("utc-2024");
    expect(q<HTMLInputElement>(root, "value").value).toBe(
      "2024-01-01T00:00:00Z",
    );
  });

  it("makes the preset custom when the value changes, and back when it matches", async () => {
    const { root } = await mount();
    type(root, "2030-05-05T05:05:05Z");
    expect(q<HTMLSelectElement>(root, "preset").value).toBe("custom");
    type(root, "2024-01-01T00:00:04 BDT");
    expect(q<HTMLSelectElement>(root, "preset").value).toBe("beidou-reading");
  });

  it("reads the clock from the token after the space", async () => {
    const { root } = await mount();
    type(root, "2024-01-01T00:00:18 GPS");
    expect(plateValue(root, "hero-utc")).toBe("2024-01-01T00:00:00Z");
    expect(text(root, "hero-utc")).toContain("read from GPS");
    expect(
      rows(root)
        .filter((r) => r.hasAttribute("data-reading"))
        .map((r) => r.dataset["row"]),
    ).toEqual(["GPS"]);
  });
});

describe("the slider", () => {
  it("has one more stop than there are inserted seconds, and starts on the latest", async () => {
    const { root } = await mount();
    const slider = q<HTMLInputElement>(root, "moment-slider");
    const stops = sliderPositions(lib);
    expect(Number(slider.min)).toBe(0);
    expect(Number(slider.max)).toBe(stops.length - 1);
    expect(slider.value).toBe(String(stops.length - 1));
    expect(text(root, "moment-value")).toBe(stops.at(-1));
    expect(stops[0]).toBe("1972-01-01T00:00:00Z");
  });

  it("writes the stop's UTC instant into the value and reads it", async () => {
    const { root } = await mount();
    const stops = sliderPositions(lib);
    slide(root, 0);
    expect(q<HTMLInputElement>(root, "value").value).toBe(stops[0]);
    expect(plateValue(root, "hero-tai")).toBe("10 s");
    expect(text(root, "moment-value")).toBe(stops[0]);
    // Before any satellite clock began, they have no result and the footnote says so.
    expect(text(root, "footnote")).toContain(
      "before this system's first instant",
    );
    slide(root, stops.length - 1);
    expect(q<HTMLInputElement>(root, "value").value).toBe(stops.at(-1));
    expect(plateValue(root, "hero-tai")).toBe("37 s");
  });

  it("has a typed equivalent and follows a typed stop", async () => {
    const { root } = await mount();
    const stops = sliderPositions(lib);
    type(root, stops[3]!);
    expect(q<HTMLInputElement>(root, "moment-slider").value).toBe("3");
    expect(text(root, "moment-value")).toBe(stops[3]);
  });

  it("leaves the slider where it is for a value that is not a stop", async () => {
    const { root } = await mount();
    slide(root, 5);
    type(root, "2030-05-05T05:05:05Z");
    expect(q<HTMLInputElement>(root, "moment-slider").value).toBe("5");
  });

  it("is a native range, labelled", async () => {
    const { root } = await mount();
    const slider = q<HTMLInputElement>(root, "moment-slider");
    expect(slider.type).toBe("range");
    expect(slider.closest("label")!.textContent).toContain(
      "Step through the leap seconds",
    );
  });
});

describe("seeding and permalinks", () => {
  it("seeds a chat call's value and paints it on the first frame", async () => {
    const template = renderSatelliteClockConverterTemplate({
      value: "2026-01-01T00:00:37 TAI",
    });
    expect(template).toContain('value="2026-01-01T00:00:37 TAI"');
    const { root } = await mount({ value: "2026-01-01T00:00:37 TAI" });
    expect(plateValue(root, "hero-utc")).toBe("2026-01-01T00:00:00Z");
    expect(q<HTMLSelectElement>(root, "preset").value).toBe("tai-reading");
  });

  it.each(CLOCK_PRESETS.map((p) => [p.id]))(
    "round-trips %s as a permalink of one string",
    async (id) => {
      const first = await mount();
      choose(first.root, "preset", id!);
      const state = first.handle.getPermalinkState?.() as Record<
        string,
        unknown
      >;
      expect(Object.keys(state)).toEqual(["value"]);
      expect(typeof state["value"]).toBe("string");
      expect((state["value"] as string).length).toBeLessThanOrEqual(64);
      const url = encodeWidgetPermalink("satclock", state);
      expect(url).toMatch(
        /^\/tools\/satellite-clock-converter\/\?w=satclock&wa=/,
      );
      const seeded = seedFromLocation("satclock", url.slice(url.indexOf("?")));
      expect(seeded).toEqual(state);
      const output = text(first.root, "clocks-output");
      const reason = text(first.root, "reason-aside");
      document.body.innerHTML = "";

      const second = await mount(seeded);
      expect(text(second.root, "clocks-output")).toBe(output);
      expect(text(second.root, "reason-aside")).toBe(reason);
      expect(q<HTMLSelectElement>(second.root, "preset").value).toBe(id);
    },
  );

  it("writes a custom value as typed", async () => {
    const { root, handle } = await mount();
    type(root, "2030-05-05T05:05:05Z");
    expect(handle.getPermalinkState?.()).toEqual({
      value: "2030-05-05T05:05:05Z",
    });
  });
});

describe("on-screen words", () => {
  function screenText(root: HTMLElement): string {
    const clone = root.cloneNode(true) as HTMLElement;
    clone
      .querySelectorAll('.gmt-codeframe, output[data-role$="output"]')
      .forEach((e) => e.remove());
    const labels = [...clone.querySelectorAll("[aria-label]")].map((e) =>
      e.getAttribute("aria-label"),
    );
    return `${clone.textContent}\n${labels.join("\n")}`;
  }

  it.each(CLOCK_PRESETS.map((p) => [p.id]))(
    "%s shows no raw null or undefined and names no body, zone or country",
    async (id) => {
      const { root } = await mount();
      choose(root, "preset", id!);
      const shown = screenText(root);
      expect(shown).not.toMatch(/\bnull\b|undefined|NaN/);
      expect(shown).not.toMatch(/UTC\+3|Moscow|MSK|New_York|en-US|\bGMT\b/);
      // GLONASS appears only in the one note that says what GLO is.
      expect(shown.replace(GLO_NOTE, "")).not.toMatch(/GLONASS/);
    },
  );

  it("states the reading in one hidden live sentence", async () => {
    const { root } = await mount({ preset: "beidou-reading" });
    const summary = q(root, "summary");
    expect(summary.getAttribute("aria-live")).toBe("polite");
    expect(summary.textContent).toContain("UTC 2024-01-01T00:00:00Z");
    expect(summary.textContent).toContain("TAI − UTC 37 s");
  });

  it("uses real controls", async () => {
    const { root } = await mount();
    expect(root.querySelectorAll("select")).toHaveLength(1);
    expect(root.querySelectorAll('input[type="text"]')).toHaveLength(1);
    expect(root.querySelectorAll('input[type="range"]')).toHaveLength(1);
  });

  it("prints the calls it made", async () => {
    const { root } = await mount({ preset: "beidou-reading" });
    const calls = text(root, "call-clocks");
    expect(calls).toContain("gnssToUtc");
    expect(calls).toContain("toTAI");
    expect(calls).toContain("taiMinusUtc");
    expect(calls).toContain("nextLeapSecond");
  });
});

describe("lifecycle", () => {
  it("an aborted mount is inert", async () => {
    const root = document.createElement("div");
    root.innerHTML = renderSatelliteClockConverterTemplate();
    document.body.append(root);
    const controller = new AbortController();
    controller.abort();
    const handle = await mountSatelliteClockConverter(
      root,
      {},
      controller.signal,
    );
    expect(text(root, "clocks-output")).toBe(" ");
    handle.destroy();
    handle.destroy();
  });
});
