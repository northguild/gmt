/**
 * @vitest-environment jsdom
 *
 * The Column Timestamp Bridge end to end against the real `@northguild/gmt`, through roles and
 * accessible names the way a person (or a screen reader) meets the page. Every preset's cards
 * are literal values read once from a run of the built library, and they agree with the
 * slice's table (the † rows). A drift in the library or in the widget fails here.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { screen, within } from "@testing-library/dom";
import {
  WIDGET_REGISTRY,
  type AnyWidgetEntry,
} from "~/components/ask/widget-registry";
import { installJsdomShims } from "~/test/jsdom-shims";
import {
  expectNoAxeViolations,
  renderWidget,
  type RenderedWidget,
} from "~/test/render-widget";
import { BRIDGE_PRESETS } from "./column-timestamp-bridge-presets";
import { ZONELESS_CHIP } from "./column-timestamp-bridge";
import { NO_SIGNAL_PILL } from "./column-timestamp-bridge-mount";
import { SITE_BASE } from "./site";
import { seedFromLocation } from "./widget-permalink";

installJsdomShims();

const entry = WIDGET_REGISTRY["showColumnTimestampBridge"] as AnyWidgetEntry;

const open = (args: Record<string, unknown> = {}, idPrefix = "test") =>
  renderWidget(entry, { args, idPrefix });

const preset = () => screen.getByRole("combobox", { name: "Preset" });
const valueBox = () =>
  screen.getByRole("textbox", { name: "Instant or wall time" });
const zoneBox = () =>
  screen.getByRole("textbox", { name: "Arrow column timezone (optional)" });
const heroValue = () =>
  screen.getByRole("status", { name: "Exact instant value", hidden: true });
const ladder = () =>
  screen.getByRole("group", { name: /^Precision ladder/, hidden: true });
const output = () => screen.getByLabelText("What the calls returned");
const calls = () => screen.getByRole("group", { name: "Calls made" });
const card = (title: string) => screen.getByRole("region", { name: title });
const radio = (name: string) => screen.getByRole("radio", { name });

const LADDER_LABELS = ["exact", "INT96", "Arrow", "Timestamp"];

/** Replaces what a text box holds, in one input event. */
async function enter(w: RenderedWidget, box: HTMLElement, value: string) {
  await w.user.clear(box);
  if (value !== "") await w.user.paste(value);
}

