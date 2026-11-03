/**
 * The Database Timestamp Reader widget, mountable on its tool page and in the chat rail.
 *
 * The reader picks a database, a form that database hands back and types the form's one to three
 * fields. One library call reads them, and the plate names what it returned. The calls made are
 * printed under it, and for a SQL offset form the two ISO readers are asked about the same text and
 * shown beside it, each with what it really returns.
 *
 * Built on the component kit: `renderDatabaseTimestampReaderTemplate` writes the markup from
 * builders only, with ids from `idScope(idPrefix)`; `mount` finds its parts by those ids. Every
 * listener is delegated on the widget with the mount's `signal`. The widget computes no result: the
 * form list, the printed templates and the calls live in `database-timestamp-forms.ts` and
 * `database-timestamp-reader.ts`, and what the plate shows is what the call returned.
 */
import {
  badge,
  card,
  codeFrame,
  escapeHtml,
  field,
  findWidget,
  hint,
  html,
  idScope,
  plates,
  raw,
  section,
  select,
  setHtml,
  textInput,
  toolLinks,
  widget,
  type SafeHtml,
} from "~/widgets/builders";
import { callOutput } from "~/widgets/families/gnss/call-output";
import { instantHero } from "~/widgets/families/ids/instant-hero";
import { grow } from "~/widgets/primitives/grow/grow";
import { preset, type GmtPreset } from "~/widgets/primitives/preset/preset";
import styles from "~/widgets/tools/database-timestamp-reader.module.css";
import { defineElements } from "~/widgets/define";
import { loadDatabaseLib, type DatabaseLib } from "./database-lib";
import {
  DATABASES,
  DB_ELSEWHERE,
  DB_FORMS,
  DB_PRESETS,
  formOf,
  formsOf,
  type DbForm,
  type DbPreset,
  type FormKind,
} from "./database-timestamp-forms";
import {
  GIVE_ZONE_TEXT,
  NOT_A_NUMBER_TEXT,
  readDb,
  unknownZoneText,
  type DbCall,
  type DbReading,
} from "./database-timestamp-reader";
import { withBase } from "./site";
import { codeSpan } from "./widget-ui";
import { onceDestroy, WidgetLoadError, type MountFn } from "./widget-mount";

/** What a seed names: a preset, or a form with its fields and zone. All strings. */
export interface DatabaseTimestampReaderArgs {
  preset?: string;
  form?: string;
  value?: string;
  value2?: string;
  value3?: string;
  zone?: string;
}

const WIDGET_NAME = "database-timestamp-reader";
export const CUSTOM_PRESET_ID = "custom";
const MAX_FIELDS = 3;
/** The permalink key and the field id of each of the three value slots, in order. */
const VALUE_KEYS = ["value", "value2", "value3"] as const;
const HERO_CAP_IDLE = "Reading";
export const ZONE_LABEL = "Session time zone";
const ZONE_HINT =
  "An IANA name such as Europe/Stockholm. Blank reads the wall time alone.";

const LOST_TEXT =
  "The call returned its empty sentinel for this text, so there is no value.";
/**
 * What a part the reading does not use carries: out of sight (the stylesheet), out of the
 * accessibility tree, out of the tab order. It keeps its box.
 */
const OFF = html`data-off="true" aria-hidden="true" inert`;

const ISO_TITLE = "The ISO readers on the same text";
const INVALID_TEXT =
  "The validator returned false: the text is not a valid value.";

/** The widest instant a plate can show: a nanosecond instant with an offset. */
const WIDEST_VALUE = "2025-02-18T12:34:56.789123456+01:00";
const WIDEST_OFFSET = "-00:44:30";
const WIDEST_ZONE = "America/Argentina/Buenos_Aires";

/** What each kind of form reads as on the badge. The words carry the meaning. */
const KIND_WORDS: Record<FormKind, string> = {
  export: "export",
  composition: "composition",
  new: "new in this release",
};

/** Every sentence the plate's reason slot can show. */
const REASONS = [
  NOT_A_NUMBER_TEXT,
  GIVE_ZONE_TEXT,
  unknownZoneText("Mars/Olympus_Mons_Station"),
  LOST_TEXT,
  INVALID_TEXT,
];

