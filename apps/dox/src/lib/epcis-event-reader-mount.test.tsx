/**
 * @vitest-environment jsdom
 *
 * The EPCIS Event Reader end to end: template → mount → interact → assert,
 * against the real `@northguild/gmt`. Every preset's printed calls, result,
 * verdict, members, dates, write-back and hand-off are checked, so a drift in
 * the library or the widget fails here.
 */
import { installJsdomShims } from "~/test/jsdom-shims";
import { blDateLib } from "~/test/ledger-lib";
import { readArgs as readBlArgs, readBlDate } from "./bl-date-stamp";
import {
  EPCIS_PRESETS,
  NULL_TEXT,
  epcisTexts,
  presetState,
} from "./epcis-event-reader";
import {
  mountEpcisEventReader,
  renderEpcisEventReaderTemplate,
} from "./epcis-event-reader-mount";
import {
  decodeWidgetPermalink,
  encodeWidgetPermalink,
  seedFromLocation,
} from "./widget-permalink";
import { SITE_BASE } from "./site";

installJsdomShims();

const REQUIRED_ROLES = [
  "preset",
  "event-time",
  "offset",
  "preset-description",
  "figure",
  "reason-aside",
  "parse-block",
  "call-parse",
  "copy-parse",
  "parse-output",
  "verdict",
  "verdict-detail",
  "readouts",
  "member-instant",
  "member-offset",
  "member-local",
  "rail-utc",
  "rail-local",
  "dates",
  "date-utc",
  "date-local",
  "words",
  "dates-aside",
  "dates-block",
  "call-dates",
  "copy-dates",
  "dates-output",
  "format-output",
  "format-block",
  "call-format",
  "copy-format",
  "format-note",
  "handoff",
];

/** preset id → [parse call, parse output, verdict]. */
const EXPECTED: Record<string, [string, string, string]> = {
  "next-day": [
    'parseEpcisEvent({ eventTime: "2024-06-15T23:30:00Z", eventTimeZoneOffset: "+02:00" })',
    '{ instant: "2024-06-15T23:30:00Z", offset: "+02:00", local: "2024-06-16T01:30:00" }',
    "Offset: stated (+02:00)",
  ],
  "offsets-disagree": [
    'parseEpcisEvent({ eventTime: "2024-06-15T10:00:00+02:00", eventTimeZoneOffset: "-05:00" })',
    '{ instant: "2024-06-15T08:00:00Z", offset: "-05:00", local: "2024-06-15T03:00:00" }',
    "Offset: stated (-05:00)",
  ],
  "minus-zero": [
    'parseEpcisEvent({ eventTime: "2024-06-15T14:30:00Z", eventTimeZoneOffset: "-00:00" })',
    '{ instant: "2024-06-15T14:30:00Z", offset: "+00:00", local: "2024-06-15T14:30:00" }',
    "Offset: stated (+00:00)",
  ],
  "no-offset": [
    'parseEpcisEvent({ eventTime: "2024-06-15T14:30:00Z" })',
    "NO SIGNAL",
    "Offset: not stated",
  ],
  "z-as-offset": [
    'parseEpcisEvent({ eventTime: "2024-06-15T14:30:00Z", eventTimeZoneOffset: "Z" })',
    "NO SIGNAL",
    "",
  ],
  "no-colon": [
    'parseEpcisEvent({ eventTime: "2024-06-15T14:30:00Z", eventTimeZoneOffset: "+0200" })',
    "NO SIGNAL",
    "",
  ],
  "no-seconds": [
    'parseEpcisEvent({ eventTime: "2024-06-15T14:30Z", eventTimeZoneOffset: "+02:00" })',
    "NO SIGNAL",
    "",
  ],
  "february-30": [
    'parseEpcisEvent({ eventTime: "2024-02-30T14:30:00Z", eventTimeZoneOffset: "+02:00" })',
    "NO SIGNAL",
    "",
  ],
};

