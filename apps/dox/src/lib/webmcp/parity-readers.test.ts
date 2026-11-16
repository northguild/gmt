/**
 * @vitest-environment jsdom
 *
 * The instrument, finance, EDI and health tools against their pages. For each page the example, a
 * second preset and a refused input: the tool's `result` is what the page's redraw computed, and a
 * library refusal reads the way the page reads it. A page with two directions also has a case for
 * each one alone, and a page that reads a call with no field has one for that. A schema refusal
 * resolves `invalid-input`.
 */
import { screen } from "@testing-library/dom";
import {
  WIDGET_REGISTRY,
  type AnyWidgetEntry,
} from "~/components/ask/widget-registry";
import { installJsdomShims } from "~/test/jsdom-shims";
import type { RenderedWidget } from "~/test/render-widget";
import { expectParity, fakeModelContext } from "~/test/webmcp-parity";
import {
  DTM_PRESETS,
  gapRows as dtmGapRows,
  memberText as dtmMemberText,
  readDtm,
  stripApplies as dtmStripApplies,
  writeBack,
} from "../dtm-decoder";
import {
  METER_FORMS,
  METER_PRESETS,
  readMeter,
} from "../double-precision-meter";
import { loadEdiLib } from "../edi-lib";
import { widestGap } from "../edi-widgets";
import {
  memberReadout as fhirMember,
  readFhir,
  verdictOf as fhirVerdict,
} from "../fhir-date-checker";
import {
  readStamp,
  STAMP_PRESETS,
  WRITE_PRESETS as FIX_WRITE_PRESETS,
  writeInstant,
} from "../fix-timestamp-reader";
import {
  detailText,
  hl7Facts,
  HL7_PRESETS,
  memberReadout as hl7Member,
  verdictText,
  type LadderCell,
} from "../hl7-timestamp-reader";
import { COUNTER_PRESETS, readCounter } from "../julian-day-counter";
import {
  checkOffset,
  READ_PRESETS as PTP_READ_PRESETS,
  readPtp,
  WRITE_PRESETS as PTP_WRITE_PRESETS,
  writePtp,
} from "../ptp-clock-converter";
import {
  READ_PRESETS as SWIFT_READ_PRESETS,
  readValueDate,
  WRITE_PRESETS as SWIFT_WRITE_PRESETS,
  writeValueDate,
} from "../swift-value-date-reader";
import { readLog, TAI64N_PRESETS, writeLabel } from "../tai64n-log-reader";
import {
  dtpBlank,
  dtpMemberText,
  dtpWriteBack,
  gapRows as x12GapRows,
  instantPlan,
  mainBlank,
  memberText as x12MemberText,
  readArgs as x12ReadArgs,
  readDtp,
  readX12,
  stripApplies as x12StripApplies,
  verdictOf as x12Verdict,
  writeDate,
  writeTime,
} from "../x12-time-reader";
import { jsonSafe } from "./json-safe";
import type { PageToolResult } from "./model-context";
import { offerPageTool, WEBMCP_MARKER } from "./offer";
import { NEEDS_A_FIELD } from "./tools/fix-timestamp-reader";
import {
  NEEDS_ALL_THREE,
  offsetDefaultNote,
} from "./tools/ptp-clock-converter";
import { noLabelNote, NO_LABEL_WRITTEN } from "./tools/tai64n-log-reader";

