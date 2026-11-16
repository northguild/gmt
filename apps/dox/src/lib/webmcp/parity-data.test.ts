/**
 * @vitest-environment jsdom
 *
 * The database, identifier, cron, expiry, duration, holiday and date tools against their pages. For
 * each page the example, a second preset and a refused input: the tool's `result` is what the
 * page's redraw computed, and a library refusal reads the way the page reads it. A page whose
 * schema refines its input also has a case for the refinement's own message. A schema refusal
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
import { CARDS, readBridge } from "../column-timestamp-bridge";
import { BRIDGE_PRESETS } from "../column-timestamp-bridge-presets";
import { callArgs, formatValue } from "../punctuality-widgets";
import {
  CRON_PRESETS,
  cronView,
  NO_SIGNAL_NOTE,
  POLICIES,
  POLICY_LINE,
  readArgs as cronReadArgs,
} from "../cron-in-a-zone";
import { DB_PRESETS } from "../database-timestamp-forms";
import { readDb } from "../database-timestamp-reader";
import {
  columnBridgeProblems,
  databaseFormProblems,
} from "../dox-tool-schemas";
import { durationFacts } from "../duration-parser-bench";
import {
  compare as expiryCompare,
  handWritten,
  platesOf as expiryPlates,
  stripRows,
  verdictText,
} from "../expiry-calculator";
import {
  BUILDER_PRESETS,
  holidayFacts,
  movedCount,
  readArgs as holidayReadArgs,
  rowResult,
} from "../holiday-rule-builder";
import {
  heroOf,
  ID_PRESETS,
  readIds,
  type RowResult,
} from "../id-timestamp-decoder";
import { buildModel } from "../leap-day-birthday";
import {
  easterPlates,
  feastMarks,
  nthModel,
  nthSentence,
  readArgs as feastsReadArgs,
} from "../moving-feasts";
import {
  COMPARATOR_PRESETS,
  compare as observanceCompare,
  readArgs as observanceReadArgs,
  selectedYear,
} from "../observance-comparator";
import {
  AUDIT_PRESETS,
  HOST_NOTE_TEXT,
  kindLabel,
  lineSentence,
  parseAuditLines,
  readAuditLines,
  readingsOf,
} from "../stored-time-audit";
import { jsonSafe } from "./json-safe";
import type { PageToolResult } from "./model-context";
import { offerPageTool, WEBMCP_MARKER } from "./offer";

vi.mock("../column-timestamp-bridge", async (importOriginal) => {
  const real =
    await importOriginal<typeof import("../column-timestamp-bridge")>();
  return { ...real, readBridge: vi.fn(real.readBridge) };
});
vi.mock("../cron-in-a-zone", async (importOriginal) => {
  const real = await importOriginal<typeof import("../cron-in-a-zone")>();
  return { ...real, cronView: vi.fn(real.cronView) };
});
vi.mock("../database-timestamp-reader", async (importOriginal) => {
  const real =
    await importOriginal<typeof import("../database-timestamp-reader")>();
  return { ...real, readDb: vi.fn(real.readDb) };
});
vi.mock("../duration-parser-bench", async (importOriginal) => {
  const real =
    await importOriginal<typeof import("../duration-parser-bench")>();
  return { ...real, durationFacts: vi.fn(real.durationFacts) };
});
vi.mock("../expiry-calculator", async (importOriginal) => {
  const real = await importOriginal<typeof import("../expiry-calculator")>();
  return {
    ...real,
    compare: vi.fn(real.compare),
    handWritten: vi.fn(real.handWritten),
    platesOf: vi.fn(real.platesOf),
    readTtl: vi.fn(real.readTtl),
    stripRows: vi.fn(real.stripRows),
    takeSnapshot: vi.fn(real.takeSnapshot),
    verdictText: vi.fn(real.verdictText),
  };
});
vi.mock("../holiday-rule-builder", async (importOriginal) => {
  const real = await importOriginal<typeof import("../holiday-rule-builder")>();
  return {
    ...real,
    holidayFacts: vi.fn(real.holidayFacts),
    movedCount: vi.fn(real.movedCount),
    rowResult: vi.fn(real.rowResult),
  };
});
vi.mock("../id-timestamp-decoder", async (importOriginal) => {
  const real = await importOriginal<typeof import("../id-timestamp-decoder")>();
  return { ...real, heroOf: vi.fn(real.heroOf), readIds: vi.fn(real.readIds) };
});
vi.mock("../leap-day-birthday", async (importOriginal) => {
  const real = await importOriginal<typeof import("../leap-day-birthday")>();
  return { ...real, buildModel: vi.fn(real.buildModel) };
});
vi.mock("../moving-feasts", async (importOriginal) => {
  const real = await importOriginal<typeof import("../moving-feasts")>();
  return {
    ...real,
    easterPlates: vi.fn(real.easterPlates),
    feastMarks: vi.fn(real.feastMarks),
    nthModel: vi.fn(real.nthModel),
  };
});
vi.mock("../observance-comparator", async (importOriginal) => {
  const real =
    await importOriginal<typeof import("../observance-comparator")>();
  return { ...real, compare: vi.fn(real.compare) };
});
vi.mock("../stored-time-audit", async (importOriginal) => {
  const real = await importOriginal<typeof import("../stored-time-audit")>();
  return {
    ...real,
    parseAuditLines: vi.fn(real.parseAuditLines),
    readAuditLines: vi.fn(real.readAuditLines),
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
const at = <T>(list: readonly T[], i: number): T => {
  const item = list[i];
  if (item === undefined) throw new Error(`no preset ${i}`);
  return item;
};
const orNull = (text: string): string | null => (text === "" ? null : text);

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

// ---------------------------------------------------------------------------
// What each page computed, put together without the tool's code
// ---------------------------------------------------------------------------

const bridgeFacts = (args: Args) =>
  combined(
    [readBridge],
    ([r]) => {
      const reading = r as ReturnType<typeof readBridge>;
      const text = (c: { fn: string; args: unknown[] }) =>
        `${c.fn}(${callArgs(c.args)[1]})`;
      const hero = reading.hero;
      return {
        mode: reading.mode,
        hero:
          hero === null
            ? null
            : {
                kind: hero.kind,
                exact: hero.kind === "instant" ? hero.exact : null,
                reason: hero.kind === "instant" ? null : hero.reason,
              },
        cards: reading.cards.map((card) => ({
          id: card.id,
          title: CARDS.find((c) => c.id === card.id)?.title ?? card.id,
          status: card.status,
          stored: card.stored,
          readBack: card.readBack === null ? null : card.readBack.text,
          readBackIsWallTime: card.readBack?.kind === "local",
          zonelessRead: card.zonelessRead,
          literal: orNull(card.literal),
          validator: card.validator === null ? null : text(card.validator),
          message: orNull(card.status === "idle" ? card.idle : card.reason),
        })),
        ladder: reading.ladder,
        calls: reading.calls.map((c) => ({
          call: text(c),
          returned: formatValue(c.result),
        })),
      };
    },
    args,
  );

const dbFacts = (args: Args) =>
  combined(
    [readDb],
    ([r]) => {
      const read = r as ReturnType<typeof readDb>;
      const pair = (c: { code: string; returned: string }) => ({
        code: c.code,
        returned: c.returned,
      });
      return {
        form: read.form.id,
        database: read.form.database,
        shape: read.shape,
        value: read.value,
        ok: read.ok,
        valid: read.valid ?? null,
        instant: read.instant ?? null,
        offset: read.offset ?? null,
        timeZone: read.timeZone ?? null,
        calls: read.calls.map(pair),
        iso: read.iso === undefined ? null : read.iso.map(pair),
      };
    },
    args,
  );

const storedFacts = (args: Args) =>
  combined(
    [parseAuditLines, readAuditLines],
    ([, rows]) => ({
      lines: (rows as ReturnType<typeof readAuditLines>).map((line, i) => ({
        n: i + 1,
        value: line.value,
        kind: line.result?.kind ?? null,
        label: line.result === null ? null : kindLabel(line.result.kind),
        readings:
          line.result === null
            ? []
            : readingsOf(line.result).map((r) => ({
                name: r.name,
                value: r.value,
              })),
        sentence: lineSentence(line),
      })),
    }),
    args,
  );

const idRow = (result: RowResult) => {
  if (result.kind === "read") {
    return {
      status: "read",
      instant: result.instant,
      version: result.version ?? null,
      returned: null,
      reason: null,
    };
  }
  if (result.kind === "sentinel") {
    return {
      status: "sentinel",
      instant: null,
      version: null,
      returned: result.literal === '""' ? "" : null,
      reason: null,
    };
  }
  return {
    status: "not-called",
    instant: null,
    version: null,
    returned: null,
    reason: result.why,
  };
};

const idFacts = (args: Args) =>
  combined(
    [readIds, heroOf],
    ([r, h]) => {
      const rows = r as ReturnType<typeof readIds>;
      const hero = h as ReturnType<typeof heroOf>;
      const one = hero.kind === "one";
      return {
        outcome: hero.kind,
        format: one ? hero.format : null,
        instant: one ? hero.instant : null,
        version: one ? (hero.version ?? null) : null,
        readBy: one ? 1 : hero.kind === "many" ? hero.count : 0,
        rows: rows.map((row) => ({
          format: row.format,
          fn: row.fn,
          ...idRow(row.result),
        })),
      };
    },
    args,
  );

const cronFacts = (args: Args) =>
  combined(
    [cronView],
    ([v], a) => {
      const view = v as ReturnType<typeof cronView>;
      return {
        zone: cronReadArgs(a as never).zone,
        year: a.year,
        change: view.ordinal,
        fields:
          view.fields === null
            ? null
            : view.fields.map((f) => ({
                key: f.key,
                label: f.label,
                text: f.text,
                star: f.star,
              })),
        night:
          view.night === null
            ? null
            : {
                transition: {
                  instant: view.night.transition.instant,
                  offsetBefore: view.night.transition.offsetBefore,
                  offsetAfter: view.night.transition.offsetAfter,
                },
                start: view.night.start,
                end: view.night.end,
                same: view.night.same,
                sentence: view.night.sentence,
                rules: view.night.lanes.map((lane) => ({
                  policy: lane.policy,
                  rule: POLICY_LINE[lane.policy],
                  plate: lane.plate,
                  runs: lane.runs.map((r) => ({
                    local: r.local,
                    instant: r.instant,
                    classification: r.classification,
                  })),
                })),
              },
        after: view.afterUsed,
        lists:
          view.lists === null
            ? null
            : view.lists.map((rows, i) => ({
                policy: POLICIES[i],
                runs: rows.map((r) => ({
                  local: r.local,
                  instant: r.instant,
                  classification: r.classification,
                  only: r.only,
                })),
              })),
      };
    },
    args,
  );

const expiryFacts = (args: Args) =>
  combined(
    [expiryPlates, handWritten, expiryCompare, verdictText, stripRows],
    ([plates, hand, cmp, verdict, rows]) => {
      const p = o(plates);
      const c = o(cmp);
      const v = o(verdict);
      return {
        plates: {
          maxAge: p.maxAge,
          expires: p.expires,
          exp: p.exp,
          signed: p.signed,
        },
        comparison: {
          kind: c.kind,
          gap: c.gap,
          handWritten: hand,
          title: v.title,
          detail: v.detail,
        },
        starts: (rows as Obj[]).map((r) => ({
          start: r.start,
          ends: r.ends,
          seconds: r.seconds,
          word: r.word,
        })),
      };
    },
    args,
  );

const durationParity = (args: Args) =>
  combined(
    [durationFacts],
    ([v]) => {
      const view = v as ReturnType<typeof durationFacts>;
      return {
        parser: view.parser,
        iso: view.iso,
        cells: view.cells.map((c) => ({
          field: c.field,
          name: c.name,
          value: c.value,
        })),
        compact: view.compact,
        roundTrip: view.roundTrip,
        sameDuration: view.sameDuration,
        words: view.words,
      };
    },
    args,
  );

const holidayParity = (args: Args) =>
  combined(
    [holidayFacts, rowResult, movedCount],
    ([f, , moved]) => {
      const facts = f as ReturnType<typeof holidayFacts>;
      const state = holidayReadArgs(args as never);
      if (!facts.ok) {
        return {
          year: null,
          zone: state.zone,
          weekend: state.weekend,
          rules: [],
          closedDays: null,
          moved: null,
        };
      }
      const { year, rules, attribution } = facts;
      return {
        year,
        zone: state.zone,
        weekend: state.weekend,
        rules: rules.map((rule, i) => {
          const row = attribution.rows[i];
          const line = rowResult(
            rule,
            row?.valid ?? false,
            row?.pairs ?? [],
            year,
          );
          return {
            rule,
            valid: row?.valid ?? false,
            state: line.state,
            text: line.text,
            dates: (row?.pairs ?? []).map((d) => ({
              unshifted: d.unshifted,
              observed: d.observed === "" ? null : d.observed,
              walks: d.walks,
            })),
          };
        }),
        closedDays:
          attribution.full === null ? null : [...attribution.full.holidays],
        moved,
      };
    },
    args,
  );

const observanceParity = (args: Args) =>
  combined(
    [observanceCompare],
    ([m], a) => {
      const model = m as ReturnType<typeof observanceCompare>;
      const state = observanceReadArgs(a as never);
      return {
        holidays: model.holidays.map((h) => ({
          name: h.name,
          month: h.month,
          day: h.day,
          valid: h.valid,
        })),
        columns: model.columns.map((c) => ({
          label: c.label,
          text: c.text,
          valid: c.valid,
          reason: orNull(c.reason),
        })),
        years: model.years,
        rows: model.rows.map((row) => ({
          year: row.year,
          disagree: row.disagree,
          differing: row.differing,
          reference: row.reference < 0 ? null : row.reference,
          cells: row.cells.map((column) =>
            column.map((cell) => ({
              state: cell.state,
              unshifted: orNull(cell.unshifted),
              observed: orNull(cell.observed),
              line: orNull(cell.line1),
              moved: orNull(cell.line2),
              note: orNull(cell.note),
            })),
          ),
        })),
        detail: selectedYear(model, state),
      };
    },
    args,
  );

const feastsParity = (args: Args) =>
  combined(
    [easterPlates, feastMarks, nthModel],
    ([p, picked, n], a) => {
      const plates = o(p);
      const marks = (o(picked).marks ?? {}) as Record<
        string,
        { words: string }
      >;
      const model = o(n);
      const state = feastsReadArgs({
        year: a.year,
        offsets: a.offsets,
        month: a.month,
        weekday: a.weekday,
        ordinal: a.n,
      } as never);
      const placed = model.date !== "";
      return {
        year: Number(state.year),
        easter: {
          gregorian: plates.gregorian,
          julian: plates.julian,
          apart: plates.apart,
          side: plates.side === "" ? null : plates.side,
          feasts: Object.keys(marks)
            .sort()
            .map((date) => ({ date, words: marks[date]?.words })),
        },
        nth: {
          sentence: nthSentence(
            state.year,
            Number(state.month),
            Number(state.weekday),
            state.ordinal,
          ),
          date: placed ? model.date : null,
          occurrences: model.occurrences,
        },
      };
    },
    args,
  );

const leapParity = (args: Args) =>
  combined(
    [buildModel],
    ([m]) => {
      const model = m as ReturnType<typeof buildModel>;
      return {
        stored: model.stored,
        reads: model.reads,
        rows: model.rows.map((r) => ({
          year: r.year,
          gmt: r.gmt,
          verdict: r.verdict,
          pasted: r.pasted,
          policy: r.policy,
          policyVerdict: r.policyVerdict,
        })),
      };
    },
    args,
  );

// ---------------------------------------------------------------------------
// The cases
// ---------------------------------------------------------------------------

interface Case {
  slug: string;
  label?: string;
  tool: string;
  widget: string;
  facts: (args: Args) => Facts;
  /** Replaces the tool's own example. */
  example?: Args;
  second: Args;
  refused: Args;
  /** Notes only the tool writes, as the text or a pattern. */
  own?: (string | RegExp)[];
  /** Notes read "Label: sentence" on the page, with the label the tool leaves off or keeps. */
  prefixed?: boolean;
  invalid: Args;
}

