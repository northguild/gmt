/**
 * @vitest-environment jsdom
 *
 * The DTM Decoder end to end: template → mount → interact → assert, against the
 * real `@northguild/gmt`. Every preset's printed call, result, verdict, members
 * and write-back are checked against the INT-15 appendix Z rows (D*) they draw,
 * so a drift in the library or the widget fails here.
 */
/// <reference types="vitest/globals" />
import { lib } from "~/test/edi-lib";
import { installJsdomShims } from "~/test/jsdom-shims";
import { encodeWidgetPermalink, seedFromLocation } from "./widget-permalink";
import { DTM_PRESETS, NULL_REASON_TEXT, presetState } from "./dtm-decoder";
import { mountDtmDecoder, renderDtmDecoderTemplate } from "./dtm-decoder-mount";

installJsdomShims();

const REQUIRED_ROLES = [
  "preset",
  "preset-description",
  "input",
  "format",
  "year-window",
  "year-start",
  "split",
  "verdict",
  "verdict-detail",
  "readouts",
  "member-date",
  "member-time",
  "member-local",
  "member-instant",
  "member-offset",
  "member-zone",
  "member-period-end",
  "call-parse",
  "copy-parse",
  "parse-block",
  "parse-output",
  "reason-aside",
  "strip-note",
  "gap-strip",
  "zone-1",
  "zone-2",
  "zone-3",
  "zone-4",
  "figure",
  "figure-note",
  "timeline",
  "instant-1",
  "instant-4",
  "offset-1",
  "offset-4",
  "as205-1",
  "as205-4",
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

/** preset id → [parse call, parse result, verdict, format call | null, format output]. */
const EXPECTED: Record<
  string,
  [string, string, string, string | null, string]
> = {
  "local-203": [
    'parseEdifactDtm("202406151430", "203")',
    '{ local: "2024-06-15T14:30:00" }',
    "Offset: not stated",
    'formatEdifactDtm("2024-06-15T14:30:00", "203")',
    '"202406151430"',
  ],
  "released-303": [
    'parseEdifactDtm("202406151430+00", "303")',
    '{ local: "2024-06-15T14:30:00", offset: "+00:00", instant: "2024-06-15T14:30:00Z" }',
    "Offset: stated (+00:00)",
    'formatEdifactDtm("2024-06-15T14:30:00+00:00", "303")',
    '"202406151430+00"',
  ],
  "utc-303": [
    'parseEdifactDtm("202406151430UTC", "303")',
    '{ local: "2024-06-15T14:30:00", offset: "+00:00", instant: "2024-06-15T14:30:00Z" }',
    "Offset: stated (+00:00)",
    'formatEdifactDtm("2024-06-15T14:30:00+00:00", "303")',
    '"202406151430+00"',
  ],
  "gmt-303": [
    'parseEdifactDtm("202406151430GMT", "303")',
    '{ local: "2024-06-15T14:30:00", offset: "+00:00", instant: "2024-06-15T14:30:00Z" }',
    "Offset: stated (+00:00)",
    'formatEdifactDtm("2024-06-15T14:30:00+00:00", "303")',
    '"202406151430+00"',
  ],
  "offset-208": [
    'parseEdifactDtm("20240615143045+0200", "208")',
    '{ local: "2024-06-15T14:30:45", offset: "+02:00", instant: "2024-06-15T12:30:45Z" }',
    "Offset: stated (+02:00)",
    'formatEdifactDtm("2024-06-15T14:30:45+02:00", "208")',
    '"20240615143045+0200"',
  ],
  "cet-303": [
    'parseEdifactDtm("202406151430CET", "303")',
    '{ local: "2024-06-15T14:30:00", zone: "CET" }',
    'Offset: not stated. "CET" is zone text, not an offset.',
    'formatEdifactDtm("2024-06-15T14:30:00", "303")',
    "NO SIGNAL",
  ],
  "offset-205": [
    'parseEdifactDtm("202406151430+0200", "205")',
    '{ local: "2024-06-15T14:30:00", offset: "+02:00", instant: "2024-06-15T12:30:00Z" }',
    "Offset: stated (+02:00)",
    'formatEdifactDtm("2024-06-15T14:30:00+02:00", "205")',
    '"202406151430+0200"',
  ],
  "period-718": [
    'parseEdifactDtm("2024061520240620", "718")',
    '{ date: "2024-06-15", periodEnd: { date: "2024-06-20" } }',
    "Offset: not stated",
    'formatEdifactDtm("2024-06-15/2024-06-20", "718")',
    '"2024061520240620"',
  ],
  "two-digit-no-window": [
    'parseEdifactDtm("240615", "101")',
    "NO SIGNAL",
    "",
    null,
    "no value to write back",
  ],
  "two-digit-window": [
    'parseEdifactDtm("240615", "101", { yearWindow: 2000 })',
    '{ date: "2024-06-15" }',
    "Offset: not stated",
    'formatEdifactDtm("2024-06-15", "101", { yearWindow: 2000 })',
    '"240615"',
  ],
};

/** preset id → the member rows the result holds (others read `not stated`). */
const MEMBERS: Record<string, Record<string, string>> = {
  "local-203": { local: "2024-06-15T14:30:00" },
  "released-303": {
    local: "2024-06-15T14:30:00",
    instant: "2024-06-15T14:30:00Z",
    offset: "+00:00",
  },
  "utc-303": {
    local: "2024-06-15T14:30:00",
    instant: "2024-06-15T14:30:00Z",
    offset: "+00:00",
  },
  "gmt-303": {
    local: "2024-06-15T14:30:00",
    instant: "2024-06-15T14:30:00Z",
    offset: "+00:00",
  },
  "offset-208": {
    local: "2024-06-15T14:30:45",
    instant: "2024-06-15T12:30:45Z",
    offset: "+02:00",
  },
  "cet-303": { local: "2024-06-15T14:30:00", zone: "CET" },
  "offset-205": {
    local: "2024-06-15T14:30:00",
    instant: "2024-06-15T12:30:00Z",
    offset: "+02:00",
  },
  "period-718": { date: "2024-06-15", "period-end": "2024-06-20" },
  "two-digit-window": { date: "2024-06-15" },
};

const MEMBER_KEYS = [
  "date",
  "time",
  "local",
  "instant",
  "offset",
  "zone",
  "period-end",
];

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
    expect(text(root, "member-local")).toBe("no result");
    expect(text(root, "verdict")).toBe("");
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

  it("renders the year controls without a placeholder", () => {
    const root = document.createElement("div");
    root.innerHTML = renderDtmDecoderTemplate();
    expect(q(root, "year-start").hasAttribute("placeholder")).toBe(false);
  });
});