/** Every caption the plate can show. */
const CAPTIONS = [HERO_CAP_IDLE, ...DATABASES];

const DEFAULT_PRESET: DbPreset = DB_PRESETS[0]!;

const DATABASE_OPTIONS = DATABASES.map((d) => ({ value: d, label: d }));

/** The tallest the main calls print: the declarations, the call and the offset split. */
const CALL_LINES = 4;
/** One output line per main call: the call and the offset split. */
const OUTPUT_LINES = 2;
/** The ISO readers print a declaration and a call each, and return one value each. */
const ISO_LINES = 4;
const ISO_OUTPUT_LINES = 2;

/** The lines each block reserves, for the test that holds them to every preset. */
export const RESERVED_LINES = {
  calls: CALL_LINES,
  output: OUTPUT_LINES,
  iso: ISO_LINES,
  isoOutput: ISO_OUTPUT_LINES,
} as const;

const MAIN_FRAME = {
  label: "Calls made",
  copyLabel: "Copy calls",
  minLines: CALL_LINES,
} as const;

/** The widest line any printed call can have, to size the frame once. */
const CALL_SIZER = [
  ...DB_FORMS.map((f) => f.call),
  'toOffsetInstant("2025-02-18T12:34:56.789+01:00[Europe/Stockholm]")',
].reduce((a, b) => (b.length > a.length ? b : a));

// ---------------------------------------------------------------------------
// State, seeds and permalinks
// ---------------------------------------------------------------------------

export interface DatabaseReaderState {
  formId: string;
  values: readonly string[];
  zone: string;
}

export function presetState(p: DbPreset): DatabaseReaderState {
  return { formId: p.form, values: [...p.values], zone: p.zone ?? "" };
}

function fieldValues(state: DatabaseReaderState, form: DbForm): string[] {
  return form.fields.map((_, i) => state.values[i] ?? "");
}

/** The preset the state equals, or the custom id. */
export function matchPreset(state: DatabaseReaderState): string {
  const form = formOf(state.formId);
  if (!form) return CUSTOM_PRESET_ID;
  const typed = fieldValues(state, form);
  const found = DB_PRESETS.find(
    (p) =>
      p.form === state.formId &&
      (p.zone ?? "") === (form.zone ? state.zone : "") &&
      p.values.length === typed.length &&
      p.values.every((v, i) => v === typed[i]),
  );
  return found?.id ?? CUSTOM_PRESET_ID;
}

/** True when the args name anything to seed the widget from. */
export function isSeeded(
  args: DatabaseTimestampReaderArgs | undefined,
): boolean {
  return (
    args !== undefined &&
    (typeof args.preset === "string" ||
      (typeof args.form === "string" && formOf(args.form) !== undefined))
  );
}

/**
 * The state a seed describes: a preset, or a form with the fields the seed also names. A form
 * with no values starts from its first preset, so no field opens blank unless the link says so.
 * Once the seed names a value, a zone form's session zone is the seed's alone, blank when it
 * names none: a preset's zone is never lent to a value it was not paired with.
 */
export function readArgs(
  args: DatabaseTimestampReaderArgs,
): DatabaseReaderState {
  const named = DB_PRESETS.find((p) => p.id === args.preset);
  if (named) return presetState(named);
  const form = typeof args.form === "string" ? formOf(args.form) : undefined;
  if (!form) return presetState(DEFAULT_PRESET);
  const first = DB_PRESETS.find((p) => p.form === form.id);
  const state = first
    ? presetState(first)
    : { formId: form.id, values: form.fields.map(() => ""), zone: "" };
  VALUE_KEYS.forEach((key, i) => {
    const v = args[key];
    if (typeof v === "string" && i < form.fields.length) {
      state.values = state.values.map((old, j) => (j === i ? v : old));
    }
  });
  const ownValues = VALUE_KEYS.some((key) => typeof args[key] === "string");
  if (form.zone && typeof args.zone === "string") state.zone = args.zone;
  else if (form.zone && ownValues) state.zone = "";
  return state;
}

/**
 * The permalink keys for `state`: `preset` alone when it is exactly a preset, else the form, every
 * field it has (even blank, so a cleared field comes back blank) and the zone of a zone form.
 */