/** Spies the page's pure facts functions: the real function, observed. */
vi.mock("../double-precision-meter", async (importOriginal) => {
  const real =
    await importOriginal<typeof import("../double-precision-meter")>();
  return { ...real, readMeter: vi.fn(real.readMeter) };
});
vi.mock("../dtm-decoder", async (importOriginal) => {
  const real = await importOriginal<typeof import("../dtm-decoder")>();
  return {
    ...real,
    gapRows: vi.fn(real.gapRows),
    readDtm: vi.fn(real.readDtm),
    writeBack: vi.fn(real.writeBack),
  };
});
vi.mock("../fhir-date-checker", async (importOriginal) => {
  const real = await importOriginal<typeof import("../fhir-date-checker")>();
  return { ...real, readFhir: vi.fn(real.readFhir) };
});
vi.mock("../fix-timestamp-reader", async (importOriginal) => {
  const real = await importOriginal<typeof import("../fix-timestamp-reader")>();
  return {
    ...real,
    readStamp: vi.fn(real.readStamp),
    writeInstant: vi.fn(real.writeInstant),
  };
});
vi.mock("../hl7-timestamp-reader", async (importOriginal) => {
  const real = await importOriginal<typeof import("../hl7-timestamp-reader")>();
  return { ...real, hl7Facts: vi.fn(real.hl7Facts) };
});
vi.mock("../julian-day-counter", async (importOriginal) => {
  const real = await importOriginal<typeof import("../julian-day-counter")>();
  return { ...real, readCounter: vi.fn(real.readCounter) };
});
vi.mock("../ptp-clock-converter", async (importOriginal) => {
  const real = await importOriginal<typeof import("../ptp-clock-converter")>();
  return {
    ...real,
    checkOffset: vi.fn(real.checkOffset),
    readPtp: vi.fn(real.readPtp),
    writePtp: vi.fn(real.writePtp),
  };
});
vi.mock("../swift-value-date-reader", async (importOriginal) => {
  const real =
    await importOriginal<typeof import("../swift-value-date-reader")>();
  return {
    ...real,
    readValueDate: vi.fn(real.readValueDate),
    writeValueDate: vi.fn(real.writeValueDate),
  };
});
vi.mock("../tai64n-log-reader", async (importOriginal) => {
  const real = await importOriginal<typeof import("../tai64n-log-reader")>();
  return {
    ...real,
    readLog: vi.fn(real.readLog),
    writeLabel: vi.fn(real.writeLabel),
  };
});
vi.mock("../x12-time-reader", async (importOriginal) => {
  const real = await importOriginal<typeof import("../x12-time-reader")>();
  return {
    ...real,
    dtpWriteBack: vi.fn(real.dtpWriteBack),
    gapRows: vi.fn(real.gapRows),
    readDtp: vi.fn(real.readDtp),
    readX12: vi.fn(real.readX12),
    writeDate: vi.fn(real.writeDate),
    writeTime: vi.fn(real.writeTime),
  };
});

installJsdomShims();

// One fixed moment, so a page that reads the clock and the tool see the same instant.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime("2026-11-16T12:00:00Z");
});
afterEach(() => {
  vi.useRealTimers();
});

type Args = Record<string, unknown>;
type Tool = Awaited<ReturnType<typeof loadTool>>;
interface Facts {
  mockClear(): unknown;
  mock: { results: { type: string; value?: unknown }[] };
}
type Obj = Record<string, unknown>;

async function loadTool(slug: string) {
  return (await import(`./tools/${slug}.ts`)).default;
}
async function exampleOf(slug: string): Promise<Args> {
  const { def } = await import(`./tools/${slug}.ts`);
  return def.example as Args;
}

const entryOf = (name: string) => WIDGET_REGISTRY[name] as AnyWidgetEntry;

/** The chat rail parses a call's args into the widget's own before it mounts; do the same here. */
function railEntryOf(name: string): AnyWidgetEntry {
  const entry = entryOf(name);
  const widgetArgs = (input: unknown): never => {
    const parsed = entry.parse(input);
    if (!parsed.ok) throw new Error(parsed.reason);
    return parsed.args as never;
  };
  return {
    ...entry,
    load: async () => {
      const loaded = await entry.load();
      return {
        renderTemplate: (idPrefix, args) =>
          loaded.renderTemplate(idPrefix, widgetArgs(args)),
        mount: (root, args, signal) =>
          loaded.mount(root, widgetArgs(args), signal),
      };
    },
  } as AnyWidgetEntry;
}