const SEED = /not given, so the page's starting/;

const idArgs = (i: number): Args => {
  const { id, epochMs, shift, timestampBits } = at(ID_PRESETS, i).state;
  return {
    id,
    ...(epochMs ? { epochMs } : {}),
    ...(shift ? { shift } : {}),
    ...(timestampBits ? { timestampBits } : {}),
  };
};
const dbArgs = (i: number): Args => {
  const p = at(DB_PRESETS, i);
  const [value = "", value2, value3] = p.values;
  return {
    form: p.form,
    value,
    ...(value2 === undefined ? {} : { value2 }),
    ...(value3 === undefined ? {} : { value3 }),
    ...(p.zone === undefined ? {} : { zone: p.zone }),
  };
};
const bridgeArgs = (i: number): Args => {
  const { value, unit, zone, duration } = at(BRIDGE_PRESETS, i).state;
  return {
    ...(value ? { value } : {}),
    unit,
    ...(zone ? { zone } : {}),
    ...(duration ? { duration } : {}),
  };
};
const cronArgs = (i: number): Args => {
  const { line, zone, year, change } = at(CRON_PRESETS, i);
  return { line, zone, year, change };
};
const holidayArgs = (i: number): Args => {
  const p = at(BUILDER_PRESETS, i);
  return {
    rules: [...p.rules],
    weekend: [...p.weekend],
    year: p.year,
    zone: p.zone,
  };
};
const observanceArgs = (i: number): Args => {
  const p = at(COMPARATOR_PRESETS, i);
  return {
    holidays: p.holidays.map((h) => ({ month: h.month, day: h.day })),
    years: { from: p.from, to: p.to },
    weekend: [...p.weekend],
  };
};

