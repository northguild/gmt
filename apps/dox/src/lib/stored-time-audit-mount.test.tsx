/**
 * @vitest-environment jsdom
 *
 * The Stored Time Audit end to end: template, mount, interact, assert, against
 * the real `@northguild/gmt`, through roles and accessible names the way a
 * person meets the page. Every preset's rows (kind and readings) and the words
 * on the lanes are literal values read from a run of the built library (the
 * rows of `classifyStoredZoned.test.ts`), with no host-specific branch, so a
 * drift in the library or the widget fails here under every CI Node. Where a
 * mark sits on a lane is for the browser gates, not for these tests.
 */
import { screen, within } from "@testing-library/dom";
import {
  WIDGET_REGISTRY,
  type AnyWidgetEntry,
} from "~/components/ask/widget-registry";
import { installJsdomShims } from "~/test/jsdom-shims";
import { spyOnResizeObservers } from "~/test/resize-observer-spy";
import {
  cellsInColumn,
  expectNoAxeViolations,
  renderWidget,
  type RenderedWidget,
} from "~/test/render-widget";
import {
  AUDIT_PRESETS,
  kindLabel,
  NOT_STORED_TEXT,
  VALID_REASON_TEXT,
} from "./stored-time-audit";
import { LINE_NO_SIGNAL } from "./stored-time-audit-mount";
import { loadStoredTimeLib } from "./stored-time-lib";
import { NO_RESULT_TITLE } from "./edi-widgets";
import { SITE_BASE } from "./site";
import { encodeWidgetPermalink, seedFromLocation } from "./widget-permalink";

installJsdomShims();

const entry = WIDGET_REGISTRY["showStoredTimeAudit"] as AnyWidgetEntry;

const open = (args: Record<string, unknown> = {}): Promise<RenderedWidget> =>
  renderWidget(entry, { args });

const TABLE = "Each pasted line, its kind and its readings";

const preset = () => screen.getByRole("combobox", { name: "Preset" });
const box = () => screen.getByRole("textbox", { name: "Stored strings" });
const table = () => screen.getByRole("table", { name: TABLE });
const rows = () => screen.getAllByRole("row").slice(1);
const radio = (n: number) =>
  screen.getByRole("radio", { name: `Draw line ${n}` });
const clockLane = () =>
  screen.getByRole("group", { name: "On the zone's clock" });
const exactLane = () =>
  screen.getByRole("group", { name: "On the exact timeline, in UTC" });
const callFrame = () => screen.getByRole("group", { name: "Call made" });
const output = () => screen.getByLabelText("What classifyStoredZoned returned");
const links = () =>
  screen.getByRole("group", { name: "Open this line in another tool" });
const legend = () => screen.getByRole("list", { name: "Legend" });

/** The legend items a reader hears: a hidden one holds its place and is not announced. */
function expectLegend(texts: readonly string[]) {
  const items = within(legend()).queryAllByRole("listitem");
  expect(items).toHaveLength(texts.length);
  texts.forEach((text, i) => expect(items[i]).toHaveTextContent(text));
}

const KIND_IDS = [
  "valid",
  "validInOverlap",
  "offsetMismatch",
  "ambiguous",
  "nonexistent",
] as const;

