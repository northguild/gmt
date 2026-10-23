/**
 * Each shared clock-change module, built from a second config that is not Canada's. The point of
 * the shared parts is that nothing in them knows which checker uses them, so a made-up checker
 * with the id prefix `x` must produce markup with no trace of Canada.
 */
import { plainText } from "./clock-change-tense";
import { moroccoTense } from "./clock-change-tense.fixture";
import { describe, expect, it } from "vitest";
import { clocksHtml } from "./clock-change-clocks";
import { helpCardHtml, helpMarkdown, helpText } from "./clock-change-help";
import {
  browserCardHtml,
  probeInlineSource,
  serversCardHtml,
  verdictHtml,
  type ProbeConfig,
  type VerdictText,
} from "./clock-change-probe";
import { storedSectionHtml, type StoredConfig } from "./clock-change-stored";
import {
  classWords,
  classCounts,
  displayKind,
  releaseWords,
  renderPinPanelHtml,
  zoneListItemHtml,
  type MapZone,
  type ZoneMapConfig,
} from "./zone-map";
import type { HelpCard } from "../data/clock-change-text";

const NOT_CANADA = /canada/i;

const PROBE: ProbeConfig = {
  idPrefix: "x",
  zones: [
    { zone: "Africa/Casablanca", expected: { verdict: "+01:00" } },
    { zone: "Africa/El_Aaiun", expected: { verdict: "+01:00" } },
  ],
  instants: [
    { iso: "2026-06-01T12:00:00Z", epochMs: 1780315200000, role: "verdict" },
  ],
};

const TEXT: VerdictText = {
  title: "Your browser",
  correctNote: "tzdb A",
  yoursNote: "1 Jun",
  checking: "Checking&hellip;",
  right: "Right.",
  wrongBefore: "Old data for ",
  wrongAfter: ".",
  more: ["Update it."],
  unknown: "Cannot read.",
};

describe("clock-change-probe with a second config", () => {
  it("finds its card by the config's id and names nothing else", () => {
    const html = browserCardHtml(PROBE, TEXT);
    expect(html).toContain('id="x-browser"');
    expect(html).toContain("Casablanca");
    expect(html).not.toMatch(NOT_CANADA);
    expect(verdictHtml(["Casablanca"], TEXT)).not.toMatch(NOT_CANADA);
  });

  it("gives the verdict row and the blind row each its own instant's correct offset", () => {
    // A made-up region whose blind instant is in summer time and whose verdict instant is not.
    const config: ProbeConfig = {
      idPrefix: "x",
      zones: [
        {
          zone: "Europe/Lisbon",
          expected: { verdict: "+00:00", blind: "+01:00" },
        },
      ],
      instants: [
        {
          iso: "2026-12-01T12:00:00Z",
          epochMs: 1796126400000,
          role: "verdict",
        },
        { iso: "2026-07-01T12:00:00Z", epochMs: 1782907200000, role: "blind" },
      ],
    };
    const html = browserCardHtml(config, { ...TEXT, blindNote: "Shown only." });
    const cell = (row: string): string =>
      new RegExp(
        `<tr role="row" ${row}[^>]*>.*?data-label="Correct" class="gmt-clockcheck-num">([^<]*)</td>`,
      ).exec(html)![1]!;
    expect(cell('data-zone="Europe/Lisbon"')).toBe("+00:00");
    expect(cell('data-blind-zone="Europe/Lisbon"')).toBe("+01:00");
  });

  it("refuses a blind instant that has no expected offset", () => {
    const config: ProbeConfig = {
      ...PROBE,
      instants: [
        ...PROBE.instants,
        { iso: "2026-07-01T12:00:00Z", epochMs: 1782907200000, role: "blind" },
      ],
    };
    expect(() => browserCardHtml(config, TEXT)).toThrow(/no expected offset/);
  });

  it("builds the inline script for that card", () => {
    const source = probeInlineSource(PROBE);
    expect(source).toContain('"x-browser"');
    expect(source).not.toMatch(NOT_CANADA);
  });

  it("renders the servers card under the config's prefix", () => {
    const html = serversCardHtml({
      idPrefix: "x",
      command: "node -e 1",
      expected: [["Casablanca", "+01:00"]],
      line: "Run this.",
    });
    expect(html).toContain('aria-labelledby="x-servers-title"');
    expect(html).not.toMatch(NOT_CANADA);
  });
});

