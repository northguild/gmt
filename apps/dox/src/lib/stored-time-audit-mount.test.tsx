/**
 * @vitest-environment jsdom
 *
 * The Stored Time Audit end to end: template, mount, interact, assert, against
 * the real `@northguild/gmt`. Every preset's rows (kind and readings) and the
 * strip edges are literal values read from a run of the built library (the
 * rows of `classifyStoredZoned.test.ts`), with no host-specific branch, so a drift in the
 * library or the widget fails here under every CI Node.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { installJsdomShims } from "~/test/jsdom-shims";
import { spyOnResizeObservers } from "~/test/resize-observer-spy";
import {
  AUDIT_PRESETS,
  NOT_STORED_TEXT,
  VALID_REASON_TEXT,
} from "./stored-time-audit";
import {
  LINE_NO_SIGNAL,
  mountStoredTimeAudit,
  renderStoredTimeAuditTemplate,
} from "./stored-time-audit-mount";
import { loadStoredTimeLib } from "./stored-time-lib";
import { SITE_BASE } from "./site";
import { encodeWidgetPermalink, seedFromLocation } from "./widget-permalink";

installJsdomShims();

const q = <T extends HTMLElement = HTMLElement>(
  root: HTMLElement,
  role: string,
) => root.querySelector(`[data-role="${role}"]`) as T;

async function mount(args = {}) {
  const root = document.createElement("div");
  root.innerHTML = renderStoredTimeAuditTemplate(args);
  document.body.append(root);
  const controller = new AbortController();
  const handle = await mountStoredTimeAudit(root, args, controller.signal);
  return { root, handle, controller };
}

function choose(root: HTMLElement, value: string) {
  const el = q<HTMLSelectElement>(root, "preset");
  el.value = value;
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

function select(root: HTMLElement, n: number) {
  const el = root.querySelector<HTMLInputElement>(
    `[data-line="${n}"] input[type="radio"]`,
  )!;
  el.checked = true;
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

const frames = () => new Promise<void>((resolve) => setTimeout(resolve, 40));

async function paste(root: HTMLElement, value: string) {
  const el = q<HTMLTextAreaElement>(root, "values");
  el.value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  await frames();
}

const rowKinds = (root: HTMLElement) =>
  [...root.querySelectorAll<HTMLElement>("tbody [data-line]")].map(
    (tr) =>
      tr.querySelector<HTMLElement>("[data-kind]")?.dataset["kind"] ??
      (tr.querySelector(".gmt-stored-nosignal") ? "null" : "?"),
  );

const tokens = (root: HTMLElement, n: number) =>
  [...root.querySelectorAll(`[data-line="${n}"] .gmt-stored-token`)].map((t) =>
    (t.textContent ?? "").replace(/\s+/g, " ").trim(),
  );

const selectedLine = (root: HTMLElement) =>
  root.querySelector<HTMLElement>("tbody [data-selected]")?.dataset["line"];

/** What each preset's lines are, from a run against `packages/gmt/dist`. */
const KINDS: Record<string, string[]> = {
  "istanbul-2016": [
    "validInOverlap",
    "ambiguous",
    "nonexistent",
    "offsetMismatch",
    "offsetMismatch",
    "valid",
  ],
  "casablanca-2018": [
    "nonexistent",
    "offsetMismatch",
    "offsetMismatch",
    "valid",
    "validInOverlap",
    "ambiguous",
  ],
  "sao-paulo-2019": [
    "nonexistent",
    "validInOverlap",
    "ambiguous",
    "valid",
    "offsetMismatch",
  ],
  "kept-offset": [
    "nonexistent",
    "nonexistent",
    "nonexistent",
    "ambiguous",
    "validInOverlap",
    "validInOverlap",
  ],
  "z-and-zero": ["valid", "offsetMismatch", "offsetMismatch", "valid", "valid"],
  "not-stored-times": ["null", "null", "null", "null", "null", "null"],
};

/** The since strip's transition for each preset whose selected line draws one. */
const SINCE: Record<string, string> = {
  "istanbul-2016": "2016-03-27T01:00:00Z",
  "casablanca-2018": "2018-06-17T02:00:00Z",
  "sao-paulo-2019": "2019-02-17T02:00:00Z",
  "z-and-zero": "2022-03-27T01:00:00Z",
};

describe("the template", () => {
  it("is the chrome only: three sections, the host note, no rows", () => {
    const root = document.createElement("div");
    root.innerHTML = renderStoredTimeAuditTemplate();
    expect(root.querySelectorAll(".gmt-widget-section")).toHaveLength(3);
    expect(root.querySelectorAll(".gmt-widget-card")).toHaveLength(1);
    expect(q(root, "values").tagName).toBe("TEXTAREA");
    expect(q(root, "values").getAttribute("spellcheck")).toBe("false");
    expect(q(root, "host-note").textContent).toMatch(
      /Read with this browser's time zone rules/,
    );
    expect(q(root, "rows").children).toHaveLength(0);
    expect(root.innerHTML.replaceAll("gmt-widget-card", "")).not.toMatch(
      /class="[^"]*card/,
    );
    expect(root.innerHTML).not.toMatch(/Vancouver/);
  });

  it("seeds the first preset, and any args it is given", () => {
    const root = document.createElement("div");
    root.innerHTML = renderStoredTimeAuditTemplate();
    expect(q<HTMLTextAreaElement>(root, "values").value).toBe(
      AUDIT_PRESETS[0]!.lines.join("\n"),
    );
    expect(q<HTMLSelectElement>(root, "preset").value).toBe("istanbul-2016");
    const seeded = document.createElement("div");
    seeded.innerHTML = renderStoredTimeAuditTemplate({ values: "x\ny" });
    expect(q<HTMLTextAreaElement>(seeded, "values").value).toBe("x\ny");
    expect(q<HTMLSelectElement>(seeded, "preset").value).toBe("custom");
  });
});

