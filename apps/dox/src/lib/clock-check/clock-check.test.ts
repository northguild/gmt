// @vitest-environment jsdom
import { convertUtcToUnix } from "@northguild/gmt/utc/convert";
import {
  CHECK_RATE_LIMIT,
  changeText,
  cityOf,
  offsetFromIntl,
  probeEpochMs,
  signedOffset,
  type ClockCheckFacts,
  type ProbeFact,
} from "./facts";
import { savedExample } from "./saved-example";
import { helpMarkdown, keyPointsMarkdown } from "./key-points";
import { minimumsMarkdown } from "./minimums";
import {
  browserCardHtml,
  changesSectionHtml,
  clocksSectionHtml,
  checkShellHtml,
  keyPointsHtml,
  placesHtml,
  probeInlineSource,
  serversCardHtml,
  serversMarkdownOf,
  storedSectionHtml,
  verdictHtml,
  type CheckPage,
} from "./template";
import {
  fillBrowserColumn,
  msToNextMinute,
  msToNextSecond,
  readBrowserOffset,
  storedSummaryText,
} from "./mount";

const TABLE: ProbeFact[] = [
  {
    zone: "America/Vancouver",
    offset: "-07:00",
    oldOffset: "-08:00",
    release: "2026b",
  },
  {
    zone: "America/Winnipeg",
    offset: "-05:00",
    oldOffset: "-06:00",
    release: "2026e",
  },
];
const FACTS: ClockCheckFacts = {
  id: "demo",
  probeInstant: "2026-11-02T12:00:00Z",
  probe: TABLE,
  transitionYears: [2026, 2027],
  clockZones: ["America/Vancouver", "America/Toronto"],
  storedZones: ["America/Vancouver", "America/Toronto"],
};
const PAGE: CheckPage = {
  facts: FACTS,
  idPrefix: "demo",
  table: TABLE,
  probeLabel: "2 Nov 2026",
  copy: {
    verdictOk: "All fine.",
    verdictWrong: (places) => ({
      line: `Old data for ${places}.`,
      more: ["Update."],
    }),
    correctNote: "reference",
    clocksNotice: "Old rules.",
    clocksHeading: "Live clocks",
    clocksHint: "Your time.",
    changesHeading: "Changes",
    changesHint: "Hint.",
    serversTitle: "Test your servers",
    serversLine: "Run this.",
    storedLead: "Lead.",
    savedDay: "15 Nov",
  },
  keyPoints: [
    {
      heading: "Everyone",
      blocks: [{ kind: "p", parts: ["Plain ", { code: "text" }] }],
    },
  ],
  help: {
    lede: ["Lede"],
    verified: ["Verified"],
    intro: "Intro",
    cases: [],
    cta: { lead: "Lead", link: "Go", href: "#demo-stored-title" },
  },
  minimums: {
    heading: "Upgrade",
    intro: "i",
    footer: "f",
    note: "n",
    rows: [],
  },
  storedPreset: "2026-11-15T09:00:00-08:00[America/Vancouver]",
  saved: savedExample(TABLE[0]!, "2026-11-15T09:00:00"),
  transitionZones: ["America/Vancouver"],
  staleZones: () => [],
};

describe("facts", () => {
  it("derives the probe epoch from the instant, as the library does", () => {
    expect(probeEpochMs(FACTS)).toBe(convertUtcToUnix(FACTS.probeInstant));
    expect(() => probeEpochMs({ probeInstant: "nope" })).toThrow();
  });

  it("formats places, offsets and changes", () => {
    expect(cityOf("America/Los_Angeles")).toBe("Los Angeles");
    expect(signedOffset("-07:00")).toBe("−07:00");
    expect(offsetFromIntl("GMT")).toBe("+00:00");
    expect(offsetFromIntl("GMT-07:00")).toBe("-07:00");
    expect(offsetFromIntl("nonsense")).toBe("");
    expect(changeText(null, "2026 or 2027")).toBe("none in 2026 or 2027");
    expect(
      changeText(
        {
          instant: "2026-03-08T10:00:00Z",
          offsetBefore: "-08:00",
          offsetAfter: "-07:00",
        },
        "x",
      ),
    ).toBe("2026-03-08 10:00 UTC, -08:00 → -07:00");
  });

  it("limits a checker to 20 requests a minute", () => {
    expect(CHECK_RATE_LIMIT).toEqual({ max: 20, windowSeconds: 60 });
  });
});