const spy = (fn: unknown) => fn as unknown as Facts;
const o = (value: unknown): Obj => value as Obj;
const given = (args: Args, ...keys: string[]) =>
  keys.every((k) => args[k] !== undefined);
const pick = (value: unknown, keys: string[]): Obj =>
  Object.fromEntries(keys.map((k) => [k, o(value)[k]]));
const at = <T>(list: readonly T[], i: number): T => {
  const item = list[i];
  if (item === undefined) throw new Error(`no preset ${i}`);
  return item;
};

function lastOf(fn: unknown): unknown {
  const last = spy(fn).mock.results.at(-1);
  return last?.type === "return" ? last.value : undefined;
}

/**
 * The facts the page's redraw computed, from the last result of each spied function, put together
 * the way the tool puts them together. The page has computed them when any spy returned.
 */
function combined(
  fns: unknown[],
  build: (values: unknown[], args: Args) => unknown,
  args: Args,
): Facts {
  return {
    mockClear: () => {
      for (const fn of fns) spy(fn).mockClear();
    },
    get mock() {
      const values = fns.map(lastOf);
      const returned = fns.some(
        (fn) => spy(fn).mock.results.at(-1)?.type === "return",
      );
      return {
        results: returned
          ? [{ type: "return", value: jsonSafe(build(values, args)) }]
          : [{ type: "none" }],
      };
    },
  };
}

let ediLib: Awaited<ReturnType<typeof loadEdiLib>>;

const ptpFacts = (args: Args) =>
  combined(
    [readPtp, checkOffset, writePtp],
    ([r, c, w], a) => {
      const whole = given(a, "seconds", "nanoseconds", "offset");
      const record = o(r).record as Obj | null;
      const verdict = o(o(c).verdict);
      const wrote = o(w);
      return {
        read: whole
          ? {
              kind: o(r).kind,
              seconds: record === null ? null : String(record.seconds),
              nanoseconds: record === null ? null : record.nanoseconds,
              ...pick(r, ["offset", "utc", "ignored", "valid", "reason"]),
            }
          : null,
        check: whole
          ? {
              ...pick(c, ["kind", "announced", "table", "tableUtc"]),
              verdict: { title: verdict.title, detail: verdict.detail },
            }
          : null,
        written: given(a, "instant")
          ? {
              kind: wrote.kind,
              seconds: wrote.seconds === null ? null : String(wrote.seconds),
              ...pick(w, ["nanoseconds", "back", "reason"]),
            }
          : null,
      };
    },
    args,
  );

const taiFacts = (args: Args) =>
  combined(
    [readLog, writeLabel],
    ([rows, w]) => ({
      lines: (rows as Obj[]).map((r) =>
        pick(r, [
          "n",
          "token",
          "message",
          "read",
          "utc",
          "tai",
          "seconds",
          "inserted",
        ]),
      ),
      written: given(args, "instant") ? pick(w, ["label", "back"]) : null,
    }),
    args,
  );

const meterFacts = (args: Args) =>
  combined(
    [readMeter],
    ([read]) => ({
      ...pick(read, ["status", "utc", "year"]),
      forms: METER_FORMS.map((form, i) => {
        const plate = (o(read).plates as Obj[])[i];
        const lines = plate?.lines as string[] | undefined;
        return {
          form,
          name: plate?.caption ?? null,
          drift: plate?.value ?? null,
          value: lines?.[0]?.replace(/^value /, "") ?? null,
        };
      }),
    }),
    args,
  );

const counterFacts = (args: Args) =>
  combined(
    [readCounter],
    ([read], a) => ({
      status: o(read).status,
      read: a.read,
      scale: a.scale,
      utc: o(read).utc,
      rows: (o(read).rows as Obj[]).map((r) =>
        pick(r, ["form", "name", "value", "back", "shift"]),
      ),
    }),
    args,
  );