describe("every preset shows the library's own answer", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it.each(AUDIT_PRESETS.map((p) => [p.id]))("%s", async (id) => {
    const { root } = await mount();
    choose(root, id!);
    const preset = AUDIT_PRESETS.find((p) => p.id === id)!;
    expect(rowKinds(root)).toEqual(KINDS[id!]);
    expect(selectedLine(root)).toBe(String(preset.selected));
    expect(q<HTMLSelectElement>(root, "preset").value).toBe(id);
    // The printed call is the call made, and its copy text is plain.
    expect(q(root, "call-audit").textContent).toContain(
      `classifyStoredZoned("${preset.lines[preset.selected - 1]}")`,
    );
    expect(q(root, "copy-audit").dataset["copyText"]).toMatch(
      /^classifyStoredZoned\(/,
    );
    if (SINCE[id!]) {
      expect(q(root, "call-audit").textContent).toContain("getDstTransitions(");
      expect(q(root, "audit-output").textContent).toContain(SINCE[id!]);
      expect(q(root, "lane-clock").textContent).toMatch(
        /Zone offset since \d{4}-\d{2}-\d{2}: [+-]\d{2}:\d{2}/,
      );
      expect(q(root, "lane-clock").textContent).toMatch(/Stored offset: /);
      expect(
        q(root, "lane-exact").querySelector(".gmt-stored-break"),
      ).not.toBeNull();
    }
    expect(root.innerHTML).not.toMatch(/NaN|undefined/);
  });

  it("reads the Istanbul rows' readings as the library returns them", async () => {
    const { root } = await mount();
    expect(tokens(root, 5)).toEqual([
      "storedOffset +02:00 → zoneOffset +03:00",
      "atStoredOffset 2016-12-01T07:00:00Z",
      "atZoneOffset 2016-12-01T06:00:00Z",
    ]);
    expect(tokens(root, 6)).toEqual([
      "instant 2016-12-01T06:00:00Z",
      "atStoredOffset 2016-12-01T06:00:00Z",
    ]);
    expect(tokens(root, 1)[0]).toMatch(/^instant 2015-11-08T/);
    expect(
      root.querySelector('[data-line="5"] .gmt-stored-badge')!.textContent,
    ).toBe("Offset mismatch");
  });

  it("reads the Los Angeles gap's readings, and draws a day strip", async () => {
    const { root } = await mount();
    choose(root, "kept-offset");
    select(root, 3);
    expect(tokens(root, 3)).toEqual([
      "earlier 2026-03-08T09:30:00Z",
      "later 2026-03-08T10:30:00Z",
      "atStoredOffset 2026-03-08T05:30:00Z",
    ]);
    expect(
      q(root, "lane-clock").querySelector(".gmt-stored-band"),
    ).not.toBeNull();
    expect(q(root, "lane-clock").textContent).toMatch(/skipped 1 hour/);
    expect(
      q(root, "lane-exact").querySelector(".gmt-stored-gate"),
    ).not.toBeNull();
    expect(q(root, "audit-output").textContent).toContain(
      '"kind":"nonexistent"',
    );
  });

  it("draws an overlap as a repeated hour", async () => {
    const { root } = await mount();
    choose(root, "kept-offset");
    select(root, 5);
    expect(q(root, "lane-clock").textContent).toMatch(/repeated 1 hour/);
    expect(
      q(root, "lane-clock").querySelector(
        '.gmt-stored-band[data-kind="overlap"]',
      ),
    ).not.toBeNull();
  });

  it("opens the Sao Paulo strip from the year before, in two printed calls", async () => {
    const { root } = await mount();
    choose(root, "sao-paulo-2019");
    const call = q(root, "call-audit").textContent!;
    expect(call).toContain('getDstTransitions("America/Sao_Paulo", 2020)');
    expect(call).toContain('getDstTransitions("America/Sao_Paulo", 2019)');
  });
});

describe("the default selected line", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("opens on the preset's line", async () => {
    const { root } = await mount();
    expect(selectedLine(root)).toBe("5");
  });

  it("is the first line that is neither valid nor not-a-time for pasted text", async () => {
    const { root } = await mount({
      values:
        "2016-12-01T09:00:00+03:00[Europe/Istanbul]\nnope\n2016-12-01T09:00:00+02:00[Europe/Istanbul]",
    });
    expect(selectedLine(root)).toBe("3");
  });

  it("is line 1 when every line is valid or not a time", async () => {
    const { root } = await mount({ values: "nope" });
    expect(selectedLine(root)).toBe("1");
  });

  it("keeps a seeded line number", async () => {
    const { root } = await mount({
      values: AUDIT_PRESETS[0]!.lines.join("\n"),
      line: "3",
    });
    expect(selectedLine(root)).toBe("3");
    expect(q(root, "call-audit").textContent).toContain("2016-03-27T03:30:00");
  });
});

describe("the sentinel", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("shows NO SIGNAL on every line of the sentinel preset, with its reason", async () => {
    const { root } = await mount();
    choose(root, "not-stored-times");
    expect(
      [...root.querySelectorAll(".gmt-stored-nosignal")].map(
        (n) => n.textContent,
      ),
    ).toEqual(Array(6).fill(LINE_NO_SIGNAL));
    expect(root.querySelectorAll("tbody .gmt-stored-sentence")).toHaveLength(6);
    for (const s of root.querySelectorAll("tbody .gmt-stored-sentence")) {
      expect(s.textContent).toBe(NOT_STORED_TEXT);
    }
    expect(q(root, "reason").querySelector("aside")).not.toBeNull();
    expect(q(root, "reason").textContent).toContain(NOT_STORED_TEXT);
    expect(q(root, "audit-output").textContent).toBe("NO SIGNAL");
    expect(
      q(root, "audit-output").classList.contains("gmt-playground-sentinel"),
    ).toBe(true);
  });

  it("can select a line that is not a stored time, without a throw", async () => {
    const { root } = await mount();
    choose(root, "not-stored-times");
    expect(() => select(root, 4)).not.toThrow();
    expect(selectedLine(root)).toBe("4");
    expect(q(root, "link-dst").getAttribute("aria-disabled")).toBe("true");
    expect(q(root, "link-dst").hasAttribute("href")).toBe(false);
  });

  it("keeps an empty answer apart from NO SIGNAL (a valid line)", async () => {
    const { root } = await mount();
    select(root, 6);
    expect(q(root, "reason").textContent).toBe(VALID_REASON_TEXT);
    expect(q(root, "reason").querySelector("aside")).toBeNull();
    expect(
      q(root, "audit-output").classList.contains("gmt-playground-sentinel"),
    ).toBe(false);
  });

  it("reads a pasted line that is not a stored time without a throw", async () => {
    const { root } = await mount();
    await paste(
      root,
      "garbage ⟨ ⟩ <b>x</b>\n2016-12-01T09:00:00+02:00[Europe/Istanbul]",
    );
    expect(rowKinds(root)).toEqual(["null", "offsetMismatch"]);
    expect(root.querySelector("tbody b")).toBeNull();
    expect(selectedLine(root)).toBe("2");
  });

  it("says so when the box is empty", async () => {
    const { root } = await mount();
    await paste(root, "  \n \n");
    expect(root.querySelector(".gmt-stored-empty")).not.toBeNull();
    expect(q(root, "audit-output").textContent).toBe(
      "Not read: there is no line.",
    );
    expect(q<HTMLSelectElement>(root, "preset").value).toBe("custom");
  });
});