describe("every preset, against the real library", () => {
  it.each(DTM_PRESETS.map((p) => [p.id]))("%s", async (id) => {
    const { root } = await mount();
    choose(root, "preset", id!);
    const [call, result, verdict, formatCall, formatOut] = EXPECTED[id!]!;

    expect(q(root, "copy-parse").dataset["copyText"]).toBe(call);
    expect(text(root, "parse-output")).toBe(result);
    expect(text(root, "verdict")).toBe(verdict);

    const members = MEMBERS[id!] ?? {};
    for (const key of MEMBER_KEYS) {
      const cell = q(root, `member-${key}`);
      if (id === "two-digit-no-window") {
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
    expect(
      q(root, "parse-output").classList.contains("gmt-playground-sentinel"),
    ).toBe(sentinel);
    if (sentinel) {
      expect(q(root, "reason-aside").textContent).toContain(
        NULL_REASON_TEXT["needs-year-window"]({ format: "101", form: "value" }),
      );
    } else {
      expect(q(root, "reason-aside").textContent).toBe("");
    }

    if (formatCall === null) {
      expect(q(root, "format-block").hidden).toBe(true);
      expect(text(root, "format-output")).toBe(formatOut);
      expect(
        q(root, "format-output").classList.contains("gmt-widget-output--empty"),
      ).toBe(true);
    } else {
      expect(q(root, "format-block").hidden).toBe(false);
      expect(q(root, "copy-format").dataset["copyText"]).toBe(formatCall);
      expect(text(root, "format-output")).toBe(formatOut);
      expect(
        q(root, "format-output").classList.contains("gmt-playground-sentinel"),
      ).toBe(formatOut === "NO SIGNAL");
    }
  });

  it("names the zone-text write-back note for CET", async () => {
    const { root } = await mount();
    choose(root, "preset", "cet-303");
    expect(text(root, "format-note")).toContain(
      "A zone text has no offset to write. Resolve the local time in a zone first, then write it with its offset.",
    );
  });

  it("reads a hyphenated period as the sentinel, with the hyphen in the reason", async () => {
    const { root } = await mount();
    type(root, "input", "20240615-20240620");
    type(root, "format", "718");
    expect(text(root, "parse-output")).toBe("NO SIGNAL");
    expect(text(root, "reason-aside")).toContain("written with a hyphen");
  });

  it("reads 209 as a time and an offset, with no instant", async () => {
    const { root } = await mount();
    type(root, "input", "143045+0200");
    type(root, "format", "209");
    expect(text(root, "parse-output")).toBe(
      '{ time: "14:30:45", offset: "+02:00" }',
    );
    expect(text(root, "verdict-detail")).toBe(
      "A time and an offset, but no date, so no instant.",
    );
    expect(text(root, "format-output")).toBe('"143045+0200"');
  });

  it("opens the year controls for 206, a two-digit-year code with an offset", async () => {
    const { root } = await mount();
    type(root, "input", "2406151430+0200");
    type(root, "format", "206");
    expect(q<HTMLSelectElement>(root, "year-window").disabled).toBe(false);
    expect(text(root, "parse-output")).toBe("NO SIGNAL");
    choose(root, "year-window", "fixed");
    type(root, "year-start", "2000");
    expect(text(root, "parse-output")).toBe(
      '{ local: "2024-06-15T14:30:00", offset: "+02:00", instant: "2024-06-15T12:30:00Z" }',
    );
  });

  it("keeps the segment's function qualifier as sent", async () => {
    const { root } = await mount();
    expect(text(root, "split")).toBe(
      "Read as a segment: function qualifier 137, shown as sent and not interpreted; value 202406151430; format code 203.Code 203 carries a four-digit year. The window is not read.",
    );
    expect(q<HTMLInputElement>(root, "format").disabled).toBe(true);
    expect(q<HTMLInputElement>(root, "format").value).toBe("203");
  });
});

describe("the strip", () => {
  it("reads 202406151430 in the four example zones (D1a to D1d, D1gap)", async () => {
    const { root } = await mount();
    const rows = [
      ["2024-06-15T18:30:00Z", "-04:00", "202406151430-0400"],
      ["2024-06-15T12:30:00Z", "+02:00", "202406151430+0200"],
      ["2024-06-15T06:30:00Z", "+08:00", "202406151430+0800"],
      ["2024-06-15T21:30:00Z", "-07:00", "202406151430-0700"],
    ];
    rows.forEach(([instant, offset, as205], i) => {
      const n = i + 1;
      expect(text(root, `instant-${n}`)).toBe(instant);
      expect(text(root, `offset-${n}`)).toBe(offset);
      expect(text(root, `as205-${n}`)).toBe(as205);
    });
    expect(text(root, "gap")).toBe(
      "Widest gap: 15 h, between Asia/Shanghai and America/Los_Angeles",
    );
    expect(q(root, "resolve-block").hidden).toBe(false);
    expect(q(root, "copy-resolve").dataset["copyText"]).toBe(
      'resolveLocal("2024-06-15T14:30:00", "America/New_York", { disambiguation: "reject" })',
    );
    expect(text(root, "resolve-output")).toBe('"2024-06-15T18:30:00Z"');
    expect(text(root, "strip-note")).toContain('disambiguation: "reject"');
  });

  it("draws the zones on one UTC timeline, earliest to the left", async () => {
    const { root } = await mount();
    const line = q(root, "timeline");
    expect(line.dataset["state"]).toBe("marks");
    expect([...line.querySelectorAll(".gmt-edi-tl-mark")].map((m) => (m as HTMLElement).dataset["series"]).sort()).toEqual(["1", "2", "3", "4"]);
    expect(line.querySelector(".gmt-edi-tl-gap")?.textContent).toBe("15 h");
    // The earliest instant (Asia/Shanghai, 3) sits left of the latest (Los Angeles, 4).
    const at = (n: string) => parseFloat((line.querySelector(`[data-series="${n}"]`) as HTMLElement).style.getPropertyValue("--x"));
    expect(at("3")).toBeLessThan(at("2"));
    expect(at("2")).toBeLessThan(at("1"));
    expect(at("1")).toBeLessThan(at("4"));
  });

  it("changes a row when its zone changes (D-kolkata)", async () => {
    const { root } = await mount();
    choose(root, "zone-2", "Asia/Kolkata");
    expect(text(root, "instant-2")).toBe("2024-06-15T09:00:00Z");
    expect(q<HTMLSelectElement>(root, "preset").value).toBe("custom");
  });

  it("says no zone chosen for a blank slot, and no gap with one zone", async () => {
    const { root } = await mount();
    choose(root, "preset", "cet-303");
    for (const n of [1, 2, 3, 4]) choose(root, `zone-${n}`, "");
    expect(q<HTMLSelectElement>(root, "preset").value).toBe("custom");
    expect(text(root, "instant-1")).toBe("no zone chosen");
    expect(text(root, "gap")).toBe(
      "Choose two zones to see how far apart the answers are.",
    );
    expect(q(root, "resolve-block").hidden).toBe(true);
    choose(root, "zone-1", "Europe/Berlin");
    expect(text(root, "instant-1")).toBe("2024-06-15T12:30:00Z");
    expect(q(root, "resolve-block").hidden).toBe(false);
  });

  it("fills the CET preset's four example zones on choosing it, and says they are the example's pick", async () => {
    const { root } = await mount();
    choose(root, "preset", "cet-303");
    const cet = DTM_PRESETS.find((p) => p.id === "cet-303")!;
    expect(cet.zones.every((z) => z !== "")).toBe(true);
    cet.zones.forEach((z, i) => {
      expect(q<HTMLSelectElement>(root, `zone-${i + 1}`).value).toBe(z);
      expect(q<HTMLSelectElement>(root, `zone-${i + 1}`).disabled).toBe(false);
      // Each row is the library's own answer for the same digits in that zone.
      const r = lib.resolveLocal("2024-06-15T14:30:00", z, {
        disambiguation: "reject",
      });
      expect(text(root, `instant-${i + 1}`)).toBe(r);
    });
    expect(text(root, "gap")).toContain("Widest gap:");
    expect(text(root, "preset-description")).toContain(
      "this example's picks, not a reading of CET",
    );
  });

  it("a hidden resolve block holds no stale call line", async () => {
    const { root } = await mount();
    expect(text(root, "call-resolve")).toContain("resolveLocal(");
    choose(root, "preset", "offset-205");
    expect(q(root, "resolve-block").hidden).toBe(true);
    expect(text(root, "call-resolve")).toBe("");
    expect(q(root, "copy-resolve").dataset["copyText"]).toBeUndefined();
  });

  it("leaves the CET write-back at NO SIGNAL; each zone's row writes it with its offset", async () => {
    const { root } = await mount();
    choose(root, "preset", "cet-303");
    expect(text(root, "format-output")).toBe("NO SIGNAL");
    expect(text(root, "as205-1")).toBe("202406151430-0400");
    choose(root, "zone-1", "Europe/Berlin");
    expect(text(root, "as205-1")).toBe("202406151430+0200");
  });

  it("disables the zone selects and blanks the cells when the value states its offset", async () => {
    const { root } = await mount();
    choose(root, "preset", "offset-205");
    for (const n of [1, 2, 3, 4]) {
      expect(q<HTMLSelectElement>(root, `zone-${n}`).disabled).toBe(true);
      expect(text(root, `instant-${n}`)).toBe("");
    }
    expect(text(root, "gap")).toBe("");
    expect(q(root, "timeline").dataset["state"]).toBe("stated");
    expect(q(root, "timeline").textContent).toContain("2024-06-15T12:30:00Z");
    expect(text(root, "strip-note")).toBe(
      "The value states its offset, so there is nothing to choose.",
    );
    expect(q(root, "resolve-block").hidden).toBe(true);
  });

  it("renders a time the clock shows twice as NO SIGNAL with its reason (D16, D16c)", async () => {
    const { root } = await mount();
    type(root, "input", "202411030130");
    type(root, "format", "203");
    choose(root, "zone-1", "America/New_York");
    expect(text(root, "instant-1")).toBe("NO SIGNAL");
    expect(
      q(root, "instant-1").classList.contains("gmt-playground-sentinel"),
    ).toBe(true);
    expect(text(root, "resolve-output")).toBe("NO SIGNAL");
    expect(text(root, "strip-aside")).toContain(
      "America/New_York: The 01:30 time happens twice in America/New_York on that date.",
    );
    // 01:30 on 2024-11-03 is ambiguous in America/Los_Angeles too, so two zones
    // are refused and two (Europe/Berlin, Asia/Shanghai) still resolve.
    expect(text(root, "instant-2")).toBe("2024-11-03T00:30:00Z");
    expect(text(root, "instant-3")).toBe("2024-11-02T17:30:00Z");
    expect(isSentinel(root, "instant-4")).toBe(true);
    expect(text(root, "strip-aside")).toContain(
      "America/Los_Angeles: The 01:30 time happens twice in America/Los_Angeles on that date.",
    );
    // The refused rows are left out of the gap.
    expect(text(root, "gap")).toBe(
      "Widest gap: 7 h, between Asia/Shanghai and Europe/Berlin",
    );
  });

  it("says an offset alone names no instant, and keeps the note's slot", async () => {
    const { root } = await mount();
    type(root, "input", "+0200");
    type(root, "format", "406");
    expect(text(root, "parse-output")).toBe('{ offset: "+02:00" }');
    expect(text(root, "strip-note")).toBe(
      "An offset alone names no instant: it needs a date and a time.",
    );
    expect(q(root, "strip-note").dataset["grow"]).toBe("slot");
    expect(q<HTMLSelectElement>(root, "zone-1").disabled).toBe(true);
  });

  it("makes a period of local times a note, not a strip", async () => {
    const { root } = await mount();
    type(root, "input", "202406151430202406201600");
    type(root, "format", "719");
    expect(text(root, "strip-note")).toBe(
      "A period: each end is a local time. Resolve each with resolveLocal.",
    );
    expect(q<HTMLSelectElement>(root, "zone-1").disabled).toBe(true);
  });
});

describe("bare values and segments", () => {
  it("shows the library's own sentinel for a value with the release character (D9raw)", async () => {
    const { root } = await mount();
    type(root, "input", "202406151430?+02");
    type(root, "format", "303");
    expect(text(root, "parse-output")).toBe("NO SIGNAL");
    expect(text(root, "reason-aside")).toContain(
      NULL_REASON_TEXT["released-character"]({ format: "303", form: "value" }),
    );
    expect(text(root, "split")).toContain("Read as a bare value.");
  });

  it("un-releases the same text in a segment (D9)", async () => {
    const { root } = await mount();
    type(root, "input", "DTM+137:202406151430?+02:303'");
    expect(text(root, "parse-output")).toBe(
      '{ local: "2024-06-15T14:30:00", offset: "+02:00", instant: "2024-06-15T12:30:00Z" }',
    );
    expect(q(root, "copy-parse").dataset["copyText"]).toBe(
      'parseEdifactDtm("202406151430+02", "303")',
    );
  });

  it("turns the verdict to the zone-text one when a CET segment is typed", async () => {
    const { root } = await mount();
    type(root, "input", "DTM+137:202406151430CET:303'");
    expect(text(root, "verdict")).toBe(
      'Offset: not stated. "CET" is zone text, not an offset.',
    );
    // The four example zones are still chosen and they are the CET preset's own.
    expect(q<HTMLSelectElement>(root, "preset").value).toBe("cet-303");
    choose(root, "preset", "utc-303");
    type(root, "input", "DTM+137:202406151430UTC:303'");
    expect(q<HTMLSelectElement>(root, "preset").value).toBe("utc-303");
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
    ["", "203", "blank-value", "Paste a DTM segment or a value."],
    ["202406151430", "", "no-format", "Type the code."],
    [
      "2024",
      "602",
      "unsupported-format",
      "602 is not a format code the library reads.",
    ],
    ["not a date", "203", "bad-value", "The value does not fit this code"],
  ])("explains %j under %j (%s)", async (input, format, _reason, snippet) => {
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
    expect(text(root, "member-local")).toBe("no result");
    expect(text(root, "format-output")).toBe("no value to write back");
    expect(text(root, "strip-note")).toBe("No value.");
    expect(root.querySelector(".gmt-playground-sentinel")).toBeNull();
  });

  it("a whitespace-only form is blank too", async () => {
    const { root } = await mount();
    type(root, "input", "   ");
    type(root, "format", " ");
    expect(text(root, "parse-output")).toBe("nothing to read");
    expect(q(root, "parse-block").hidden).toBe(true);
  });

  it("goes from blank to a refused value to a result and back, with the call frame following", async () => {
    const { root } = await mount();
    type(root, "input", "");
    type(root, "format", "");
    expect(q(root, "parse-block").hidden).toBe(true);

    // The first character is partial input: a value with no format code is the
    // library's sentinel with its reason, not the empty state.
    type(root, "input", "2");
    expect(q(root, "parse-block").hidden).toBe(false);
    expect(q(root, "copy-parse").dataset["copyText"]).toBe('parseEdifactDtm("2", "")');
    expect(text(root, "parse-output")).toBe("NO SIGNAL");
    expect(isSentinel(root, "parse-output")).toBe(true);
    expect(text(root, "reason-aside")).toContain("Type the code.");

    type(root, "input", "202406151430");
    type(root, "format", "203");
    expect(text(root, "parse-output")).toBe('{ local: "2024-06-15T14:30:00" }');

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
    expect(text(root, "reason-aside")).toContain("Paste a DTM segment or a value.");
  });

  it("a segment with no value is a call, not the empty state", async () => {
    const { root } = await mount();
    type(root, "input", "DTM+");
    expect(text(root, "parse-output")).toBe("NO SIGNAL");
    expect(q(root, "parse-block").hidden).toBe(false);
  });

  it("says the segment carries no format code", async () => {
    const { root } = await mount();
    type(root, "input", "DTM+137:202406151430'");
    expect(text(root, "reason-aside")).toContain("The segment carries none.");
  });
});

describe("the year window", () => {
  it("clears the sentinel when a start year is chosen and typed", async () => {
    const { root } = await mount();
    choose(root, "preset", "two-digit-no-window");
    expect(text(root, "parse-output")).toBe("NO SIGNAL");
    expect(q<HTMLSelectElement>(root, "year-window").disabled).toBe(false);
    expect(q<HTMLInputElement>(root, "year-start").disabled).toBe(true);
    choose(root, "year-window", "fixed");
    expect(q<HTMLInputElement>(root, "year-start").disabled).toBe(false);
    type(root, "year-start", "2000");
    expect(text(root, "parse-output")).toBe('{ date: "2024-06-15" }');
    expect(q(root, "copy-parse").dataset["copyText"]).toBe(
      'parseEdifactDtm("240615", "101", { yearWindow: 2000 })',
    );
    expect(q<HTMLSelectElement>(root, "preset").value).toBe("two-digit-window");
  });

  it("leaves NO SIGNAL from the keyboard: choose a start year, Tab, type 2000", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    const { root } = await mount();
    choose(root, "preset", "two-digit-no-window");
    expect(text(root, "parse-output")).toBe("NO SIGNAL");
    const win = q<HTMLSelectElement>(root, "year-window");
    win.focus();
    await user.selectOptions(win, "fixed");
    await user.tab();
    expect(document.activeElement).toBe(q(root, "year-start"));
    await user.keyboard("2000");
    expect(q<HTMLInputElement>(root, "year-start").value).toBe("2000");
    expect(text(root, "parse-output")).toBe('{ date: "2024-06-15" }');
  });

  it("disables both year controls for a code with a four-digit year", async () => {
    const { root } = await mount();
    type(root, "input", "20240615");
    type(root, "format", "102");
    expect(q<HTMLSelectElement>(root, "year-window").disabled).toBe(true);
    expect(q<HTMLInputElement>(root, "year-start").disabled).toBe(true);
    expect(text(root, "split")).toContain(
      "Code 102 carries a four-digit year. The window is not read.",
    );
    // The controls are still in the template: a code change never removes a row.
    expect(q(root, "year-window")).not.toBeNull();
  });

  it("explains a window that is not a year (Y-bad)", async () => {
    const { root } = await mount();
    choose(root, "preset", "two-digit-no-window");
    choose(root, "year-window", "fixed");
    type(root, "year-start", "9901");
    expect(text(root, "parse-output")).toBe("NO SIGNAL");
    expect(text(root, "reason-aside")).toContain(
      "The window is rolling or a whole year from 0 to 9900.",
    );
    expect(q(root, "copy-parse").dataset["copyText"]).toBe(
      'parseEdifactDtm("240615", "101", { yearWindow: 9901 })',
    );
  });

  it("passes rolling to the library, which reads the clock (faked here)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime("2026-10-07T12:00:00Z");
    const { root } = await mount();
    type(root, "input", "990615");
    type(root, "format", "101");
    choose(root, "year-window", "rolling");
    expect(q(root, "copy-parse").dataset["copyText"]).toBe(
      'parseEdifactDtm("990615", "101", { yearWindow: "rolling" })',
    );
    expect(text(root, "parse-output")).toBe('{ date: "1999-06-15" }');
  });

  it("does not fall back to a preset when seeded without a window", async () => {
    const { root } = await mount({ input: "240615", format: "101" });
    expect(q<HTMLSelectElement>(root, "year-window").value).toBe("none");
    expect(text(root, "parse-output")).toBe("NO SIGNAL");
    expect(q<HTMLSelectElement>(root, "preset").value).toBe(
      "two-digit-no-window",
    );
  });

  it("seeds a numeric window from a chat call", async () => {
    const { root } = await mount({
      input: "240615",
      format: "101",
      yearWindow: 2000,
    });
    expect(q<HTMLSelectElement>(root, "year-window").value).toBe("fixed");
    expect(q<HTMLInputElement>(root, "year-start").value).toBe("2000");
    expect(text(root, "parse-output")).toBe('{ date: "2024-06-15" }');
  });
});