const fixFacts = (args: Args) =>
  combined(
    [readStamp, writeInstant],
    ([r, w], a) => {
      const parsed = o(r).parsed as Obj | null;
      const verdict = o(o(r).verdict);
      return {
        read: given(a, "stamp")
          ? {
              kind: o(r).kind,
              instant: parsed?.instant ?? null,
              precision: parsed?.precision ?? null,
              leapSecond: parsed?.leapSecond ?? null,
              ...pick(r, ["digits", "belowNanosecond"]),
              verdict: { title: verdict.title, detail: verdict.detail },
            }
          : null,
        written: given(a, "instant")
          ? {
              kind: o(w).kind,
              rows: (o(w).rows as Obj[]).map((row) =>
                pick(row, ["precision", "out", "note"]),
              ),
            }
          : null,
      };
    },
    args,
  );

const swiftFacts = (args: Args) =>
  combined(
    [readValueDate, writeValueDate],
    ([r, w], a) => ({
      read: given(a, "value")
        ? pick(r, ["kind", "iso", "year", "valid", "code"])
        : null,
      written: given(a, "date")
        ? pick(w, ["kind", "written", "back", "same"])
        : null,
    }),
    args,
  );

const dtmFacts = (args: Args) =>
  combined(
    [readDtm, dtmGapRows, writeBack],
    ([read, rows, written]) => {
      const r = read as Parameters<typeof dtmMemberText>[0];
      const shown = dtmStripApplies(r) && r.house !== null;
      const all = (rows ?? []) as Parameters<typeof widestGap>[0];
      return {
        value: r.value,
        format: r.format,
        kind: dtmMemberText(r, "kind"),
        start: dtmMemberText(r, "value"),
        end: dtmMemberText(r, "periodEnd"),
        instant: dtmMemberText(r, "instant"),
        offset: dtmMemberText(r, "offset"),
        written: written == null ? null : o(written).output,
        zones: shown ? all.filter((z) => z.zone !== "") : null,
        gap: shown ? (widestGap(all, ediLib)?.text ?? null) : null,
      };
    },
    args,
  );

const x12Facts = (args: Args) =>
  combined(
    [readX12, readDtp, x12GapRows, writeDate, writeTime, dtpWriteBack],
    ([mainRead, dtpRead, rows, dateW, timeW, dtpW], a) => {
      const { main: m, dtp: d } = x12ReadArgs(a as never);
      let main = null;
      let dtp = null;
      if (!mainBlank(m)) {
        const read = mainRead as Parameters<typeof x12MemberText>[0];
        const applies = x12StripApplies(read);
        const zones = applies
          ? ((rows ?? []) as Obj[]).filter((r) => r.zone !== "")
          : [];
        const plan = instantPlan(read, m.zones);
        const planned =
          plan.kind === "resolve"
            ? ((zones[0]?.instant as string | undefined) ?? "")
            : read.instant;
        main = {
          kind: x12MemberText(read, "kind"),
          value: x12MemberText(read, "value"),
          timeCode: x12MemberText(read, "code"),
          offset: x12MemberText(read, "offset"),
          zone: x12MemberText(read, "zone"),
          daylight: x12MemberText(read, "daylight"),
          instant: planned === "" ? null : planned,
          zones: applies ? zones : null,
          gap: applies
            ? (widestGap(
                (rows ?? []) as Parameters<typeof widestGap>[0],
                ediLib,
              )?.text ?? null)
            : null,
          verdict: x12Verdict(read).verdict || null,
          detail: x12Verdict(read).detail || null,
          written: {
            date: dateW == null ? null : o(dateW).output,
            time: timeW == null ? null : o(timeW).output,
          },
        };
      }
      if (!dtpBlank(d)) {
        const read = dtpRead as Parameters<typeof dtpMemberText>[0];
        dtp = {
          kind: dtpMemberText(read, "kind"),
          value: dtpMemberText(read, "value"),
          end: dtpMemberText(read, "rangeEnd"),
          written: dtpW == null ? null : o(dtpW).output,
        };
      }
      return { main, dtp };
    },
    args,
  );