export function permalinkOf(
  state: DatabaseReaderState,
): Record<string, string> {
  const preset = matchPreset(state);
  if (preset !== CUSTOM_PRESET_ID) return { preset };
  const form = formOf(state.formId);
  if (!form) return {};
  const out: Record<string, string> = { form: form.id };
  fieldValues(state, form).forEach((v, i) => {
    out[VALUE_KEYS[i]!] = v;
  });
  if (form.zone) out["zone"] = state.zone;
  return out;
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

const TOKEN =
  /("(?:[^"\\]|\\.)*")|(\b\d[\d_]*(?:\.\d+)?n?\b)|([A-Za-z_]\w*)(?=\()/g;

/** One printed call as highlighted markup: strings, numbers and called names. */
function codeOf(code: string): SafeHtml {
  let out = "";
  let last = 0;
  for (const m of code.matchAll(TOKEN)) {
    out += escapeHtml(code.slice(last, m.index));
    const kind = m[1] !== undefined ? "str" : m[2] !== undefined ? "num" : "fn";
    out += codeSpan(kind, m[0]);
    last = m.index + m[0].length;
  }
  return raw(out + escapeHtml(code.slice(last)));
}

function callsOf(calls: readonly DbCall[]): { code: SafeHtml; plain: string } {
  return {
    code: raw(calls.map((c) => codeOf(c.code).value).join("\n")),
    plain: calls.map((c) => c.code).join("\n"),
  };
}

function framesOf(
  calls: readonly DbCall[],
  o: { label: string; copyLabel: string; minLines: number },
): SafeHtml {
  const { code, plain } = callsOf(calls);
  return codeFrame({
    label: o.label,
    copyLabel: o.copyLabel,
    copyText: plain,
    ...(calls.length === 0 ? {} : { code }),
    minLines: o.minLines,
    sizer: CALL_SIZER,
    gate: "codeframe",
  });
}

/** True when the form's own call returned its sentinel (not a refusal, not a validator's `false`). */
function isLost(reading: DbReading): boolean {
  if (reading.ok || reading.shape === "valid") return false;
  return reading.note === undefined || reading.note === GIVE_ZONE_TEXT;
}

function reasonOf(reading: DbReading): string {
  if (isLost(reading)) return reading.note ?? LOST_TEXT;
  if (reading.note !== undefined) return reading.note;
  if (reading.shape === "valid" && !reading.valid) return INVALID_TEXT;
  return "";
}

function plateOf(reading: DbReading | null): SafeHtml {
  const lost = reading !== null && isLost(reading);
  const state =
    reading === null || (reading.value === "" && !lost)
      ? "empty"
      : lost
        ? "none"
        : "one";
  return instantHero({
    gate: "hero",
    caption: reading === null ? HERO_CAP_IDLE : reading.form.database,
    captions: CAPTIONS,
    label: "Reading",
    state,
    value: reading === null ? "" : reading.value,
    sample: WIDEST_VALUE,
    lost,
    bar: state === "one",
    chip: null,
    call: null,
    reason: reading === null ? "" : reasonOf(reading),
    reasons: REASONS,
  });
}

/**
 * The kind badge: the form's kind in words. The slot is as wide as the widest word, so a form
 * with another kind never moves what sits beside it.
 */
function kindOf(kind: FormKind): SafeHtml {
  return html`<div class="${styles.kind}" data-gate="kind">${badge({ text: KIND_WORDS[kind], tone: "neutral" })}</div>`;
}

/**
 * The offset plate. It is laid out for every reading and drawn only when the reading split an
 * offset out, so a reading without one keeps its box.
 */
function offsetOf(reading: DbReading | null): SafeHtml {
  const offset = reading?.offset;
  const off = offset === undefined;
  return html`<div class="${styles.offset}" ${off ? OFF : ""}>${plates(
    [
      {
        caption: "Offset",
        value: off ? "" : offset,
        lines: [off ? "" : (reading?.timeZone ?? "")],
        samples: [WIDEST_OFFSET],
        lineSamples: [[WIDEST_ZONE]],
      },
    ],
    { gate: "offset" },
  )}</div>`;
}

