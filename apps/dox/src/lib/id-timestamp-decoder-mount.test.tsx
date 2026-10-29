/**
 * @vitest-environment jsdom
 *
 * The ID Timestamp Decoder end to end against the real `@northguild/gmt`, through roles and
 * accessible names the way a person (or a screen reader) meets the page. Every preset's
 * rows are literal values read once from a run of the built library, and they agree with
 * the slice's table. A drift in the library or in the widget fails here.
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
  cellsInColumn,
  expectNoAxeViolations,
  renderWidget,
  type RenderedWidget,
} from "~/test/render-widget";
import { FORMATS, ID_PRESETS } from "./id-timestamp-decoder";
import { NO_SIGNAL_PILL } from "./id-timestamp-decoder-mount";
import { SITE_BASE } from "./site";
import { seedFromLocation } from "./widget-permalink";

installJsdomShims();

const entry = WIDGET_REGISTRY["showIdTimestampDecoder"] as AnyWidgetEntry;

const open = (args: Record<string, unknown> = {}, idPrefix = "test") =>
  renderWidget(entry, { args, idPrefix });

const preset = () => screen.getByRole("combobox", { name: "Preset" });
const idBox = () => screen.getByRole("textbox", { name: "Identifier" });
const epochBox = () => screen.getByRole("textbox", { name: "Epoch (Unix ms)" });
const shiftBox = () =>
  screen.getByRole("textbox", { name: "Bits below the timestamp" });
const bitsBox = () =>
  screen.getByRole("textbox", { name: "Timestamp bits (optional)" });
const instantOut = () =>
  screen.getByRole("status", { name: "Decoded instant" });
const table = () =>
  screen.getByRole("table", { name: "What each decoder reads" });
const output = () => screen.getByLabelText("What the calls returned");
const calls = () => screen.getByRole("group", { name: "Calls made" });

const returned = (fn: string) =>
  cellsInColumn(table(), "Returned")[FORMATS.findIndex((f) => f.fn === fn)]!;

/** Replaces what a text box holds, in one input event. */
async function enter(w: RenderedWidget, box: HTMLElement, value: string) {
  await w.user.clear(box);
  if (value !== "") await w.user.paste(value);
}

const NOT = "not-called";

/** Read once from the built library; the fn keys are the rows, `""`/`null` the sentinels. */
const RECORDED: Record<string, { hero: string; rows: Record<string, string> }> =
  {
    "uuid-v7": {
      hero: "one",
      rows: {
        fromUuidTimestamp: '"2022-02-22T19:22:22Z"',
        fromUlid: '""',
        fromObjectId: '""',
        fromKsuid: '""',
        fromSnowflake: NOT,
      },
    },
    "uuid-v1": {
      hero: "one",
      rows: {
        fromUuidTimestamp: '"2022-02-22T19:22:22Z"',
      },
    },
    "uuid-v6": {
      hero: "one",
      rows: {
        fromUuidTimestamp: '"2022-02-22T19:22:22Z"',
      },
    },
    "uuid-v4": {
      hero: "none",
      rows: { fromUuidTimestamp: '""', fromUlid: '""' },
    },
    "uuid-urn": {
      hero: "none",
      rows: { fromUuidTimestamp: '""', fromKsuid: '""' },
    },
    ulid: {
      hero: "one",
      rows: {
        fromUlid: '"2016-07-30T23:54:10.259Z"',
        fromUuidTimestamp: '""',
      },
    },
    "ulid-letter-i": {
      hero: "none",
      rows: { fromUlid: '""', fromUuidTimestamp: '""' },
    },
    objectid: { hero: "one", rows: { fromObjectId: '"2024-01-12T08:14:08Z"' } },
    "objectid-2038": {
      hero: "one",
      rows: { fromObjectId: '"2038-01-19T03:14:08Z"' },
    },
    ksuid: { hero: "one", rows: { fromKsuid: '"2017-10-10T04:00:47Z"' } },
    "ksuid-lower": {
      hero: "one",
      rows: { fromKsuid: '"2017-10-10T04:00:51Z"' },
    },
    "sf-1420070400000-22": {
      hero: "one",
      rows: { fromSnowflake: '"2016-04-30T11:18:25.796Z"', fromUlid: '""' },
    },
    "sf-1288834974657-22-41": {
      hero: "one",
      rows: { fromSnowflake: '"2018-10-10T20:19:24.211Z"' },
    },
    "sf-other-epoch": {
      hero: "one",
      rows: { fromSnowflake: '"2022-12-07T18:36:29.554Z"' },
    },
  };