const cellText = (cell: LadderCell): string | null =>
  cell.state === "value" ? cell.text : cell.state === "none" ? "" : null;

const hl7Result = (args: Args) =>
  combined(
    [hl7Facts],
    ([facts]) => {
      const { read, strip, ladder } = facts as ReturnType<typeof hl7Facts>;
      const member = (
        key: "kind" | "instant" | "offset" | "local" | "precision",
      ) => {
        const m = hl7Member(read, key);
        return m.state === "value" ? m.text : null;
      };
      const verdict = verdictText(read);
      const detail = detailText(read);
      return {
        kind: member("kind"),
        instant: member("instant"),
        local: member("local"),
        offset: member("offset"),
        precision: member("precision"),
        verdict: verdict === "" ? null : verdict,
        detail: detail === "" ? null : detail,
        readAsUtc:
          strip === null || strip.utcReading === "" ? null : strip.utcReading,
        gap: strip?.gap?.text ?? null,
        zones:
          strip === null
            ? null
            : strip.rows
                .filter((r) => r.zone !== "")
                .map((r) => ({
                  zone: r.zone,
                  instant: r.instant,
                  offset: r.offset,
                  fromUtcReading: r.third,
                  reason: r.reason,
                })),
        ladder:
          read.parsed === null
            ? null
            : {
                withOffsetColumn: ladder.third,
                rows: ladder.rows.map((r) => ({
                  precision: r.precision,
                  sent: cellText(r.sent),
                  withOffset: cellText(r.offset),
                })),
              },
      };
    },
    args,
  );

const fhirFacts = (args: Args) =>
  combined(
    [readFhir],
    ([r]) => {
      const read = r as ReturnType<typeof readFhir>;
      const member = (key: "value" | "precision" | "offset") => {
        const m = fhirMember(read, key);
        return m.state === "value" ? m.text : null;
      };
      const verdict = fhirVerdict(read);
      return {
        value: read.parsed === null ? null : read.parsed.value,
        precision: read.parsed === null ? null : read.parsed.precision,
        offset: read.parsed === null ? null : member("offset"),
        verdict: verdict.title,
        detail: verdict.detail === "" ? null : verdict.detail,
        types: read.rows.map((row) => ({
          type: row.type,
          valid: row.valid,
          patternMatches: row.pattern,
          reason: row.reason,
        })),
      };
    },
    args,
  );

interface Case {
  slug: string;
  /** Names a second case on a page. */
  label?: string;
  /** Used in place of the tool's own example. */
  example?: Args;
  tool: string;
  widget: string;
  facts: (args: Args) => Facts;
  second: Args;
  /** An input the schema accepts and the library refuses. */
  refused: Args;
  /** Sentences only the tool writes, which the page does not show. */
  own?: string[];
  /** The tool writes each note as `<name>: <the page's sentence>`, and the page shows the sentence. */
  prefixed?: boolean;
  /** An input the schema refuses. */
  invalid: Args;
}

const ptp = {
  slug: "ptp-clock-converter",
  tool: "convert_ptp_timestamp",
  widget: "showPtpClockConverter",
  facts: ptpFacts,
};
const tai = {
  slug: "tai64n-log-reader",
  tool: "read_tai64n_labels",
  widget: "showTai64nLogReader",
  facts: taiFacts,
};
const fix = {
  slug: "fix-timestamp-reader",
  tool: "read_fix_timestamp",
  widget: "showFixTimestampReader",
  facts: fixFacts,
};
const swift = {
  slug: "swift-value-date-reader",
  tool: "read_swift_value_date",
  widget: "showSwiftValueDateReader",
  facts: swiftFacts,
};
const dtm = {
  slug: "dtm-decoder",
  tool: "decode_edifact_dtm",
  widget: "showDtmDecoder",
  facts: dtmFacts,
};
const x12 = {
  slug: "x12-time-reader",
  tool: "read_x12_date_time",
  widget: "showX12TimeReader",
  facts: x12Facts,
};
const hl7 = {
  slug: "hl7-timestamp-reader",
  tool: "read_hl7_timestamp",
  widget: "showHl7TimestampReader",
  facts: hl7Result,
};