describe("saved example", () => {
  it("reads the saved offset from the fact", () => {
    const ex = savedExample(TABLE[1]!, "2026-11-15T09:00:00");
    expect(ex.savedOffset).toBe("-06:00");
    expect(ex.newOffset).toBe("-05:00");
    expect(ex.shownHm).toBe("10:00");
    expect(ex.saved).toBe("2026-11-15T09:00:00-06:00[America/Winnipeg]");
    expect(ex.fixed).toBe("2026-11-15T09:00:00-05:00[America/Winnipeg]");
  });

  it("wraps past midnight", () => {
    const late = savedExample(TABLE[0]!, "2026-11-15T23:30:00");
    expect(late.shownHm).toBe("00:30");
  });
});

describe("renderers take their data as an argument", () => {
  it("renders the key points and the help card from the given data", () => {
    expect(keyPointsMarkdown(PAGE.keyPoints)).toContain("Everyone");
    expect(helpMarkdown(PAGE.help)).toContain("Intro");
    expect(minimumsMarkdown(PAGE.minimums)).toContain("Upgrade");
  });
});

describe("template", () => {
  it("uses neutral classes and the checker's own root", () => {
    const html = checkShellHtml(
      PAGE,
      browserCardHtml(PAGE, "t") +
        changesSectionHtml(PAGE, "c") +
        clocksSectionHtml(PAGE, "k") +
        serversCardHtml(PAGE) +
        storedSectionHtml(PAGE, "s") +
        keyPointsHtml(PAGE),
    );
    expect(html).toContain('class="gmt-check gmt-demo gmt-widget not-content"');
    expect(html).toContain("gmt-check-stack");
    expect(html).not.toContain("gmt-demo-");
    expect(html).toContain('id="demo-servers-title"');
    expect(html).toContain('id="demo-keypoints-title"');
    expect(html.match(/<tr data-zone=/g)).toHaveLength(TABLE.length);
    expect(html).toContain("reference");
  });

  it("puts the checker's example in the saved-times textarea", () => {
    expect(storedSectionHtml(PAGE, "s")).toContain(
      `>${PAGE.storedPreset}</textarea>`,
    );
  });

  it("renders the verdict from the checker's words", () => {
    expect(verdictHtml(PAGE, [])).toContain("All fine.");
    const bad = verdictHtml(PAGE, ["Vancouver", "Winnipeg"]);
    expect(bad).toContain("Old data for ");
    expect(bad).toContain("<code>Vancouver</code> and <code>Winnipeg</code>");
    expect(placesHtml(["A"])).toBe("<code>A</code>");
  });

  it("derives the inline probe from the facts", () => {
    const source = probeInlineSource(PAGE);
    expect(source).toContain(String(probeEpochMs(FACTS)));
    expect(source).toContain(".gmt-check .gmt-check-browser");
    for (const fact of TABLE) expect(source).toContain(fact.offset);
  });

  it("writes the servers card as Markdown", () => {
    const md = serversMarkdownOf(PAGE);
    expect(md).toContain("## Test your servers");
    expect(md).toContain("Expected:");
  });
});

describe("mount helpers", () => {
  it("reads the browser's offset at the probe instant", () => {
    const reading = readBrowserOffset(FACTS, "UTC");
    expect(reading).toEqual({ kind: "offset", offset: "+00:00" });
    expect(readBrowserOffset(FACTS, "Not/AZone")).toEqual({
      kind: "unknown-zone",
    });
  });

  it("fills the browser card and the verdict", () => {
    document.body.innerHTML = browserCardHtml(PAGE, "t");
    const root = document.body;
    const unread = fillBrowserColumn(PAGE, root);
    expect(unread).toBe(0);
    const verdict = root.querySelector<HTMLElement>('[data-role="verdict"]')!;
    expect(["ok", "bad"]).toContain(verdict.dataset.state);
    expect(root.querySelectorAll('[data-role="browser"]')).toHaveLength(
      TABLE.length,
    );
  });

  it("times the next tick", () => {
    expect(msToNextMinute("2026-10-22T12:00:30.000Z")).toBe(30_000);
    expect(msToNextSecond("2026-10-22T12:00:30.250Z")).toBe(750);
    expect(storedSummaryText([])).toBe("Nothing checked");
  });
});
