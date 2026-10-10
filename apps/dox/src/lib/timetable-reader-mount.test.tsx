/**
 * @vitest-environment jsdom
 *
 * The Timetable Reader widget end to end: template -> mount -> interact ->
 * assert, against the real `@northguild/gmt`. Every preset's row 1 call and
 * result are section 9 rows.
 */
/// <reference types="vitest/globals" />
import { installJsdomShims } from "~/test/jsdom-shims";
import { encodeWidgetPermalink, seedFromLocation } from "./widget-permalink";
import {
  crossingTime,
  scheduleDelivery,
  transitTime,
} from "@northguild/gmt/transport/calculate";
import { etaAtZone } from "@northguild/gmt/transport/convert";
import { isValidTimeZone } from "@northguild/gmt/zoned/validate";
import { isValidDateTime } from "@northguild/gmt/plain/validate";
import { classifyLocal, resolveLocal } from "@northguild/gmt/instant/convert";
import { getDstTransitions } from "@northguild/gmt/zoned/get";
import {
  SKIPPED_OFFSET_TEXT,
  TIMETABLE_PRESETS,
  arrivalChipText,
  chartLayout,
  chartSummary,
  chartWindow,
  rowBadge,
  type TimetableLib,
  type TimetableState,
} from "./timetable-reader";
import {
  mountTimetableReader,
  renderTimetableReaderTemplate,
} from "./timetable-reader-mount";

installJsdomShims();

const REQUIRED_ROLES = [
  "preset",
  "preset-description",
  "start-zone",
  "duration",
  "zone",
  "departure-1",
  "offset-1",
  "departure-2",
  "offset-2",
  "departure-3",
  "offset-3",
  "departure-4",
  "offset-4",
  "rows",
  "reason-aside",
  "row-pick",
  "call-timetable",
  "copy-timetable",
  "timetable-output",
  "day",
  "day-caption",
  "band-chip",
  "day-track",
  "bands",
  "day-ticks",
  "rowset",
  "rows-body",
  "two-clocks",
  "plot",
  "chart-caption",
  "chart-legend",
  ...[1, 2, 3, 4].flatMap((n) => [
    `lane-${n}`,
    `handle-${n}`,
    `tag-${n}`,
    `row-${n}`,
  ]),
];

const EXPECTED: Record<string, [string, string]> = {
  "fall-back": [
    '[{ departure: "2024-11-03T00:30:00", duration: "PT1H", timeZone: "America/New_York" }], { startTimeZone: "America/New_York" }',
    '{ eta: "2024-11-03T01:30:00-04:00[America/New_York]", legTimes: [{ arrival: "2024-11-03T05:30:00Z", localArrival: "2024-11-03T01:30:00-04:00[America/New_York]", dwellAfter: "PT0S" }] }',
  ],
  "offset-picks": [
    '[{ departure: "2024-11-03T01:30:00", duration: "PT1H", timeZone: "America/New_York" }], { startTimeZone: "America/New_York" }',
    '{ eta: "2024-11-03T01:30:00-05:00[America/New_York]", legTimes: [{ arrival: "2024-11-03T06:30:00Z", localArrival: "2024-11-03T01:30:00-05:00[America/New_York]", dwellAfter: "PT0S" }] }',
  ],
  "spring-forward": [
    '[{ departure: "2024-03-10T01:30:00", duration: "PT1H", timeZone: "America/New_York" }], { startTimeZone: "America/New_York" }',
    '{ eta: "2024-03-10T03:30:00-04:00[America/New_York]", legTimes: [{ arrival: "2024-03-10T07:30:00Z", localArrival: "2024-03-10T03:30:00-04:00[America/New_York]", dwellAfter: "PT0S" }] }',
  ],
  "published-local": [
    '[{ departure: "2024-06-15T10:00:00", duration: "PT1H", timeZone: "UTC" }], { startTimeZone: "America/New_York" }',
    '{ eta: "2024-06-15T15:00:00+00:00[UTC]", legTimes: [{ arrival: "2024-06-15T15:00:00Z", localArrival: "2024-06-15T15:00:00+00:00[UTC]", dwellAfter: "PT0S" }] }',
  ],
  "berlin-fall-back": [
    '[{ departure: "2024-10-27T02:30:00", duration: "PT1H", timeZone: "Europe/Amsterdam" }], { startTimeZone: "Europe/Berlin" }',
    '{ eta: "2024-10-27T02:30:00+01:00[Europe/Amsterdam]", legTimes: [{ arrival: "2024-10-27T01:30:00Z", localArrival: "2024-10-27T02:30:00+01:00[Europe/Amsterdam]", dwellAfter: "PT0S" }] }',
  ],
};

const q = <T extends HTMLElement = HTMLElement>(
  root: HTMLElement,
  role: string,
) => root.querySelector(`[data-role="${role}"]`) as T;

async function mount(args = {}, templateArgs = args) {
  const root = document.createElement("div");
  root.innerHTML = renderTimetableReaderTemplate(templateArgs);
  document.body.append(root);
  const controller = new AbortController();
  const handle = await mountTimetableReader(root, args, controller.signal);
  return { root, handle, controller };
}