const lines = (i: number) => at(TAI64N_PRESETS, i).lines.join("\n");
const swiftValue = (i: number) => at(SWIFT_READ_PRESETS, i).text;
const swiftDate = (i: number) => at(SWIFT_WRITE_PRESETS, i).text;
const stampText = (i: number) => at(STAMP_PRESETS, i).text;
const fixInstant = (i: number) => at(FIX_WRITE_PRESETS, i).text;
const dtmInput = (i: number) => at(DTM_PRESETS, i).input;

const cases: Case[] = [
  {
    ...ptp,
    second: {
      seconds: "1718452800",
      nanoseconds: "500000000",
      offset: "36",
      instant: "2024-06-15T12:00:00Z",
    },
    refused: {
      seconds: at(PTP_READ_PRESETS, 4).seconds,
      nanoseconds: "0",
      offset: "37",
      instant: at(PTP_WRITE_PRESETS, 2).instant,
    },
    invalid: { seconds: "1704067237" },
  },
  {
    ...ptp,
    label: "to read only",
    example: {
      seconds: at(PTP_READ_PRESETS, 0).seconds,
      nanoseconds: "0",
      offset: "37",
    },
    second: {
      seconds: "1718452800",
      nanoseconds: "500000000",
      offset: "36",
    },
    refused: {
      seconds: at(PTP_READ_PRESETS, 5).seconds,
      nanoseconds: "0",
      offset: "37",
    },
    invalid: { nanoseconds: "0" },
  },
  {
    ...ptp,
    label: "to write only",
    example: { instant: at(PTP_WRITE_PRESETS, 0).instant },
    second: { instant: "2016-06-30T12:00:00Z", offset: "36" },
    refused: { instant: at(PTP_WRITE_PRESETS, 1).instant, offset: "37" },
    own: [NEEDS_ALL_THREE, offsetDefaultNote("37")],
    invalid: { offset: "37" },
  },
  {
    ...tai,
    second: { values: lines(3), instant: "2017-06-15T12:00:00Z" },
    refused: {
      values: "nothing to read here\nnor here",
      instant: "1960-01-01T00:00:00Z",
    },
    own: [NO_LABEL_WRITTEN],
    invalid: {},
  },
  {
    ...tai,
    label: "with lines and no instant",
    example: { values: lines(0) },
    second: { values: lines(1) },
    refused: {
      values: "@40000000659200a500000000 read\nnothing to read\nnor this",
    },
    own: [noLabelNote(2), noLabelNote(3)],
    invalid: { values: "   " },
  },
  {
    slug: "double-precision-meter",
    tool: "measure_julian_date_precision",
    widget: "showDoublePrecisionMeter",
    facts: meterFacts,
    second: { ...at(METER_PRESETS, 3).state },
    refused: { value: "not an instant", scale: "TAI" },
    invalid: { scale: "XYZ" },
  },
  {
    slug: "julian-day-counter",
    tool: "convert_instant_to_julian_date",
    widget: "showJulianDayCounter",
    facts: counterFacts,
    second: { ...at(COUNTER_PRESETS, 1).state },
    refused: { value: "abc", read: "mjd", scale: "TAI" },
    invalid: { read: "nope" },
  },
  {
    slug: "julian-day-counter",
    label: "inside a leap second",
    tool: "convert_instant_to_julian_date",
    widget: "showJulianDayCounter",
    facts: counterFacts,
    example: { ...at(COUNTER_PRESETS, 3).state },
    second: { value: "51544.5", read: "mjd", scale: "TT" },
    refused: { value: "2451545.5.5", read: "jd", scale: "TCG" },
    invalid: { scale: "x" },
  },
  {
    ...fix,
    second: { stamp: stampText(4), instant: fixInstant(2) },
    refused: { stamp: "not a stamp", instant: fixInstant(3) },
    invalid: { stamp: 5 },
  },
  {
    ...fix,
    label: "with only a stamp",
    example: { stamp: stampText(1) },
    second: { stamp: stampText(5) },
    refused: { stamp: "2024" },
    invalid: { stamp: 5 },
  },
  {
    ...fix,
    label: "with only an instant",
    example: { instant: fixInstant(1) },
    second: { instant: fixInstant(0) },
    refused: { instant: fixInstant(3) },
    invalid: { instant: 5 },
  },
  {
    ...fix,
    label: "with no field",
    example: {},
    second: {},
    refused: {},
    own: [NEEDS_A_FIELD],
    invalid: { stamp: 5 },
  },
  {
    ...swift,
    second: { value: swiftValue(3), date: swiftDate(1) },
    refused: { value: swiftValue(1), date: swiftDate(2) },
    invalid: {},
  },
  {
    ...swift,
    label: "with only a value",
    example: { value: swiftValue(0) },
    second: { value: swiftValue(4) },
    refused: { value: swiftValue(8) },
    invalid: {},
  },
  {
    ...swift,
    label: "with only a date",
    example: { date: swiftDate(0) },
    second: { date: swiftDate(1) },
    refused: { date: swiftDate(4) },
    invalid: {},
  },
  {
    ...dtm,
    second: {
      input: dtmInput(9),
      format: "719",
      zone1: "America/New_York",
      zone2: "Europe/London",
      zone3: "Asia/Tokyo",
      zone4: "Pacific/Auckland",
    },
    refused: { input: "DTM+137:notadate:203'", zone1: "Europe/Berlin" },
    invalid: {},
  },
  {
    ...dtm,
    label: "with a format",
    example: { input: "20240615", format: "102" },
    second: { input: dtmInput(8), format: "718" },
    refused: { input: "2024", format: "102" },
    invalid: { input: "20240615", format: "" },
  },
  {
    ...x12,
    second: {
      date: "20240115",
      time: "0930",
      timeCode: "ES",
      zone: "Europe/London",
      zone2: "Asia/Tokyo",
      zone3: "Australia/Sydney",
      zone4: "Asia/Shanghai",
      format: "DTS",
      value: "20240615143000-20240620160000",
    },
    refused: {
      date: "2024",
      time: "99",
      timeCode: "ET",
      zone: "Europe/London",
      format: "D6",
      value: "240615",
    },
    invalid: {},
  },
  {
    ...x12,
    label: "with a date and a time",
    example: { date: "20240615", time: "1430", timeCode: "UT" },
    second: { date: "20240115", time: "0930", timeCode: "13" },
    refused: { date: "notadate", time: "1430" },
    invalid: { timeCode: "ET" },
  },
  {
    ...x12,
    label: "with only a date",
    example: { date: "20240615" },
    second: { date: "20240115" },
    refused: { date: "2024" },
    invalid: { zone: "Europe/London" },
  },
  {
    ...x12,
    label: "with only a time",
    example: { time: "1430" },
    second: { time: "0930" },
    refused: { time: "99" },
    invalid: { zone: "Europe/London" },
  },
  {
    ...x12,
    label: "with only a DTP value",
    example: { format: "RD8", value: "20240615-20240620" },
    second: { format: "DB", value: "06152024" },
    refused: { format: "D6", value: "240615" },
    invalid: { format: "RD8" },
  },
  {
    ...hl7,
    second: {
      value: at(HL7_PRESETS, 4).value,
      zone1: "Europe/London",
      zone2: "Asia/Tokyo",
    },
    refused: { value: "not a timestamp", zone1: "Europe/Berlin" },
    invalid: {},
  },
  {
    ...hl7,
    label: "with a stated offset",
    example: { value: at(HL7_PRESETS, 1).value },
    second: { value: at(HL7_PRESETS, 3).value },
    refused: { value: "2024061" },
    invalid: { zone1: "Europe/London" },
  },
  {
    ...hl7,
    label: "with a partial value",
    example: { value: at(HL7_PRESETS, 10).value },
    second: { value: at(HL7_PRESETS, 6).value, zone1: "Africa/Johannesburg" },
    refused: { value: "20241" },
    invalid: { value: "" },
  },
  {
    slug: "fhir-date-checker",
    tool: "check_fhir_date",
    widget: "showFhirDateChecker",
    facts: fhirFacts,
    second: { value: "2015-02-07T13:28:17-05:00" },
    refused: { value: "2024-13-45" },
    prefixed: true,
    invalid: {},
  },
];

