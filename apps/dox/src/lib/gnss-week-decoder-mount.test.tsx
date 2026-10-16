/**
 * @vitest-environment jsdom
 *
 * The GNSS Week Decoder end to end: template -> mount -> interact -> assert,
 * against the real `@northguild/gmt`. Values are from a run of the built
 * library, so a drift in the library or the widget fails here.
 */
import { installJsdomShims } from "~/test/jsdom-shims";
import { GNSS_PRESETS } from "./gnss-week-decoder";
import {
  mountGnssWeekDecoder,
  renderGnssWeekDecoderTemplate,
} from "./gnss-week-decoder-mount";
import { encodeWidgetPermalink, seedFromLocation } from "./widget-permalink";

installJsdomShims();

const REQUIRED_ROLES = [
  "preset",
  "preset-description",
  "mode-group",
  "mode-broadcast",
  "mode-rinex",
  "mode-utc",
  "counter",
  "system",
  "week",
  "tow",
  "era-mode",
  "era",
  "pivot",
  "utc",
  "frame",
  "heroes",
  "hero-utc",
  "hero-system",
  "hero-rinex",
  "lanes",
  "lanes-empty",
  "lane-list",
  "summary",
  "reason-aside",
  "counter-table",
  "counter-body",
  "rinex-table",
  "rinex-body",
  "footnote",
  "call-decoder",
  "copy-decoder",
  "decoder-output",
];

const UTC: Record<string, string> = {
  "galileo-2019": "2019-04-07T00:00:00Z",
  "lnav-2024": "2024-01-01T00:00:00Z",
  "not-before-2020": "2024-01-01T00:00:00Z",
  "same-reading-two-dates": "1981-12-05T23:59:59Z",
  "second-rollover": "2019-04-06T23:59:42Z",
  "third-rollover": "2038-11-20T23:59:42Z",
  "nearest-today": "2024-01-01T00:00:00Z",
  "cnav-2024": "2024-01-01T00:00:00Z",
  "beidou-2024": "2024-01-01T00:00:00Z",
  "leap-second": "2016-12-31T23:59:60Z",
  "rinex-navic": "2024-01-01T00:00:00Z",
  "rinex-leap-second": "2016-12-31T23:59:60Z",
  "utc-2019-rollover": "2019-04-07T00:00:00Z",
  "utc-2024": "2024-01-01T00:00:00Z",
};
const SENTINEL = new Set([
  "week-past-the-counter",
  "utc-before-galileo",
  "utc-no-leap-second",
]);

const q = <T extends HTMLElement = HTMLElement>(
  root: HTMLElement,
  role: string,
) => root.querySelector(`[data-role="${role}"]`) as T;

async function mount(args = {}, templateArgs = args) {
  const root = document.createElement("div");
  root.innerHTML = renderGnssWeekDecoderTemplate(templateArgs);
  document.body.append(root);
  const controller = new AbortController();
  const handle = await mountGnssWeekDecoder(root, args, controller.signal);
  return { root, handle, controller };
}