function outputOf(reading: DbReading | null): SafeHtml {
  const label = "What the calls returned";
  if (reading === null || reading.calls.length === 0) {
    return callOutput({
      label,
      state: "empty",
      lines: [],
      minLines: OUTPUT_LINES,
    });
  }
  const lost = isLost(reading);
  return callOutput({
    label,
    state: lost && reading.calls.length === 1 ? "sentinel" : "live",
    lines: reading.calls.map((c, i) => ({
      text: c.returned,
      lost: lost && i === 0,
    })),
    minLines: OUTPUT_LINES,
  });
}

const ISO_FRAME = {
  label: "ISO reader calls",
  copyLabel: "Copy ISO reader calls",
  minLines: ISO_LINES,
};

/** The ISO readers' calls: none off a `new` form. */
function isoCallsOf(reading: DbReading | null, kind: FormKind): SafeHtml {
  return framesOf(kind === "new" ? (reading?.iso ?? []) : [], ISO_FRAME);
}

/** What the ISO readers returned, each its real return in ink: they compare, they judge nothing. */
function isoOutputOf(reading: DbReading | null, kind: FormKind): SafeHtml {
  const calls = kind === "new" ? (reading?.iso ?? []) : [];
  return callOutput({
    label: "What the ISO readers returned",
    state: calls.length === 0 ? "empty" : "live",
    lines: calls.map((c) => ({ text: c.returned, lost: false })),
    minLines: ISO_OUTPUT_LINES,
  });
}

/**
 * The ISO readers asked about the same text, in a card of their own. The card is built once, laid
 * out for every form and drawn only for a `new` form, so a form without it keeps the page's
 * shape. A reading redraws what is inside the card, never the card, so its entrance plays once.
 */
function isoOf(idOf: (name: string) => string, kind: FormKind): SafeHtml {
  return html`<div id="${idOf("iso")}" class="${styles.iso}" data-gate="iso" ${kind === "new" ? "" : OFF}>${card(
    html`<h5 class="${styles.cardTitle}">${ISO_TITLE}</h5><div id="${idOf("iso-calls")}">${isoCallsOf(null, kind)}</div><div id="${idOf("iso-output")}">${isoOutputOf(null, kind)}</div>`,
  )}</div>`;
}

/** Marks a part off (out of sight, the accessibility tree and the tab order) or back on, as `OFF` does. */
function setOff(node: HTMLElement, off: boolean): void {
  node.toggleAttribute("inert", off);
  if (off) {
    node.setAttribute("data-off", "true");
    node.setAttribute("aria-hidden", "true");
  } else {
    node.removeAttribute("data-off");
    node.removeAttribute("aria-hidden");
  }
}

/** Where the forms with no reader here are read, one line each, whatever the form on show. */
function elsewhereOf(): SafeHtml {
  return html`<div class="${styles.elsewhere}"><p class="${styles.elsewhereTitle}">Forms that live elsewhere</p
    ><ul class="${styles.elsewhereList}">${DB_ELSEWHERE.map(
      (e) =>
        html`<li><a href="${withBase(e.href)}">${e.database}: ${e.form}</a></li>`,
    )}</ul></div>`;
}

function linksOf(): SafeHtml {
  return toolLinks({
    label: "Other tools",
    links: [
      {
        text: "Databases guide",
        href: withBase("/guides/conversion/databases/"),
      },
      {
        text: "ID Timestamp Decoder",
        href: withBase("/tools/id-timestamp-decoder/"),
      },
      {
        text: "Foreign Epoch Bridges",
        href: withBase("/guides/conversion/foreign-epoch-bridges/"),
      },
      {
        text: "Column Timestamp Bridge",
        href: withBase("/tools/column-timestamp-bridge/"),
      },
      {
        text: "Converter Bench",
        href: withBase("/tools/converter-bench/"),
      },
    ],
  });
}

/**
 * The form select, the forms that live elsewhere and the fields of one form. Every one of the three
 * value slots and the zone slot is laid out for every form, and the ones the form does not use are
 * marked off and hidden, so picking another form never moves what is below. The zone slot shares a
 * row with the second value, since no form has both.
 */