const bridge: Case = {
  slug: "column-timestamp-bridge",
  tool: "convert_column_timestamp",
  widget: "showColumnTimestampBridge",
  facts: bridgeFacts,
  second: bridgeArgs(2),
  refused: { value: "not a time", unit: "nanosecond" },
  invalid: { unit: "second" },
};

const db: Case = {
  slug: "database-timestamp-reader",
  tool: "read_database_timestamp",
  widget: "showDatabaseTimestampReader",
  facts: dbFacts,
  second: dbArgs(7),
  refused: dbArgs(4),
  invalid: { form: "no-such-form", value: "x" },
};

const stored: Case = {
  slug: "stored-time-audit",
  tool: "check_stored_timestamps",
  widget: "showStoredTimeAudit",
  facts: storedFacts,
  second: { values: at(AUDIT_PRESETS, 1).lines.join("\n") },
  refused: { values: "not a stored time" },
  // The page writes the note around a code element, so its text is in two pieces.
  own: [HOST_NOTE_TEXT],
  invalid: { values: "   " },
};

const id: Case = {
  slug: "id-timestamp-decoder",
  tool: "decode_id_timestamp",
  widget: "showIdTimestampDecoder",
  facts: idFacts,
  second: idArgs(6),
  refused: { id: "not an id" },
  invalid: {},
};