function choose(root: HTMLElement, role: string, value: string) {
  const el = q<HTMLSelectElement>(root, role);
  el.value = value;
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

function type(root: HTMLElement, role: string, value: string) {
  const el = q<HTMLInputElement>(root, role);
  el.value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

function pickMode(root: HTMLElement, mode: string) {
  const el = q<HTMLInputElement>(root, `mode-${mode}`);
  el.checked = true;
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

const text = (root: HTMLElement, role: string) =>
  q(root, role).textContent ?? "";
const isSentinel = (root: HTMLElement, role: string) =>
  q(root, role).classList.contains("gmt-playground-sentinel");
const plateValue = (root: HTMLElement, role: string) =>
  q(root, role).querySelector(".gmt-punct-hero-value")!.textContent!;
const lanes = (root: HTMLElement) =>
  [...root.querySelectorAll<HTMLElement>('[data-role="laneset"]')].filter(
    (l) => !l.hasAttribute("data-blank"),
  );
const laneValues = (root: HTMLElement) =>
  lanes(root).map(
    (l) => l.querySelector('[data-role="lane-value"]')!.textContent,
  );

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime("2026-10-15T00:00:00Z");
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.useRealTimers();
});

describe("renderGnssWeekDecoderTemplate", () => {
  it("carries every role the mount looks up", () => {
    const root = document.createElement("div");
    root.innerHTML = renderGnssWeekDecoderTemplate();
    for (const role of REQUIRED_ROLES) {
      expect(root.querySelector(`[data-role="${role}"]`), role).not.toBeNull();
    }
  });

  it("is a widget root with the standard wrapper, and no class containing card but the wrapper", () => {
    const root = document.createElement("div");
    root.innerHTML = renderGnssWeekDecoderTemplate();
    const widget = root.firstElementChild as HTMLElement;
    expect(widget.className).toBe(
      "gmt-gnss-week-decoder gmt-widget not-content",
    );
    const cardClasses = [...root.querySelectorAll("[class]")]
      .flatMap((el) => [...el.classList])
      .filter((c) => c.includes("card"));
    expect(new Set(cardClasses)).toEqual(new Set(["gmt-widget-card"]));
  });

  it("renders four numbered sections, 2 and 3 wide, with three plates and four lane slots", () => {
    const root = document.createElement("div");
    root.innerHTML = renderGnssWeekDecoderTemplate();
    const sections = [...root.querySelectorAll(".gmt-widget-section")];
    expect(sections.map((s) => s.querySelector("h4")!.textContent)).toEqual([
      "1. Say which week you have",
      "2. Read it",
      "3. The same moment on every counter",
      "4. What the library returns",
    ]);
    expect(
      sections.map((s) => s.classList.contains("gmt-widget-section--wide")),
    ).toEqual([false, true, true, false]);
    expect(root.querySelectorAll(".gmt-punct-hero")).toHaveLength(3);
    expect(root.querySelectorAll('[data-role="laneset"]')).toHaveLength(4);
    expect(root.querySelectorAll('[data-role="counter-body"] tr')).toHaveLength(
      8,
    );
    expect(root.querySelectorAll('[data-role="rinex-body"] tr')).toHaveLength(
      5,
    );
  });

  it("escapes a hostile seed", () => {
    const root = document.createElement("div");
    root.innerHTML = renderGnssWeekDecoderTemplate({
      week: '"><img src=x onerror=alert(1)>',
      timeOfWeekSeconds: "<script>x</script>",
      utc: '"><svg onload=alert(1)>',
      rolloverNotBefore: "<b>x</b>",
    });
    expect(root.querySelector("img")).toBeNull();
    expect(root.querySelector("script")).toBeNull();
    expect(root.querySelector("svg[onload]")).toBeNull();
    expect(root.querySelector("b")).toBeNull();
  });
});

describe("every preset, against the real library", () => {
  it("has an expectation for every preset", () => {
    expect([...Object.keys(UTC), ...SENTINEL].sort()).toEqual(
      GNSS_PRESETS.map((p) => p.id).sort(),
    );
  });

  it.each(GNSS_PRESETS.map((p) => [p.id]))("%s", async (id) => {
    const { root } = await mount();
    choose(root, "preset", id!);
    expect(q<HTMLSelectElement>(root, "preset").value).toBe(id);
    expect(root.querySelectorAll(".gmt-punct-hero")).toHaveLength(3);
    expect(root.querySelectorAll('[data-role="laneset"]')).toHaveLength(4);
    if (SENTINEL.has(id!)) {
      expect(isSentinel(root, "decoder-output")).toBe(true);
      expect(text(root, "decoder-output")).toBe("NO SIGNAL");
      expect(
        root.querySelector('[data-role="reason-aside"] p')!.textContent,
      ).not.toBe("");
      return;
    }
    expect(isSentinel(root, "decoder-output")).toBe(false);
    expect(plateValue(root, "hero-utc")).toBe(UTC[id!]);
    expect(text(root, "reason-aside")).toBe("");
    expect(text(root, "call-decoder")).toContain("gnss");
    expect(text(root, "call-decoder").length).toBeGreaterThan(0);
  });
});

describe("a null result", () => {
  it("shows NO SIGNAL with the library's sentence, plates that read no result and lanes that say so", async () => {
    const { root } = await mount({ preset: "week-past-the-counter" });
    expect(isSentinel(root, "decoder-output")).toBe(true);
    expect(text(root, "reason-aside")).toContain(
      "This counter shows weeks below 1024.",
    );
    expect(
      [...root.querySelectorAll(".gmt-punct-hero")].every((p) =>
        p.hasAttribute("data-empty"),
      ),
    ).toBe(true);
    expect(lanes(root)).toHaveLength(0);
  });

  it("is a different sentence for each reason the library refuses", async () => {
    const { root } = await mount({ preset: "lnav-2024" });
    const sentences = new Set<string>();
    for (const [role, value] of [
      ["week", "x"],
      ["tow", "604800"],
      ["era", "x"],
      ["era", "99999999"],
    ] as const) {
      type(root, role, value);
      expect(isSentinel(root, "decoder-output")).toBe(true);
      sentences.add(text(root, "reason-aside"));
      choose(root, "preset", "lnav-2024");
    }
    expect(sentences.size).toBe(4);
  });
});

describe("a lane the counter cannot show is a result, not a no-signal", () => {
  it("draws no pin for it and no NO SIGNAL", async () => {
    const { root } = await mount({ preset: "rinex-navic" });
    expect(isSentinel(root, "decoder-output")).toBe(false);
    const values = laneValues(root);
    expect(values).toEqual([
      "2024-01-01T00:00:00Z",
      "no result",
      "2043-08-17T00:00:00Z",
    ]);
    expect(lanes(root)[1]!.querySelector("[data-empty]")).not.toBeNull();
  });
});

describe("the form", () => {
  it("opens on the first preset", async () => {
    const { root } = await mount();
    expect(q<HTMLSelectElement>(root, "preset").value).toBe("galileo-2019");
    expect(plateValue(root, "hero-utc")).toBe("2019-04-07T00:00:00Z");
    expect(laneValues(root)).toEqual([
      "2019-04-07T00:00:00Z",
      "2097-10-06T00:00:00Z",
    ]);
  });

  it("makes the preset custom when a field changes", async () => {
    const { root } = await mount();
    type(root, "week", "1025");
    expect(q<HTMLSelectElement>(root, "preset").value).toBe("custom");
    type(root, "week", "1024");
    expect(q<HTMLSelectElement>(root, "preset").value).toBe("galileo-2019");
  });

  it("shows only the fields a mode reads", async () => {
    const { root } = await mount();
    const hidden = () =>
      [...root.querySelectorAll<HTMLElement>("[data-field]")]
        .filter((f) => f.hidden)
        .map((f) => f.dataset["field"])
        .sort();
    expect(hidden()).toEqual(["pivot", "system", "utc"]);
    pickMode(root, "rinex");
    expect(hidden()).toEqual(["counter", "era", "era-mode", "pivot", "utc"]);
    pickMode(root, "utc");
    expect(hidden()).toEqual([
      "era",
      "era-mode",
      "pivot",
      "system",
      "tow",
      "week",
    ]);
    pickMode(root, "broadcast");
    choose(root, "era-mode", "notBefore");
    expect(hidden()).toEqual(["era", "system", "utc"]);
  });

  it("carries the moment across a change of mode", async () => {
    const { root } = await mount({ preset: "lnav-2024" });
    pickMode(root, "utc");
    expect(q<HTMLInputElement>(root, "utc").value).toBe("2024-01-01T00:00:00Z");
    expect(plateValue(root, "hero-utc")).toBe("2024-01-01T00:00:00Z");
    pickMode(root, "rinex");
    expect(q<HTMLInputElement>(root, "week").value).toBe("247");
    expect(q<HTMLSelectElement>(root, "system").value).toBe("GPS");
  });

  it("reads the same moment on every counter", async () => {
    const { root } = await mount({ preset: "utc-2019-rollover" });
    const rows = [...q(root, "counter-body").querySelectorAll("tr")];
    expect(rows).toHaveLength(8);
    const row = (name: string) =>
      [
        ...rows
          .find((r) => r.dataset["row"] === name)!
          .querySelectorAll("th, td"),
      ].map((c) => c.textContent);
    expect(row("GPS-LNAV")[0]).toContain("your reading");
    expect(row("GPS-LNAV").slice(1)).toEqual(["0", "18", "2"]);
    expect(row("GPS-CNAV").slice(1, 2)).toEqual(["2048"]);
    expect(row("GAL").slice(1, 2)).toEqual(["1024"]);
    expect(rows.filter((r) => r.hasAttribute("data-reading"))).toHaveLength(1);
  });

  it("says no result in a cell the library gave none for, and why under the table", async () => {
    const { root } = await mount({ preset: "same-reading-two-dates" });
    const gal = q(root, "counter-body").querySelector('[data-row="GAL"]')!;
    expect(gal.textContent).toContain("no result");
    expect(text(root, "footnote")).toBe(
      "No reading: before this system's first week.",
    );
    expect(isSentinel(root, "decoder-output")).toBe(false);
  });

  it("keeps the table rows when a reading goes to NO SIGNAL", async () => {
    const { root } = await mount({ preset: "lnav-2024" });
    type(root, "week", "x");
    expect(root.querySelectorAll('[data-role="counter-body"] tr')).toHaveLength(
      8,
    );
    expect(root.querySelectorAll('[data-role="rinex-body"] tr')).toHaveLength(
      5,
    );
  });
});

describe("seeding", () => {
  it("seeds a chat call's numbers and paints them on the first frame", async () => {
    const { root } = await mount({
      counter: "GPS-LNAV",
      week: 247,
      timeOfWeekSeconds: 86418,
      rolloverEra: 2,
    });
    expect(q<HTMLSelectElement>(root, "preset").value).toBe("lnav-2024");
    expect(plateValue(root, "hero-utc")).toBe("2024-01-01T00:00:00Z");
  });

  it("seeds a not-before date", async () => {
    const { root } = await mount({
      counter: "QZS-LNAV",
      week: "247",
      timeOfWeekSeconds: "86418",
      rolloverNotBefore: "2020-01-01T00:00:00Z",
    });
    expect(q<HTMLSelectElement>(root, "preset").value).toBe("not-before-2020");
    expect(q<HTMLSelectElement>(root, "era-mode").value).toBe("notBefore");
  });
});

describe("permalinks", () => {
  it.each(GNSS_PRESETS.map((p) => [p.id]))(
    "round-trips %s as a permalink of strings",
    async (id) => {
      const first = await mount();
      choose(first.root, "preset", id!);
      const state = first.handle.getPermalinkState?.() as Record<
        string,
        unknown
      >;
      expect(
        Object.values(state).every(
          (v) => typeof v === "string" && v.length > 0 && v.length <= 64,
        ),
      ).toBe(true);
      const url = encodeWidgetPermalink("gnssweek", state);
      expect(url).toMatch(/^\/tools\/gnss-week-decoder\/\?w=gnssweek&wa=/);
      const seeded = seedFromLocation("gnssweek", url.slice(url.indexOf("?")));
      expect(seeded).toEqual(state);
      const output = text(first.root, "decoder-output");
      document.body.innerHTML = "";

      const second = await mount(seeded);
      expect(text(second.root, "decoder-output")).toBe(output);
      expect(q<HTMLSelectElement>(second.root, "preset").value).toBe(id);
    },
  );

  it("writes a custom reading as the keys it uses", async () => {
    const { root, handle } = await mount({ preset: "lnav-2024" });
    type(root, "week", "100");
    expect(handle.getPermalinkState?.()).toEqual({
      mode: "broadcast",
      week: "100",
      timeOfWeekSeconds: "86418",
      counter: "GPS-LNAV",
      rolloverEra: "2",
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

  it.each(GNSS_PRESETS.map((p) => [p.id]))(
    "%s shows no raw null or undefined and names no body, zone or country",
    async (id) => {
      const { root } = await mount();
      choose(root, "preset", id!);
      const shown = screenText(root);
      expect(shown).not.toMatch(/\bnull\b|undefined|NaN/);
      expect(shown).not.toMatch(
        /UTC\+3|Moscow|MSK|New_York|en-US|\bGMT\b|GLONASS/,
      );
    },
  );

  it("states the reading in one hidden live sentence", async () => {
    const { root } = await mount({ preset: "beidou-2024" });
    const summary = q(root, "summary");
    expect(summary.getAttribute("aria-live")).toBe("polite");
    expect(summary.textContent).toContain("BDT time 2024-01-01T00:00:04 BDT");
  });

  it("names the lanes for a screen reader and nothing inside the drawing takes focus", async () => {
    const { root } = await mount({ preset: "lnav-2024" });
    const drawing = q(root, "lanes");
    expect(drawing.getAttribute("role")).toBe("img");
    expect(drawing.getAttribute("aria-label")).toContain(
      "era 2: 2024-01-01T00:00:00Z",
    );
    expect(q(root, "lane-list").querySelectorAll("li")).toHaveLength(4);
    expect(
      drawing.querySelectorAll("a, button, input, select, [tabindex]"),
    ).toHaveLength(0);
  });

  it("has no drag handle or slider", async () => {
    const { root } = await mount();
    expect(root.querySelector('input[type="range"]')).toBeNull();
  });

  it("uses real controls", async () => {
    const { root } = await mount();
    expect(root.querySelectorAll("select").length).toBeGreaterThan(0);
    expect(root.querySelectorAll('input[type="radio"]')).toHaveLength(3);
    expect(root.querySelectorAll('input[type="text"]').length).toBeGreaterThan(
      0,
    );
  });
});

describe("lifecycle", () => {
  it("an aborted mount is inert", async () => {
    const root = document.createElement("div");
    root.innerHTML = renderGnssWeekDecoderTemplate();
    document.body.append(root);
    const controller = new AbortController();
    controller.abort();
    const handle = await mountGnssWeekDecoder(root, {}, controller.signal);
    expect(text(root, "decoder-output")).toBe(" ");
    handle.destroy();
    handle.destroy();
  });

  it("two decoders on one page keep separate mode groups", async () => {
    const a = await mount();
    const b = await mount();
    const names = new Set(
      [
        ...document.querySelectorAll<HTMLInputElement>('input[type="radio"]'),
      ].map((r) => r.name),
    );
    expect(names.size).toBe(2);
    pickMode(a.root, "utc");
    expect(q<HTMLInputElement>(b.root, "mode-broadcast").checked).toBe(true);
  });
});
