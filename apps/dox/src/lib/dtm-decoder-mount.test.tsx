/**
 * @vitest-environment jsdom
 *
 * The DTM Decoder end to end: template → mount → interact → assert, against the
 * real `@northguild/gmt`. Every preset's printed calls, result, verdict, members
 * and write-back are checked, so a drift in the library or the widget fails here.
 */
/// <reference types="vitest/globals" />
import { lib } from "~/test/edi-lib";
import { installJsdomShims } from "~/test/jsdom-shims";
import { encodeWidgetPermalink, seedFromLocation } from "./widget-permalink";
import { DTM_PRESETS, REASON_TEXT, presetState } from "./dtm-decoder";
import { mountDtmDecoder, renderDtmDecoderTemplate } from "./dtm-decoder-mount";

installJsdomShims();

const REQUIRED_ROLES = [
  "preset",
  "preset-description",
  "input",
  "format",
  "split",
  "verdict",
  "verdict-detail",
  "readouts",
  "member-kind",
  "member-value",
  "member-period-end",
  "member-instant",
  "member-offset",
  "call-parse",
  "copy-parse",
  "parse-block",
  "parse-output",
  "reason-aside",
  "strip-note",
  "gap-strip",
  "zone-1",
  "zone-4",
  "figure",
  "timeline",
  "instant-1",
  "instant-4",
  "offset-1",
  "offset-4",
  "as205-1",
  "as205-4",
  "third-head",
  "gap",
  "strip-summary",
  "strip-aside",
  "call-resolve",
  "copy-resolve",
  "resolve-output",
  "format-output",
  "format-note",
  "call-format",
  "copy-format",
];

const NOT_STATED = "not stated";

/** preset id → [calls, parse output, verdict, format call | null, format output]. */
const EXPECTED: Record<
  string,
  [string, string, string, string | null, string]
