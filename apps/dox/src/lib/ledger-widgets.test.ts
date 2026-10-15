/**
 * @vitest-environment jsdom
 */
import { Temporal } from "@js-temporal/polyfill";
import { dwellTime } from "@northguild/gmt/transport/calculate";
import { diffUtcAsDuration } from "@northguild/gmt/utc/calculate";
import {
  DWELL_PRESETS,
  createLedgerCanvas,
  dayCells,
  fitLedgerCanvas,
  toEpochMs,
} from "./dwell-ledger";
import {
  DAY_FIT_NARROW_PX,
  DAY_FIT_SHORT_PX,
  dateText,
  dayColumnFit,
  dayColumnsHtml,
  dayLabelParts,
  descriptionHoldHtml,
  hourDurationText,
  localText,
  NO_RESULT,
  plateHtml,
  platesHtml,
  zoneWithOffsets,
  type DayMark,
} from "./ledger-widgets";
import { FIXED_OFFSET_ZONES, TRANSPORT_ZONES } from "./transport-widgets";

function columns(
  zone: string,
  from: string,
  to: string,
  states: Record<string, DayMark> = {},
) {
  const a = toEpochMs(from);
  const b = toEpochMs(to);
  const canvas = fitLedgerCanvas(a, b, [zone])!;
  const cells = dayCells(canvas, zone, a, b);
  const root = document.createElement("div");
  root.innerHTML = dayColumnsHtml(cells, canvas, states);
  return { cells, canvas, root };
}