describe("the caps", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("reads twelve lines and says how many it left out", async () => {
    const { root } = await mount();
    const line = "2016-12-01T09:00:00+03:00[Europe/Istanbul]";
    await paste(root, Array(15).fill(line).join("\n"));
    expect(root.querySelectorAll("tbody [data-line]")).toHaveLength(12);
    expect(q(root, "truncated").textContent).toMatch(
      /3 more lines not read, after the first 12/,
    );
  });
});

describe("the DST Inspector link", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("is seeded with the line's zone and wall year", async () => {
    const { root } = await mount();
    const link = q(root, "link-dst");
    expect(link.textContent).toBe("This zone's clock changes in 2016");
    const href = link.getAttribute("href")!;
    expect(href.startsWith(`${SITE_BASE}/tools/dst-inspector/?w=dst&wa=`)).toBe(
      true,
    );
    const seed = seedFromLocation("dst", href.slice(href.indexOf("?")));
    expect(seed).toEqual({ zone: "Europe/Istanbul", year: 2016 });
  });
});

describe("permalinks", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it.each(AUDIT_PRESETS.map((p) => [p.id]))(
    "round-trips %s, newlines included",
    async (id) => {
      const first = await mount();
      choose(first.root, id!);
      const state = first.handle.getPermalinkState?.() as Record<
        string,
        string
      >;
      const preset = AUDIT_PRESETS.find((p) => p.id === id)!;
      expect(state).toEqual({
        values: preset.lines.join("\n"),
        line: String(preset.selected),
      });
      const url = encodeWidgetPermalink("storedaudit", state);
      expect(url).toMatch(
        new RegExp(
          `^${SITE_BASE}/tools/stored-time-audit/\\?w=storedaudit&wa=`,
        ),
      );
      const seeded = seedFromLocation(
        "storedaudit",
        url.slice(url.indexOf("?")),
      );
      expect(seeded).toEqual(state);
      const before = q(first.root, "audit-output").textContent;
      document.body.innerHTML = "";

      const second = await mount(seeded);
      expect(q(second.root, "audit-output").textContent).toBe(before);
      expect(rowKinds(second.root)).toEqual(KINDS[id!]);
      expect(selectedLine(second.root)).toBe(String(preset.selected));
      expect(q<HTMLSelectElement>(second.root, "preset").value).toBe(id);
    },
  );

  it("carries the reader's own lines and selection", async () => {
    const { root, handle } = await mount();
    await paste(
      root,
      "2016-12-01T09:00:00+02:00[Europe/Istanbul]\n2016-12-01T09:00:00+03:00[Europe/Istanbul]",
    );
    select(root, 2);
    expect(handle.getPermalinkState?.()).toEqual({
      values:
        "2016-12-01T09:00:00+02:00[Europe/Istanbul]\n2016-12-01T09:00:00+03:00[Europe/Istanbul]",
      line: "2",
    });
  });
});

describe("nothing moves", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  /** The parts of section 3 whose boxes must not change: their tags, classes and counts. */
  function skeleton(root: HTMLElement): string {
    const frame = q(root, "frame");
    const part = (el: Element) => `${el.tagName}.${el.className}`;
    return [
      ...[...frame.children].map(part),
      ...[...q(root, "figure").children].map(part),
      ...[...q(root, "figure").children].flatMap((lane) =>
        [...lane.children].map(part),
      ),
      String(frame.querySelectorAll("[data-legend]").length),
      part(q(root, "reason").parentElement!),
      String(
        q(root, "reason").parentElement!.querySelectorAll(".gmt-edi-sizer")
          .length,
      ),
      part(q(root, "audit-output").parentElement!),
      part(q(root, "call-audit").closest(".gmt-ledger-hold")!),
    ].join("|");
  }

  it("keeps section 3's frame, lanes, legend and holds across every preset and line", async () => {
    const { root } = await mount();
    const base = skeleton(root);
    for (const p of AUDIT_PRESETS) {
      choose(root, p.id);
      for (let n = 1; n <= p.lines.length; n++) {
        select(root, n);
        expect(skeleton(root)).toBe(base);
      }
    }
  });

  it("keeps the Kind column and the reading tokens fixed", async () => {
    const { root } = await mount();
    const kindCol = q(root, "table").querySelector<HTMLElement>(
      ".gmt-stored-col-kind",
    )!;
    const width = kindCol.style.getPropertyValue("--kind-ch");
    expect(width).toBe(String("Valid in an overlap".length));
    for (const p of AUDIT_PRESETS) {
      choose(root, p.id);
      expect(kindCol.style.getPropertyValue("--kind-ch")).toBe(width);
      expect(q(root, "table").querySelectorAll("thead th")).toHaveLength(4);
      for (const tr of root.querySelectorAll("tbody [data-line]")) {
        expect(tr.children).toHaveLength(4);
      }
    }
  });

  it("toggles legend items without removing any", async () => {
    const { root } = await mount();
    const on = () =>
      [...root.querySelectorAll<HTMLElement>("[data-legend]")]
        .filter((li) => !li.hasAttribute("data-off"))
        .map((li) => li.dataset["legend"]);
    expect(on()).toEqual(["gate", "mark", "break"]);
    choose(root, "kept-offset");
    expect(on()).toEqual(["gap", "gate", "mark"]);
    select(root, 5);
    expect(on()).toEqual(["overlap", "gate", "mark"]);
    choose(root, "not-stored-times");
    expect(on()).toEqual([]);
  });
});