> = {
  "local-203": [
    'classifyEdifactDtmFormat("203")\nparseEdifactDateTime("202406151430", "203")',
    '{ kind: "dateTime", format: "203" }\n"2024-06-15T14:30:00"',
    "Offset: not stated",
    'formatEdifactDateTime("2024-06-15T14:30:00", "203")',
    '"202406151430"',
  ],
  "released-303": [
    'classifyEdifactDtmFormat("303")\nparseEdifactOffsetDateTime("202406151430+00", "303")\ntoOffsetInstant("2024-06-15T14:30:00+00:00")',
    '{ kind: "offsetDateTime", format: "303" }\n"2024-06-15T14:30:00+00:00"\n{ instant: "2024-06-15T14:30:00Z", offset: "+00:00" }',
    "Offset: stated (+00:00)",
    'formatEdifactOffsetDateTime("2024-06-15T14:30:00+00:00", "303")',
    '"202406151430+00"',
  ],
  "utc-303": [
    'classifyEdifactDtmFormat("303")\nparseEdifactOffsetDateTime("202406151430UTC", "303")\ntoOffsetInstant("2024-06-15T14:30:00+00:00")',
    '{ kind: "offsetDateTime", format: "303" }\n"2024-06-15T14:30:00+00:00"\n{ instant: "2024-06-15T14:30:00Z", offset: "+00:00" }',
    "Offset: stated (+00:00)",
    'formatEdifactOffsetDateTime("2024-06-15T14:30:00+00:00", "303")',
    '"202406151430+00"',
  ],
  "gmt-303": [
    'classifyEdifactDtmFormat("303")\nparseEdifactOffsetDateTime("202406151430GMT", "303")\ntoOffsetInstant("2024-06-15T14:30:00+00:00")',
    '{ kind: "offsetDateTime", format: "303" }\n"2024-06-15T14:30:00+00:00"\n{ instant: "2024-06-15T14:30:00Z", offset: "+00:00" }',
    "Offset: stated (+00:00)",
    'formatEdifactOffsetDateTime("2024-06-15T14:30:00+00:00", "303")',
    '"202406151430+00"',
  ],
  "offset-205": [
    'classifyEdifactDtmFormat("205")\nparseEdifactOffsetDateTime("202406151430+0200", "205")\ntoOffsetInstant("2024-06-15T14:30:00+02:00")',
    '{ kind: "offsetDateTime", format: "205" }\n"2024-06-15T14:30:00+02:00"\n{ instant: "2024-06-15T12:30:00Z", offset: "+02:00" }',
    "Offset: stated (+02:00)",
    'formatEdifactOffsetDateTime("2024-06-15T14:30:00+02:00", "205")',
    '"202406151430+0200"',
  ],
  "offset-208": [
    'classifyEdifactDtmFormat("208")\nparseEdifactOffsetDateTime("20240615143045+0200", "208")\ntoOffsetInstant("2024-06-15T14:30:45+02:00")',
    '{ kind: "offsetDateTime", format: "208" }\n"2024-06-15T14:30:45+02:00"\n{ instant: "2024-06-15T12:30:45Z", offset: "+02:00" }',
    "Offset: stated (+02:00)",
    'formatEdifactOffsetDateTime("2024-06-15T14:30:45+02:00", "208")',
    '"20240615143045+0200"',
  ],
  "date-102": [
    'classifyEdifactDtmFormat("102")\nparseEdifactDate("20240615", "102")',
    '{ kind: "date", format: "102" }\n"2024-06-15"',
    "Offset: not stated",
    'formatEdifactDate("2024-06-15", "102")',
    '"20240615"',
  ],
  "time-402": [
    'classifyEdifactDtmFormat("402")\nparseEdifactTime("143045", "402")',
    '{ kind: "time", format: "402" }\n"14:30:45"',
    "Offset: not stated",
    'formatEdifactTime("14:30:45", "402")',
    '"143045"',
  ],
  "period-718": [
    'classifyEdifactDtmFormat("718")\nparseEdifactDatePeriod("2024061520240620", "718")',
    '{ kind: "datePeriod", format: "718" }\n{ start: "2024-06-15", end: "2024-06-20" }',
    "Offset: not stated",
    'formatEdifactDatePeriod("2024-06-15", "2024-06-20", "718")',
    '"2024061520240620"',
  ],
  "period-719": [
    'classifyEdifactDtmFormat("719")\nparseEdifactDateTimePeriod("202406151430202406201600", "719")',
    '{ kind: "dateTimePeriod", format: "719" }\n{ start: "2024-06-15T14:30:00", end: "2024-06-20T16:00:00" }',
    "Offset: not stated",
    'formatEdifactDateTimePeriod("2024-06-15T14:30:00", "2024-06-20T16:00:00", "719")',
    '"202406151430202406201600"',
  ],
  "cet-303": [
    'classifyEdifactDtmFormat("303")\nparseEdifactOffsetDateTime("202406151430CET", "303")',
    "NO SIGNAL",
    "",
    null,
    "no value to write back",
  ],
  "two-digit-101": [
    'classifyEdifactDtmFormat("101")',
    "NO SIGNAL",
    "",
    null,
    "no value to write back",
  ],
};

/** preset id → the member rows the result holds (others read `not stated`). */
const MEMBERS: Record<string, Record<string, string>> = {
  "local-203": { kind: "local date-time", value: "2024-06-15T14:30:00" },
  "released-303": {
    kind: "date-time with offset",
    value: "2024-06-15T14:30:00+00:00",
    instant: "2024-06-15T14:30:00Z",
    offset: "+00:00",
  },
  "utc-303": {
    kind: "date-time with offset",
    value: "2024-06-15T14:30:00+00:00",
    instant: "2024-06-15T14:30:00Z",
    offset: "+00:00",
  },
  "gmt-303": {
    kind: "date-time with offset",
    value: "2024-06-15T14:30:00+00:00",
    instant: "2024-06-15T14:30:00Z",
    offset: "+00:00",
  },
  "offset-205": {
    kind: "date-time with offset",
    value: "2024-06-15T14:30:00+02:00",
    instant: "2024-06-15T12:30:00Z",
    offset: "+02:00",
  },
  "offset-208": {
    kind: "date-time with offset",
    value: "2024-06-15T14:30:45+02:00",
    instant: "2024-06-15T12:30:45Z",
    offset: "+02:00",
  },
  "date-102": { kind: "date", value: "2024-06-15" },
  "time-402": { kind: "time", value: "14:30:45" },
  "period-718": {
    kind: "date period",
    value: "2024-06-15",
    "period-end": "2024-06-20",
  },
  "period-719": {
    kind: "date-time period",
    value: "2024-06-15T14:30:00",
    "period-end": "2024-06-20T16:00:00",
  },
};

