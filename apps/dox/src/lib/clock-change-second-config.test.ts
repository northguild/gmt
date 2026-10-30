// @vitest-environment jsdom
/**
 * Each shared clock-change module, built from a second config that is not Canada's. The point of
 * the shared parts is that nothing in them knows which checker uses them, so a made-up checker
 * with the id prefix `x` must produce a page with no trace of Canada.
 */
import { screen, within } from "@testing-library/dom";
import { describe, expect, it } from "vitest";
import { installJsdomShims } from "~/test/jsdom-shims";
import { expectNoAxeViolations } from "~/test/render-widget";
import { html } from "~/widgets/builders/html";
import { section, widget } from "~/widgets/builders/layout";
import { clocks } from "~/widgets/families/clockcheck/clocks";
import { helpCard } from "~/widgets/families/clockcheck/help-card";
import { serversCard } from "~/widgets/families/clockcheck/info-card";
import { probeCard } from "~/widgets/families/clockcheck/probe-card";
import { storedSection } from "~/widgets/families/clockcheck/stored-section";
import { zoneMap } from "~/widgets/families/clockcheck/zone-map";
import { renderHtml } from "~/widgets/test-fixture";
import { plainText } from "./clock-change-tense";
import { moroccoTense } from "./clock-change-tense.fixture";
import { helpMarkdown } from "./clock-change-help";
import {
  probeInlineSource,
  type ProbeConfig,
  type VerdictText,
} from "./clock-change-probe";
import type { StoredConfig } from "./clock-change-stored";
import {
  classWords,
  classCounts,
  displayKind,
  releaseWords,
  type MapZone,
  type ZoneMapConfig,
} from "./zone-map";
import type { HelpCard } from "../data/clock-change-text";

installJsdomShims();

/** The made-up checker's page: a card in a widget scoped `x`. */
const inPage = (card: ReturnType<typeof html>) =>
  renderHtml(widget({ name: "x", label: "Checker x", scope: "x" }, card));

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
  it("names its places and nothing else", async () => {
    const page = inPage(probeCard(PROBE, TEXT));
    const card = within(page.host).getByRole("region", {
      name: "Your browser",
    });
    expect(card).toHaveTextContent("Casablanca");
    expect(page.host).not.toHaveTextContent(NOT_CANADA);
    await expectNoAxeViolations(page.host);
  });

  it("builds the inline script for that card", () => {
    expect(probeInlineSource(PROBE)).not.toMatch(NOT_CANADA);
  });

  it("renders the servers card under the config's prefix", async () => {
    const page = inPage(
      serversCard({
        idPrefix: "x",
        command: "node -e 1",
        expected: [["Casablanca", "+01:00"]],
        line: "Run this.",
      }),
    );
    expect(
      within(page.host).getByRole("region", { name: "Test your own servers" }),
    ).toBeInTheDocument();
    expect(page.host).not.toHaveTextContent(NOT_CANADA);
    await expectNoAxeViolations(page.host);
  });
});

describe("clock-change-clocks with a second config", () => {
  it("lists the zones it is given, each with a NO SIGNAL readout", () => {
    const page = inPage(
      clocks({
        idPrefix: "x",
        zones: ["Africa/Casablanca"],
        stopped: new Set(["Africa/Casablanca"]),
      }),
    );
    const [item] = within(page.host).getAllByRole("listitem");
    expect(item).toHaveTextContent("Africa/Casablanca");
    expect(within(item!).getByText("NO SIGNAL")).toBeVisible();
    expect(page.host).not.toHaveTextContent(NOT_CANADA);
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
  it("carries its own example and names nothing else", async () => {
    const page = inPage(storedSection(STORED));
    expect(
      within(page.host).getByRole("region", {
        name: "Did your saved events move?",
      }),
    ).toHaveTextContent("Casablanca");
    expect(page.host).not.toHaveTextContent(NOT_CANADA);
    await expectNoAxeViolations(page.host);
  });
});

const HELP: HelpCard = {
  lede: ["gmt reads it."],
  verified: ["Tested."],
  intro: "Two cases.",
  cases: [{ tag: "Case", input: "in", output: "out", why: ["Because."] }],
  cta: { lead: "Check yours.", link: "Go", href: "#x-stored-heading" },
};

describe("clock-change-help with a second config", () => {
  it("renders, and words, a card that is not Canada's", async () => {
    const page = inPage(helpCard("x", HELP));
    expect(
      within(page.host).getByRole("region", { name: "How gmt helps" }),
    ).toBeInTheDocument();
    expect(within(page.host).getByRole("link", { name: "Go" })).toHaveAttribute(
      "href",
      "#x-stored-heading",
    );
    expect(page.host).not.toHaveTextContent(NOT_CANADA);
    expect(helpMarkdown(HELP)).not.toMatch(NOT_CANADA);
    await expectNoAxeViolations(page.host);
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

  it("renders the pin panel and list with no trace of Canada", async () => {
    const page = inPage(
      zoneMap({
        idPrefix: "x",
        zones: ["Africa/Casablanca"],
        listLabel: "x time zones, scrollable list",
        mapHeight: 400,
        legend: html``,
        clocks: section(
          { id: "x-clocks", heading: "Live clocks", level: 4 },
          html`<p>Clocks.</p>`,
        ),
      }),
    );
    expect(
      within(page.host).getByRole("button", { name: /Africa\/Casablanca/ }),
    ).toBeInTheDocument();
    expect(screen.getByText("Local time")).toBeInTheDocument();
    expect(page.host).not.toHaveTextContent(NOT_CANADA);
    await expectNoAxeViolations(page.host);
  });
});