describe("lifecycle", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("describes the figure for assistive tech", async () => {
    const { root } = await mount();
    const label = q(root, "figure").getAttribute("aria-label")!;
    expect(q(root, "figure").getAttribute("role")).toBe("img");
    expect(label).toContain(
      "The zone was at +03:00 at this time; the stored +02:00 is no offset it has.",
    );
  });

  it("releases its width observer on destroy, and destroying twice is safe", async () => {
    const spy = spyOnResizeObservers();
    const { handle } = await mount();
    expect(spy.live.size).toBe(1);
    handle.destroy();
    handle.destroy();
    expect(spy.live.size).toBe(0);
    spy.restore();
  });

  it("mounts nothing when aborted before the library loads", async () => {
    const root = document.createElement("div");
    root.innerHTML = renderStoredTimeAuditTemplate();
    const controller = new AbortController();
    controller.abort();
    const handle = await mountStoredTimeAudit(root, {}, controller.signal);
    expect(q(root, "rows").children).toHaveLength(0);
    expect(handle.getPermalinkState?.()).toBeNull();
    expect(() => {
      handle.destroy();
      handle.destroy();
    }).not.toThrow();
  });
});

/**
 * Every line of every preset, against the rows of
 * `packages/gmt/src/zoned/classify/classifyStoredZoned.test.ts`:
 * the kind and every reading the row prints, in the order it prints them. Times
 * are those rows' times, as `...:00Z`. No host-specific branch: each rule change
 * predates tz 2025c.
 */
type Reading = readonly [
  preset: string,
  line: number,
  kind: string,
  tokens: string[],
];
const READINGS: readonly Reading[] = [
  [
    "istanbul-2016",
    1,
    "validInOverlap",
    [
      "instant 2015-11-08T00:30:00Z",
      "earlier 2015-11-08T00:30:00Z",
      "later 2015-11-08T01:30:00Z",
      "atStoredOffset 2015-11-08T00:30:00Z",
    ],
  ],
  [
    "istanbul-2016",
    2,
    "ambiguous",
    [
      "earlier 2015-11-08T00:30:00Z",
      "later 2015-11-08T01:30:00Z",
      "atStoredOffset 2015-11-08T02:30:00Z",
    ],
  ],
  [
    "istanbul-2016",
    3,
    "nonexistent",
    [
      "earlier 2016-03-27T00:30:00Z",
      "later 2016-03-27T01:30:00Z",
      "atStoredOffset 2016-03-27T00:30:00Z",
    ],
  ],
  [
    "istanbul-2016",
    4,
    "offsetMismatch",
    [
      "storedOffset +02:00 → zoneOffset +03:00",
      "atStoredOffset 2016-10-30T01:30:00Z",
      "atZoneOffset 2016-10-30T00:30:00Z",
    ],
  ],
  [
    "istanbul-2016",
    5,
    "offsetMismatch",
    [
      "storedOffset +02:00 → zoneOffset +03:00",
      "atStoredOffset 2016-12-01T07:00:00Z",
      "atZoneOffset 2016-12-01T06:00:00Z",
    ],
  ],
  [
    "istanbul-2016",
    6,
    "valid",
    ["instant 2016-12-01T06:00:00Z", "atStoredOffset 2016-12-01T06:00:00Z"],
  ],
  [
    "casablanca-2018",
    1,
    "nonexistent",
    [
      "earlier 2018-06-17T01:30:00Z",
      "later 2018-06-17T02:30:00Z",
      "atStoredOffset 2018-06-17T02:30:00Z",
    ],
  ],
  [
    "casablanca-2018",
    2,
    "offsetMismatch",
    [
      "storedOffset +00:00 → zoneOffset +01:00",
      "atStoredOffset 2018-10-28T02:30:00Z",
      "atZoneOffset 2018-10-28T01:30:00Z",
    ],
  ],
  [
    "casablanca-2018",
    3,
    "offsetMismatch",
    [
      "storedOffset +00:00 → zoneOffset +01:00",
      "atStoredOffset 2018-12-01T09:00:00Z",
      "atZoneOffset 2018-12-01T08:00:00Z",
    ],
  ],
  [
    "casablanca-2018",
    4,
    "valid",
    ["instant 2018-12-01T08:00:00Z", "atStoredOffset 2018-12-01T08:00:00Z"],
  ],
  [
    "casablanca-2018",
    5,
    "validInOverlap",
    [
      "instant 2019-05-05T02:30:00Z",
      "earlier 2019-05-05T01:30:00Z",
      "later 2019-05-05T02:30:00Z",
      "atStoredOffset 2019-05-05T02:30:00Z",
    ],
  ],
  [
    "casablanca-2018",
    6,
    "ambiguous",
    [
      "earlier 2019-05-05T01:30:00Z",
      "later 2019-05-05T02:30:00Z",
      "atStoredOffset 2019-05-05T00:30:00Z",
    ],
  ],
  [
    "sao-paulo-2019",
    1,
    "nonexistent",
    [
      "earlier 2018-11-04T02:30:00Z",
      "later 2018-11-04T03:30:00Z",
      "atStoredOffset 2018-11-04T03:30:00Z",
    ],
  ],
  [
    "sao-paulo-2019",
    2,
    "validInOverlap",
    [
      "instant 2019-02-17T02:30:00Z",
      "earlier 2019-02-17T01:30:00Z",
      "later 2019-02-17T02:30:00Z",
      "atStoredOffset 2019-02-17T02:30:00Z",
    ],
  ],
  [
    "sao-paulo-2019",
    3,
    "ambiguous",
    [
      "earlier 2019-02-17T01:30:00Z",
      "later 2019-02-17T02:30:00Z",
      "atStoredOffset 2019-02-17T03:30:00Z",
    ],
  ],
  [
    "sao-paulo-2019",
    4,
    "valid",
    ["instant 2019-11-03T03:30:00Z", "atStoredOffset 2019-11-03T03:30:00Z"],
  ],
  [
    "sao-paulo-2019",
    5,
    "offsetMismatch",
    [
      "storedOffset -02:00 → zoneOffset -03:00",
      "atStoredOffset 2020-01-15T14:00:00Z",
      "atZoneOffset 2020-01-15T15:00:00Z",
    ],
  ],
  [
    "kept-offset",
    1,
    "nonexistent",
    [
      "earlier 2024-10-05T15:15:00Z",
      "later 2024-10-05T15:45:00Z",
      "atStoredOffset 2024-10-05T15:45:00Z",
    ],
  ],
  [
    "kept-offset",
    2,
    "nonexistent",
    [
      "earlier 2024-09-28T13:30:00Z",
      "later 2024-09-28T14:30:00Z",
      "atStoredOffset 2024-09-28T14:30:00Z",
    ],
  ],
  [
    "kept-offset",
    3,
    "nonexistent",
    [
      "earlier 2026-03-08T09:30:00Z",
      "later 2026-03-08T10:30:00Z",
      "atStoredOffset 2026-03-08T05:30:00Z",
    ],
  ],
  [
    "kept-offset",
    4,
    "ambiguous",
    [
      "earlier 2026-11-01T08:30:00Z",
      "later 2026-11-01T09:30:00Z",
      "atStoredOffset 2026-11-01T04:30:00Z",
    ],
  ],
  [
    "kept-offset",
    5,
    "validInOverlap",
    [
      "instant 2026-11-01T09:30:00Z",
      "earlier 2026-11-01T08:30:00Z",
      "later 2026-11-01T09:30:00Z",
      "atStoredOffset 2026-11-01T09:30:00Z",
    ],
  ],
  [
    "kept-offset",
    6,
    "validInOverlap",
    [
      "instant 2026-11-01T08:30:00Z",
      "earlier 2026-11-01T08:30:00Z",
      "later 2026-11-01T09:30:00Z",
      "atStoredOffset 2026-11-01T08:30:00Z",
    ],
  ],
  [
    "z-and-zero",
    1,
    "valid",
    ["instant 2022-07-08T00:14:07Z", "atStoredOffset 2022-07-08T00:14:07Z"],
  ],
  [
    "z-and-zero",
    2,
    "offsetMismatch",
    [
      "storedOffset +00:00 → zoneOffset +01:00",
      "atStoredOffset 2022-07-08T00:14:07Z",
      "atZoneOffset 2022-07-07T23:14:07Z",
    ],
  ],
  [
    "z-and-zero",
    3,
    "offsetMismatch",
    [
      "storedOffset +00:00 → zoneOffset +01:00",
      "atStoredOffset 2022-07-08T00:14:07Z",
      "atZoneOffset 2022-07-07T23:14:07Z",
    ],
  ],
  [
    "z-and-zero",
    4,
    "valid",
    ["instant 1960-01-01T01:04:30Z", "atStoredOffset 1960-01-01T01:05:00Z"],
  ],
  [
    "z-and-zero",
    5,
    "valid",
    ["instant 1960-01-01T01:04:30Z", "atStoredOffset 1960-01-01T01:04:30Z"],
  ],
  ["not-stored-times", 1, "null", []],
  ["not-stored-times", 2, "null", []],
  ["not-stored-times", 3, "null", []],
  ["not-stored-times", 4, "null", []],
  ["not-stored-times", 5, "null", []],
  ["not-stored-times", 6, "null", []],
];