describe("dayColumnsHtml", () => {
  // The canvas starts at the local midnight, so 9 March 2024 in New York is
  // the first column and the clock change falls on the 10th.
  const spring = () =>
    columns(
      "America/New_York",
      "2024-03-09T20:00:00-05:00[America/New_York]",
      "2024-03-11T04:00:00-04:00[America/New_York]",
    );

  it("draws one listitem for each day with its date, length and state", () => {
    const { root } = spring();
    const days = [...root.querySelectorAll<HTMLElement>('[role="listitem"]')];
    expect(days.map((d) => d.dataset.date)).toEqual([
      "2024-03-09",
      "2024-03-10",
      "2024-03-11",
    ]);
    expect(days.map((d) => d.dataset.hours)).toEqual(["24", "23", "24"]);
    expect(days.map((d) => d.dataset.state)).toEqual([
      "plain",
      "plain",
      "plain",
    ]);
  });

  it("sizes each column by its day's real bounds", () => {
    const { root, cells, canvas } = spring();
    const days = [...root.querySelectorAll<HTMLElement>(".gmt-ledger-day")];
    cells.forEach((cell, i) => {
      const left = canvas.toPercent(cell.startMs);
      const width = canvas.toPercent(cell.endMs) - left;
      expect(days[i]!.style.left).toBe(`${left}%`);
      expect(days[i]!.style.width).toBe(`${width}%`);
    });
    // The 23-hour day is narrower than a 24-hour one.
    const widths = days.map((d) => parseFloat(d.style.width));
    expect(widths[1]!).toBeLessThan(widths[0]!);
  });

  it("flags a 23-hour day with a dashed short chip and a 25-hour day with a long one", () => {
    const { root } = spring();
    const odd = root.querySelectorAll<HTMLElement>(".gmt-ledger-odd");
    expect(odd).toHaveLength(1);
    expect(odd[0]!.textContent).toBe("23 h");
    expect(odd[0]!.dataset.dst).toBe("short");
    const fall = columns(
      "Europe/Amsterdam",
      "2024-10-26T20:00:00+02:00[Europe/Amsterdam]",
      "2024-10-28T04:00:00+01:00[Europe/Amsterdam]",
    ).root.querySelector<HTMLElement>(".gmt-ledger-odd")!;
    expect(fall.textContent).toBe("25 h");
    expect(fall.dataset.dst).toBe("long");
  });

  it("names the date, the odd length, the tier and the state in the aria-label", () => {
    const { root } = columns(
      "America/New_York",
      "2024-03-09T20:00:00-05:00[America/New_York]",
      "2024-03-11T04:00:00-04:00[America/New_York]",
      {
        "2024-03-10": { state: "hatched", chip: "charged", tier: 2 },
      },
    );
    const day = root.querySelector<HTMLElement>('[data-date="2024-03-10"]')!;
    expect(day.getAttribute("aria-label")).toBe(
      "10 Mar Sun, 23 hours, tier 2, charged",
    );
    expect(day.title).toBe(day.getAttribute("aria-label"));
    expect(day.classList).toContain("gmt-punct-hatch");
    expect(day.dataset.tier).toBe("2");
    expect(
      [...day.querySelectorAll(".gmt-cutoff-chip")].map((c) => c.textContent),
    ).toEqual(["charged", "tier 2", "23 h"]);
  });

  it("gives each state its class, its series and its kind", () => {
    const { root } = columns(
      "America/New_York",
      "2024-06-14T20:00:00-04:00[America/New_York]",
      "2024-06-17T04:00:00-04:00[America/New_York]",
      {
        "2024-06-14": { state: "lit", chip: "free", series: 1, kind: "free" },
        "2024-06-15": { state: "closed", chip: "closed", kind: "closed" },
        "2024-06-16": {
          state: "plain",
          chip: "event day",
          aria: "event day, not counted",
        },
      },
    );
    const by = (date: string) =>
      root.querySelector<HTMLElement>(`[data-date="${date}"]`)!;
    expect(by("2024-06-14").dataset.series).toBe("1");
    expect(by("2024-06-14").dataset.kind).toBe("free");
    expect(by("2024-06-14").classList).not.toContain("gmt-punct-hatch");
    expect(by("2024-06-15").classList).toContain("gmt-cutoff-closed");
    expect(by("2024-06-16").getAttribute("aria-label")).toBe(
      "16 Jun Sun, event day, not counted",
    );
  });

  it("hides the visible label and chips from assistive technology", () => {
    const { root } = spring();
    for (const el of root.querySelectorAll(
      ".gmt-ledger-day-label, .gmt-ledger-day-chips",
    )) {
      expect(el.getAttribute("aria-hidden")).toBe("true");
    }
  });

  it("escapes a chip and a kind it is given", () => {
    const { root } = columns(
      "America/New_York",
      "2024-06-14T20:00:00-04:00[America/New_York]",
      "2024-06-15T04:00:00-04:00[America/New_York]",
      {
        "2024-06-14": {
          state: "lit",
          chip: '<img src=x onerror="alert(1)">',
          kind: '"><b>',
        },
      },
    );
    expect(root.querySelector("img")).toBeNull();
    expect(root.querySelector("b")).toBeNull();
  });

  it("leaves out a column that has no width on the canvas", () => {
    const canvas = createLedgerCanvas(0, 1000);
    const html = dayColumnsHtml(
      [
        {
          startMs: 5000,
          endMs: 6000,
          date: "2024-06-15",
          hours: 24,
          touched: false,
        },
      ],
      canvas,
      {},
    );
    expect(html).toBe("");
  });

  it("skips the weekday of a date it cannot read", () => {
    expect(dayLabelParts("not a date")).toEqual({
      date: "not a date",
      weekday: "",
    });
    expect(dayLabelParts("2024-06-15")).toEqual({
      date: "15 Jun",
      weekday: "Sat",
    });
  });
});

describe("dayColumnFit", () => {
  it("keeps everything for a wide column and when nothing was measured", () => {
    expect(dayColumnFit(DAY_FIT_SHORT_PX)).toBe("full");
    expect(dayColumnFit(400)).toBe("full");
    expect(dayColumnFit(0)).toBe("full");
    expect(dayColumnFit(Number.NaN)).toBe("full");
  });

  it("drops the weekday first, then the whole label", () => {
    expect(dayColumnFit(DAY_FIT_SHORT_PX - 1)).toBe("short");
    expect(dayColumnFit(DAY_FIT_NARROW_PX)).toBe("short");
    expect(dayColumnFit(DAY_FIT_NARROW_PX - 1)).toBe("narrow");
  });
});