function choosePreset(root: HTMLElement, id: string) {
  const preset = q<HTMLSelectElement>(root, "preset");
  preset.value = id;
  preset.dispatchEvent(new Event("change", { bubbles: true }));
}

function type(root: HTMLElement, role: string, value: string) {
  const input = q<HTMLInputElement>(root, role);
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("renderTimetableReaderTemplate", () => {
  it("carries every role the mount looks up", () => {
    const root = document.createElement("div");
    root.innerHTML = renderTimetableReaderTemplate();
    for (const role of REQUIRED_ROLES) {
      expect(root.querySelector(`[data-role="${role}"]`), role).not.toBeNull();
    }
  });

  it("puts pictures and values in two panes per section, in reading order", () => {
    const root = document.createElement("div");
    root.innerHTML = renderTimetableReaderTemplate();
    const splits = root.querySelectorAll(".gmt-timetable-split");
    expect(splits).toHaveLength(2);
    const order = (split: Element, roles: string[]) => {
      const nodes = roles.map((r) =>
        split.querySelector(`[data-role="${r}"]`)!,
      );
      nodes.forEach((n, i) => {
        if (i > 0) {
          expect(
            nodes[i - 1]!.compareDocumentPosition(n) &
              Node.DOCUMENT_POSITION_FOLLOWING,
          ).toBeTruthy();
        }
      });
      return nodes;
    };
    const [track, rowset] = order(splits[0]!, ["day-track", "rowset"]);
    expect(track!.closest(".gmt-timetable-pane")).not.toBe(
      rowset!.closest(".gmt-timetable-pane"),
    );
    const [chart, table] = order(splits[1]!, ["two-clocks", "rows"]);
    expect(chart!.closest(".gmt-timetable-pane")).not.toBe(
      table!.closest(".gmt-timetable-pane"),
    );
    // The controls line is not in a pane: it spans both columns.
    expect(
      splits[0]!
        .querySelector(".gmt-timetable-top")!
        .closest(".gmt-timetable-pane"),
    ).toBeNull();
  });

  it("has no placeholder on any printed-departure field", () => {
    const root = document.createElement("div");
    root.innerHTML = renderTimetableReaderTemplate();
    for (let i = 1; i <= 4; i++) {
      expect(q(root, `departure-${i}`).hasAttribute("placeholder")).toBe(false);
    }
  });
});

describe("mountTimetableReader", () => {
  it.each(TIMETABLE_PRESETS.map((p) => [p.id]))(
    "prints row 1's documented call and result for %s",
    async (id) => {
      const { root } = await mount();
      choosePreset(root, id);
      const [call, result] = EXPECTED[id]!;
      expect(q(root, "copy-timetable").dataset.copyText).toBe(
        `scheduleDelivery(${call})`,
      );
      expect(
        q(root, "timetable-output").textContent!.replace(/\n\s+/g, " "),
      ).toBe(result);
    },
  );

  it("shows the same Leaves text on rows 2 and 3 of spring-forward", async () => {
    const { root } = await mount();
    choosePreset(root, "spring-forward");
    const row2 = root.querySelector('[data-role="row-2-display"]')!;
    const row3 = root.querySelector('[data-role="row-3-display"]')!;
    const leaves2 = row2.querySelectorAll("td")[1]!.textContent;
    const leaves3 = row3.querySelectorAll("td")[1]!.textContent;
    expect(leaves2).toBe(leaves3);
    expect(leaves2).toContain("2024-03-10T03:30:00-04:00");
  });

  it("badges row 2 of spring-forward as skipped", async () => {
    const { root } = await mount();
    choosePreset(root, "spring-forward");
    const row2 = root.querySelector('[data-role="row-2-display"]')!;
    expect(row2.textContent).toContain("Never shows on the clock");
  });

  it("badges row 2 of fall-back as twice", async () => {
    const { root } = await mount();
    choosePreset(root, "fall-back");
    const row2 = root.querySelector('[data-role="row-2-display"]')!;
    expect(row2.textContent).toContain("Occurs twice");
  });

  it("gives NO SIGNAL and the skipped-offset reason for -05:00 typed into the skipped row (V83)", async () => {
    const { root } = await mount();
    choosePreset(root, "spring-forward");
    type(root, "offset-2", "-05:00");
    const rowPick = q<HTMLSelectElement>(root, "row-pick");
    rowPick.value = "1";
    rowPick.dispatchEvent(new Event("change", { bubbles: true }));
    expect(q(root, "timetable-output").textContent).toBe("NO SIGNAL");
    expect(q(root, "reason-aside").textContent).toContain(SKIPPED_OFFSET_TEXT);
  });

  it("renders the chat seed (V84) with the Occurs-twice badge", async () => {
    const seed = {
      startTimeZone: "Europe/Berlin",
      departures: ["2024-10-27T02:30:00"],
      duration: "PT1H",
      timeZone: "Europe/Amsterdam",
    };
    const { root } = await mount(seed);
    expect(
      q(root, "timetable-output").textContent!.replace(/\n\s+/g, " "),
    ).toBe(EXPECTED["berlin-fall-back"]![1]);
    const row1 = root.querySelector('[data-role="row-1-display"]')!;
    expect(row1.textContent).toContain("Occurs twice");
  });

  it("round-trips every preset's state as a permalink of strings", async () => {
    for (const preset of TIMETABLE_PRESETS) {
      const { root, handle } = await mount();
      choosePreset(root, preset.id);
      const state = handle.getPermalinkState?.() as Record<string, string>;
      expect(state).not.toBeNull();
      for (const value of Object.values(state))
        expect(typeof value).toBe("string");
      const url = encodeWidgetPermalink("timetable", state);
      const seeded = seedFromLocation("timetable", url.slice(url.indexOf("?")));
      const again = await mount(seeded);
      const [, result] = EXPECTED[preset.id]!;
      expect(
        q(again.root, "timetable-output").textContent!.replace(/\n\s+/g, " "),
      ).toBe(result);
      document.body.innerHTML = "";
    }
  });

  /* The page path: the server renders the default template and the mount is
     then handed the seed from the URL. The rail path renders the template with
     the seed, which hid these. */
  describe("a seed applied to the default template (the tool page)", () => {
    it("keeps a seeded offset the Offset select had no option for", async () => {
      const { root } = await mount(
        {
          startTimeZone: "America/New_York",
          departures: ["2024-11-03T01:30:00", "2024-11-03T01:30:00"],
          offsets: ["", "-05:00"],
          duration: "PT1H",
          timeZone: "America/New_York",
        },
        {},
      );
      expect(q<HTMLSelectElement>(root, "offset-2").value).toBe("-05:00");
      expect(q(root, "row-2-display").textContent).toContain(
        "2024-11-03T01:30:00-05:00",
      );
    });

    it("reads the page's own Worth trying link (an offset in a skipped hour) as NO SIGNAL", async () => {
      const { root } = await mount(
        {
          startTimeZone: "America/New_York",
          duration: "PT1H",
          timeZone: "America/New_York",
          departure1: "2024-03-10T02:30:00",
          offset1: "-05:00",
        },
        {},
      );
      expect(q<HTMLSelectElement>(root, "offset-1").value).toBe("-05:00");
      expect(q(root, "timetable-output").textContent).toBe("NO SIGNAL");
    });

    it("keeps a zone outside the curated list and reads it", async () => {
      const { root } = await mount(
        {
          startTimeZone: "America/New_York",
          duration: "PT1H",
          timeZone: "Europe/Helsinki",
          departure1: "2024-06-15T10:00:00",
        },
        {},
      );
      expect(q<HTMLSelectElement>(root, "zone").value).toBe("Europe/Helsinki");
      expect(q(root, "timetable-output").textContent).not.toBe("NO SIGNAL");
    });
  });

  it("keeps row 2's -05:00 when the offset-picks preset is chosen after another", async () => {
    const { root } = await mount();
    choosePreset(root, "published-local");
    choosePreset(root, "offset-picks");
    expect(q<HTMLSelectElement>(root, "offset-2").value).toBe("-05:00");
    expect(q<HTMLSelectElement>(root, "preset").value).toBe("offset-picks");
  });

  it("is inert when aborted before the library loads", async () => {
    const root = document.createElement("div");
    root.innerHTML = renderTimetableReaderTemplate();
    const controller = new AbortController();
    controller.abort();
    const handle = await mountTimetableReader(root, {}, controller.signal);
    expect(handle.getPermalinkState?.()).toBeNull();
  });

  it("can be destroyed twice", async () => {
    const { handle } = await mount();
    expect(() => {
      handle.destroy();
      handle.destroy();
    }).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// The day track, the chart and the table
// ---------------------------------------------------------------------------

const lib: TimetableLib = {
  scheduleDelivery,
  transitTime,
  etaAtZone,
  crossingTime,
  isValidTimeZone,
  isValidDateTime,
  resolveLocal,
  getDstTransitions,
  classifyLocal,
};

const NYZ = "[America/New_York]";

/** Section 9 L1 to L5: each row's Leaves and Local arrival, in full. */
const ROW_TEXTS: Record<string, [string, string][]> = {
  "fall-back": [
    [`2024-11-03T00:30:00-04:00${NYZ}`, `2024-11-03T01:30:00-04:00${NYZ}`],
    [`2024-11-03T01:30:00-04:00${NYZ}`, `2024-11-03T01:30:00-05:00${NYZ}`],
    [`2024-11-03T02:30:00-05:00${NYZ}`, `2024-11-03T03:30:00-05:00${NYZ}`],
  ],
  "offset-picks": [
    [`2024-11-03T01:30:00-04:00${NYZ}`, `2024-11-03T01:30:00-05:00${NYZ}`],
    [`2024-11-03T01:30:00-05:00${NYZ}`, `2024-11-03T02:30:00-05:00${NYZ}`],
  ],
  "spring-forward": [
    [`2024-03-10T01:30:00-05:00${NYZ}`, `2024-03-10T03:30:00-04:00${NYZ}`],
    [`2024-03-10T03:30:00-04:00${NYZ}`, `2024-03-10T04:30:00-04:00${NYZ}`],
    [`2024-03-10T03:30:00-04:00${NYZ}`, `2024-03-10T04:30:00-04:00${NYZ}`],
  ],
  "published-local": [
    [`2024-06-15T10:00:00-04:00${NYZ}`, "2024-06-15T15:00:00+00:00[UTC]"],
  ],
  "berlin-fall-back": [
    [
      "2024-10-27T02:30:00+02:00[Europe/Berlin]",
      "2024-10-27T02:30:00+01:00[Europe/Amsterdam]",
    ],
  ],
};

/** The note each row of each preset carries: `rowBadge`'s own text. */
const BADGES: Record<string, (string | null)[]> = {
  "fall-back": [null, rowBadge("twice", false), null],
  "offset-picks": [rowBadge("twice", false), rowBadge("twice", true)],
  "spring-forward": [null, rowBadge("skipped", false), null],
  "published-local": [null],
  "berlin-fall-back": [rowBadge("twice", false)],
};

function stateOfPreset(id: string): TimetableState {
  const p = TIMETABLE_PRESETS.find((x) => x.id === id)!;
  return {
    startTimeZone: p.startTimeZone,
    duration: p.duration,
    timeZone: p.timeZone,
    rows: [0, 1, 2, 3].map(
      (i) => p.rows[i] ?? { departure: "", offset: "" },
    ) as TimetableState["rows"],
  };
}

const fullText = (cell: Element) =>
  cell.querySelector(".gmt-timetable-live .gmt-timetable-time-full")
    ?.textContent ?? null;

function keydown(root: HTMLElement, role: string, k: string, shift = false) {
  q(root, role).dispatchEvent(
    new KeyboardEvent("keydown", { key: k, shiftKey: shift, bubbles: true }),
  );
}

function pointer(root: HTMLElement, role: string, kind: string, clientX = 0) {
  q(root, role).dispatchEvent(
    new PointerEvent(kind, { bubbles: true, pointerId: 1, clientX }),
  );
}

function stubTrack(root: HTMLElement) {
  q(root, "day-track").getBoundingClientRect = () =>
    ({
      left: 0,
      right: 1440,
      width: 1440,
      top: 0,
      bottom: 28,
      height: 28,
    }) as DOMRect;
}

const value = (root: HTMLElement, role: string) =>
  q<HTMLInputElement>(root, role).value;

describe("every preset's rows are unchanged", () => {
  it.each(TIMETABLE_PRESETS.map((p) => [p.id]))(
    "prints the Leaves, Local arrival and Note of every row of %s",
    async (id) => {
      const { root } = await mount();
      choosePreset(root, id);
      const want = ROW_TEXTS[id]!;
      for (let i = 0; i < want.length; i++) {
        const tr = q(root, `row-${i + 1}-display`);
        const cells = tr.querySelectorAll("td");
        expect(fullText(cells[1]!)).toBe(want[i]![0]);
        expect(fullText(cells[3]!)).toBe(want[i]![1]);
        const badge =
          cells[2]!.querySelector(".gmt-timetable-live .gmt-transport-badge")
            ?.textContent ?? "";
        const expected = BADGES[id]![i]!;
        expect(badge).toBe(expected === null ? "" : expected);
      }
      expect(root.querySelectorAll("tbody tr").length).toBe(want.length);
    },
  );
});

describe("the chart matches the table", () => {
  it.each(TIMETABLE_PRESETS.map((p) => [p.id]))(
    "draws every row of %s at the numbers chartLayout gives",
    async (id) => {
      const { root } = await mount();
      choosePreset(root, id);
      const layout = chartLayout(stateOfPreset(id), lib)!;
      const win = chartWindow(layout);
      const mille = (m: number) =>
        ((m - win.start) / (win.end - win.start)) * 1000;
      const pct = (m: number) =>
        ((m - win.start) / (win.end - win.start)) * 100;
      expect(layout.rows.length).toBe(ROW_TEXTS[id]!.length);
      for (const r of layout.rows) {
        const [leaves, local] = ROW_TEXTS[id]![r.n - 1]!;
        const link = q(root, `link-${r.n}`);
        expect(link.getAttribute("data-instant")).toBe(leaves);
        expect(Number(link.getAttribute("x1"))).toBeCloseTo(
          mille(r.printedMinute),
          2,
        );
        expect(Number(link.getAttribute("x2"))).toBeCloseTo(
          mille(r.instantMinute!),
          2,
        );
        const bar = q(root, `bar-${r.n}`);
        expect(bar.dataset.leaves).toBe(leaves);
        expect(bar.dataset.arrival).toBe(local);
        expect(parseFloat(bar.style.left)).toBeCloseTo(
          pct(r.instantMinute!),
          3,
        );
        expect(parseFloat(bar.style.width)).toBeCloseTo(
          pct(r.arrivalMinute!) - pct(r.instantMinute!),
          3,
        );
        expect(q(root, `arrival-${r.n}`).textContent).toBe(
          arrivalChipText(local, layout.date),
        );
        expect(q(root, `printed-${r.n}`)).not.toBeNull();
        expect(q(root, `instant-${r.n}`)).not.toBeNull();
      }
    },
  );

  it("shows rows 2 and 3 of spring-forward ending on one point, row 2 dashed", async () => {
    const { root } = await mount();
    choosePreset(root, "spring-forward");
    expect(q(root, "link-2").getAttribute("x2")).toBe(
      q(root, "link-3").getAttribute("x2"),
    );
    expect(
      q(root, "link-2").classList.contains("gmt-timetable-link--dashed"),
    ).toBe(true);
    expect(
      q(root, "link-3").classList.contains("gmt-timetable-link--dashed"),
    ).toBe(false);
    expect(q(root, "link-2").getAttribute("x1")).not.toBe(
      q(root, "link-3").getAttribute("x1"),
    );
  });

  it("starts both rows of offset-picks at one printed point and ends them apart", async () => {
    const { root } = await mount();
    choosePreset(root, "offset-picks");
    expect(q(root, "link-1").getAttribute("x1")).toBe(
      q(root, "link-2").getAttribute("x1"),
    );
    expect(q(root, "link-1").getAttribute("x2")).not.toBe(
      q(root, "link-2").getAttribute("x2"),
    );
  });

  it("draws two twice wedges on fall-back, one skipped on spring-forward, none on published-local", async () => {
    const { root } = await mount();
    const wedges = (kind: string) =>
      root.querySelectorAll(`.gmt-timetable-wedge[data-kind="${kind}"]`).length;
    choosePreset(root, "fall-back");
    expect([wedges("twice"), wedges("skipped")]).toEqual([2, 0]);
    choosePreset(root, "spring-forward");
    expect([wedges("twice"), wedges("skipped")]).toEqual([0, 1]);
    choosePreset(root, "published-local");
    expect([wedges("twice"), wedges("skipped")]).toEqual([0, 0]);
  });

  it("rewrites its text alternative on every render", async () => {
    const { root } = await mount();
    choosePreset(root, "spring-forward");
    expect(q(root, "two-clocks").getAttribute("role")).toBe("img");
    expect(q(root, "two-clocks").getAttribute("aria-label")).toBe(
      chartSummary(chartLayout(stateOfPreset("spring-forward"), lib)!),
    );
  });

  it("draws a hollow mark and no bar for a row that names no instant", async () => {
    const { root } = await mount();
    choosePreset(root, "offset-picks");
    keydown(root, "handle-2", "PageDown");
    expect(q(root, "bar-2")).toBeNull();
    expect(q(root, "link-2")).toBeNull();
    expect(
      q(root, "printed-2").classList.contains("gmt-timetable-sq--hollow"),
    ).toBe(true);
    expect(q(root, "journey-2").textContent).toContain("no instant");
  });

  it("says so when there is nothing to draw", async () => {
    const { root } = await mount();
    for (const n of [1, 2, 3, 4]) type(root, `departure-${n}`, "");
    expect(q(root, "plot").textContent).toContain(
      "Type a printed departure in a row to draw the two clocks.",
    );
    expect(q(root, "day-caption").textContent).toBe(
      "Type a printed departure in a row to draw its day.",
    );
    expect(q(root, "tag-1").hidden).toBe(true);
  });
});

describe("the shaded hour", () => {
  it("shades the repeated hour of fall-back", async () => {
    const { root } = await mount();
    choosePreset(root, "fall-back");
    const bands = root.querySelectorAll<HTMLElement>(".gmt-timetable-band");
    expect(bands.length).toBe(1);
    expect(bands[0]!.dataset.kind).toBe("twice");
    expect(bands[0]!.style.left).toBe("4.1667%");
    expect(bands[0]!.style.width).toBe("4.1667%");
    expect(q(root, "band-chip").textContent).toBe(
      "01:00\u201302:00 happens twice",
    );
    expect(q(root, "day-caption").textContent).toBe(
      "Local day 2024-11-03 in America/New_York",
    );
  });

  it("shades the skipped hour of spring-forward", async () => {
    const { root } = await mount();
    choosePreset(root, "spring-forward");
    const bands = root.querySelectorAll<HTMLElement>(".gmt-timetable-band");
    expect(bands.length).toBe(1);
    expect(bands[0]!.dataset.kind).toBe("skipped");
    expect(bands[0]!.style.left).toBe("8.3333%");
    expect(q(root, "band-chip").textContent).toBe(
      "02:00\u201303:00 never shows",
    );
  });

  it("shades nothing on published-local", async () => {
    const { root } = await mount();
    choosePreset(root, "published-local");
    expect(root.querySelectorAll(".gmt-timetable-band").length).toBe(0);
    expect(q(root, "band-chip").textContent).toBe("No clock change this day");
  });
});

describe("a handle moves its row's printed time", () => {
  it("writes the row's input from the keyboard and keeps the handle in sync", async () => {
    const { root } = await mount();
    choosePreset(root, "fall-back");
    keydown(root, "handle-1", "ArrowRight");
    expect(value(root, "departure-1")).toBe("2024-11-03T00:35:00");
    expect(q(root, "handle-1").getAttribute("aria-valuenow")).toBe("35");
    keydown(root, "handle-1", "PageUp");
    expect(value(root, "departure-1")).toBe("2024-11-03T01:35:00");
    keydown(root, "handle-1", "ArrowLeft", true);
    expect(value(root, "departure-1")).toBe("2024-11-03T00:35:00");
    keydown(root, "handle-1", "End");
    expect(value(root, "departure-1")).toBe("2024-11-03T23:55:00");
    keydown(root, "handle-1", "Home");
    expect(value(root, "departure-1")).toBe("2024-11-03T00:00:00");
    type(root, "departure-1", "2024-11-03T01:32:00");
    keydown(root, "handle-1", "ArrowRight");
    expect(value(root, "departure-1")).toBe("2024-11-03T01:35:00");
  });

  it("turns the preset to custom once a handle moves, and back when it returns", async () => {
    const { root } = await mount();
    choosePreset(root, "fall-back");
    keydown(root, "handle-1", "ArrowRight");
    expect(q<HTMLSelectElement>(root, "preset").value).toBe("custom");
    keydown(root, "handle-1", "ArrowLeft");
    expect(q<HTMLSelectElement>(root, "preset").value).toBe("fall-back");
  });

  it("moves the handle when a time is typed, and hides it for anything else", async () => {
    const { root } = await mount();
    choosePreset(root, "fall-back");
    type(root, "departure-1", "2024-11-03T03:15:00");
    expect(q(root, "handle-1").getAttribute("aria-valuenow")).toBe("195");
    expect(q(root, "handle-1").style.left).toBe("13.5417%");
    type(root, "departure-1", "nonsense");
    expect(q(root, "handle-1").hidden).toBe(true);
    expect(q(root, "tag-1").textContent).toBe("1 \u00b7 not a date and time");
    type(root, "departure-3", "2024-11-04T01:30:00");
    expect(q(root, "handle-3").hidden).toBe(true);
    expect(q(root, "tag-3").textContent).toBe("3 \u00b7 on 2024-11-04");
  });

  it("reads the printed time aloud", async () => {
    const { root } = await mount();
    choosePreset(root, "spring-forward");
    keydown(root, "handle-1", "PageUp");
    expect(q(root, "handle-1").getAttribute("aria-valuetext")).toBe(
      "02:30, never shows on the clock, read as 03:30",
    );
    expect(q(root, "tag-1").textContent).toBe("1 \u00b7 02:30 skipped");
  });

  it("enters and leaves the repeated hour by keyboard", async () => {
    const { root } = await mount();
    choosePreset(root, "fall-back");
    expect(q<HTMLSelectElement>(root, "offset-1").disabled).toBe(true);
    keydown(root, "handle-1", "PageUp");
    const offset = q<HTMLSelectElement>(root, "offset-1");
    expect(offset.disabled).toBe(false);
    expect(offset.options.length).toBe(3);
    expect(q(root, "row-1-display").textContent).toContain(
      "Occurs twice: the earlier instant",
    );
    expect(q(root, "tag-1").textContent).toBe("1 \u00b7 01:30 twice");
    expect(q(root, "handle-1").getAttribute("aria-valuetext")).toBe(
      "01:30, happens twice, read as the earlier pass",
    );
    keydown(root, "handle-1", "PageUp");
    expect(q<HTMLSelectElement>(root, "offset-1").disabled).toBe(true);
    expect(q(root, "badge-1")).toBeNull();
    expect(q(root, "tag-1").textContent).toBe("1 \u00b7 02:30");
  });

  it("states why each Offset select is or is not available, in a slot that is always there", async () => {
    const { root } = await mount();
    choosePreset(root, "fall-back");
    const why = (n: number) => q(root, `why-${n}`).textContent;
    expect(why(1)).toBe("Happens once: nothing to choose.");
    expect(why(4)).toBe("Type a printed time first.");
    keydown(root, "handle-1", "PageUp");
    expect(why(1)).toBe("Happens twice: the offset picks the pass.");
    choosePreset(root, "spring-forward");
    keydown(root, "handle-1", "PageUp");
    expect(why(1)).toBe("Never shows: no offset makes it valid.");
    for (const n of [1, 2, 3, 4]) {
      const sel = q<HTMLSelectElement>(root, `offset-${n}`);
      expect(sel.getAttribute("aria-describedby")).toBe(q(root, `why-${n}`).id);
    }
    expect(root.querySelectorAll(".gmt-timetable-why-slot")).toHaveLength(4);
  });

  it("walks through the repeated hour and keeps an offset it was given", async () => {
    const { root } = await mount();
    choosePreset(root, "fall-back");
    for (let i = 0; i < 7; i++) keydown(root, "handle-1", "ArrowRight");
    expect(q(root, "tag-1").textContent).toBe("1 \u00b7 01:05 twice");
    setOffset(root, "offset-1", "-05:00");
    expect(q(root, "row-1-display").textContent).toContain(
      "Offset written: this pass",
    );
    for (let i = 0; i < 11; i++) keydown(root, "handle-1", "ArrowRight");
    expect(value(root, "departure-1")).toBe("2024-11-03T02:00:00");
    expect(q(root, "tag-1").textContent).toBe("1 \u00b7 02:00");
    expect(q<HTMLSelectElement>(root, "offset-1").value).toBe("-05:00");
    expect(fullText(q(root, "row-1-display").querySelectorAll("td")[1]!)).toBe(
      `2024-11-03T02:00:00-05:00${NYZ}`,
    );
  });

  it("keeps a written offset when the handle moves off its hour, and reads again when it returns", async () => {
    const { root } = await mount();
    choosePreset(root, "offset-picks");
    keydown(root, "handle-2", "PageDown");
    expect(q<HTMLSelectElement>(root, "offset-2").value).toBe("-05:00");
    expect(q<HTMLSelectElement>(root, "offset-2").disabled).toBe(false);
    const leaves = q(root, "row-2-display").querySelectorAll("td")[1]!;
    expect(leaves.textContent).toContain("NO SIGNAL");
    expect(q(root, "bar-2")).toBeNull();
    expect(q(root, "link-2")).toBeNull();
    keydown(root, "handle-2", "PageUp");
    expect(fullText(q(root, "row-2-display").querySelectorAll("td")[1]!)).toBe(
      `2024-11-03T01:30:00-05:00${NYZ}`,
    );
  });

  it("returns a result when a handle moves the offset's row back into agreement (L8)", async () => {
    const { root } = await mount(
      {
        startTimeZone: "America/New_York",
        duration: "PT1H",
        timeZone: "America/New_York",
        departure1: "2024-03-10T02:30:00",
        offset1: "-05:00",
      },
      {},
    );
    expect(q(root, "timetable-output").textContent).toBe("NO SIGNAL");
    expect(q(root, "reason-aside").textContent).toContain(SKIPPED_OFFSET_TEXT);
    keydown(root, "handle-1", "PageDown");
    expect(value(root, "departure-1")).toBe("2024-03-10T01:30:00");
    expect(q(root, "timetable-output").textContent).not.toBe("NO SIGNAL");
    expect(q(root, "reason-aside").textContent).toBe("");
  });
});

function setOffset(root: HTMLElement, role: string, offset: string) {
  const el = q<HTMLSelectElement>(root, role);
  el.value = offset;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("a pointer drag", () => {
  it("moves the row under the pointer, through the repeated hour and out", async () => {
    const { root } = await mount();
    choosePreset(root, "fall-back");
    stubTrack(root);
    pointer(root, "handle-2", "pointerdown", 90);
    pointer(root, "handle-2", "pointermove", 75);
    expect(value(root, "departure-2")).toBe("2024-11-03T01:15:00");
    expect(q<HTMLSelectElement>(root, "offset-2").disabled).toBe(false);
    pointer(root, "handle-2", "pointermove", 130);
    expect(value(root, "departure-2")).toBe("2024-11-03T02:10:00");
    expect(q<HTMLSelectElement>(root, "offset-2").disabled).toBe(true);
    pointer(root, "handle-2", "pointerup", 130);
  });

  it("ignores a pointermove no handle started", async () => {
    const { root } = await mount();
    choosePreset(root, "fall-back");
    stubTrack(root);
    pointer(root, "handle-2", "pointermove", 130);
    expect(value(root, "departure-2")).toBe("2024-11-03T01:30:00");
  });

  it("still drags when setPointerCapture throws", async () => {
    const { root } = await mount();
    choosePreset(root, "fall-back");
    stubTrack(root);
    q(root, "handle-2").setPointerCapture = () => {
      throw new Error("no such pointer");
    };
    pointer(root, "handle-2", "pointerdown", 90);
    pointer(root, "handle-2", "pointermove", 130);
    expect(value(root, "departure-2")).toBe("2024-11-03T02:10:00");
  });

  it("stops moving after the pointer comes up or capture is lost", async () => {
    const { root } = await mount();
    choosePreset(root, "fall-back");
    stubTrack(root);
    pointer(root, "handle-2", "pointerdown", 90);
    pointer(root, "handle-2", "pointerup", 90);
    pointer(root, "handle-2", "pointermove", 200);
    expect(value(root, "departure-2")).toBe("2024-11-03T01:30:00");
    pointer(root, "handle-2", "pointerdown", 90);
    q(root, "handle-2").dispatchEvent(
      new Event("lostpointercapture", { bubbles: true }),
    );
    pointer(root, "handle-2", "pointermove", 200);
    expect(value(root, "departure-2")).toBe("2024-11-03T01:30:00");
  });

  it("adds a blank row where an empty lane is pressed", async () => {
    const { root } = await mount();
    choosePreset(root, "fall-back");
    stubTrack(root);
    expect(q(root, "handle-4").hidden).toBe(true);
    expect(q(root, "tag-4").textContent).toBe("4 \u00b7 click to add");
    pointer(root, "lane-4", "pointerdown", 720);
    expect(value(root, "departure-4")).toBe("2024-11-03T12:00:00");
    expect(q(root, "handle-4").hidden).toBe(false);
    pointer(root, "lane-4", "pointerup", 720);
  });

  it("does nothing when a lane that has a handle is pressed away from it", async () => {
    const { root } = await mount();
    choosePreset(root, "fall-back");
    stubTrack(root);
    pointer(root, "lane-1", "pointerdown", 900);
    pointer(root, "lane-1", "pointermove", 1000);
    expect(value(root, "departure-1")).toBe("2024-11-03T00:30:00");
  });

  it("refits the chart's window only when the drag settles", async () => {
    const { root } = await mount();
    choosePreset(root, "fall-back");
    stubTrack(root);
    const plot = q(root, "plot");
    expect([plot.dataset.windowStart, plot.dataset.windowEnd]).toEqual([
      "0",
      "300",
    ]);
    pointer(root, "handle-3", "pointerdown", 150);
    pointer(root, "handle-3", "pointermove", 720);
    expect(value(root, "departure-3")).toBe("2024-11-03T12:00:00");
    expect([plot.dataset.windowStart, plot.dataset.windowEnd]).toEqual([
      "0",
      "300",
    ]);
    pointer(root, "handle-3", "pointerup", 720);
    expect([plot.dataset.windowStart, plot.dataset.windowEnd]).toEqual([
      "0",
      "900",
    ]);
  });

  it("refits the chart's window when a key move settles", async () => {
    const { root } = await mount();
    choosePreset(root, "fall-back");
    keydown(root, "handle-3", "End");
    const plot = q(root, "plot");
    expect(plot.dataset.windowEnd).toBe("300");
    q(root, "handle-3").dispatchEvent(
      new KeyboardEvent("keyup", { key: "End", bubbles: true }),
    );
    expect(Number(plot.dataset.windowEnd)).toBeGreaterThan(900);
  });
});

describe("structure", () => {
  it("makes all three sections full width, with the reason aside last in the third", async () => {
    const { root } = await mount();
    const sections = root.querySelectorAll(
      ".gmt-widget-card > .gmt-widget-section",
    );
    expect(sections.length).toBe(3);
    for (const section of sections) {
      expect(section.classList.contains("gmt-widget-section--wide")).toBe(true);
    }
    expect(sections[2]!.lastElementChild).toBe(q(root, "reason-aside"));
  });

  it("keeps the chart out of the tab order and the day's tab stops on the visible handles", async () => {
    const { root } = await mount();
    choosePreset(root, "fall-back");
    expect(
      q(root, "two-clocks").querySelectorAll(
        "a, button, input, select, textarea, [tabindex]",
      ).length,
    ).toBe(0);
    const stops = [
      ...q(root, "day").querySelectorAll<HTMLElement>("[tabindex]"),
    ].filter((el) => !el.hidden);
    expect(stops.map((el) => el.dataset.role)).toEqual([
      "handle-1",
      "handle-2",
      "handle-3",
    ]);
  });

  it("breaks a zoned value only before its bracket and after a slash in the zone", async () => {
    const { root } = await mount();
    choosePreset(root, "fall-back");
    const full = root.querySelector(
      ".gmt-timetable-live .gmt-timetable-time-full",
    )!;
    const toks = [...full.querySelectorAll(".gmt-timetable-tok")].map(
      (t) => t.textContent,
    );
    expect(toks).toEqual([
      expect.stringMatching(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/,
      ),
      "[America/",
      "New_York]",
    ]);
    expect(full.querySelectorAll("wbr")).toHaveLength(2);
    /* The zone is one block, so it moves to the next line whole. */
    expect(full.querySelector(".gmt-timetable-zone")?.textContent).toBe(
      "[America/New_York]",
    );
    const printed = root.querySelector(".gmt-timetable-printed-text")!;
    expect(printed.querySelectorAll("wbr")).toHaveLength(0);
    expect(printed.querySelectorAll(".gmt-timetable-tok")).toHaveLength(1);
  });

  it("keeps every sizer's text out of the root's text", async () => {
    const { root } = await mount();
    choosePreset(root, "fall-back");
    const sizers = root.querySelectorAll(".gmt-timetable-sizer");
    expect(sizers.length).toBeGreaterThan(0);
    for (const sizer of sizers) {
      expect(sizer.textContent).toBe("");
      expect(sizer.getAttribute("aria-hidden")).toBe("true");
    }
    expect(root.textContent).not.toContain("0000-00-00");
  });

  it("draws the table's disabled Offset select only where it matters", async () => {
    const { root } = await mount();
    choosePreset(root, "offset-picks");
    expect(q<HTMLSelectElement>(root, "offset-1").disabled).toBe(false);
    expect(q<HTMLSelectElement>(root, "offset-2").disabled).toBe(false);
    expect(q<HTMLSelectElement>(root, "offset-3").disabled).toBe(true);
    expect(q<HTMLSelectElement>(root, "offset-4").disabled).toBe(true);
  });

  it("shows NO SIGNAL as a sentinel in the cells of a row that returns null", async () => {
    const { root } = await mount();
    choosePreset(root, "spring-forward");
    setOffset(root, "offset-2", "-05:00");
    const cells = q(root, "row-2-display").querySelectorAll("td");
    for (const i of [1, 3]) {
      const sentinel = cells[i]!.querySelector(".gmt-playground-sentinel");
      expect(sentinel?.textContent).toBe("NO SIGNAL");
      expect(
        cells[i]!.querySelector(".gmt-timetable-time-full")?.textContent ?? "",
      ).toBe("");
    }
  });
});