function formPartsOf(
  id: (local: string) => string,
  state: DatabaseReaderState,
  form: DbForm,
): SafeHtml {
  const values = fieldValues(state, form);
  const slot = (i: number): SafeHtml => {
    const f = form.fields[i];
    const off = f === undefined;
    const key = VALUE_KEYS[i]!;
    const body = field({
      id: id(key),
      label: f?.label ?? "Unused field",
      ...(f?.hint ? { hint: hint(id(`${key}-hint`), f.hint) } : {}),
      control: ({ id: cid, describedBy }) =>
        textInput({
          id: cid,
          value: values[i] ?? "",
          autocomplete: "off",
          spellcheck: false,
          maxLength: 96,
          describedBy,
        }),
    });
    return html`<div class="${styles.slot}" data-slot="${key}" ${off ? OFF : ""}>${body}</div>`;
  };
  const zoneOff = form.zone !== true;
  const zone = html`<div class="${styles.slot}" data-slot="zone" ${zoneOff ? OFF : ""}>${field(
    {
      id: id("zone"),
      label: ZONE_LABEL,
      hint: hint(id("zone-hint"), ZONE_HINT),
      control: ({ id: cid, describedBy }) =>
        textInput({
          id: cid,
          value: zoneOff ? "" : state.zone,
          autocomplete: "off",
          spellcheck: false,
          maxLength: 64,
          describedBy,
        }),
    },
  )}</div>`;
  return html`${field({
    id: id("form"),
    label: "Form",
    control: ({ id: cid, describedBy }) =>
      select({
        id: cid,
        value: form.id,
        options: formsOf(form.database).map((f) => ({
          value: f.id,
          label: f.form,
        })),
        describedBy,
      }),
  })}${elsewhereOf()}<div class="${styles.fields}">${Array.from({ length: MAX_FIELDS }, (_, i) => slot(i))}${zone}</div>`;
}

// ---------------------------------------------------------------------------
// Template
// ---------------------------------------------------------------------------

/**
 * The widget's chrome, seeded with `args` so the first paint shows them. With no args it shows the
 * first preset. The plate and the calls are drawn by `mount`, because they come from real library
 * calls.
 */