describe("hourDurationText", () => {
  it("shows days, hours and minutes with a day as 24 hours", () => {
    expect(hourDurationText("PT400H")).toBe("16 d 16 h");
    expect(hourDurationText("PT139H30M")).toBe("5 d 19 h 30 min");
    expect(hourDurationText("PT0S")).toBe("0 h");
    expect(hourDurationText("PT2H")).toBe("2 h");
    expect(hourDurationText("PT24H")).toBe("1 d");
    expect(hourDurationText("PT30M")).toBe("30 min");
    expect(hourDurationText("PT0H")).toBe("0 h");
  });

  it("returns an empty string for text that is not such a duration", () => {
    for (const bad of [
      "",
      "PT",
      "P1D",
      "P1DT2H",
      "-PT2H",
      "PT1H30S",
      "PT0.5H",
      "2 hours",
      "pt2h",
      "PT2H ",
    ]) {
      expect(hourDurationText(bad), bad).toBe("");
    }
  });

  it("reads zero seconds, which carry no time", () => {
    expect(hourDurationText("PT1H0S")).toBe("1 h");
  });

  it("agrees with the library for every duration the Dwell Ledger presets produce", () => {
    for (const p of DWELL_PRESETS) {
      const zone = p.zone === "" ? undefined : p.zone;
      const result = dwellTime(p.entry, p.exit, zone);
      if (result === null) continue;
      const text = hourDurationText(result.duration);
      expect(text, `${p.id} ${result.duration}`).not.toBe("");
      // The text and the library's own hour count say the same thing.
      const hours = Number(
        diffUtcAsDuration(
          Temporal.Instant.fromEpochMilliseconds(toEpochMs(p.entry)).toString(),
          Temporal.Instant.fromEpochMilliseconds(toEpochMs(p.exit)).toString(),
          "hours",
        ).match(/(\d+)H/)?.[1] ?? 0,
      );
      const days = Number(/(\d+) d/.exec(text)?.[1] ?? 0);
      const rest = Number(/(\d+) h/.exec(text)?.[1] ?? 0);
      expect(days * 24 + rest, p.id).toBe(hours);
    }
  });
});

describe("dateText", () => {
  it("writes a date with its weekday", () => {
    expect(dateText("2024-06-15")).toBe("Sat 15 Jun 2024");
    expect(dateText("2011-12-31")).toBe("Sat 31 Dec 2011");
  });

  it("returns an empty string for anything but a real YYYY-MM-DD date", () => {
    for (const bad of [
      "",
      "2024-02-30",
      "2024-6-15",
      "2024-06-15T10:00:00",
      "15 Jun 2024",
    ]) {
      expect(dateText(bad), bad).toBe("");
    }
  });
});

describe("localText", () => {
  it("writes an instant on a zone's clock", () => {
    expect(localText("2024-06-14T07:00:00Z", "Asia/Shanghai")).toBe(
      "Fri 14 Jun 15:00",
    );
    expect(localText("2024-06-14T07:00:00Z", "America/New_York")).toBe(
      "Fri 14 Jun 03:00",
    );
  });

  it("reads an offset and a bracketed instant, and an offset as the zone", () => {
    expect(localText("2024-06-14T15:00:00+08:00", "UTC")).toBe(
      "Fri 14 Jun 07:00",
    );
    expect(
      localText("2024-06-10T08:00:00+08:00[Asia/Shanghai]", "+02:00"),
    ).toBe("Mon 10 Jun 02:00");
  });

  it("returns an empty string when the zone or the instant cannot be read", () => {
    expect(localText("2024-06-14T07:00:00Z", "Mars/Olympus")).toBe("");
    expect(localText("2024-06-14T07:00:00Z", "")).toBe("");
    expect(localText("not an instant", "UTC")).toBe("");
    expect(localText("2024-06-14T07:00:00", "UTC")).toBe("");
  });
});

describe("zoneWithOffsets", () => {
  it("holds the transport zones, +08:00 and the fixed offsets, each once", () => {
    expect(new Set(zoneWithOffsets).size).toBe(zoneWithOffsets.length);
    for (const zone of [...TRANSPORT_ZONES, "+08:00", ...FIXED_OFFSET_ZONES]) {
      expect(zoneWithOffsets).toContain(zone);
    }
  });

  it("puts +08:00 after the named zones and before the other offsets", () => {
    const at = zoneWithOffsets.indexOf("+08:00");
    expect(at).toBe(TRANSPORT_ZONES.length);
    expect(zoneWithOffsets.slice(at + 1)).toEqual([...FIXED_OFFSET_ZONES]);
  });
});