/** preset id → [UTC date, local date, words, written back, note]. */
const DATES: Record<string, [string, string, string, string, string]> = {
  "next-day": [
    "2024-06-15",
    "2024-06-16",
    "The local date is the next day.",
    '{ eventTime: "2024-06-15T23:30:00Z", eventTimeZoneOffset: "+02:00" }',
    "",
  ],
  "offsets-disagree": [
    "2024-06-15",
    "2024-06-15",
    "The same date on both clocks.",
    '{ eventTime: "2024-06-15T08:00:00Z", eventTimeZoneOffset: "-05:00" }',
    "eventTime is written again as the instant in UTC, ending in Z, with no trailing zeros in a fraction.",
  ],
  "minus-zero": [
    "2024-06-15",
    "2024-06-15",
    "The same date on both clocks.",
    '{ eventTime: "2024-06-15T14:30:00Z", eventTimeZoneOffset: "+00:00" }',
    "The offset came back with a plus sign: the library writes -00:00 as +00:00.",
  ],
};

const q = <T extends HTMLElement = HTMLElement>(
  root: HTMLElement,
  role: string,
) => root.querySelector(`[data-role="${role}"]`) as T;

async function mount(args = {}, templateArgs = args) {
  const root = document.createElement("div");
  root.innerHTML = renderEpcisEventReaderTemplate(templateArgs);
  document.body.append(root);
  const controller = new AbortController();
  const handle = await mountEpcisEventReader(root, args, controller.signal);
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

const text = (root: HTMLElement, role: string) =>
  q(root, role).textContent ?? "";
const isSentinel = (root: HTMLElement, role: string) =>
  q(root, role).classList.contains("gmt-playground-sentinel");
const isEmpty = (root: HTMLElement, role: string) =>
  q(root, role).classList.contains("gmt-widget-output--empty");
const railDate = (root: HTMLElement, role: string) =>
  q(root, role).querySelector(".gmt-epcis-rail-date")!.textContent;

afterEach(() => {
  document.body.innerHTML = "";
});

describe("renderEpcisEventReaderTemplate", () => {
  it("carries every role the mount looks up", () => {
    const root = document.createElement("div");
    root.innerHTML = renderEpcisEventReaderTemplate();
    for (const role of REQUIRED_ROLES) {
      expect(root.querySelector(`[data-role="${role}"]`), role).not.toBeNull();
    }
  });

  it("is a widget root with the standard wrapper, and no class containing card but the wrapper", () => {
    const root = document.createElement("div");
    root.innerHTML = renderEpcisEventReaderTemplate();
    const widget = root.firstElementChild as HTMLElement;
    expect(widget.className).toBe(
      "gmt-epcis-event-reader gmt-widget not-content",
    );
    expect(widget.getAttributeNames()).toEqual(["class"]);
    const cardClasses = [...root.querySelectorAll("[class]")]
      .flatMap((el) => [...el.classList])
      .filter((c) => c.includes("card"));
    expect(new Set(cardClasses)).toEqual(new Set(["gmt-widget-card"]));
  });

  it("holds no result, renders four numbered sections and three fields in the first", () => {
    const root = document.createElement("div");
    root.innerHTML = renderEpcisEventReaderTemplate();
    const sections = root.querySelectorAll(".gmt-widget-section");
    expect(sections).toHaveLength(4);
    expect(
      [...sections].map((s) => s.querySelector("h4")!.textContent),
    ).toEqual([
      "1. The event's two fields",
      "2. What the event states",
      "3. The same moment on two clocks",
      "4. Written back by formatEpcisEvent",
    ]);
    expect(root.querySelectorAll(".gmt-edi-top > .gmt-label")).toHaveLength(3);
    expect(text(root, "member-instant")).toBe("no result");
    expect(text(root, "verdict")).toBe("");
  });

  it("opens on the first preset unless it is seeded", () => {
    const root = document.createElement("div");
    root.innerHTML = renderEpcisEventReaderTemplate();
    expect(q<HTMLSelectElement>(root, "preset").value).toBe("next-day");
    expect(q<HTMLInputElement>(root, "event-time").value).toBe(
      "2024-06-15T23:30:00Z",
    );
    root.innerHTML = renderEpcisEventReaderTemplate({
      eventTime: "2024-06-15T15:00:00Z",
    });
    expect(q<HTMLSelectElement>(root, "preset").value).toBe("custom");
    expect(q<HTMLInputElement>(root, "offset").value).toBe("");
  });

  it("escapes a hostile seed", () => {
    const root = document.createElement("div");
    root.innerHTML = renderEpcisEventReaderTemplate({
      eventTime: '"><img src=x onerror=alert(1)>',
      eventTimeZoneOffset: '"><script>x</script>',
    });
    expect(root.querySelector("img")).toBeNull();
    expect(root.querySelector("script")).toBeNull();
  });

  it("reserves a hold for every region whose text varies", () => {
    const root = document.createElement("div");
    root.innerHTML = renderEpcisEventReaderTemplate();
    const holds = root.querySelectorAll(".gmt-edi-hold");
    expect(holds.length).toBeGreaterThanOrEqual(14);
    for (const hold of holds) {
      expect(hold.querySelectorAll(":scope > *").length).toBeGreaterThan(1);
      for (const sizer of hold.querySelectorAll(".gmt-edi-sizer")) {
        expect(sizer.getAttribute("aria-hidden")).toBe("true");
        expect(sizer.hasAttribute("data-role")).toBe(false);
      }
    }
    const holdOf = (role: string) => q(root, role).closest(".gmt-edi-hold")!;
    const t = epcisTexts();
    expect(
      holdOf("preset-description").querySelectorAll(".gmt-edi-sizer"),
    ).toHaveLength(new Set(t.descriptions).size);
    expect(holdOf("verdict").querySelectorAll(".gmt-edi-sizer")).toHaveLength(
      2,
    );
    expect(
      holdOf("verdict-detail").querySelectorAll(".gmt-edi-sizer"),
    ).toHaveLength(2);
    expect(holdOf("words").querySelectorAll(".gmt-edi-sizer")).toHaveLength(3);
    expect(
      holdOf("format-note").querySelectorAll(".gmt-edi-sizer"),
    ).toHaveLength(new Set(t.writeNotes).size);
    // Each rail reserves its widest value and each empty sentence.
    for (const role of ["rail-utc", "rail-local"]) {
      expect(
        holdOf(role).querySelectorAll(".gmt-epcis-rail.gmt-edi-sizer"),
      ).toHaveLength(1 + new Set(t.railEmpty).size);
    }
    // The call frames reserve the longest call, the outputs the longest result.
    expect(holdOf("parse-block").textContent).toContain(t.parseCall);
    expect(holdOf("parse-output").textContent).toContain(t.parseOutput);
    expect(holdOf("format-block").textContent).toContain(t.formatCall);
    expect(holdOf("dates-block").textContent).toContain(
      t.dateCalls.split("\n")[0]!,
    );
    // One sizer for each sentence, because the tallest is set by the width.
    expect(
      holdOf("reason-aside").querySelectorAll(".gmt-edi-sizer"),
    ).toHaveLength(t.nulls.length);
  });
});

describe("every preset, against the real library", () => {
  it("has an expectation for every preset", () => {
    expect(Object.keys(EXPECTED).sort()).toEqual(
      EPCIS_PRESETS.map((p) => p.id).sort(),
    );
  });

  it.each(EPCIS_PRESETS.map((p) => [p.id]))("%s", async (id) => {
    const { root } = await mount();
    choose(root, "preset", id!);
    const [call, result, verdict] = EXPECTED[id!]!;
    const sentinel = result === "NO SIGNAL";

    expect(q(root, "copy-parse").dataset["copyText"]).toBe(call);
    expect(text(root, "parse-output")).toBe(result);
    expect(isSentinel(root, "parse-output")).toBe(sentinel);
    expect(text(root, "verdict")).toBe(verdict);
    expect(q(root, "parse-block").hidden).toBe(false);
    expect(text(root, "reason-aside") === "").toBe(!sentinel);
    expect(q(root, "preset-description").textContent).toBe(
      EPCIS_PRESETS.find((p) => p.id === id)!.description,
    );

    const dates = DATES[id!];
    for (const role of ["member-instant", "member-offset", "member-local"]) {
      const cell = q(root, role);
      expect(cell.dataset["state"], role).toBe(sentinel ? "none" : "value");
      if (sentinel) expect(cell.textContent).toBe("no result");
    }

    if (dates === undefined) {
      expect(text(root, "date-utc")).toBe("no result");
      expect(text(root, "date-local")).toBe("no result");
      expect(text(root, "words")).toBe("");
      expect(q(root, "dates-block").hidden).toBe(true);
      expect(text(root, "dates-output")).toBe("no dates to compare");
      expect(isEmpty(root, "dates-output")).toBe(true);
      expect(text(root, "format-output")).toBe("no value to write back");
      expect(isEmpty(root, "format-output")).toBe(true);
      expect(q(root, "format-block").hidden).toBe(true);
      expect(text(root, "format-note")).toBe("");
      expect(q(root, "rail-utc").dataset["state"]).toBe("empty");
      expect(q(root, "rail-local").dataset["state"]).toBe("empty");
      const link = q<HTMLAnchorElement>(root, "handoff");
      expect(link.getAttribute("aria-disabled")).toBe("true");
      expect(link.hasAttribute("href")).toBe(false);
      return;
    }
    const [utc, local, words, written, note] = dates;
    expect(text(root, "date-utc")).toBe(utc);
    expect(text(root, "date-local")).toBe(local);
    expect(text(root, "words")).toBe(words);
    expect(q(root, "dates-block").hidden).toBe(false);
    expect(isSentinel(root, "dates-output")).toBe(false);
    expect(q(root, "copy-dates").dataset["copyText"]!.split("\n")).toHaveLength(
      4,
    );
    expect(text(root, "format-output")).toBe(written);
    expect(isSentinel(root, "format-output")).toBe(false);
    expect(q(root, "format-block").hidden).toBe(false);
    expect(text(root, "format-note")).toBe(note);
    expect(q(root, "rail-utc").dataset["state"]).toBe("value");
    expect(q(root, "rail-local").dataset["state"]).toBe("value");
    expect(railDate(root, "rail-utc")).toBe(utc);
    expect(railDate(root, "rail-local")).toBe(local);
    const link = q<HTMLAnchorElement>(root, "handoff");
    expect(link.hasAttribute("aria-disabled")).toBe(false);
    expect(link.getAttribute("href")).toMatch(
      new RegExp(`^${SITE_BASE}/tools/bl-date-stamp/\\?w=bldate&wa=`),
    );
  });

  it("prints the four date calls in the order made, and their results beside them", async () => {
    const { root } = await mount();
    expect(q(root, "copy-dates").dataset["copyText"]).toBe(
      [
        'convertUtcToPlainDate("2024-06-15T23:30:00Z")',
        'chopTime("2024-06-16T01:30:00")',
        'areDatesEqual("2024-06-15", "2024-06-16")',
        'isAfterDate("2024-06-16", "2024-06-15")',
      ].join("\n"),
    );
    expect(text(root, "dates-output")).toBe(
      ['"2024-06-15"', '"2024-06-16"', "false", "true"].join("\n"),
    );
  });

  it.each([
    ["no-offset", NULL_TEXT.noOffset],
    ["z-as-offset", NULL_TEXT.badOffset],
    ["no-colon", NULL_TEXT.badOffset],
    ["no-seconds", NULL_TEXT.badTime],
    ["february-30", NULL_TEXT.badDate],
  ])(
    "%s says why in one sentence from the library's validators",
    async (id, sentence) => {
      const { root } = await mount();
      choose(root, "preset", id);
      expect(text(root, "reason-aside")).toContain(sentence);
      expect(
        root.querySelectorAll(
          '[data-role="reason-aside"] .starlight-aside__content p',
        ),
      ).toHaveLength(1);
    },
  );
});

describe("the day rails", () => {
  it("marks the lit day and one pin on each rail", async () => {
    const { root } = await mount();
    for (const role of ["rail-utc", "rail-local"]) {
      const rail = q(root, role);
      expect(rail.getAttribute("role")).toBe("img");
      expect(
        rail.querySelectorAll('.gmt-epcis-day[data-lit="1"]'),
      ).toHaveLength(1);
      expect(rail.querySelectorAll(".gmt-epcis-pin")).toHaveLength(1);
      expect(
        rail.querySelector(".gmt-epcis-pin")!.getAttribute("style"),
      ).toContain("--x:50.000%");
    }
    expect(q(root, "rail-utc").getAttribute("aria-label")).toBe(
      "UTC: the event falls on 2024-06-15.",
    );
    expect(q(root, "rail-local").getAttribute("aria-label")).toBe(
      "Local clock +02:00: the event falls on 2024-06-16.",
    );
    expect(q(root, "rail-local").textContent).toContain("Local clock +02:00");
  });

  it("keeps each rail's box and says why in words without a result", async () => {
    const { root } = await mount();
    choose(root, "preset", "no-offset");
    expect(q(root, "rail-local").textContent).toContain(
      "Not stated: the offset is missing, so the local clock is unknown.",
    );
    expect(q(root, "rail-utc").textContent).toContain(
      "No instant to place: the library read no result.",
    );
    expect(railDate(root, "rail-utc")).toBe("no result");
    choose(root, "preset", "z-as-offset");
    expect(q(root, "rail-local").textContent).toContain(
      "No local clock: the library read no result.",
    );
    expect(
      q(root, "rail-local").querySelectorAll(".gmt-epcis-track"),
    ).toHaveLength(1);
  });

  it("is a replaced element, never a removed one: both rails stay in the hold", async () => {
    const { root } = await mount();
    const holds = ["rail-utc", "rail-local"].map(
      (r) => q(root, r).parentElement,
    );
    for (const id of EPCIS_PRESETS.map((p) => p.id)) {
      choose(root, "preset", id);
      ["rail-utc", "rail-local"].forEach((r, i) => {
        expect(q(root, r).parentElement).toBe(holds[i]);
        expect(q(root, r).classList.contains("gmt-edi-sizer")).toBe(false);
      });
    }
  });
});

describe("a blank form and partial input", () => {
  it("a blank form makes no call and is empty, not amber", async () => {
    const { root } = await mount();
    type(root, "event-time", "");
    type(root, "offset", "");
    expect(text(root, "parse-output")).toBe("nothing to read");
    expect(isEmpty(root, "parse-output")).toBe(true);
    expect(isSentinel(root, "parse-output")).toBe(false);
    expect(q(root, "parse-block").hidden).toBe(true);
    expect(text(root, "reason-aside")).toBe("");
    expect(text(root, "verdict")).toBe("");
    expect(text(root, "member-instant")).toBe("no result");
    expect(text(root, "format-output")).toBe("no value to write back");
    expect(q(root, "rail-utc").textContent).toContain("Nothing to place yet.");
    expect(q(root, "rail-local").textContent).toContain(
      "Nothing to place yet.",
    );
    expect(q(root, "figure").textContent).toContain(
      "Type an eventTime and an eventTimeZoneOffset to take them apart.",
    );
    expect(root.querySelector(".gmt-playground-sentinel")).toBeNull();
  });

  it("anything typed in one field is partial input, and the library answers it", async () => {
    const { root } = await mount();
    type(root, "event-time", "");
    type(root, "offset", "");
    type(root, "offset", "+02:00");
    expect(text(root, "parse-output")).toBe("NO SIGNAL");
    expect(isSentinel(root, "parse-output")).toBe(true);
    expect(q(root, "copy-parse").dataset["copyText"]).toBe(
      'parseEpcisEvent({ eventTime: "", eventTimeZoneOffset: "+02:00" })',
    );
    expect(text(root, "reason-aside")).toContain(NULL_TEXT.noTime);
    type(root, "offset", "");
    type(root, "event-time", "2024-06-15T14:30:00Z");
    expect(text(root, "reason-aside")).toContain(NULL_TEXT.noOffset);
    expect(text(root, "verdict")).toBe("Offset: not stated");
    expect(q(root, "copy-parse").dataset["copyText"]).toBe(
      'parseEpcisEvent({ eventTime: "2024-06-15T14:30:00Z" })',
    );
  });

  it("goes from blank to a refused value to a result and back, with the call frame following", async () => {
    const { root } = await mount();
    type(root, "event-time", "");
    type(root, "offset", "");
    expect(q(root, "parse-block").hidden).toBe(true);
    type(root, "event-time", "2024-06-15T14:30:00Z");
    expect(q(root, "parse-block").hidden).toBe(false);
    expect(text(root, "parse-output")).toBe("NO SIGNAL");
    type(root, "offset", "-05:00");
    expect(text(root, "parse-output")).toContain(
      'local: "2024-06-15T09:30:00"',
    );
    expect(text(root, "words")).toBe("The same date on both clocks.");
    type(root, "event-time", "");
    type(root, "offset", "");
    expect(q(root, "parse-block").hidden).toBe(true);
    expect(text(root, "member-local")).toBe("no result");
  });

  it("changes the preset to Custom when a field is edited, and back when it matches", async () => {
    const { root } = await mount();
    type(root, "offset", "+03:00");
    expect(q<HTMLSelectElement>(root, "preset").value).toBe("custom");
    type(root, "offset", "+02:00");
    expect(q<HTMLSelectElement>(root, "preset").value).toBe("next-day");
  });

  it("draws a refused field in a neutral box, never amber", async () => {
    const { root } = await mount();
    choose(root, "preset", "z-as-offset");
    const fig = q(root, "figure");
    expect(
      fig.querySelectorAll('[data-group="neutral"]').length,
    ).toBeGreaterThan(0);
    expect(fig.querySelector(".gmt-playground-sentinel")).toBeNull();
    choose(root, "preset", "no-offset");
    expect(
      q(root, "figure").querySelector('[data-group="none"]'),
    ).not.toBeNull();
  });

  it("takes both fields apart with the group brackets", async () => {
    const { root } = await mount();
    const fig = q(root, "figure");
    expect(
      [...fig.querySelectorAll(".gmt-edi-half-label")].map(
        (m) => m.textContent,
      ),
    ).toEqual(["eventTime", "eventTimeZoneOffset"]);
    expect(
      [...fig.querySelectorAll(".gmt-edi-box")].map((b) => b.textContent),
    ).toEqual(["2024-06-15", "T23:30:00", "Z", "+02:00"]);
    expect(
      [...fig.querySelectorAll(".gmt-edi-bracket-label")].map((m) =>
        m.textContent?.trim(),
      ),
    ).toEqual(["date", "time", "offset", "offset"]);
    expect(fig.getAttribute("aria-label")).toContain("date 2024-06-15");
  });
});

describe("the hand-off", () => {
  it("opens the B/L Date Stamp on the instant, the event and the offset", async () => {
    const { root } = await mount();
    const link = q<HTMLAnchorElement>(root, "handoff");
    expect(link.textContent).toBe(
      "Read this moment as a shipped on board date in the B/L Date Stamp",
    );
    const href = link.getAttribute("href")!;
    expect(href).toBe(
      encodeWidgetPermalink("bldate", {
        value: "2024-06-15T23:30:00Z",
        event: "shippedOnBoard",
        timeZone: "+02:00",
      }),
    );
    const decoded = decodeWidgetPermalink(href.slice(href.indexOf("?")));
    expect(decoded!.kind).toBe("bldate");
    const seeded = seedFromLocation("bldate", href.slice(href.indexOf("?")));
    // The B/L Date Stamp reads the offset as its place zone.
    const bl = readBlDate(readBlArgs(seeded), blDateLib);
    expect(bl.bl).toBe("2024-06-16");
    expect(bl.utc).toBe("2024-06-15");
  });

  it("follows the fields, and loses its address when the result goes", async () => {
    const { root } = await mount();
    type(root, "offset", "-05:00");
    expect(
      decodeURIComponent(q(root, "handoff").getAttribute("href")!),
    ).toContain('"timeZone":"-05:00"');
    type(root, "offset", "Z");
    expect(q(root, "handoff").hasAttribute("href")).toBe(false);
    expect(q(root, "handoff").getAttribute("aria-disabled")).toBe("true");
  });
});

describe("seeding", () => {
  it("seeds the scenario's event and opens it as the next-day preset", async () => {
    const { root } = await mount({
      eventTime: "2024-06-15T23:30:00Z",
      eventTimeZoneOffset: "+02:00",
    });
    expect(q<HTMLSelectElement>(root, "preset").value).toBe("next-day");
    expect(text(root, "date-local")).toBe("2024-06-16");
    expect(text(root, "words")).toBe("The local date is the next day.");
  });

  it("seeds the starter question: both fields, as given", async () => {
    const { root } = await mount({
      eventTime: "2024-06-15T23:30:00Z",
      eventTimeZoneOffset: "+02:00",
    });
    expect(text(root, "verdict")).toBe("Offset: stated (+02:00)");
  });

  it("never fills a missing offset in", async () => {
    const { root } = await mount({ eventTime: "2024-06-15T14:30:00Z" });
    expect(q<HTMLInputElement>(root, "offset").value).toBe("");
    expect(text(root, "parse-output")).toBe("NO SIGNAL");
    expect(text(root, "verdict")).toBe("Offset: not stated");
    expect(q<HTMLSelectElement>(root, "preset").value).toBe("no-offset");
  });

  it("seeds from the template too", async () => {
    const { root } = await mount(
      { eventTime: "2024-06-15T14:30:00Z", eventTimeZoneOffset: "-05:00" },
      { eventTime: "2024-06-15T14:30:00Z", eventTimeZoneOffset: "-05:00" },
    );
    expect(q<HTMLInputElement>(root, "event-time").value).toBe(
      "2024-06-15T14:30:00Z",
    );
    expect(q<HTMLInputElement>(root, "offset").value).toBe("-05:00");
  });
});

describe("permalinks", () => {
  it.each(EPCIS_PRESETS.map((p) => [p.id]))(
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
      // A blank offset has no key.
      expect("eventTimeZoneOffset" in state).toBe(id !== "no-offset");
      const url = encodeWidgetPermalink("epcis", state);
      expect(url).toMatch(/\\?w=epcis&wa=[^)"'\s]+$/);
      const seeded = seedFromLocation("epcis", url.slice(url.indexOf("?")));
      expect(seeded).toEqual(state);
      const output = text(first.root, "parse-output");
      document.body.innerHTML = "";

      const second = await mount(seeded);
      expect(text(second.root, "parse-output")).toBe(output);
      expect(q<HTMLSelectElement>(second.root, "preset").value).toBe(id);
    },
  );
});

describe("naming", () => {
  it("names no regulator, statute, agency, docket or customs body", async () => {
    const forbidden = /\b(CFR|statut|regulat|docket|agency|customs|court)\b/i;
    const { root } = await mount();
    const seen: string[] = [renderEpcisEventReaderTemplate()];
    for (const p of EPCIS_PRESETS) {
      seen.push(p.label, p.description);
      choose(root, "preset", p.id);
      seen.push(root.textContent ?? "");
    }
    for (const s of seen) expect(s).not.toMatch(forbidden);
    for (const p of EPCIS_PRESETS) {
      expect(presetState(p).eventTime).not.toMatch(forbidden);
    }
  });
});

describe("lifecycle", () => {
  it("an aborted mount is inert", async () => {
    const root = document.createElement("div");
    root.innerHTML = renderEpcisEventReaderTemplate();
    document.body.append(root);
    const controller = new AbortController();
    controller.abort();
    const handle = await mountEpcisEventReader(root, {}, controller.signal);
    expect(text(root, "member-instant")).toBe("no result");
    expect(handle.getPermalinkState?.()).toBeNull();
    expect(() => {
      handle.destroy();
      handle.destroy();
    }).not.toThrow();
  });

  it("destroying twice is safe, and the widget stops answering", async () => {
    const { root, handle } = await mount();
    handle.destroy();
    handle.destroy();
    type(root, "offset", "-05:00");
    expect(text(root, "verdict")).toBe("Offset: stated (+02:00)");
  });
});

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

describe("on-screen words", () => {
  it.each(EPCIS_PRESETS.map((p) => [p.id]))(
    "%s never names the library as GMT, and shows no raw null",
    async (id) => {
      const { root } = await mount();
      choose(root, "preset", id!);
      const shown = screenText(root);
      expect(shown).not.toMatch(/GMT/);
      expect(shown).not.toMatch(/\b(null|undefined)\b/);
      for (const role of ["member-instant", "member-offset", "member-local"]) {
        expect(q(root, role).textContent).not.toMatch(/null|undefined|^$/);
      }
      for (const role of ["date-utc", "date-local"]) {
        expect(q(root, role).textContent).not.toMatch(/null|undefined|^$/);
      }
    },
  );

  it("calls the library the library", async () => {
    const { root } = await mount();
    choose(root, "preset", "no-offset");
    expect(text(root, "reason-aside")).toMatch(
      /the library does not assume UTC/,
    );
  });
});

describe("the library under the widget", () => {
  it("is the real one: a printed call is the call the library made", async () => {
    const { root } = await mount();
    choose(root, "preset", "minus-zero");
    expect(text(root, "member-offset")).toBe("+00:00");
    expect(text(root, "format-output")).toContain(
      'eventTimeZoneOffset: "+00:00"',
    );
  });
});