const exact = (text: string) =>
  new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`);

/** The checked line's number, or `null` when none is. */
const selectedLine = (): number | null => {
  const on = screen
    .queryAllByRole("radio")
    .findIndex((r) => (r as HTMLInputElement).checked);
  return on < 0 ? null : on + 1;
};

const frames = () => new Promise<void>((resolve) => setTimeout(resolve, 40));

async function paste(w: RenderedWidget, value: string) {
  await w.user.clear(box());
  if (value !== "") await w.user.click(box());
  if (value !== "") await w.user.paste(value);
  await frames();
}

const readKinds = (): string[] =>
  cellsInColumn(table(), "Kind").map((cell) =>
    within(cell).queryByText(LINE_NO_SIGNAL)
      ? "null"
      : (KIND_IDS.find((id) => within(cell).queryByText(kindLabel(id))) ?? "?"),
  );

const tokensOf = (n: number): HTMLElement[] =>
  within(rows()[n - 1]!).queryAllByRole("listitem");

async function choose(w: RenderedWidget, id: string) {
  await w.user.selectOptions(preset(), id);
}

async function select(w: RenderedWidget, n: number) {
  await w.user.click(radio(n));
}

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
 * What each line's strip says, as words: whether the band is drawn and the two
 * lane texts, in reading order. A valid or unreadable line draws no strip (null).
 */
type Strip = null | {
  band?: string;
  clock: string;
  exact: string;
};
const STRIPS: readonly (readonly [string, number, Strip])[] = [
  [
    "istanbul-2016",
    1,
    {
      band: "overlap",
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
      band: "overlap",
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
      band: "gap",
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
      clock: "Zone offset since 2016-03-27: +03:00Stored offset: +02:00",
      exact:
        "+02:00 \u2192 +03:00 2016-03-27atStoredOffset 10-30 01:30ZatZoneOffset 10-30 00:30Z",
    },
  ],
  [
    "istanbul-2016",
    5,
    {
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
      band: "gap",
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
      clock: "Zone offset since 2018-06-17: +01:00Stored offset: +00:00",
      exact:
        "+00:00 \u2192 +01:00 2018-06-17atStoredOffset 10-28 02:30ZatZoneOffset 10-28 01:30Z",
    },
  ],
  [
    "casablanca-2018",
    3,
    {
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
      band: "overlap",
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
      band: "overlap",
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
      band: "gap",
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
      band: "overlap",
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
      band: "overlap",
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
      clock: "Zone offset since 2019-02-16: -03:00Stored offset: -02:00",
      exact:
        "-02:00 \u2192 -03:00 2019-02-17atStoredOffset 01-15 14:00ZatZoneOffset 01-15 15:00Z",
    },
  ],
  [
    "kept-offset",
    1,
    {
      band: "gap",
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
      band: "gap",
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
      band: "gap",
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
      band: "overlap",
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
      band: "overlap",
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
      band: "overlap",
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
      clock: "Zone offset since 2022-03-27: +01:00Stored offset: +00:00",
      exact:
        "+00:00 \u2192 +01:00 2022-03-27atStoredOffset 07-08 00:14ZatZoneOffset 07-07 23:14Z",
    },
  ],
  [
    "z-and-zero",
    3,
    {
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

/** The since strip's transition for each preset whose selected line draws one. */
const SINCE: Record<string, string> = {
  "istanbul-2016": "2016-03-27T01:00:00Z",
  "casablanca-2018": "2018-06-17T02:00:00Z",
  "sao-paulo-2019": "2019-02-17T02:00:00Z",
  "z-and-zero": "2022-03-27T01:00:00Z",
};

const ISTANBUL = AUDIT_PRESETS[0]!;
const LA_OFF = "2026-07-08T00:14:07+00:00[Europe/London]";
const LA_OK = "2026-07-08T00:14:07+01:00[Europe/London]";

describe("the template", () => {
  it("names its controls, seeds the first preset and says whose rules it reads with", async () => {
    const w = await open();
    expect(box()).toHaveAttribute("spellcheck", "false");
    expect(box()).toHaveValue(ISTANBUL.lines.join("\n"));
    expect(preset()).toHaveValue("istanbul-2016");
    expect(
      screen.getByText(/Read with this browser's time zone rules/),
    ).toBeVisible();
    expect(screen.queryByText(/Vancouver/)).not.toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Stored Time Audit" }),
    ).toBeInTheDocument();
    await expectNoAxeViolations(w.root);
  });

  it("describes the textarea by its cap hint", async () => {
    await open();
    expect(box()).toHaveAccessibleDescription(
      /at most 12 lines of 80 characters/,
    );
  });

  it("seeds any args it is given, and calls them custom", async () => {
    await open({ values: "x\ny" });
    expect(box()).toHaveValue("x\ny");
    expect(preset()).toHaveValue("custom");
  });
});

describe("every preset shows the library's own answer", () => {
  it.each(AUDIT_PRESETS.map((p) => [p.id]))("%s", async (id) => {
    const w = await open();
    await choose(w, id!);
    const p = AUDIT_PRESETS.find((x) => x.id === id)!;
    expect(readKinds()).toEqual(KINDS[id!]);
    expect(selectedLine()).toBe(p.selected);
    expect(preset()).toHaveValue(id);
    // The printed call is the call made, and its copy text is plain.
    expect(callFrame()).toHaveTextContent(
      `classifyStoredZoned("${p.lines[p.selected - 1]}")`,
    );
    await w.user.click(
      within(callFrame()).getByRole("button", { name: "Copy call" }),
    );
    expect(await navigator.clipboard.readText()).toMatch(
      /^classifyStoredZoned\(/,
    );
    if (SINCE[id!]) {
      expect(callFrame()).toHaveTextContent("getDstTransitions(");
      expect(output()).toHaveTextContent(SINCE[id!]!);
      expect(clockLane()).toHaveTextContent(
        /Zone offset since \d{4}-\d{2}-\d{2}: [+-]\d{2}:\d{2}/,
      );
      expect(clockLane()).toHaveTextContent(/Stored offset: /);
      expect(
        within(exactLane()).getByRole("img", { name: "Time not drawn" }),
      ).toBeInTheDocument();
    }
    expect(w.root).not.toHaveTextContent(/NaN|undefined/);
    await expectNoAxeViolations(w.root);
  });

  it("reads the Istanbul rows' readings as the library returns them", async () => {
    await open();
    expect(tokensOf(5)).toHaveLength(3);
    [
      "storedOffset +02:00 → zoneOffset +03:00",
      "atStoredOffset 2016-12-01T07:00:00Z",
      "atZoneOffset 2016-12-01T06:00:00Z",
    ].forEach((t, i) => expect(tokensOf(5)[i]).toHaveTextContent(exact(t)));
    expect(tokensOf(6)).toHaveLength(2);
    expect(tokensOf(6)[0]).toHaveTextContent("instant 2016-12-01T06:00:00Z");
    expect(tokensOf(1)[0]).toHaveTextContent(/^instant 2015-11-08T/);
    expect(within(rows()[4]!).getByText("Offset mismatch")).toBeVisible();
  });

  it("reads the Los Angeles gap's readings, and draws a skipped hour", async () => {
    const w = await open();
    await choose(w, "kept-offset");
    await select(w, 3);
    [
      "earlier 2026-03-08T09:30:00Z",
      "later 2026-03-08T10:30:00Z",
      "atStoredOffset 2026-03-08T05:30:00Z",
    ].forEach((t, i) => expect(tokensOf(3)[i]).toHaveTextContent(exact(t)));
    expect(clockLane()).toHaveTextContent(/skipped 1 hour/);
    expect(
      within(clockLane()).getByRole("img", { name: /on the zone's day$/ }),
    ).toBeInTheDocument();
    expect(within(exactLane()).getByText(/→/)).toBeVisible();
    expect(output()).toHaveTextContent('"kind":"nonexistent"');
    await expectNoAxeViolations(w.root);
  });

  it("draws an overlap as a repeated hour", async () => {
    const w = await open();
    await choose(w, "kept-offset");
    await select(w, 5);
    expect(clockLane()).toHaveTextContent(/repeated 1 hour/);
    expect(
      within(clockLane()).getByRole("img", { name: /^repeated 1 hour/ }),
    ).toBeInTheDocument();
  });

  it("opens the Sao Paulo strip from the year before, in two printed calls", async () => {
    const w = await open();
    await choose(w, "sao-paulo-2019");
    expect(callFrame()).toHaveTextContent(
      'getDstTransitions("America/Sao_Paulo", 2020)',
    );
    expect(callFrame()).toHaveTextContent(
      'getDstTransitions("America/Sao_Paulo", 2019)',
    );
  });
});

describe("the default selected line", () => {
  it("opens on the preset's line", async () => {
    await open();
    expect(selectedLine()).toBe(5);
  });

  it("goes back to the first line that is not valid when the reader changes the text", async () => {
    const w = await open();
    expect(selectedLine()).toBe(5);
    // Eight new lines: seven valid, then one an hour off. The old 5 is in
    // range, but it names a valid line of the new text.
    await paste(w, [...Array(7).fill(LA_OK), LA_OFF].join("\n"));
    expect(selectedLine()).toBe(8);
    expect(clockLane()).not.toHaveTextContent(/^On the zone's clock$/);
    await expectNoAxeViolations(w.root);
  });

  it("does not keep the old number across a cleared box", async () => {
    const w = await open();
    await paste(w, "");
    expect(selectedLine()).toBeNull();
    await paste(w, [LA_OFF, LA_OFF].join("\n"));
    expect(selectedLine()).toBe(1);
  });

  it("keeps a preset's line over the reader's click, and a permalink's line", async () => {
    const w = await open();
    await select(w, 2);
    expect(selectedLine()).toBe(2);
    await choose(w, "sao-paulo-2019");
    expect(selectedLine()).toBe(5);
    w.destroy();

    await open({ values: ISTANBUL.lines.join("\n"), line: "3" });
    expect(selectedLine()).toBe(3);
    expect(callFrame()).toHaveTextContent("2016-03-27T03:30:00");
  });

  it("is the first line that is neither valid nor not-a-time for pasted text", async () => {
    await open({
      values:
        "2016-12-01T09:00:00+03:00[Europe/Istanbul]\nnope\n2016-12-01T09:00:00+02:00[Europe/Istanbul]",
    });
    expect(selectedLine()).toBe(3);
  });

  it("is line 1 when every line is valid or not a time", async () => {
    await open({ values: "nope" });
    expect(selectedLine()).toBe(1);
  });
});

describe("the line radios", () => {
  it("name each radio for its row, keep the number visible and move with the arrow keys", async () => {
    const w = await open();
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(ISTANBUL.lines.length);
    radios.forEach((r, i) => {
      expect(r).toHaveAccessibleName(`Draw line ${i + 1}`);
      expect(within(rows()[i]!).getByText(String(i + 1))).toBeVisible();
    });
    radio(5).focus();
    await w.user.keyboard("{ArrowDown}");
    expect(selectedLine()).toBe(6);
    expect(radio(6)).toHaveFocus();
    await expectNoAxeViolations(w.root);
  });

  it("keeps the focus on the radio when a line is picked", async () => {
    const w = await open();
    await select(w, 2);
    expect(radio(2)).toHaveFocus();
    expect(radio(2)).toBeChecked();
  });
});

describe("the sentinel", () => {
  it("shows NO SIGNAL on every line of the sentinel preset, with its reason", async () => {
    const w = await open();
    await choose(w, "not-stored-times");
    expect(within(table()).getAllByText(LINE_NO_SIGNAL)).toHaveLength(6);
    expect(within(table()).getAllByText(NOT_STORED_TEXT)).toHaveLength(6);
    expect(
      screen.getByRole("complementary", { name: NO_RESULT_TITLE }),
    ).toHaveTextContent(NOT_STORED_TEXT);
    expect(output()).toHaveTextContent(/^NO SIGNAL$/);
    await expectNoAxeViolations(w.root);
  });

  it("announces through the one output, not a live region per row", async () => {
    const w = await open();
    await choose(w, "not-stored-times");
    expect(within(table()).queryAllByRole("status")).toHaveLength(0);
    expect(within(table()).queryAllByRole("alert")).toHaveLength(0);
  });

  it("can select a line that is not a stored time, and its tool link has nowhere to go", async () => {
    const w = await open();
    await choose(w, "not-stored-times");
    await select(w, 4);
    expect(selectedLine()).toBe(4);
    const link = within(links()).getByText(/This zone's clock changes/);
    expect(link).toHaveAttribute("aria-disabled", "true");
    expect(link).not.toHaveAttribute("href");
  });

  it("keeps an empty answer apart from NO SIGNAL (a valid line)", async () => {
    const w = await open();
    await select(w, 6);
    expect(screen.getByText(VALID_REASON_TEXT)).toBeVisible();
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    expect(output()).not.toHaveTextContent("NO SIGNAL");
    await expectNoAxeViolations(w.root);
  });

  it("reads a pasted line that is not a stored time as text, never as markup", async () => {
    const w = await open();
    await paste(
      w,
      "garbage ⟨ ⟩ <b>x</b>\n2016-12-01T09:00:00+02:00[Europe/Istanbul]",
    );
    expect(readKinds()).toEqual(["null", "offsetMismatch"]);
    expect(within(table()).getByText("garbage ⟨ ⟩ <b>x</b>")).toBeVisible();
    expect(within(table()).queryByText("x")).not.toBeInTheDocument();
    expect(selectedLine()).toBe(2);
  });

  it("says so when the box is empty", async () => {
    const w = await open();
    await paste(w, "  \n \n");
    expect(
      within(table()).getByText("Paste a stored time above: one line each."),
    ).toBeVisible();
    expect(output()).toHaveTextContent("Not read: there is no line.");
    expect(preset()).toHaveValue("custom");
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
    await expectNoAxeViolations(w.root);
  });
});

describe("the caps", () => {
  it("reads twelve lines and says how many it left out", async () => {
    const w = await open();
    await paste(w, Array(15).fill(LA_OK).join("\n"));
    expect(screen.getAllByRole("radio")).toHaveLength(12);
    expect(
      screen.getByText(/3 more lines not read, after the first 12/),
    ).toBeVisible();
  });
});

describe("the DST Inspector link", () => {
  it("is seeded with the line's zone and wall year", async () => {
    await open();
    const link = within(links()).getByRole("link", {
      name: "This zone's clock changes in 2016",
    });
    const href = link.getAttribute("href")!;
    expect(href.startsWith(`${SITE_BASE}/tools/dst-inspector/?w=dst&wa=`)).toBe(
      true,
    );
    expect(seedFromLocation("dst", href.slice(href.indexOf("?")))).toEqual({
      zone: "Europe/Istanbul",
      year: 2016,
    });
  });
});

describe("permalinks", () => {
  it.each(AUDIT_PRESETS.map((p) => [p.id]))(
    "round-trips %s, newlines included",
    async (id) => {
      const first = await open();
      await choose(first, id!);
      const p = AUDIT_PRESETS.find((x) => x.id === id)!;
      const url = first.permalink();
      expect(url).toMatch(
        new RegExp(
          `^${SITE_BASE}/tools/stored-time-audit/\\?w=storedaudit&wa=`,
        ),
      );
      const state = { values: p.lines.join("\n"), line: String(p.selected) };
      expect(url).toBe(encodeWidgetPermalink("storedaudit", state));
      const seeded = seedFromLocation(
        "storedaudit",
        url.slice(url.indexOf("?")),
      );
      expect(seeded).toEqual(state);
      first.destroy();

      await open(seeded as Record<string, unknown>);
      expect(readKinds()).toEqual(KINDS[id!]);
      expect(selectedLine()).toBe(p.selected);
      expect(preset()).toHaveValue(id);
    },
  );

  it("carries the reader's own lines and selection", async () => {
    const w = await open();
    const values =
      "2016-12-01T09:00:00+02:00[Europe/Istanbul]\n2016-12-01T09:00:00+03:00[Europe/Istanbul]";
    await paste(w, values);
    await select(w, 2);
    const url = w.permalink();
    expect(
      seedFromLocation("storedaudit", url.slice(url.indexOf("?"))),
    ).toEqual({ values, line: "2" });
  });
});

describe("what the figure announces", () => {
  it("names the figure in one sentence", async () => {
    await open();
    expect(
      screen.getByRole("group", {
        name: /The zone was at \+03:00 at this time; the stored \+02:00 is no offset it has\./,
      }),
    ).toBeInTheDocument();
  });

  it("lists only the legend items that apply, and keeps the rest out of the reading order", async () => {
    const w = await open();
    expectLegend(
      ["a reading", "clock change", "time not drawn"].sort(
        (a, b) =>
          [
            "skipped hour",
            "repeated hour",
            "clock change",
            "a reading",
            "time not drawn",
          ].indexOf(a) -
          [
            "skipped hour",
            "repeated hour",
            "clock change",
            "a reading",
            "time not drawn",
          ].indexOf(b),
      ),
    );
    await choose(w, "kept-offset");
    expectLegend(["skipped hour", "clock change", "a reading"]);
    await select(w, 5);
    expectLegend(["repeated hour", "clock change", "a reading"]);
    await choose(w, "not-stored-times");
    expectLegend([]);
    expect(
      within(legend()).getAllByRole("listitem", { hidden: true }),
    ).toHaveLength(5);
  });
});

describe("lifecycle", () => {
  it("releases its width observer on destroy", async () => {
    const spy = spyOnResizeObservers();
    const w = await open();
    expect(spy.live.size).toBeGreaterThan(0);
    w.destroy();
    expect(spy.live.size).toBe(0);
    spy.restore();
  });

  it("mounts nothing when aborted before the library loads", async () => {
    const w = await renderWidget(entry, { args: {}, aborted: true });
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
    expect(() => w.destroy()).not.toThrow();
  });
});

describe("the library under the strips", () => {
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

describe("every line of every preset", () => {
  it("is in the tables, once", () => {
    const lines = AUDIT_PRESETS.flatMap((p) =>
      p.lines.map((_, i) => `${p.id}:${i + 1}`),
    );
    expect(READINGS.map(([p, n]) => `${p}:${n}`)).toEqual(lines);
    expect(STRIPS.map(([p, n]) => `${p}:${n}`)).toEqual(lines);
  });

  it.each(READINGS)(
    "%s line %i reads as %s",
    async (id, line, kind, tokens) => {
      const w = await open();
      await choose(w, id);
      expect(readKinds()[line - 1]).toBe(kind);
      const items = tokensOf(line);
      expect(items).toHaveLength(tokens.length);
      tokens.forEach((t, i) => expect(items[i]).toHaveTextContent(exact(t)));
      w.destroy();
    },
  );

  it.each(STRIPS)("%s line %i draws its strip", async (id, line, strip) => {
    const w = await open();
    await choose(w, id);
    await select(w, line);
    if (strip === null) {
      expect(clockLane()).toHaveTextContent(exact("On the zone's clock"));
      expect(exactLane()).toHaveTextContent(
        exact("On the exact timeline, in UTC"),
      );
      expect(within(clockLane()).queryAllByRole("img")).toHaveLength(0);
      return;
    }
    expect(clockLane()).toHaveTextContent(
      exact(`On the zone's clock${strip.clock}`),
    );
    expect(exactLane()).toHaveTextContent(
      exact(`On the exact timeline, in UTC${strip.exact}`),
    );
    if (strip.band) {
      expect(
        within(clockLane()).getByRole("img", { name: /on the zone's day$/ }),
      ).toBeInTheDocument();
    } else {
      expect(
        within(clockLane()).queryByRole("img", { name: /on the zone's day$/ }),
      ).not.toBeInTheDocument();
    }
  });
});