const cron: Case = {
  slug: "cron-in-a-zone",
  tool: "check_cron_on_clock_change",
  widget: "showCronInAZone",
  facts: cronFacts,
  second: cronArgs(4),
  refused: {
    line: "not a cron line",
    zone: "Europe/London",
    year: 2024,
    change: "1",
  },
  own: [NO_SIGNAL_NOTE, /^Each list holds the next \d+ runs at most\.$/],
  invalid: { line: "30 1 * * *" },
};

const expiry: Case = {
  slug: "expiry-calculator",
  tool: "compute_expiry_forms",
  widget: "showExpiryCalculator",
  facts: expiryFacts,
  second: { amount: 1, unit: "months", start: "2027-01-31T12:00:00Z" },
  refused: { amount: 1, unit: "years", start: "not a date" },
  own: [/^isValidUtc returned false for/],
  invalid: { amount: 1.5, unit: "years" },
};

const duration: Case = {
  slug: "duration-parser-bench",
  tool: "read_duration",
  widget: "showDurationParserBench",
  facts: durationParity,
  example: { text: "2h 30m", locale: "en" },
  second: { text: "PT45M", locale: "de" },
  refused: { text: "banana", locale: "fr" },
  invalid: { text: "" },
};

const holiday: Case = {
  slug: "holiday-rule-builder",
  tool: "build_holiday_calendar",
  widget: "showHolidayRuleBuilder",
  facts: holidayParity,
  second: holidayArgs(1),
  refused: {
    rules: [{ kind: "fixed", name: "30 Feb", month: 2, day: 30 }],
    weekend: [6, 7],
    year: 2024,
    zone: "Europe/London",
  },
  invalid: { year: 1800 },
};