/**
 * What each line's strip draws: a day strip's band (kind, left %, width %), the
 * stored pin (left %), the clock-change gate and the lane texts; a since strip's
 * gate and texts. A valid or unreadable line draws no strip (null). Band edges
 * are the transition's local minute-of-day over 1440: Lord Howe's 30-minute gap
 * at 02:00 is 8.33 and 2.08, Los Angeles' hour at 02:00 is 8.33 and 4.17, the
 * since strips' transitions are stored-time-audit.md § Presets.
 */
type Strip = null | {
  band?: readonly [kind: string, x: string, w: string];
  pin?: string;
  gate: readonly [kind: string, style: string];
  clock: string;
  exact: string;
};
const STRIPS: readonly (readonly [string, number, Strip])[] = [
  [
    "istanbul-2016",
    1,
    {
      band: ["overlap", "12.5", "4.17"],
      pin: "14.58",
      gate: ["overlap", "--x:50;--tier:0"],
      clock:
        "repeated 1 hour00:0002:0004:0006:0008:0010:0012:0014:0016:0018:0020:0022:0024:00stored 03:30",
      exact:
        "+03:00 \u2192 +02:00 01:00Zinstant = earlier = atStoredOffset 00:30Zlater 01:30Z",
    },
  ],
  [
    "istanbul-2016",
    2,
    {
      band: ["overlap", "12.5", "4.17"],
      pin: "14.58",
      gate: ["overlap", "--x:30.47;--tier:0"],
      clock:
        "repeated 1 hour00:0002:0004:0006:0008:0010:0012:0014:0016:0018:0020:0022:0024:00stored 03:30",
      exact:
        "+03:00 \u2192 +02:00 01:00Zearlier 00:30Zlater 01:30ZatStoredOffset 02:30Z",
    },
  ],
  [
    "istanbul-2016",
    3,
    {
      band: ["gap", "12.5", "4.17"],
      pin: "14.58",
      gate: ["gap", "--x:50;--tier:0"],
      clock:
        "skipped 1 hour00:0002:0004:0006:0008:0010:0012:0014:0016:0018:0020:0022:0024:00stored 03:30",
      exact:
        "+02:00 \u2192 +03:00 01:00Zearlier = atStoredOffset 00:30Zlater 01:30Z",
    },
  ],
  [
    "istanbul-2016",
    4,
    {
      gate: ["since", "--x:8;--tier:0"],
      clock: "Zone offset since 2016-03-27: +03:00Stored offset: +02:00",
      exact:
        "+02:00 \u2192 +03:00 2016-03-27atStoredOffset 10-30 01:30ZatZoneOffset 10-30 00:30Z",
    },
  ],
  [
    "istanbul-2016",
    5,
    {
      gate: ["since", "--x:8;--tier:0"],
      clock: "Zone offset since 2016-03-27: +03:00Stored offset: +02:00",
      exact:
        "+02:00 \u2192 +03:00 2016-03-27atStoredOffset 12-01 07:00ZatZoneOffset 12-01 06:00Z",
    },
  ],
  ["istanbul-2016", 6, null],
  [
    "casablanca-2018",
    1,
    {
      band: ["gap", "8.33", "4.17"],
      pin: "10.42",
      gate: ["gap", "--x:50;--tier:0"],
      clock:
        "skipped 1 hour00:0002:0004:0006:0008:0010:0012:0014:0016:0018:0020:0022:0024:00stored 02:30",
      exact:
        "+00:00 \u2192 +01:00 02:00Zearlier 01:30Zlater = atStoredOffset 02:30Z",
    },
  ],
  [
    "casablanca-2018",
    2,
    {
      gate: ["since", "--x:8;--tier:0"],
      clock: "Zone offset since 2018-06-17: +01:00Stored offset: +00:00",
      exact:
        "+00:00 \u2192 +01:00 2018-06-17atStoredOffset 10-28 02:30ZatZoneOffset 10-28 01:30Z",
    },
  ],
  [
    "casablanca-2018",
    3,
    {
      gate: ["since", "--x:8;--tier:0"],
      clock: "Zone offset since 2018-06-17: +01:00Stored offset: +00:00",
      exact:
        "+00:00 \u2192 +01:00 2018-06-17atStoredOffset 12-01 09:00ZatZoneOffset 12-01 08:00Z",
    },
  ],
  ["casablanca-2018", 4, null],
  [
    "casablanca-2018",
    5,
    {
      band: ["overlap", "8.33", "4.17"],
      pin: "10.42",
      gate: ["overlap", "--x:50;--tier:0"],
      clock:
        "repeated 1 hour00:0002:0004:0006:0008:0010:0012:0014:0016:0018:0020:0022:0024:00stored 02:30",
      exact:
        "+01:00 \u2192 +00:00 02:00Zinstant = later = atStoredOffset 02:30Zearlier 01:30Z",
    },
  ],
  [
    "casablanca-2018",
    6,
    {
      band: ["overlap", "8.33", "4.17"],
      pin: "10.42",
      gate: ["overlap", "--x:69.53;--tier:0"],
      clock:
        "repeated 1 hour00:0002:0004:0006:0008:0010:0012:0014:0016:0018:0020:0022:0024:00stored 02:30",
      exact:
        "+01:00 \u2192 +00:00 02:00Zearlier 01:30Zlater 02:30ZatStoredOffset 00:30Z",
    },
  ],
  [
    "sao-paulo-2019",
    1,
    {
      band: ["gap", "0", "4.17"],
      pin: "2.08",
      gate: ["gap", "--x:50;--tier:0"],
      clock:
        "skipped 1 hour00:0002:0004:0006:0008:0010:0012:0014:0016:0018:0020:0022:0024:00stored 00:30",
      exact:
        "-03:00 \u2192 -02:00 03:00Zearlier 02:30Zlater = atStoredOffset 03:30Z",
    },
  ],
  [
    "sao-paulo-2019",
    2,
    {
      band: ["overlap", "95.83", "4.1"],
      pin: "97.92",
      gate: ["overlap", "--x:50;--tier:0"],
      clock:
        "repeated 1 hour00:0002:0004:0006:0008:0010:0012:0014:0016:0018:0020:0022:0024:00stored 23:30",
      exact:
        "-02:00 \u2192 -03:00 02:00Zinstant = later = atStoredOffset 02:30Zearlier 01:30Z",
    },
  ],
  [
    "sao-paulo-2019",
    3,
    {
      band: ["overlap", "95.83", "4.1"],
      pin: "97.92",
      gate: ["overlap", "--x:30.47;--tier:0"],
      clock:
        "repeated 1 hour00:0002:0004:0006:0008:0010:0012:0014:0016:0018:0020:0022:0024:00stored 23:30",
      exact:
        "-02:00 \u2192 -03:00 02:00Zearlier 01:30Zlater 02:30ZatStoredOffset 03:30Z",
    },
  ],
  ["sao-paulo-2019", 4, null],
  [
    "sao-paulo-2019",
    5,
    {
      gate: ["since", "--x:8;--tier:0"],
      clock: "Zone offset since 2019-02-16: -03:00Stored offset: -02:00",
      exact:
        "-02:00 \u2192 -03:00 2019-02-17atStoredOffset 01-15 14:00ZatZoneOffset 01-15 15:00Z",
    },
  ],
  [
    "kept-offset",
    1,
    {
      band: ["gap", "8.33", "2.08"],
      pin: "9.38",
      gate: ["gap", "--x:50;--tier:0"],
      clock:
        "skipped 30 minutes00:0002:0004:0006:0008:0010:0012:0014:0016:0018:0020:0022:0024:00stored 02:15",
      exact:
        "+10:30 \u2192 +11:00 15:30Zearlier 15:15Zlater = atStoredOffset 15:45Z",
    },
  ],
  [
    "kept-offset",
    2,
    {
      band: ["gap", "11.46", "4.17"],
      pin: "13.54",
      gate: ["gap", "--x:50;--tier:0"],
      clock:
        "skipped 1 hour00:0002:0004:0006:0008:0010:0012:0014:0016:0018:0020:0022:0024:00stored 03:15",
      exact:
        "+12:45 \u2192 +13:45 14:00Zearlier 13:30Zlater = atStoredOffset 14:30Z",
    },
  ],
  [
    "kept-offset",
    3,
    {
      band: ["gap", "8.33", "4.17"],
      pin: "10.42",
      gate: ["gap", "--x:81.25;--tier:0"],
      clock:
        "skipped 1 hour00:0002:0004:0006:0008:0010:0012:0014:0016:0018:0020:0022:0024:00stored 02:30",
      exact:
        "-08:00 \u2192 -07:00 10:00Zearlier 09:30Zlater 10:30ZatStoredOffset 05:30Z",
    },
  ],
  [
    "kept-offset",
    4,
    {
      band: ["overlap", "4.17", "4.17"],
      pin: "6.25",
      gate: ["overlap", "--x:81.25;--tier:0"],
      clock:
        "repeated 1 hour00:0002:0004:0006:0008:0010:0012:0014:0016:0018:0020:0022:0024:00stored 01:30",
      exact:
        "-07:00 \u2192 -08:00 09:00Zearlier 08:30Zlater 09:30ZatStoredOffset 04:30Z",
    },
  ],
  [
    "kept-offset",
    5,
    {
      band: ["overlap", "4.17", "4.17"],
      pin: "6.25",
      gate: ["overlap", "--x:50;--tier:0"],
      clock:
        "repeated 1 hour00:0002:0004:0006:0008:0010:0012:0014:0016:0018:0020:0022:0024:00stored 01:30",
      exact:
        "-07:00 \u2192 -08:00 09:00Zinstant = later = atStoredOffset 09:30Zearlier 08:30Z",
    },
  ],
  [
    "kept-offset",
    6,
    {
      band: ["overlap", "4.17", "4.17"],
      pin: "6.25",
      gate: ["overlap", "--x:50;--tier:0"],
      clock:
        "repeated 1 hour00:0002:0004:0006:0008:0010:0012:0014:0016:0018:0020:0022:0024:00stored 01:30",
      exact:
        "-07:00 \u2192 -08:00 09:00Zinstant = earlier = atStoredOffset 08:30Zlater 09:30Z",
    },
  ],
  ["z-and-zero", 1, null],
  [
    "z-and-zero",
    2,
    {
      gate: ["since", "--x:8;--tier:0"],
      clock: "Zone offset since 2022-03-27: +01:00Stored offset: +00:00",
      exact:
        "+00:00 \u2192 +01:00 2022-03-27atStoredOffset 07-08 00:14ZatZoneOffset 07-07 23:14Z",
    },
  ],
  [
    "z-and-zero",
    3,
    {
      gate: ["since", "--x:8;--tier:0"],
      clock: "Zone offset since 2022-03-27: +01:00Stored offset: +00:00",
      exact:
        "+00:00 \u2192 +01:00 2022-03-27atStoredOffset 07-08 00:14ZatZoneOffset 07-07 23:14Z",
    },
  ],
  ["z-and-zero", 4, null],
  ["z-and-zero", 5, null],
  ["not-stored-times", 1, null],
  ["not-stored-times", 2, null],
  ["not-stored-times", 3, null],
  ["not-stored-times", 4, null],
  ["not-stored-times", 5, null],
  ["not-stored-times", 6, null],
];