/** A regular expression that matches exactly this text. */
const exact = (text: string) =>
  new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`);

// [state, stored-1, stored-2, read-back, literal]
type Row = [string, string, string, string, string];
interface Recorded {
  hero: [string, string];
  ladder: string[];
  cards: Record<string, Row>;
}

const TITLES: Record<string, string> = {
  int96: "Parquet INT96",
  arrow: "Arrow Timestamp",
  timestamp: "protobuf Timestamp",
  duration: "protobuf Duration",
};

/** Read once from the built library. */
const RECORDED: Record<string, Recorded> = {
  "tokyo-seconds": {
    hero: ["instant", "2024-01-01T00:00:00Z"],
    ladder: [
      "2024-01-01T00:00:00Z",
      "2024-01-01T00:00:00Z",
      "2024-01-01T00:00:00Z",
      "2024-01-01T00:00:00Z",
    ],
    cards: {
      int96: [
        "read",
        "julianDay: 2460311",
        "nanosOfDay: 0n",
        "2024-01-01T00:00:00Z",
        "",
      ],
      arrow: ["read", "1704067200n", "", "2024-01-01T00:00:00Z", ""],
      timestamp: [
        "read",
        "seconds: 1704067200n",
        "nanos: 0",
        "2024-01-01T00:00:00Z",
        "",
      ],
      duration: [
        "read",
        "seconds: 5401n",
        "nanos: 500000000",
        "PT1H30M1.5S",
        "",
      ],
    },
  },
  "sub-microsecond": {
    hero: ["instant", "2024-01-01T00:00:00.123456789Z"],
    ladder: [
      "2024-01-01T00:00:00.123456789Z",
      "2024-01-01T00:00:00.123456789Z",
      "2024-01-01T00:00:00.123456Z",
      "2024-01-01T00:00:00.123456789Z",
    ],
    cards: {
      int96: [
        "read",
        "julianDay: 2460311",
        "nanosOfDay: 123456789n",
        "2024-01-01T00:00:00.123456789Z",
        "",
      ],
      arrow: [
        "read",
        "1704067200123456n",
        "",
        "2024-01-01T00:00:00.123456Z",
        "",
      ],
      timestamp: [
        "read",
        "seconds: 1704067200n",
        "nanos: 123456789",
        "2024-01-01T00:00:00.123456789Z",
        "",
      ],
      duration: ["idle", "", "", "", ""],
    },
  },
  "before-1970": {
    hero: ["instant", "1969-12-31T23:59:59.9999999Z"],
    ladder: [
      "1969-12-31T23:59:59.9999999Z",
      "1969-12-31T23:59:59.9999999Z",
      "1969-12-31T23:59:59.999999Z",
      "1969-12-31T23:59:59.9999999Z",
    ],
    cards: {
      int96: [
        "read",
        "julianDay: 2440587",
        "nanosOfDay: 86399999999900n",
        "1969-12-31T23:59:59.9999999Z",
        "",
      ],
      arrow: ["read", "-1n", "", "1969-12-31T23:59:59.999999Z", ""],
      timestamp: [
        "read",
        "seconds: -1n",
        "nanos: 999999900",
        "1969-12-31T23:59:59.9999999Z",
        "",
      ],
      duration: ["read", "seconds: -1n", "nanos: -500000000", "-PT1.5S", ""],
    },
  },
  "wall-time-zoneless": {
    hero: ["not-instant", ""],
    ladder: ["", "", "2024-01-01T00:00:00", ""],
    cards: {
      int96: ["sentinel", "", "", "", "null"],
      arrow: ["read", "1704067200000n", "", "2024-01-01T00:00:00", ""],
      timestamp: ["sentinel", "", "", "", "null"],
      duration: ["idle", "", "", "", ""],
    },
  },
  "instant-into-zoneless": {
    hero: ["instant", "2024-01-01T00:00:00Z"],
    ladder: [
      "2024-01-01T00:00:00Z",
      "2024-01-01T00:00:00Z",
      "",
      "2024-01-01T00:00:00Z",
    ],
    cards: {
      int96: [
        "read",
        "julianDay: 2460311",
        "nanosOfDay: 0n",
        "2024-01-01T00:00:00Z",
        "",
      ],
      arrow: ["sentinel", "", "", "", "0n"],
      timestamp: [
        "read",
        "seconds: 1704067200n",
        "nanos: 0",
        "2024-01-01T00:00:00Z",
        "",
      ],
      duration: ["idle", "", "", "", ""],
    },
  },
  "int64-edge": {
    hero: ["instant", "2262-04-11T23:47:16.854775807Z"],
    ladder: [
      "2262-04-11T23:47:16.854775807Z",
      "2262-04-11T23:47:16.854775807Z",
      "2262-04-11T23:47:16.854775807Z",
      "2262-04-11T23:47:16.854775807Z",
    ],
    cards: {
      int96: [
        "read",
        "julianDay: 2547339",
        "nanosOfDay: 85636854775807n",
        "2262-04-11T23:47:16.854775807Z",
        "",
      ],
      arrow: [
        "read",
        "9223372036854775807n",
        "",
        "2262-04-11T23:47:16.854775807Z",
        "",
      ],
      timestamp: [
        "read",
        "seconds: 9223372036n",
        "nanos: 854775807",
        "2262-04-11T23:47:16.854775807Z",
        "",
      ],
      duration: ["idle", "", "", "", ""],
    },
  },
  "past-proto-range": {
    hero: ["instant", "+010000-01-01T00:00:00Z"],
    ladder: ["+010000-01-01T00:00:00Z", "+010000-01-01T00:00:00Z", "", ""],
    cards: {
      int96: [
        "read",
        "julianDay: 5373485",
        "nanosOfDay: 0n",
        "+010000-01-01T00:00:00Z",
        "",
      ],
      arrow: ["sentinel", "", "", "", "0n"],
      timestamp: ["sentinel", "", "", "", "null"],
      duration: ["sentinel", "", "", "", "null"],
    },
  },
  "decode-int96-bytes": {
    hero: ["empty", ""],
    ladder: ["", "", "", ""],
    cards: {
      int96: [
        "read",
        "bytes: 00000000000000008c3d2500",
        "",
        "1970-01-01T00:00:00Z",
        "",
      ],
      arrow: ["idle", "", "", "", ""],
      timestamp: ["idle", "", "", "", ""],
      duration: ["idle", "", "", "", ""],
    },
  },
  "decode-int96-record": {
    hero: ["empty", ""],
    ladder: ["", "", "", ""],
    cards: {
      int96: [
        "read",
        "julianDay: 2460380",
        "nanosOfDay: 45296789000000n",
        "2024-03-10T12:34:56.789Z",
        "",
      ],
      arrow: ["idle", "", "", "", ""],
      timestamp: ["idle", "", "", "", ""],
      duration: ["idle", "", "", "", ""],
    },
  },
  "decode-int96-full-day": {
    hero: ["empty", ""],
    ladder: ["", "", "", ""],
    cards: {
      int96: [
        "sentinel",
        "julianDay: 2440588",
        "nanosOfDay: 86400000000000n",
        "",
        '""',
      ],
      arrow: ["idle", "", "", "", ""],
      timestamp: ["idle", "", "", "", ""],
      duration: ["idle", "", "", "", ""],
    },
  },
  "decode-arrow-zoneless": {
    hero: ["empty", ""],
    ladder: ["", "", "", ""],
    cards: {
      int96: ["idle", "", "", "", ""],
      arrow: ["read", "-1n", "", "1969-12-31T23:59:59.999999999", ""],
      timestamp: ["idle", "", "", "", ""],
      duration: ["idle", "", "", "", ""],
    },
  },
  "decode-nanos-sign": {
    hero: ["empty", ""],
    ladder: ["", "", "", ""],
    cards: {
      int96: ["idle", "", "", "", ""],
      arrow: ["idle", "", "", "", ""],
      timestamp: ["sentinel", "seconds: 0n", "nanos: -1", "", '""'],
      duration: ["read", "seconds: 0n", "nanos: -1", "-PT0.000000001S", ""],
    },
  },
};

/** What one card says it stored, read back and returned. */
function expectCard(id: string, row: Row, label: string) {
  const [, stored1, stored2, readBack, literal] = row;
  const c = card(TITLES[id]!);
  const stored = within(
    within(c).getByRole("group", { name: "Stored" }),
  ).queryAllByRole("code");
  const wantStored = [stored1, stored2].filter((t) => t !== "");
  expect(stored, label).toHaveLength(wantStored.length);
  wantStored.forEach((t, i) => expect(stored[i]).toHaveTextContent(exact(t)));
  const back = within(
    within(c).getByRole("group", { name: "Reads back" }),
  ).queryAllByRole("code");
  expect(back, label).toHaveLength(readBack === "" ? 0 : 1);
  if (readBack !== "") expect(back[0]).toHaveTextContent(exact(readBack));
  if (literal === "") {
    expect(
      within(c).queryByText(NO_SIGNAL_PILL),
      label,
    ).not.toBeInTheDocument();
  } else {
    expect(within(c).getByText(NO_SIGNAL_PILL), label).toBeInTheDocument();
    expect(within(c).getByText(literal), label).toBeInTheDocument();
  }
}

describe("presets against the real library", () => {
  it("records a result for every preset", () => {
    expect(Object.keys(RECORDED).sort()).toEqual(
      BRIDGE_PRESETS.map((p) => p.id).sort(),
    );
  });

  for (const p of BRIDGE_PRESETS) {
    it(`reads ${p.id}`, async () => {
      await open({ preset: p.id });
      const want = RECORDED[p.id]!;
      if (want.hero[1] === "") {
        expect(heroValue()).not.toHaveTextContent(/\d/);
      } else {
        expect(heroValue()).toHaveTextContent(exact(want.hero[1]));
      }
      for (const [id, row] of Object.entries(want.cards)) {
        expectCard(id, row, `${p.id} ${id}`);
      }
      const rungs = LADDER_LABELS.map((label) =>
        within(ladder()).getByRole("group", { name: label, hidden: true }),
      );
      rungs.forEach((rung, i) => {
        const text = within(rung).queryAllByRole("code", { hidden: true });
        const wantText = want.ladder[i]!;
        expect(text, `${p.id} ladder ${LADDER_LABELS[i]}`).toHaveLength(
          wantText === "" ? 0 : 1,
        );
        if (wantText !== "") expect(text[0]).toHaveTextContent(exact(wantText));
      });
    });
  }
});

describe("behaviour", () => {
  it("opens on the Tokyo default with no signal pill", async () => {
    await open();
    expect(preset()).toHaveValue("tokyo-seconds");
    expect(heroValue()).not.toHaveTextContent(NO_SIGNAL_PILL);
    expect(heroValue()).toHaveTextContent("2024-01-01T00:00:00Z");
  });

  it("marks a zoneless wall time as not an instant, with a chip and no hero pill", async () => {
    await open({ preset: "wall-time-zoneless" });
    expect(
      within(card("Arrow Timestamp")).getByText(ZONELESS_CHIP),
    ).toBeInTheDocument();
    // Arrow read it, so the hero does not claim a lost signal.
    expect(heroValue()).not.toHaveTextContent(NO_SIGNAL_PILL);
    expect(
      screen.getByText("Not an instant, so there is no exact value."),
    ).toBeInTheDocument();
  });

  it("shows NO SIGNAL in the hero when no format read the input", async () => {
    const w = await open({ value: "not a time" });
    expect(heroValue()).toHaveTextContent(NO_SIGNAL_PILL);
    await expectNoAxeViolations(w.root);
  });

  it("says the empty box is empty, and not NO SIGNAL", async () => {
    const w = await open();
    await w.user.clear(valueBox());
    await w.user.clear(
      screen.getByRole("textbox", { name: "ISO duration (optional)" }),
    );
    expect(heroValue()).not.toHaveTextContent(NO_SIGNAL_PILL);
    expect(
      screen.getAllByText("Give an instant or a wall time.").length,
    ).toBeGreaterThan(0);
    expect(output()).toHaveTextContent("No call made: give a value.");
  });

  it("shows a refused read as NO SIGNAL beside its literal, not a blank", async () => {
    const w = await open({ preset: "past-proto-range" });
    const arrow = card("Arrow Timestamp");
    // A nanosecond count past int64 is out of range, not the 1970 epoch.
    expect(within(arrow).getByText(NO_SIGNAL_PILL)).toBeInTheDocument();
    expect(within(arrow).getByText("0n")).toBeInTheDocument();
    await expectNoAxeViolations(w.root);
  });

  it("keeps a legitimate zero as a value", async () => {
    await open({
      value: "1970-01-01T00:00:00Z",
      unit: "second",
      zone: "UTC",
    });
    const arrow = card("Arrow Timestamp");
    expect(
      within(within(arrow).getByRole("group", { name: "Stored" })).getByRole(
        "code",
      ),
    ).toHaveTextContent(exact("0n"));
    expect(within(arrow).queryByText(NO_SIGNAL_PILL)).not.toBeInTheDocument();
  });

  it("names an unknown zone in the other tools' words", async () => {
    await open({
      value: "2024-01-01T00:00:00Z",
      unit: "second",
      zone: "Mars/Olympus",
    });
    const arrow = card("Arrow Timestamp");
    expect(
      within(arrow).getByText(
        "Mars/Olympus is not a time zone this browser knows.",
      ),
    ).toBeInTheDocument();
  });

  it("fills the inputs from a preset and switches to Your values on typing", async () => {
    const w = await open();
    await w.user.selectOptions(preset(), "sub-microsecond");
    expect(valueBox()).toHaveValue("2024-01-01T00:00:00.123456789Z");
    await enter(w, valueBox(), "2024-01-01T00:00:00.5Z");
    expect(preset()).toHaveValue("custom");
    await w.user.selectOptions(preset(), "custom");
    expect(valueBox()).toHaveValue("2024-01-01T00:00:00.5Z");
  });

  it("switches mode, hiding the fields the mode does not use", async () => {
    const w = await open();
    expect(valueBox()).toBeVisible();
    await w.user.click(radio("From stored values"));
    expect(
      screen.queryByRole("textbox", { name: "Instant or wall time" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("figure", { name: "Exact instant" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "int64" })).toBeInTheDocument();
    await w.user.click(radio("From an instant"));
    expect(valueBox()).toBeInTheDocument();
    await expectNoAxeViolations(w.root);
  });

  it("keeps the decode panel out of the accessibility tree until it opens", async () => {
    const w = await open();
    expect(
      screen.queryByRole("group", { name: "Parquet INT96" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("textbox", { name: "julianDay" }),
    ).not.toBeInTheDocument();
    expect(valueBox()).toBeInTheDocument();
    await expectNoAxeViolations(w.root);
    await w.user.click(radio("From stored values"));
    expect(
      screen.getByRole("group", { name: "Parquet INT96" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "julianDay" })).toBeVisible();
    expect(
      screen.queryByRole("textbox", { name: "Instant or wall time" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("textbox", { name: "ISO duration (optional)" }),
    ).not.toBeInTheDocument();
    await expectNoAxeViolations(w.root);
  });

  it("shows the INT96 field of the form that is chosen", async () => {
    const w = await open({ mode: "decode" });
    expect(
      screen.getByRole("textbox", { name: "julianDay" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("textbox", { name: "Bytes" }),
    ).not.toBeInTheDocument();
    await w.user.click(radio("12 bytes"));
    expect(screen.getByRole("textbox", { name: "Bytes" })).toBeInTheDocument();
    expect(
      screen.queryByRole("textbox", { name: "julianDay" }),
    ).not.toBeInTheDocument();
  });

  it("decodes typed fields and says what is wrong with a bad one", async () => {
    const w = await open({
      mode: "decode",
      julianDay: "2440588",
      nanosOfDay: "0",
    });
    const int96 = () => card("Parquet INT96");
    expect(
      within(
        within(int96()).getByRole("group", { name: "Reads back" }),
      ).getByRole("code"),
    ).toHaveTextContent("1970-01-01T00:00:00Z");
    await enter(w, screen.getByRole("textbox", { name: "julianDay" }), "12x");
    expect(
      within(int96()).getByText("Type a whole number"),
    ).toBeInTheDocument();
    await w.user.click(radio("12 bytes"));
    await enter(w, screen.getByRole("textbox", { name: "Bytes" }), "zz");
    expect(within(int96()).getByText("Type 24 hex digits")).toBeInTheDocument();
    await expectNoAxeViolations(w.root);
  });

  it("names every control", async () => {
    await open({ mode: "decode" });
    for (const name of ["Preset"]) {
      expect(screen.getByRole("combobox", { name })).toBeInTheDocument();
    }
    for (const name of [
      "Arrow column timezone (optional)",
      "julianDay",
      "nanosOfDay",
      "int64",
    ]) {
      expect(screen.getByRole("textbox", { name })).toBeInTheDocument();
    }
    expect(screen.getAllByRole("textbox", { name: "seconds" })).toHaveLength(2);
    expect(screen.getAllByRole("textbox", { name: "nanos" })).toHaveLength(2);
    for (const name of ["Mode", "Arrow unit", "Form"]) {
      expect(screen.getByRole("group", { name })).toBeInTheDocument();
    }
    expect(radio("Day and nanoseconds")).toBeChecked();
    expect(radio("second")).toBeChecked();
  });

  it("keeps four cards and four ladder rows while a value is typed", async () => {
    const w = await open();
    const count = () => screen.getAllByRole("region").length;
    const before = count();
    expect(before).toBeGreaterThanOrEqual(4);
    expect(
      within(ladder()).getAllByRole("group", { hidden: true }),
    ).toHaveLength(4);
    await enter(w, valueBox(), "x".repeat(64));
    expect(count()).toBe(before);
    expect(
      within(ladder()).getAllByRole("group", { hidden: true }),
    ).toHaveLength(4);
    for (const title of Object.values(TITLES)) {
      expect(card(title)).toBeInTheDocument();
    }
    await expectNoAxeViolations(w.root);
  });

  it("prints the calls it made and links each function's page", async () => {
    const w = await open();
    expect(calls()).toHaveTextContent("toParquetInt96(");
    expect(output()).toHaveTextContent("2024-01-01T00:00:00Z");
    expect(
      screen.getByRole("link", { name: "toParquetInt96 reference" }),
    ).toHaveAttribute(
      "href",
      `${SITE_BASE}/reference/precision/convert/toParquetInt96/`,
    );
    expect(
      screen.getByRole("link", { name: "ID Timestamp Decoder" }),
    ).toHaveAttribute("href", `${SITE_BASE}/tools/id-timestamp-decoder/`);
    await expectNoAxeViolations(w.root);
  });

  it("keeps two copies on one page apart", async () => {
    const a = await open({ preset: "tokyo-seconds" }, "first");
    const b = await open({ preset: "int64-edge" }, "second");
    const boxes = screen.getAllByRole("combobox", { name: "Preset" });
    expect(boxes).toHaveLength(2);
    expect(boxes[0]).toHaveValue("tokyo-seconds");
    expect(boxes[1]).toHaveValue("int64-edge");
    await b.user.selectOptions(boxes[1]!, "before-1970");
    expect(boxes[0]).toHaveValue("tokyo-seconds");
    await enter(
      a,
      screen.getAllByRole("textbox", { name: "Instant or wall time" })[0]!,
      "x",
    );
    expect(boxes[1]).toHaveValue("before-1970");
  });

  it("escapes what is typed", async () => {
    const w = await open();
    await enter(w, valueBox(), '<img src=x onerror="1">');
    await enter(w, zoneBox(), "<b>x</b>");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(calls()).toHaveTextContent(
      'toParquetInt96("<img src=x onerror=\\"1\\">")',
    );
  });
});

describe("permalinks", () => {
  const seedOf = (w: RenderedWidget) => {
    const url = w.permalink();
    return seedFromLocation("colbridge", url.slice(url.indexOf("?")));
  };

  it("round trips a preset", async () => {
    const w = await open({ preset: "int64-edge" });
    expect(seedOf(w)).toEqual({ preset: "int64-edge" });
  });

  it("round trips typed values", async () => {
    const w = await open({
      value: "2024-01-01T00:00:00Z",
      unit: "millisecond",
      zone: "UTC",
    });
    expect(seedOf(w)).toEqual({
      value: "2024-01-01T00:00:00Z",
      unit: "millisecond",
      zone: "UTC",
    });
  });

  it("round trips a decode", async () => {
    const w = await open({ mode: "decode", int64: "-1" });
    expect(seedOf(w)).toEqual({ mode: "decode", int64: "-1" });
    const again = await open(seedOf(w) as Record<string, unknown>, "again");
    expect(seedOf(again)).toEqual({ mode: "decode", int64: "-1" });
  });
});

describe("module content", () => {
  it("holds no epoch, unit factor or layout outside the presets", () => {
    const dir = __dirname;
    const files = readdirSync(dir).filter(
      (f) =>
        (f.startsWith("column-timestamp-") || f === "column-bridge-lib.ts") &&
        !/\.test\./.test(f) &&
        f !== "column-timestamp-bridge-presets.ts",
    );
    expect(files.length).toBeGreaterThanOrEqual(3);
    for (const f of files) {
      const text = readFileSync(join(dir, f), "utf8");
      expect(text, f).not.toMatch(
        /2440588|86400000000000|62135596800|1_000_000_000|1e9\b/,
      );
    }
  });
});