describe("clock-change-clocks with a second config", () => {
  it("lists the zones it is given, each with a NO SIGNAL readout", () => {
    const html = clocksHtml(
      ["Africa/Casablanca"],
      new Set(["Africa/Casablanca"]),
    );
    expect(html).toContain('data-zone="Africa/Casablanca"');
    expect(html).toContain("NO SIGNAL");
    expect(html).not.toMatch(NOT_CANADA);
  });
});

const STORED: StoredConfig = {
  idPrefix: "x",
  endpoint: "/api/x-check",
  zones: ["Africa/Casablanca"],
  preset: "2026-06-01T09:00:00+01:00[Africa/Casablanca]",
  example: {
    city: "Casablanca",
    wallHm: "09:00",
    dateText: "1 Jun",
    savedOffset: "+00:00",
    newOffset: "+01:00",
    shownHm: "10:00",
    saved: "2026-06-01T09:00:00+00:00[Africa/Casablanca]",
  },
};

describe("clock-change-stored with a second config", () => {
  it("namespaces its ids and carries its own example", () => {
    const html = storedSectionHtml(STORED);
    expect(html).toContain("x-stored-title");
    expect(html).toContain("Casablanca");
    expect(html).not.toMatch(NOT_CANADA);
  });
});

const HELP: HelpCard = {
  lede: ["gmt reads it."],
  verified: ["Tested."],
  intro: "Two cases.",
  cases: [{ tag: "Case", input: "in", output: "out", why: ["Because."] }],
  cta: { lead: "Check yours.", link: "Go", href: "#x-stored-title" },
};

describe("clock-change-help with a second config", () => {
  it("renders, and words, a card that is not Canada's", () => {
    expect(helpCardHtml("x", HELP)).toContain('aria-labelledby="x-help-title"');
    expect(helpCardHtml("x", HELP)).not.toMatch(NOT_CANADA);
    expect(helpMarkdown(HELP)).not.toMatch(NOT_CANADA);
    expect(helpText(HELP)).not.toMatch(NOT_CANADA);
  });
});

const MAP: ZoneMapConfig = {
  idPrefix: "x",
  height: 400,
  boundariesUrl: "/timezone-boundaries-x.json",
  projection: () => {
    throw new Error("not drawn here");
  },
  stopped: new Set(["Africa/Casablanca"]),
  classText: (kind) =>
    plainText(
      { stopped: "Stops", "changes-after": "Changes", none: "Never" }[kind],
    ),
  releaseOf: (id) => (id === "Africa/Casablanca" ? "9z" : null),
  releaseRange: "9a to 9z",
  mapLabel: "Map of x.",
  labelled: [],
  anchors: {},
  creditsCorner: "corner",
};

const ROW = (zone: string, kind: MapZone["kind"]): MapZone => ({
  zone,
  offset: "+01:00",
  last: null,
  next: null,
  kind,
});

describe("zone-map with a second config", () => {
  it("classes by the config's facts and words", () => {
    expect(
      displayKind(
        MAP,
        "Africa/Casablanca",
        ROW("Africa/Casablanca", "changes-after"),
      ),
    ).toBe("stopped");
    expect(classWords(MAP, "Africa/Casablanca", undefined, moroccoTense)).toBe(
      "Stops",
    );
    expect(releaseWords(MAP, "Africa/Casablanca")).toBe("tzdb 9z");
    expect(releaseWords(MAP, "Africa/El_Aaiun")).toContain("9a to 9z");
    const rows = new Map([["Africa/El_Aaiun", ROW("Africa/El_Aaiun", "none")]]);
    expect(
      classCounts(MAP, ["Africa/Casablanca", "Africa/El_Aaiun"], rows),
    ).toEqual({
      stopped: 1,
      "changes-after": 0,
      none: 1,
    });
  });

  it("renders the pin panel and list items with no trace of Canada", () => {
    expect(renderPinPanelHtml()).not.toMatch(NOT_CANADA);
    expect(zoneListItemHtml("Africa/Casablanca")).not.toMatch(NOT_CANADA);
  });
});