const observance: Case = {
  slug: "observance-comparator",
  tool: "compare_observance_policies",
  widget: "showObservanceComparator",
  facts: observanceParity,
  second: observanceArgs(2),
  refused: {
    holidays: [{ month: 2, day: 30 }],
    years: { from: 2020, to: 2024 },
    weekend: [6, 7],
  },
  own: [SEED],
  invalid: { holidays: [] },
};

const feasts: Case = {
  slug: "moving-feasts",
  tool: "compute_easter_dates",
  widget: "showMovingFeasts",
  facts: feastsParity,
  example: { year: 2026, month: 3, weekday: 3, n: 3 },
  second: {
    year: 2027,
    offsets: [0, 1, 39, 49],
    month: 10,
    weekday: 7,
    n: "last",
  },
  refused: { year: 2026, offsets: [0], month: 2, weekday: 1, n: 5 },
  invalid: { year: 1800 },
};

const leap: Case = {
  slug: "leap-day-birthday",
  tool: "resolve_yearly_date",
  widget: "showLeapDayBirthday",
  facts: leapParity,
  example: { value: "2000-02-29", year: 2024, locale: "en" },
  second: { value: "--03-15", year: 2097, locale: "de-DE" },
  refused: { value: "--02-30", year: 2023, locale: "en" },
  invalid: { value: "" },
};