const tools = new Map<string, Tool>();
beforeAll(async () => {
  ediLib = await loadEdiLib();
  for (const c of cases) tools.set(c.slug, await loadTool(c.slug));
});

const toolOf = (c: Case): Tool => {
  const tool = tools.get(c.slug);
  if (!tool) throw new Error(`no tool ${c.slug}`);
  return tool;
};

function okOf(result: PageToolResult<unknown>) {
  if (!result.ok) throw new Error("expected ok");
  return result;
}

describe.each(cases)("$tool against $slug $label", (c) => {
  it("returns what the page computes for its first preset", async () => {
    const args = c.example ?? (await exampleOf(c.slug));
    await expectParity({
      entry: railEntryOf(c.widget),
      args,
      facts: c.facts(args),
      tool: toolOf(c),
    });
    expect(toolOf(c).name).toBe(c.tool);
  });

  it("returns what the page computes for a second preset", async () => {
    await expectParity({
      entry: railEntryOf(c.widget),
      args: c.second,
      facts: c.facts(c.second),
      tool: toolOf(c),
    });
  });

  it("explains an input the library refuses in the page's own words", async () => {
    await expectParity({
      entry: railEntryOf(c.widget),
      args: c.refused,
      facts: c.facts(c.refused),
      tool: toolOf(c),
      inspect: async (_page: RenderedWidget, result) => {
        const { notes } = okOf(result);
        expect(notes.length).toBeGreaterThan(0);
        // Every sentence the tool reports is one the page shows, but the few only the tool writes.
        for (const note of notes) {
          if (c.own?.includes(note)) continue;
          const shown = c.prefixed ? note.replace(/^[^:]+: /, "") : note;
          expect(screen.getAllByText(shown).length).toBeGreaterThan(0);
        }
      },
    });
  });

  it("resolves invalid-input for arguments the schema refuses", async () => {
    const result = await toolOf(c).execute(c.invalid, {});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("invalid-input");
  });

  it("registers through offerPageTool on a page that names it", async () => {
    const fake = fakeModelContext();
    const controller = new AbortController();
    const doc = document.implementation.createHTMLDocument("");
    const meta = doc.createElement("meta");
    meta.name = WEBMCP_MARKER;
    meta.content = c.slug;
    doc.head.append(meta);
    Object.defineProperty(doc, "modelContext", { value: fake.context });
    try {
      const outcome = await offerPageTool(
        c.slug,
        () => import(`./tools/${c.slug}.ts`),
        { doc, signal: controller.signal },
      );
      expect(outcome).toBe("registered");
      expect(fake.tools.has(c.tool)).toBe(true);
    } finally {
      controller.abort();
    }
    expect(fake.tools.size).toBe(0);
  });
});