describe("the template", () => {
  it("is a named region with three numbered sections and one row for each decoder", async () => {
    await open();
    expect(
      screen.getByRole("region", { name: "ID Timestamp Decoder" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 4 })).toHaveLength(3);
    expect(
      screen.getByRole("heading", { name: "1. Paste an identifier" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "2. What each decoder reads" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "3. The calls" }),
    ).toBeInTheDocument();
    expect(within(table()).getAllByRole("row")).toHaveLength(
      FORMATS.length + 1,
    );
  });

  it("names every control", async () => {
    await open();
    expect(preset()).toBeInTheDocument();
    expect(idBox()).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "Snowflake layout" }),
    ).toBeInTheDocument();
    expect(epochBox()).toBeInTheDocument();
    expect(shiftBox()).toBeInTheDocument();
    expect(bitsBox()).toBeInTheDocument();
    expect(idBox()).toHaveAttribute("maxlength", "96");
  });

  it("keeps two copies on one page apart", async () => {
    const a = await open({}, "rail-a");
    await open({ preset: "ksuid" }, "rail-b");
    const boxes = screen.getAllByRole("textbox", { name: "Identifier" });
    expect(boxes).toHaveLength(2);
    expect(boxes[0]!.id).not.toBe(boxes[1]!.id);
    const kept = (boxes[1] as HTMLInputElement).value;
    await enter(a, boxes[0]!, "abc");
    expect(boxes[0]).toHaveValue("abc");
    expect(boxes[1]).toHaveValue(kept);
  });
});

describe("presets against the real library", () => {
  it("records a result for every preset", () => {
    expect(Object.keys(RECORDED).sort()).toEqual(
      ID_PRESETS.map((p) => p.id).sort(),
    );
  });

  for (const p of ID_PRESETS) {
    it(`reads ${p.id}`, async () => {
      await open({ preset: p.id });
      const want = RECORDED[p.id]!;
      if (want.hero === "none") {
        expect(instantOut()).toHaveTextContent(NO_SIGNAL_PILL);
      } else {
        expect(instantOut()).not.toHaveTextContent(NO_SIGNAL_PILL);
      }
      for (const [fn, text] of Object.entries(want.rows)) {
        if (text === NOT) {
          expect(
            within(returned(fn)).queryByRole("code"),
          ).not.toBeInTheDocument();
        } else {
          expect(within(returned(fn)).getByRole("code")).toHaveTextContent(
            text,
          );
        }
      }
    });
  }
});