const cases: Case[] = [
  bridge,
  {
    ...bridge,
    label: "decoding stored values",
    example: { bytes: "00000000000000008c3d2500" },
    second: { julianDay: "2440588", nanosOfDay: "0" },
    refused: { int64: "-1", unit: "nanosecond", zone: "Not/AZone" },
    invalid: { bytes: "xyz" },
    own: [SEED],
  },
  db,
  {
    ...db,
    label: "with a session zone",
    example: dbArgs(DB_PRESETS.findIndex((p) => p.zone !== undefined)),
    second: {
      ...dbArgs(DB_PRESETS.findIndex((p) => p.zone !== undefined)),
      value: "2024-06-15 08:00:00",
      zone: "Europe/London",
    },
    refused: {
      ...dbArgs(DB_PRESETS.findIndex((p) => p.zone !== undefined)),
      value: "not a time",
    },
  },
  stored,
  {
    ...stored,
    label: "with more lines than it reads",
    example: {
      values: Array.from(
        { length: 14 },
        () => "2024-03-31T02:30:00+01:00[Europe/Berlin]",
      ).join("\n"),
    },
    second: { values: "2024-10-27T02:30:00+01:00[Europe/Berlin]" },
    own: [HOST_NOTE_TEXT],
    refused: {
      values: Array.from({ length: 13 }, () => "not a stored time").join("\n"),
    },
  },
  id,
  {
    ...id,
    label: "with a Snowflake layout",
    example: idArgs(ID_PRESETS.findIndex((p) => p.state.epochMs !== "")),
    second: idArgs(ID_PRESETS.findIndex((p) => p.state.timestampBits !== "")),
    refused: {
      id: "not an id",
      epochMs: "1420070400000",
      shift: "22",
    },
  },
  cron,
  {
    ...cron,
    label: "with no zone",
    example: { line: "30 1 * * *", year: 2024 },
    second: { line: "0 0 * * *", year: 2018, change: "2" },
    refused: { line: "not a cron line", year: 2024 },
    own: [
      NO_SIGNAL_NOTE,
      /^No zone was given/,
      /^Each list holds the next \d+ runs at most\.$/,
    ],
  },
  {
    ...cron,
    label: "with a zone the browser does not know",
    example: cronArgs(0),
    second: cronArgs(2),
    refused: { line: "30 1 * * *", zone: "Not/AZone", year: 2024, change: "1" },
  },
  expiry,
  {
    ...expiry,
    label: "with no start",
    example: { amount: 2, unit: "days" },
    second: { amount: 90, unit: "days" },
    refused: { amount: 1, unit: "months" },
    own: [/^No start was given/, /^isValidUtc returned false for/],
  },
  duration,
  {
    ...duration,
    label: "with no locale",
    example: { text: "2h 30m" },
    second: { text: "P1Y2M" },
    refused: { text: "banana" },
    own: [/^No locale was given/],
  },
  holiday,
  {
    ...holiday,
    label: "with nothing but a year",
    example: { year: 2024 },
    second: { year: 2031 },
    refused: { year: 2024, rules: holiday.refused.rules },
    own: [SEED],
  },
  observance,
  {
    ...observance,
    label: "with a rule the library refuses",
    example: observanceArgs(1),
    second: observanceArgs(2),
    refused: {
      ...observanceArgs(0),
      holidays: [{ month: 2, day: 30 }],
    },
    own: [SEED],
  },
  feasts,
  leap,
  {
    ...leap,
    label: "with no year",
    example: { value: "2000-02-29" },
    second: { value: "03-15", locale: "ja-JP" },
    refused: { value: "--02-30" },
    own: [/^No year was given/],
  },
];