describe("every line of every preset", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("is in the tables, once", () => {
    const lines = AUDIT_PRESETS.flatMap((p) =>
      p.lines.map((_, i) => `${p.id}:${i + 1}`),
    );
    expect(READINGS.map(([p, n]) => `${p}:${n}`)).toEqual(lines);
    expect(STRIPS.map(([p, n]) => `${p}:${n}`)).toEqual(lines);
  });

  it.each(READINGS)(
    "%s line %i reads as %s",
    async (preset, line, kind, tokens) => {
      const { root } = await mount();
      choose(root, preset);
      expect(rowKinds(root)[line - 1]).toBe(kind);
      expect(tokens_(root, line)).toEqual(tokens);
    },
  );

  it.each(STRIPS)("%s line %i draws its strip", async (preset, line, strip) => {
    const { root } = await mount();
    choose(root, preset);
    select(root, line);
    const clock = q(root, "lane-clock");
    const exact = q(root, "lane-exact");
    const band = clock.querySelector<HTMLElement>(".gmt-stored-band");
    const gate = exact.querySelector<HTMLElement>(".gmt-stored-gate");
    if (strip === null) {
      expect(band).toBeNull();
      expect(gate).toBeNull();
      expect(clock.textContent).toBe("");
      expect(exact.textContent).toBe("");
      return;
    }
    expect([gate!.dataset["kind"], gate!.getAttribute("style")]).toEqual([
      ...strip.gate,
    ]);
    expect(clock.textContent).toBe(strip.clock);
    expect(exact.textContent).toBe(strip.exact);
    if (strip.band) {
      expect(band!.dataset["kind"]).toBe(strip.band[0]);
      expect(band!.getAttribute("style")).toBe(
        `--x:${strip.band[1]};--w:${strip.band[2]}`,
      );
      expect(
        clock.querySelector(".gmt-stored-pin")!.getAttribute("style"),
      ).toBe(`--x:${strip.pin}`);
    } else {
      expect(band).toBeNull();
    }
  });

  it("opens each since strip on the transition getDstTransitions returns", async () => {
    const lib = await loadStoredTimeLib();
    for (const [zone, year, instant] of [
      ["Europe/Istanbul", 2016, "2016-03-27T01:00:00Z"],
      ["Africa/Casablanca", 2018, "2018-06-17T02:00:00Z"],
      ["America/Sao_Paulo", 2019, "2019-02-17T02:00:00Z"],
      ["Europe/London", 2022, "2022-03-27T01:00:00Z"],
    ] as const) {
      expect(
        lib.getDstTransitions(zone, year).map((t) => t.instant),
        `${zone} ${year}`,
      ).toContain(instant);
    }
  });
});