describe("plateHtml", () => {
  const html = (spec: Parameters<typeof plateHtml>[0]) => {
    const root = document.createElement("div");
    root.innerHTML = plateHtml(spec);
    return root.firstElementChild as HTMLElement;
  };

  it("holds a caption that changes with a choice to the longest one it can show", () => {
    const plate = html({
      role: "hero-bl",
      caption: "Issue date",
      captions: ["Issue date", "Received for shipment date"],
      value: "3",
      lines: [""],
    });
    const hold = plate.querySelector(".gmt-ledger-hold")!;
    const caps = [...hold.querySelectorAll(".gmt-punct-hero-cap")];
    expect(caps.map((c) => c.textContent)).toEqual([
      "Issue date",
      "Issue date",
      "Received for shipment date",
    ]);
    // Only the live caption is read; the sizers are hidden from assistive technology.
    expect(caps[0]!.hasAttribute("aria-hidden")).toBe(false);
    expect(
      caps.slice(1).every((c) => c.getAttribute("aria-hidden") === "true"),
    ).toBe(true);
    // A plate whose caption never changes has no hold.
    const plain = html({
      role: "x",
      caption: "Ran for",
      value: "3",
      lines: [""],
    });
    expect(plain.querySelector(".gmt-ledger-hold")).toBeNull();
  });

  it("draws a caption, a value and one span for each sub line", () => {
    const plate = html({
      role: "hero-free",
      caption: "Free days used",
      value: "3",
      lines: ["of 3 free"],
      series: 1,
    });
    expect(plate.classList).toContain("gmt-punct-hero");
    expect(plate.dataset.role).toBe("hero-free");
    expect(plate.dataset.series).toBe("1");
    expect(plate.hasAttribute("data-empty")).toBe(false);
    expect(plate.querySelector(".gmt-punct-hero-cap")!.textContent).toBe(
      "Free days used",
    );
    expect(plate.querySelector(".gmt-punct-hero-value")!.textContent).toBe("3");
    expect(
      [...plate.querySelectorAll(".gmt-punct-hero-line")].map(
        (l) => l.textContent,
      ),
    ).toEqual(["of 3 free"]);
  });

  it("takes the quiet look only when asked", () => {
    const base = {
      role: "hero-expires",
      caption: "Free time expires",
      value: "17 Jun 00:00",
      lines: [],
    };
    expect(html({ ...base, quiet: true }).classList).toContain(
      "gmt-punct-hero--quiet",
    );
    expect(html(base).classList).not.toContain("gmt-punct-hero--quiet");
  });

  it("keeps its box and its lines when there is no result", () => {
    const plate = html({
      role: "hero-days",
      caption: "Local days",
      value: null,
      lines: ["in Europe/London", "1 in Europe/Amsterdam"],
    });
    expect(plate.hasAttribute("data-empty")).toBe(true);
    expect(plate.querySelector(".gmt-punct-hero-value")!.textContent).toBe(
      NO_RESULT,
    );
    expect(
      [...plate.querySelectorAll(".gmt-punct-hero-line")].map(
        (l) => l.textContent,
      ),
    ).toEqual(["", ""]);
  });

  it("escapes every text it is given", () => {
    const plate = html({
      role: '"><i>',
      caption: "<b>x</b>",
      value: "<u>1</u>",
      lines: ["<s>z</s>"],
    });
    expect(plate.querySelector("b, u, s, i")).toBeNull();
  });

  it("wraps its plates in one pinned, aria-hidden row", () => {
    const root = document.createElement("div");
    root.innerHTML = platesHtml("heroes", [
      { role: "a", caption: "A", value: "1", lines: [] },
      { role: "b", caption: "B", value: null, lines: [] },
    ]);
    const row = root.firstElementChild as HTMLElement;
    expect(row.classList).toContain("gmt-punct-heroes");
    expect(row.getAttribute("aria-hidden")).toBe("true");
    expect(row.querySelectorAll(".gmt-punct-hero")).toHaveLength(2);
  });
});

describe("descriptionHoldHtml", () => {
  it("draws the live paragraph once and a hidden sizer for each description", () => {
    const root = document.createElement("div");
    root.innerHTML = descriptionHoldHtml(
      `<p class="gmt-widget-hint" data-role="preset-description">One.</p>`,
      ["One.", "A longer description.", "A longer description."],
    );
    const hold = root.querySelector(".gmt-ledger-hold")!;
    expect(
      hold.querySelectorAll("[data-role='preset-description']"),
    ).toHaveLength(1);
    const sizers = [...hold.querySelectorAll(".gmt-edi-sizer")];
    expect(sizers.map((s) => s.textContent)).toEqual([
      "One.",
      "A longer description.",
    ]);
    expect(sizers.every((s) => s.getAttribute("aria-hidden") === "true")).toBe(
      true,
    );
  });
});