const tools = new Map<string, Tool>();
beforeAll(async () => {
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

const parityFor = (c: Case, args: Args) => c.facts(args);

describe.each(cases)("$tool against $slug $label", (c) => {
  it("returns what the page computes for its first example", async () => {
    const args = c.example ?? (await exampleOf(c.slug));
    await expectParity({
      entry: railEntryOf(c.widget),
      args,
      facts: parityFor(c, args),
      tool: toolOf(c),
    });
    expect(toolOf(c).name).toBe(c.tool);
  });

  it("returns what the page computes for a second input", async () => {
    await expectParity({
      entry: railEntryOf(c.widget),
      args: c.second,
      facts: parityFor(c, c.second),
      tool: toolOf(c),
    });
  });

  it("explains an input the library refuses in the page's own words", async () => {
    await expectParity({
      entry: railEntryOf(c.widget),
      args: c.refused,
      facts: parityFor(c, c.refused),
      tool: toolOf(c),
      inspect: async (_page: RenderedWidget, result) => {
        const { notes } = okOf(result);
        expect(notes.length).toBeGreaterThan(0);
        // Every sentence the tool reports is one the page shows, but the few only the tool writes.
        for (const note of notes) {
          if (
            c.own?.some((own) =>
              typeof own === "string" ? own === note : own.test(note),
            )
          ) {
            continue;
          }
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

// ---------------------------------------------------------------------------
// A refinement's own message
// ---------------------------------------------------------------------------

describe("a refinement refuses with its own message", () => {
  const messagesOf = async (slug: string, args: Args) => {
    const tool = await loadTool(slug);
    const result = await tool.execute(args, {});
    expect(result.ok).toBe(false);
    if (result.ok || result.error !== "invalid-input") {
      throw new Error("expected invalid-input");
    }
    return result.issues.map((issue: { message: string }) => issue.message);
  };

  it("convert_column_timestamp names the mode a stored value needs", async () => {
    const args = {
      value: "2024-01-01T00:00:00Z",
      mode: "encode",
      bytes: "00000000000000008c3d2500",
    };
    const expected = columnBridgeProblems(args);
    expect(expected).toContain(
      "Stored values need mode decode. Leave mode out or send decode.",
    );
    expect(await messagesOf("column-timestamp-bridge", args)).toEqual(expected);
  });

  it("read_database_timestamp names the count of values the form takes", async () => {
    const args = {
      form: at(DB_PRESETS, 0).form,
      value: "2024-03-15 14:30:00+00",
      value2: "extra",
    };
    const expected = databaseFormProblems(args);
    expect(expected).toHaveLength(1);
    expect(await messagesOf("database-timestamp-reader", args)).toEqual(
      expected,
    );
  });

  it("read_database_timestamp refuses a zone for a form with no session zone", async () => {
    const args = { ...dbArgs(0), zone: "UTC" };
    const expected = databaseFormProblems(args);
    expect(expected).toHaveLength(1);
    expect(await messagesOf("database-timestamp-reader", args)).toEqual(
      expected,
    );
  });

  it("check_cron_on_clock_change names a change that is not a digit string from 1 to 20", async () => {
    const messages = await messagesOf("cron-in-a-zone", {
      line: "30 1 * * *",
      zone: "Europe/London",
      year: 2024,
      change: "21",
    });
    expect(messages).toContain('change is a digit string from "1" to "20".');
  });

  it("check_stored_timestamps refuses a blank list", async () => {
    expect(await messagesOf("stored-time-audit", { values: "  \n " })).toEqual([
      "Send at least one line.",
    ]);
  });

  it("compute_easter_dates refuses an offset the page has no switch for", async () => {
    const messages = await messagesOf("moving-feasts", {
      year: 2026,
      offsets: [3],
      month: 3,
      weekday: 3,
      n: 3,
    });
    expect(messages).toEqual([
      "Each offset is one of -46, -2, 0, 1, 39, 49, 50.",
    ]);
  });
});