function tokens_(root: HTMLElement, n: number): string[] {
  return tokens(root, n);
}

describe("section 3 and the table keep their boxes", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  const ROLES = [
    "frame",
    "lane-clock",
    "lane-exact",
    "legend",
    "reason",
  ] as const;

  /**
   * jsdom has no layout, so it cannot measure a box. What it can see is what
   * decides one here: the same nodes, no inline size, never `hidden`, and the
   * same classes. The real boxes (within 0.5 px over every preset and line, at
   * 1440 and 390, Chromium and WebKit) are measured in a browser. Each track's
   * width is fixed per viewport so the lane redraws for both widths.
   */
  it.each([1440, 390])("at %i px", async (width) => {
    const { root } = await mount();
    for (const role of ["lane-clock", "lane-exact"]) {
      Object.defineProperty(q(root, role), "clientWidth", {
        configurable: true,
        value: width - 80,
      });
      Object.defineProperty(q(root, role), "offsetWidth", {
        configurable: true,
        value: width - 80,
      });
    }
    const nodes = ROLES.map((r) => q(root, r));
    const shape = (el: HTMLElement) =>
      `${el.tagName}|${el.className}|${el.hasAttribute("hidden")}|${el.style.cssText}`;
    const base = nodes.map(shape);
    const kindCol = q(root, "table").querySelector<HTMLElement>(
      ".gmt-stored-col-kind",
    )!;
    const kindWidth = kindCol.style.getPropertyValue("--kind-ch");
    let seen = 0;
    for (const p of AUDIT_PRESETS) {
      choose(root, p.id);
      for (let n = 1; n <= p.lines.length; n++) {
        select(root, n);
        seen++;
        expect(ROLES.map((r) => q(root, r))).toEqual(nodes);
        expect(nodes.map(shape)).toEqual(base);
        expect(kindCol.style.getPropertyValue("--kind-ch")).toBe(kindWidth);
        expect(root.querySelectorAll("[data-legend]")).toHaveLength(5);
        // Whatever the strip, the exact lane's tier rows are the same four.
        for (const chip of root.querySelectorAll<HTMLElement>(
          ".gmt-stored-track--exact [style*='--tier']",
        )) {
          expect(Number(chip.style.getPropertyValue("--tier"))).toBeLessThan(4);
        }
      }
    }
    expect(seen).toBe(AUDIT_PRESETS.reduce((s, p) => s + p.lines.length, 0));
  });

  it("holds the reason in a slot that is never hidden and fills its hold", () => {
    const css = readFileSync(
      join(import.meta.dirname, "../styles/gmt-stored-time-audit.css"),
      "utf8",
    );
    expect(css).toMatch(/\[data-role="reason"\][^{]*\{[^}]*flex: 1 1 auto/);
    expect(css).toMatch(
      /\[data-role="reason"\][^{]*\{[^}]*min-block-size: 100%/,
    );
    const root = document.createElement("div");
    root.innerHTML = renderStoredTimeAuditTemplate();
    expect(q(root, "reason").hasAttribute("hidden")).toBe(false);
    expect(q(root, "reason").parentElement!.className).toBe("gmt-ledger-hold");
  });

  it("prints every instant token nowrap with tabular figures", async () => {
    // jsdom loads no sheet, so check the class contract the sheet guarantees:
    // every printed reading is a `.gmt-stored-token`, and that rule carries
    // `font-variant-numeric: tabular-nums`. A token breaks only between its
    // name and its value, which are nowrap themselves, so a value never splits.
    const css = readFileSync(
      join(import.meta.dirname, "../styles/gmt-stored-time-audit.css"),
      "utf8",
    );
    const rule = (sel: string) =>
      css.match(
        new RegExp(`${sel.replace(/[.]/g, "\\.")}\\s*\\{([^}]*)\\}`),
      )?.[1] ?? "";
    expect(rule(".gmt-stored-time-audit .gmt-stored-token")).toMatch(
      /font-variant-numeric: tabular-nums/,
    );
    expect(rule(".gmt-stored-time-audit .gmt-stored-token-name")).toMatch(
      /white-space: nowrap/,
    );
    // The value wraps only at its `<wbr>` points; each segment between them is
    // nowrap, so a hyphen inside a date cannot break (Chromium ignores keep-all).
    const valueRule = rule(".gmt-stored-time-audit .gmt-stored-token-value");
    expect(valueRule).toMatch(/white-space: normal/);
    expect(valueRule).toMatch(/overflow-wrap: normal/);
    expect(rule(".gmt-stored-time-audit .gmt-stored-seg")).toMatch(
      /white-space: nowrap/,
    );
    const { root } = await mount();
    for (const p of AUDIT_PRESETS) {
      choose(root, p.id);
      for (const t of root.querySelectorAll(".gmt-stored-tokens > *")) {
        expect(t.classList.contains("gmt-stored-token")).toBe(true);
        for (const v of t.querySelectorAll(".gmt-stored-token-value")) {
          expect(v.parentElement).toBe(t);
        }
      }
    }
  });

  it("marks a reading's break points with a <wbr> that copied text never carries", async () => {
    const { root } = await mount();
    await paste(root, "2016-12-01T09:00:00.123456789+02:00[Europe/Istanbul]");
    const values = [
      ...root.querySelectorAll<HTMLElement>(
        '[data-line="1"] .gmt-stored-token-value',
      ),
    ];
    const marked = values.filter((v) => v.querySelector("wbr"));
    expect(marked.length).toBeGreaterThan(0);
    for (const v of marked) {
      // Every stretch between break points is a nowrap segment.
      const html = v.innerHTML;
      expect(html).toMatch(
        /^<span class="gmt-stored-seg">[^<]*<\/span>(<wbr><span class="gmt-stored-seg">[^<]*<\/span>){1,2}$/,
      );
      // `<wbr>` only after the `T` and before the `.` of a fraction.
      expect(html).not.toMatch(/\d<\/span><wbr><span[^>]*>\d/);
      for (const m of html.matchAll(/(.)<\/span><wbr><span[^>]*>(.)/g)) {
        expect(m[1] === "T" || m[2] === ".").toBe(true);
      }
      // textContent is what copy and permalinks read: no marker in it.
      expect(v.textContent).not.toContain("<wbr>");
      expect(v.textContent).toMatch(/^[-+\dTZ:.]+$/);
    }
    expect(marked.some((v) => v.innerHTML.includes("T</span><wbr>"))).toBe(
      true,
    );
    expect(
      marked.some((v) =>
        v.innerHTML.includes('<wbr><span class="gmt-stored-seg">.123456789'),
      ),
    ).toBe(true);
  });
});