const MEMBER_KEYS = ["kind", "value", "period-end", "instant", "offset"];

const q = <T extends HTMLElement = HTMLElement>(
  root: HTMLElement,
  role: string,
) => root.querySelector(`[data-role="${role}"]`) as T;

async function mount(args = {}, templateArgs = args) {
  const root = document.createElement("div");
  root.innerHTML = renderDtmDecoderTemplate(templateArgs);
  document.body.append(root);
  const controller = new AbortController();
  const handle = await mountDtmDecoder(root, args, controller.signal);
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

afterEach(() => {
  document.body.innerHTML = "";
  vi.useRealTimers();
});

describe("renderDtmDecoderTemplate", () => {
  it("carries every role the mount looks up", () => {
    const root = document.createElement("div");
    root.innerHTML = renderDtmDecoderTemplate();
    for (const role of REQUIRED_ROLES) {
      expect(root.querySelector(`[data-role="${role}"]`), role).not.toBeNull();
    }
  });

  it("is a widget root with the standard wrapper, and no class containing card but the wrapper", () => {
    const root = document.createElement("div");
    root.innerHTML = renderDtmDecoderTemplate();
    const widget = root.firstElementChild as HTMLElement;
    expect(widget.className).toBe("gmt-dtm-decoder gmt-widget not-content");
    expect(widget.getAttributeNames()).toEqual(["class"]);
    const cardClasses = [...root.querySelectorAll("[class]")]
      .flatMap((el) => [...el.classList])
      .filter((c) => c.includes("card"));
    expect(new Set(cardClasses)).toEqual(new Set(["gmt-widget-card"]));
  });

  it("holds no result and renders four numbered sections", () => {
    const root = document.createElement("div");
    root.innerHTML = renderDtmDecoderTemplate();
    expect(root.querySelectorAll(".gmt-widget-section")).toHaveLength(4);
    expect(text(root, "member-value")).toBe("no result");
    expect(text(root, "verdict")).toBe("");
  });

  it("has no year-window control: the section's field row is the preset, the segment and the code", () => {
    const root = document.createElement("div");
    root.innerHTML = renderDtmDecoderTemplate();
    expect(root.querySelector('[data-role="year-window"]')).toBeNull();
    expect(root.querySelector('[data-role="year-start"]')).toBeNull();
    expect(root.querySelectorAll(".gmt-edi-top > .gmt-label")).toHaveLength(3);
  });

  it("escapes a hostile seed", () => {
    const root = document.createElement("div");
    root.innerHTML = renderDtmDecoderTemplate({
      input: '"><img src=x onerror=alert(1)>',
      zone1: '"><script>x</script>',
    });
    expect(root.querySelector("img")).toBeNull();
    expect(root.querySelector("script")).toBeNull();
  });
});

describe("every preset, against the real library", () => {
  it("has an expectation for every preset", () => {
    expect(Object.keys(EXPECTED).sort()).toEqual(
      DTM_PRESETS.map((p) => p.id).sort(),
    );
  });

  it.each(DTM_PRESETS.map((p) => [p.id]))("%s", async (id) => {
    const { root } = await mount();
    choose(root, "preset", id!);
    const [call, result, verdict, formatCall, formatOut] = EXPECTED[id!]!;

    expect(q(root, "copy-parse").dataset["copyText"]).toBe(call);
    expect(text(root, "parse-output")).toBe(result);
    expect(text(root, "verdict")).toBe(verdict);

    const members = MEMBERS[id!];
    for (const key of MEMBER_KEYS) {
      const cell = q(root, `member-${key}`);
      if (members === undefined) {
        expect(cell.textContent).toBe("no result");
        expect(cell.dataset["state"]).toBe("none");
      } else if (members[key] !== undefined) {
        expect(cell.textContent, key).toBe(members[key]);
        expect(cell.dataset["state"]).toBe("value");
      } else {
        expect(cell.textContent, key).toBe(NOT_STATED);
        expect(cell.dataset["state"]).toBe("absent");
      }
    }

    const sentinel = result === "NO SIGNAL";
    expect(isSentinel(root, "parse-output")).toBe(sentinel);
    expect(text(root, "reason-aside") === "").toBe(!sentinel);

    if (formatCall === null) {
      expect(q(root, "format-block").hidden).toBe(true);
      expect(text(root, "format-output")).toBe(formatOut);
      expect(isEmpty(root, "format-output")).toBe(true);
    } else {
      expect(q(root, "format-block").hidden).toBe(false);
      expect(q(root, "copy-format").dataset["copyText"]).toBe(formatCall);
      expect(text(root, "format-output")).toBe(formatOut);
      expect(isSentinel(root, "format-output")).toBe(false);
    }
  });

  it("lands CET under 303 on the sentinel with the signed-hour sentence", async () => {
    const { root } = await mount();
    choose(root, "preset", "cet-303");
    const sentence = text(root, "reason-aside");
    expect(sentence).toContain("signed hour");
    expect(sentence).toContain("CET");
    expect(q(root, "copy-parse").dataset["copyText"]).toContain(
      "parseEdifactOffsetDateTime",
    );
  });

  it("lands a two-digit-year code on the sentinel and points at the pattern parsers", async () => {
    const { root } = await mount();
    choose(root, "preset", "two-digit-101");
    const sentence = text(root, "reason-aside");
    expect(sentence).toContain("yyMMdd");
    expect(sentence).toContain("yearWindow");
    expect(q(root, "parse-block").hidden).toBe(false);
  });

  it("keeps the segment's function qualifier as sent", async () => {
    const { root } = await mount();
    type(root, "input", "DTM+999:202406151430:203'");
    expect(text(root, "split")).toContain(
      "function qualifier 999, shown as sent and not interpreted",
    );
  });
});

describe("the strip", () => {
  it("reads 202406151430 in the four example zones", async () => {
    const { root } = await mount();
    expect(text(root, "instant-1")).toBe("2024-06-15T18:30:00Z");
    expect(text(root, "offset-1")).toBe("-04:00");
    expect(text(root, "as205-1")).toBe("202406151430-0400");
    expect(text(root, "instant-2")).toBe("2024-06-15T12:30:00Z");
    expect(text(root, "instant-3")).toBe("2024-06-15T06:30:00Z");
    expect(text(root, "instant-4")).toBe("2024-06-15T21:30:00Z");
    expect(text(root, "gap")).toContain("Widest gap: 15 h");
    expect(q(root, "timeline").dataset["state"]).toBe("marks");
    expect(q(root, "copy-resolve").dataset["copyText"]).toBe(
      'resolveLocal("2024-06-15T14:30:00", "America/New_York", { disambiguation: "reject" })',
    );
  });

  it("reads a period of local date-times at both ends, with the end beside the start", async () => {
    const { root } = await mount();
    choose(root, "preset", "period-719");
    expect(text(root, "instant-2")).toBe("2024-06-15T12:30:00Z");
    expect(text(root, "as205-2")).toBe("2024-06-20T14:00:00Z");
    expect(q(root, "as205-2").dataset["label"]).toBe("end");
    expect(text(root, "third-head")).toBe("End instant");
    choose(root, "preset", "local-203");
    expect(q(root, "as205-2").dataset["label"]).toBe("as 205");
    expect(text(root, "third-head")).toBe("As 205");
  });

  it("changes a row when its zone changes, and leaves the preset for Custom", async () => {
    const { root } = await mount();
    choose(root, "zone-3", "Asia/Kolkata");
    expect(text(root, "instant-3")).toBe("2024-06-15T09:00:00Z");
    expect(q<HTMLSelectElement>(root, "preset").value).toBe("custom");
  });

  it("says no zone chosen for a blank slot, and no gap with one zone", async () => {
    const { root } = await mount();
    for (const n of [2, 3, 4]) choose(root, `zone-${n}`, "");
    expect(text(root, "instant-2")).toBe("no zone chosen");
    expect(text(root, "gap")).toBe(
      "Choose two zones to see how far apart the answers are.",
    );
  });

  it("disables the zone selects and blanks the cells when the value states its offset", async () => {
    const { root } = await mount();
    choose(root, "preset", "offset-205");
    for (const n of [1, 2, 3, 4]) {
      expect(q<HTMLSelectElement>(root, `zone-${n}`).disabled).toBe(true);
      expect(text(root, `instant-${n}`)).toBe("");
    }
    expect(q(root, "timeline").dataset["state"]).toBe("stated");
    expect(text(root, "strip-note")).toBe(
      "The value states its offset, so there is nothing to choose.",
    );
    expect(q(root, "resolve-block").hidden).toBe(true);
    expect(q(root, "copy-resolve").dataset["copyText"]).toBeUndefined();
  });

  it("keeps the example zones off every preset whose result gives the strip no work", async () => {
    const { root } = await mount();
    for (const p of DTM_PRESETS) {
      choose(root, "preset", p.id);
      const filled = [1, 2, 3, 4].some(
        (n) => q<HTMLSelectElement>(root, `zone-${n}`).value !== "",
      );
      expect(filled, p.id).toBe(p.zones.some((z) => z !== ""));
    }
  });

  it("never fills a zone from the code or the value typed", async () => {
    const { root } = await mount();
    for (const n of [1, 2, 3, 4]) choose(root, `zone-${n}`, "");
    type(root, "input", "DTM+137:202406151430UTC:303'");
    type(root, "input", "202406151430");
    type(root, "format", "203");
    for (const n of [1, 2, 3, 4])
      expect(q<HTMLSelectElement>(root, `zone-${n}`).value).toBe("");
  });

  it("renders a time the clock shows twice as NO SIGNAL with its reason", async () => {
    const { root } = await mount();
    type(root, "input", "202411030130");
    type(root, "format", "203");
    choose(root, "zone-1", "America/New_York");
    expect(isSentinel(root, "instant-1")).toBe(true);
    expect(text(root, "strip-aside")).toContain("happens twice");
    expect(text(root, "resolve-output")).toBe("NO SIGNAL");
  });

  it("says an offset-free date names no instant and keeps the timeline's box", async () => {
    const { root } = await mount();
    choose(root, "preset", "date-102");
    expect(q(root, "timeline").dataset["state"]).toBe("empty");
    expect(text(root, "timeline")).toContain("nothing to place");
    expect(
      q(root, "timeline").querySelector(".gmt-playground-sentinel"),
    ).toBeNull();
    choose(root, "preset", "period-718");
    expect(text(root, "strip-note")).toContain("period of dates");
  });
});

describe("bare values and segments", () => {
  it("shows the library's own sentinel for a value with the release character", async () => {
    const { root } = await mount();
    type(root, "input", "202406151430?+02");
    type(root, "format", "303");
    expect(text(root, "parse-output")).toBe("NO SIGNAL");
    expect(text(root, "reason-aside")).toContain(
      REASON_TEXT["released-character"]({ form: "value" }),
    );
    expect(text(root, "split")).toContain("Read as a bare value.");
  });

  it("un-releases the same text in a segment", async () => {
    const { root } = await mount();
    type(root, "input", "DTM+137:202406151430?+02:303'");
    expect(text(root, "parse-output")).toContain('"2024-06-15T14:30:00+02:00"');
    expect(q(root, "copy-parse").dataset["copyText"]).toContain(
      'parseEdifactOffsetDateTime("202406151430+02", "303")',
    );
  });

  it("follows the segment typed from CET to a stated offset, and back to the matching preset", async () => {
    const { root } = await mount();
    type(root, "input", "DTM+137:202406151430CET:303'");
    expect(q<HTMLSelectElement>(root, "preset").value).toBe("custom");
    expect(text(root, "verdict")).toBe("");
    expect(isSentinel(root, "parse-output")).toBe(true);
    type(root, "input", "DTM+137:202406151430UTC:303'");
    expect(text(root, "verdict")).toBe("Offset: stated (+00:00)");
  });

  it("restores the typed format when a segment goes back to a bare value", async () => {
    const { root } = await mount();
    type(root, "input", "240615");
    type(root, "format", "101");
    type(root, "input", "DTM+137:202406151430:203'");
    expect(q<HTMLInputElement>(root, "format").value).toBe("203");
    type(root, "input", "240615");
    expect(q<HTMLInputElement>(root, "format").value).toBe("101");
    expect(q<HTMLInputElement>(root, "format").disabled).toBe(false);
  });

  it.each([
    ["", "203", "Paste a DTM segment or a value."],
    ["202406151430", "", "Type the code."],
    ["2024", "602", "602 is not a format code the library reads."],
    ["not a date", "203", "does not fit code 203"],
    ["240615", "101", "two-digit year"],
    ["202406151430CET", "304", "CET"],
  ])("explains %j under %j", async (input, format, snippet) => {
    const { root } = await mount();
    type(root, "input", input);
    type(root, "format", format);
    expect(text(root, "parse-output")).toBe("NO SIGNAL");
    expect(text(root, "reason-aside")).toContain(snippet);
  });

  it("a blank form makes no call and is empty, not amber", async () => {
    const { root } = await mount();
    type(root, "input", "");
    type(root, "format", "");
    expect(text(root, "parse-output")).toBe("nothing to read");
    expect(isEmpty(root, "parse-output")).toBe(true);
    expect(isSentinel(root, "parse-output")).toBe(false);
    expect(q(root, "parse-block").hidden).toBe(true);
    expect(text(root, "reason-aside")).toBe("");
    expect(text(root, "verdict")).toBe("");
    expect(text(root, "member-value")).toBe("no result");
    expect(text(root, "format-output")).toBe("no value to write back");
    expect(text(root, "strip-note")).toBe("No value.");
    expect(root.querySelector(".gmt-playground-sentinel")).toBeNull();
  });

  it("goes from blank to a refused value to a result and back, with the call frame following", async () => {
    const { root } = await mount();
    type(root, "input", "");
    type(root, "format", "");
    expect(q(root, "parse-block").hidden).toBe(true);

    // The first character is partial input: a value with no format code is the
    // sentinel with its reason, not the empty state.
    type(root, "input", "2");
    expect(text(root, "parse-output")).toBe("NO SIGNAL");
    expect(isSentinel(root, "parse-output")).toBe(true);
    expect(text(root, "reason-aside")).toContain("Type the code.");

    type(root, "input", "202406151430");
    type(root, "format", "203");
    expect(q(root, "parse-block").hidden).toBe(false);
    expect(text(root, "parse-output")).toContain('"2024-06-15T14:30:00"');

    type(root, "input", "");
    type(root, "format", "");
    expect(text(root, "parse-output")).toBe("nothing to read");
    expect(q(root, "parse-block").hidden).toBe(true);
    expect(text(root, "reason-aside")).toBe("");
  });

  it("a format code with no value is partial input: the sentinel, with its reason", async () => {
    const { root } = await mount();
    type(root, "input", "");
    type(root, "format", "203");
    expect(q(root, "parse-block").hidden).toBe(false);
    expect(text(root, "parse-output")).toBe("NO SIGNAL");
    expect(text(root, "reason-aside")).toContain(
      "Paste a DTM segment or a value.",
    );
  });

  it("says the segment carries no format code", async () => {
    const { root } = await mount();
    type(root, "input", "DTM+137:202406151430'");
    expect(text(root, "reason-aside")).toContain("The segment carries none.");
  });
});

describe("seeding", () => {
  it("seeds an unlisted zone without dropping it", async () => {
    const { root } = await mount({
      input: "202406151430",
      format: "203",
      zone1: "Pacific/Auckland",
    });
    expect(q<HTMLSelectElement>(root, "zone-1").value).toBe("Pacific/Auckland");
    expect(text(root, "instant-1")).toBe("2024-06-15T02:30:00Z");
  });

  it("seeds the starter question with no zone: the widget answers not stated", async () => {
    const { root } = await mount({ input: "202406151430", format: "203" });
    expect(text(root, "verdict")).toBe("Offset: not stated");
    expect(text(root, "instant-1")).toBe("no zone chosen");
  });

  it("seeds from the template too", async () => {
    const { root } = await mount(
      { input: "DTM+137:202406151430:205'" },
      { input: "DTM+137:202406151430:205'" },
    );
    expect(q<HTMLInputElement>(root, "input").value).toBe(
      "DTM+137:202406151430:205'",
    );
  });

  it("loads an old link that still carries a year window without error, and ignores it", async () => {
    const { root, handle } = await mount({
      input: "240615",
      format: "101",
      yearWindow: "2000",
    } as never);
    expect(text(root, "parse-output")).toBe("NO SIGNAL");
    expect(text(root, "reason-aside")).toContain("yearWindow");
    expect(handle.getPermalinkState?.()).toEqual({
      input: "240615",
      format: "101",
    });
  });
});

describe("permalinks", () => {
  it.each(DTM_PRESETS.map((p) => [p.id]))(
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
      const url = encodeWidgetPermalink("dtm", state);
      expect(url).toMatch(/\?w=dtm&wa=[^)"'\s]+$/);
      const seeded = seedFromLocation("dtm", url.slice(url.indexOf("?")));
      expect(seeded).toEqual(state);
      const parseOutput = text(first.root, "parse-output");
      document.body.innerHTML = "";

      const second = await mount(seeded);
      expect(text(second.root, "parse-output")).toBe(parseOutput);
      expect(q<HTMLSelectElement>(second.root, "preset").value).toBe(id);
    },
  );

  it("carries the format only for a bare value, and never a year window", async () => {
    const { root, handle } = await mount();
    expect(handle.getPermalinkState?.()).not.toHaveProperty("format");
    expect(handle.getPermalinkState?.()).not.toHaveProperty("yearWindow");
    type(root, "input", "240615");
    type(root, "format", "101");
    expect(handle.getPermalinkState?.()).toMatchObject({
      input: "240615",
      format: "101",
    });
  });

  it("holds every starter link's state through the content-test pattern", () => {
    for (const state of [
      { input: "DTM+137:202406151430:203'" },
      { input: "202406151430?+02", format: "303" },
    ]) {
      const url = encodeWidgetPermalink("dtm", state);
      expect(url).toMatch(/\?w=([a-z]+)&wa=([^)"'\s]+)/);
    }
  });
});

describe("naming", () => {
  it("names no regulator, statute, agency, docket or customs body, and no business event", async () => {
    const forbidden = /\b(CFR|statut|regulat|docket|agency|customs|gate-in)\b/i;
    const { root } = await mount();
    const seen: string[] = [renderDtmDecoderTemplate()];
    for (const p of DTM_PRESETS) {
      seen.push(p.label, p.description);
      choose(root, "preset", p.id);
      seen.push(root.textContent ?? "");
    }
    for (const s of seen) expect(s).not.toMatch(forbidden);
    for (const p of DTM_PRESETS) {
      expect(presetState(p).input).not.toMatch(forbidden);
    }
  });
});

describe("lifecycle", () => {
  it("an aborted mount is inert", async () => {
    const root = document.createElement("div");
    root.innerHTML = renderDtmDecoderTemplate();
    document.body.append(root);
    const controller = new AbortController();
    controller.abort();
    const handle = await mountDtmDecoder(root, {}, controller.signal);
    expect(text(root, "member-value")).toBe("no result");
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
    type(root, "input", "DTM+137:202406151430UTC:303'");
    expect(text(root, "verdict")).toBe("Offset: not stated");
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
  it.each(DTM_PRESETS.map((p) => [p.id]))(
    "%s never names the library as GMT, and shows no raw null",
    async (id) => {
      const { root } = await mount();
      choose(root, "preset", id!);
      const shown = screenText(root);
      expect(shown).not.toMatch(/GMT (does|returns|maps|reads|never)/);
      expect(shown).not.toMatch(/\b(null|undefined)\b/);
      for (const key of MEMBER_KEYS) {
        expect(q(root, `member-${key}`).textContent).not.toMatch(
          /null|undefined|^$/,
        );
      }
    },
  );

  it("takes the segment's parts and the value apart, with the standard's mask letters", async () => {
    const { root } = await mount();
    const figure = q(root, "figure");
    expect(figure.getAttribute("aria-label")).toBe(
      "Segment with function qualifier 137, shown as sent. 202406151430 under code 203: year 2024, month 06, day 15, hour 14, minute 30; no offset",
    );
    expect(
      [...figure.querySelectorAll(".gmt-edi-part .gmt-edi-box")].map(
        (b) => b.textContent,
      ),
    ).toEqual(["DTM", "137", "202406151430", "203"]);
    expect(
      [...figure.querySelectorAll(".gmt-edi-punct")].map((b) => b.textContent),
    ).toEqual(["+", ":", ":", "'"]);
    expect(
      [...figure.querySelectorAll(".gmt-edi-mask")].map((m) =>
        m.textContent?.trim(),
      ),
    ).toEqual(["CCYY", "MM", "DD", "HH", "MM", ""]);
    expect(
      [...figure.querySelectorAll(".gmt-edi-bracket-label")].map((m) =>
        m.textContent?.trim(),
      ),
    ).toEqual(["date", "time", ""]);
  });

  it("shows the release character as sent and the offset as its own group", async () => {
    const { root } = await mount();
    choose(root, "preset", "released-303");
    const figure = q(root, "figure");
    expect(
      [...figure.querySelectorAll(".gmt-edi-part .gmt-edi-box")][2]!
        .textContent,
    ).toBe("202406151430?+00");
    expect(
      [...figure.querySelectorAll(".gmt-edi-bracket-label")].map((m) =>
        m.textContent?.trim(),
      ),
    ).toEqual(["date", "time", "zone"]);
    expect(figure.textContent).not.toContain("no offset");
  });

  it("shows a period's two halves", async () => {
    const { root } = await mount();
    choose(root, "preset", "period-718");
    expect(
      [...q(root, "figure").querySelectorAll(".gmt-edi-half-label")].map(
        (m) => m.textContent,
      ),
    ).toEqual(["start", "end"]);
    choose(root, "preset", "period-719");
    expect(
      [...q(root, "figure").querySelectorAll(".gmt-edi-half-label")].map(
        (m) => m.textContent,
      ),
    ).toEqual(["start", "end"]);
  });

  it("draws a refused value in neutral boxes, never amber", async () => {
    const { root } = await mount();
    type(root, "input", "DTM+137:202413151430:203'");
    expect(
      q(root, "figure").querySelectorAll('[data-group="neutral"]').length,
    ).toBeGreaterThan(0);
    expect(
      q(root, "figure").querySelector(".gmt-playground-sentinel"),
    ).toBeNull();
    expect(q(root, "figure").textContent).not.toContain("no offset");
  });

  it("reserves a hold for every text a region can show", () => {
    const root = document.createElement("div");
    root.innerHTML = renderDtmDecoderTemplate();
    const holds = root.querySelectorAll(".gmt-edi-hold");
    expect(holds.length).toBeGreaterThan(8);
    for (const hold of holds) {
      for (const sizer of hold.querySelectorAll(".gmt-edi-sizer")) {
        expect(sizer.getAttribute("aria-hidden")).toBe("true");
      }
    }
    // The preset description's hold draws every preset's description.
    const descriptions = root.querySelector(
      '[data-role="preset-description"]',
    )!.parentElement!;
    expect(descriptions.querySelectorAll(".gmt-edi-sizer").length).toBe(
      new Set(DTM_PRESETS.map((p) => p.description)).size,
    );
  });
});

describe("the library under the widget", () => {
  it("is the real one: a printed call is the call the library made", () => {
    expect(lib.parseEdifactDateTime("202406151430", "203")).toBe(
      "2024-06-15T14:30:00",
    );
  });
});