export function renderDatabaseTimestampReaderTemplate(
  idPrefix: string,
  args: DatabaseTimestampReaderArgs = {},
): SafeHtml {
  const id = idScope(idPrefix);
  const state = isSeeded(args) ? readArgs(args) : presetState(DEFAULT_PRESET);
  const form = formOf(state.formId)!;

  const pick = section(
    { id: id("pick"), heading: "1. Pick a database and a form", level: 4 },
    html`<div class="${styles.controls}">${preset({
      id: id("preset"),
      label: "Preset",
      value: matchPreset(state),
      options: [
        { value: CUSTOM_PRESET_ID, label: "Your values", description: "" },
        ...DB_PRESETS.map((p) => ({
          value: p.id,
          label: p.label,
          description: formOf(p.form)?.form ?? "",
        })),
      ],
    })}${field({
      id: id("database"),
      label: "Database",
      control: ({ id: cid, describedBy }) =>
        select({
          id: cid,
          value: form.database,
          options: DATABASE_OPTIONS,
          describedBy,
        }),
    })}<div id="${id("form-parts")}" class="${styles.parts}">${formPartsOf(id, state, form)}</div></div>`,
  );

  const read = section(
    { id: id("read"), heading: "2. What the call reads", level: 4 },
    html`<div class="${styles.results}">${grow(
      html`<div id="${id("hero")}">${plateOf(null)}</div>`,
    )}<div class="${styles.side}"><div id="${id("kind")}">${kindOf(form.kind)}</div><div id="${id("offset")}">${offsetOf(null)}</div></div></div>`,
  );

  const calls = section(
    { id: id("calls"), heading: "3. The calls", level: 4 },
    html`<div class="${styles.pair}">${card(
      html`<h5 class="${styles.cardTitle}">The calls made</h5>${grow(
        html`<div id="${id("calls-slot")}">${framesOf([], MAIN_FRAME)}</div>`,
      )}${grow(html`<div id="${id("output-slot")}">${outputOf(null)}</div>`)}`,
    )}${isoOf(id, form.kind)}</div>${grow(
      html`<div id="${id("links")}">${linksOf()}</div>`,
    )}`,
  );

  return widget(
    { name: WIDGET_NAME, label: "Database Timestamp Reader", scope: idPrefix },
    html`${pick}${read}${calls}`,
  );
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

interface Controller {
  readState(): DatabaseReaderState;
  apply(state: DatabaseReaderState): void;
}

function setupWidget(
  root: HTMLElement,
  lib: DatabaseLib,
  signal: AbortSignal,
): Controller {
  const { el: widgetEl, id, part: el } = findWidget(root, WIDGET_NAME);
  const presetEl = widgetEl.querySelector<GmtPreset>("gmt-preset")!;
  let formId =
    formOf(el<HTMLSelectElement>("form").value)?.id ?? DEFAULT_PRESET.form;

  const input = (name: string): HTMLInputElement => el<HTMLInputElement>(name);

  const readState = (): DatabaseReaderState => {
    const form = formOf(formId)!;
    return {
      formId,
      values: form.fields.map((_, i) => input(VALUE_KEYS[i]!).value),
      zone: form.zone ? input("zone").value : "",
    };
  };

  function syncPreset(): void {
    presetEl.value = matchPreset(readState());
  }

  function render(): void {
    const state = readState();
    const form = formOf(state.formId)!;
    const reading = readDb(lib, form.id, state.values, state.zone);
    setHtml(el("hero"), plateOf(reading));
    setHtml(el("kind"), kindOf(form.kind));
    setHtml(el("offset"), offsetOf(reading));
    setHtml(el("calls-slot"), framesOf(reading.calls, MAIN_FRAME));
    setHtml(el("output-slot"), outputOf(reading));
    setOff(el("iso"), form.kind !== "new");
    setHtml(el("iso-calls"), isoCallsOf(reading, form.kind));
    setHtml(el("iso-output"), isoOutputOf(reading, form.kind));
    setHtml(el("links"), linksOf());
  }

  /** Redraw the form select and the fields for `state`, then read. */
  function apply(state: DatabaseReaderState): void {
    const form = formOf(state.formId) ?? formOf(DEFAULT_PRESET.form)!;
    formId = form.id;
    el<HTMLSelectElement>("database").value = form.database;
    setHtml(el("form-parts"), formPartsOf(id, { ...state, formId }, form));
    syncPreset();
    render();
  }

  widgetEl.addEventListener(
    "input",
    (e) => {
      const target = e.target as HTMLElement | null;
      if (target === null || target.tagName !== "INPUT") return;
      syncPreset();
      render();
    },
    { signal },
  );

  widgetEl.addEventListener(
    "change",
    (e) => {
      const target = e.target;
      if (target === presetEl) {
        const chosen = DB_PRESETS.find((p) => p.id === presetEl.value);
        // "Your values" keeps what is typed.
        if (chosen) apply(presetState(chosen));
        return;
      }
      if (target === el("database")) {
        const database = (target as HTMLSelectElement).value;
        const first = DB_PRESETS.find(
          (p) => formOf(p.form)?.database === database,
        );
        const form = formsOf(database)[0];
        if (first) apply(presetState(first));
        else if (form) {
          apply({
            formId: form.id,
            values: form.fields.map(() => ""),
            zone: "",
          });
        }
        return;
      }
      if (target === el("form")) {
        const next = formOf((target as HTMLSelectElement).value);
        if (!next) return;
        const first = DB_PRESETS.find((p) => p.form === next.id);
        apply(
          first
            ? presetState(first)
            : { formId: next.id, values: next.fields.map(() => ""), zone: "" },
        );
      }
    },
    { signal },
  );

  syncPreset();
  render();
  return { readState, apply };
}

export const mountDatabaseTimestampReader: MountFn<
  DatabaseTimestampReaderArgs
> = async (root, args, signal) => {
  defineElements();
  let lib: DatabaseLib;
  try {
    lib = await loadDatabaseLib();
  } catch (cause) {
    // Loud, not inert: the host decides what to show (see `WidgetLoadError`).
    throw cause instanceof WidgetLoadError ? cause : new WidgetLoadError(cause);
  }
  if (signal.aborted) return onceDestroy(() => {});

  const widget = setupWidget(root, lib, signal);
  if (isSeeded(args)) widget.apply(readArgs(args));

  return onceDestroy(
    () => {},
    () => permalinkOf(widget.readState()),
  );
};