describe("behaviour", () => {
  it("opens on the default with only the version showing", async () => {
    await open();
    expect(preset()).toHaveValue("uuid-v7");
    expect(screen.getByText("v7")).toBeInTheDocument();
    expect(instantOut()).not.toHaveTextContent(NO_SIGNAL_PILL);
    expect(instantOut()).toHaveTextContent("2022-02-22T19:22:22Z");
  });

  it("shows NO SIGNAL only when every decoder returned its sentinel", async () => {
    const w = await open({ preset: "uuid-v4" });
    expect(instantOut()).toHaveTextContent(NO_SIGNAL_PILL);
    await w.user.selectOptions(preset(), "ulid");
    expect(instantOut()).not.toHaveTextContent(NO_SIGNAL_PILL);
    await expectNoAxeViolations(w.root);
  });

  it("says the empty box is empty, and not NO SIGNAL", async () => {
    const w = await open();
    await w.user.clear(idBox());
    expect(instantOut()).not.toHaveTextContent(NO_SIGNAL_PILL);
    expect(instantOut()).toBeEmptyDOMElement();
    expect(screen.getByText("Paste an identifier.")).toBeInTheDocument();
    expect(output()).toHaveTextContent("Not read: there is no identifier.");
  });

  it("fills the inputs from a preset and switches to Your values on typing", async () => {
    const w = await open();
    await w.user.selectOptions(preset(), "sf-1420070400000-22");
    expect(idBox()).toHaveValue("175928847299117063");
    expect(epochBox()).toHaveValue("1420070400000");
    expect(shiftBox()).toHaveValue("22");
    await enter(w, idBox(), "175928847299117064");
    expect(preset()).toHaveValue("custom");
    await w.user.selectOptions(preset(), "custom");
    expect(idBox()).toHaveValue("175928847299117064");
  });

  it("makes no Snowflake call without a layout, and says why", async () => {
    await open({ id: "175928847299117063" });
    expect(returned("fromSnowflake")).toHaveTextContent(
      "Give an epoch and a shift",
    );
  });

  it("makes no Snowflake call with an epoch but no shift", async () => {
    await open({ id: "175928847299117063", epochMs: "1420070400000" });
    expect(returned("fromSnowflake")).toHaveTextContent(
      "Give an epoch and a shift: a Snowflake has no default layout.",
    );
  });

  it("prints the calls it made and what they returned", async () => {
    const w = await open({ preset: "ulid" });
    expect(calls()).toHaveTextContent("fromUlid(");
    expect(output()).toHaveTextContent("2016-07-30T23:54:10.259Z");
    expect(
      screen.getByRole("link", { name: "fromUlid reference" }),
    ).toHaveAttribute(
      "href",
      `${SITE_BASE}/reference/precision/identifiers/fromUlid/`,
    );
    await expectNoAxeViolations(w.root);
  });

  it("keeps five rows while an identifier is typed", async () => {
    const w = await open();
    const before = within(table()).getAllByRole("row").length;
    await enter(w, idBox(), "x".repeat(64));
    expect(within(table()).getAllByRole("row")).toHaveLength(before);
    await expectNoAxeViolations(w.root);
  });

  it("escapes what is typed", async () => {
    const w = await open();
    await enter(w, idBox(), '<img src=x onerror="1">');
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(calls()).toHaveTextContent(
      'fromUlid("<img src=x onerror=\\"1\\">")',
    );
  });
});

describe("permalinks", () => {
  it("round trips a preset", async () => {
    const w = await open({ preset: "ksuid" });
    const url = w.permalink();
    expect(seedFromLocation("iddecode", url.slice(url.indexOf("?")))).toEqual({
      preset: "ksuid",
    });
  });

  it("round trips typed values", async () => {
    const w = await open({ id: "abc", epochMs: "1", shift: "2" });
    const url = w.permalink();
    expect(seedFromLocation("iddecode", url.slice(url.indexOf("?")))).toEqual({
      id: "abc",
      epochMs: "1",
      shift: "2",
    });
  });
});

describe("module content", () => {
  it("holds no epoch, unit factor or ID grammar", () => {
    const dir = __dirname;
    const files = readdirSync(dir).filter(
      (f) =>
        (f.startsWith("id-timestamp-") || f === "identifier-lib.ts") &&
        !/\.test\./.test(f),
    );
    expect(files.length).toBeGreaterThanOrEqual(3);
    for (const f of files) {
      const text = readFileSync(join(dir, f), "utf8");
      expect(text, f).not.toMatch(
        /1582|1400000000|0x01B21DD213814000|0123456789ABCDEFGHJKMNPQRSTVWXYZ/i,
      );
    }
  });
});