describe("seeding", () => {
  it("seeds an unlisted zone without dropping it", async () => {
    const { root } = await mount({
      input: "DTM+137:202406151430:203'",
      zone1: "Africa/Nairobi",
    });
    expect(q<HTMLSelectElement>(root, "zone-1").value).toBe("Africa/Nairobi");
    expect(text(root, "instant-1")).toBe("2024-06-15T11:30:00Z");
  });

  it("seeds the starter question with no zone: the widget answers not stated", async () => {
    const { root } = await mount({ input: "202406151430", format: "203" });
    expect(text(root, "verdict")).toBe("Offset: not stated");
    expect(text(root, "instant-1")).toBe("no zone chosen");
    expect(q<HTMLSelectElement>(root, "preset").value).toBe("custom");
  });

  it("seeds from the template too", async () => {
    const args = { input: "20240615", format: "102" };
    const { root } = await mount(args, args);
    expect(q<HTMLInputElement>(root, "input").value).toBe("20240615");
    expect(text(root, "parse-output")).toBe('{ date: "2024-06-15" }');
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
      expect(Object.keys(seeded).sort()).toEqual(Object.keys(state).sort());
      expect(seeded).toEqual(state);
      const parseOutput = text(first.root, "parse-output");
      document.body.innerHTML = "";

      const second = await mount(seeded);
      expect(text(second.root, "parse-output")).toBe(parseOutput);
      expect(q<HTMLSelectElement>(second.root, "preset").value).toBe(id);
    },
  );

  it("carries the format only for a bare value", async () => {
    const { root, handle } = await mount();
    expect(handle.getPermalinkState?.()).not.toHaveProperty("format");
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
    for (const reason of Object.values(NULL_REASON_TEXT)) {
      seen.push(
        reason({ format: "602", form: "value" }),
        reason({ format: "", form: "segment" }),
      );
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
    expect(text(root, "member-local")).toBe("no result");
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
    type(root, "input", "DTM+137:202406151430CET:303'");
    expect(text(root, "verdict")).toBe("Offset: not stated");
  });
});

function screenText(root: HTMLElement): string {
  const clone = root.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('.gmt-codeframe, output[data-role$="output"]').forEach((e) => e.remove());
  const labels = [...clone.querySelectorAll("[aria-label]")].map((e) => e.getAttribute("aria-label"));
  return `${clone.textContent}\n${labels.join("\n")}`;
}

describe("on-screen words", () => {
  it.each(DTM_PRESETS.map((p) => [p.id]))("%s never names the library as GMT, and shows no raw null", async (id) => {
    const { root } = await mount();
    choose(root, "preset", id!);
    const text = screenText(root);
    expect(text).not.toMatch(/GMT (does|returns|maps|reads|never)/);
    expect(text).not.toMatch(/\b(null|undefined)\b/);
    for (const key of MEMBER_KEYS) {
      expect(q(root, `member-${key}`).textContent).not.toMatch(/null|undefined|^$/);
    }
  });

  it("says CET is zone text, not an offset, without naming the library", async () => {
    const { root } = await mount();
    choose(root, "preset", "cet-303");
    expect(text(root, "verdict")).toBe('Offset: not stated. "CET" is zone text, not an offset.');
  });

  it("takes the segment's parts and the value apart, with the standard's mask letters", async () => {
    const { root } = await mount();
    const figure = q(root, "figure");
    expect(figure.getAttribute("aria-label")).toBe(
      "Segment with function qualifier 137, shown as sent. 202406151430 under code 203: year 2024, month 06, day 15, hour 14, minute 30; no offset",
    );
    expect([...figure.querySelectorAll(".gmt-edi-part .gmt-edi-box")].map((b) => b.textContent)).toEqual(["DTM", "137", "202406151430", "203"]);
    expect([...figure.querySelectorAll(".gmt-edi-punct")].map((b) => b.textContent)).toEqual(["+", ":", ":", "'"]);
    expect([...figure.querySelectorAll(".gmt-edi-mask")].map((m) => m.textContent?.trim())).toEqual(["CCYY", "MM", "DD", "HH", "MM", ""]);
    expect([...figure.querySelectorAll(".gmt-edi-bracket-label")].map((m) => m.textContent?.trim())).toEqual(["date", "time", ""]);
  });

  it("shows the release character as sent and the offset as its own group", async () => {
    const { root } = await mount();
    choose(root, "preset", "released-303");
    const figure = q(root, "figure");
    expect([...figure.querySelectorAll(".gmt-edi-part .gmt-edi-box")][2]!.textContent).toBe("202406151430?+00");
    expect([...figure.querySelectorAll(".gmt-edi-bracket-label")].map((m) => m.textContent?.trim())).toEqual(["date", "time", "zone"]);
    expect(figure.textContent).not.toContain("no offset");
  });

  it("shows a period's two halves, and which window read a two-digit year", async () => {
    const { root } = await mount();
    choose(root, "preset", "period-718");
    expect([...q(root, "figure").querySelectorAll(".gmt-edi-half-label")].map((m) => m.textContent)).toEqual(["start", "end"]);
    choose(root, "preset", "two-digit-window");
    expect(text(root, "figure-note")).toBe("Two-digit year, read as 2024 by the window starting in 2000.");
    choose(root, "preset", "two-digit-no-window");
    expect(text(root, "figure-note")).toBe("Two-digit year: no window was given, so the century is not read.");
  });

  it("draws a refused value in neutral boxes, never amber", async () => {
    const { root } = await mount();
    type(root, "input", "DTM+137:202413151430:203'");
    expect(q(root, "figure").querySelectorAll('[data-group="neutral"]').length).toBeGreaterThan(0);
    expect(q(root, "figure").querySelector(".gmt-playground-sentinel")).toBeNull();
    expect(q(root, "figure").textContent).not.toContain("no offset");
  });

  it("keeps the timeline's box and says why in words when there is no instant", async () => {
    const { root } = await mount();
    choose(root, "preset", "period-718");
    expect(q(root, "timeline").dataset["state"]).toBe("empty");
    expect(q(root, "timeline").textContent).toContain("nothing to place");
    expect(q(root, "timeline").querySelector(".gmt-playground-sentinel")).toBeNull();
  });
});
