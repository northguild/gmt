/**
 * The Elapsed vs. Clock Difference widget (MAR-16), mountable on its tool page
 * and in the chat rail.
 *
 * Two UTC readings, and two ways to subtract them. The clock difference counts
 * no inserted second; the seconds that passed, read through TAI, count every
 * one. The three numbers sit as a sum above two rulers: the UTC clock face, one
 * cell per clock second, and the SI seconds that passed, one cell per second
 * under it. An inserted second is a stretched `:60` cell on the clock face that
 * the clock tape leaves a gap for and the elapsed tape fills, so the elapsed
 * ruler runs one second longer. A long span keeps the seconds next to each end,
 * a break, and every inserted second as its own cell. A native range moves the
 * end by day.
 *
 * Built on the component kit: `renderElapsedVsClockTemplate` writes the chrome from
 * builders only, with ids from `idScope(idPrefix)`, and `mount` fills each slot from
 * real library calls with `setHtml`. Every listener is delegated on the widget with
 * the mount's `signal`. Every printed call and result is the real one; the drawing
 * only places them. The ruler cells are this tool's own drawing, so their markup is
 * built here and styled by its CSS Module.
 */
import { getUnixNow } from "@northguild/gmt/unix/get";
import { defineElements } from "~/widgets/define";
import {
  aside,
  codeFrame,
  field,
  fieldGrid,
  findWidget,
  hint,
  html,
  idScope,
  plates,
  section,
  setHtml,
  srOnly,
  swatch,
  textInput,
  toolLinks,
  widget,
  type Plate,
  type SafeHtml,
  type ToolLinkItem,
} from "~/widgets/builders";
import { callOutput } from "~/widgets/families/gnss/call-output";
import { callLines, outputOf } from "~/widgets/families/gnss/call-lines";
import { grow } from "~/widgets/primitives/grow/grow";
import { preset, type GmtPreset } from "~/widgets/primitives/preset/preset";
import { range, type GmtRange } from "~/widgets/primitives/range/range";
import styles from "~/widgets/tools/elapsed-vs-clock.module.css";
import { NO_RESULT_TITLE } from "./edi-widgets";
import {
  CUSTOM_PRESET_ID,
  ELAPSED_LINKS,
  ELAPSED_PRESETS,
  blankPlates,
  elapsedHandoffs,
  elapsedPlates,
  isSeeded,
  matchPreset,
  permalinkOf,
  presetState,
  readArgs,
  readElapsed,
  rulerModel,
  summaryText,
  type ElapsedRead,
  type ElapsedState,
  type ElapsedVsClockArgs,
  type RulerCell,
  type RulerModel,
  type RulerPiece,
} from "./elapsed-vs-clock";
import { onWidthChange } from "./label-fit";
import {
  drawMs,
  sliderDate,
  sliderMax,
  sliderPosition,
} from "./leap-second-timeline";
import type { TimescaleLib } from "./timescale-lib";
import { loadTimescaleLib } from "./timescale-lib";
import { INTEGER_UTC_FROM } from "./timescale-widgets";
import { onceDestroy, WidgetLoadError, type MountFn } from "./widget-mount";
import { handoffHref } from "./widget-permalink";

export type { ElapsedVsClockArgs } from "./elapsed-vs-clock";

const WIDGET_NAME = "elapsed-vs-clock";

/** The text of an output with nothing to read: a blank field makes no call. */
const BLANK_TEXT = "Not read: the field is blank.";

/** The sentence of the list when the span holds no inserted second. */
const NONE_COUNTED_TEXT = "No second was inserted between these two.";
const NOT_READ_TEXT = "Not read: there is no count.";

const NO_SIGNAL_RULER = "⟨ NO SIGNAL — invalid input ⟩";

/** The widest value each plate prints, so the three keep their width while the end is dragged. */
const PLATE_SAMPLES: Readonly<Record<string, readonly string[]>> = {
  "hero-clock": ["-4444444444 s"],
  "hero-elapsed": ["-4444444444 s"],
  "hero-count": ["-44"],
};

const GROUPS = [
  { id: "clock", heading: "Clock difference", calls: "spanNs" },
  {
    id: "elapsed",
    heading: "Seconds that passed",
    calls: "toTAI, spanNs",
  },
  { id: "count", heading: "Leap seconds between", calls: "leapSecondsBetween" },
] as const;

// ---------------------------------------------------------------------------
// Markup
// ---------------------------------------------------------------------------

function plateOf(spec: ReturnType<typeof blankPlates>[number]): Plate {
  const samples = PLATE_SAMPLES[spec.role];
  return {
    caption: spec.caption,
    value: spec.value,
    lines: spec.lines,
    ...(spec.series === undefined ? {} : { series: spec.series }),
    ...(spec.quiet === true ? { quiet: true } : {}),
    ...(spec.captions === undefined ? {} : { captions: spec.captions }),
    ...(samples === undefined ? {} : { samples }),
  };
}

/** The sum the three plates make, with its operators between them. */
function equationOf(specs: ReturnType<typeof blankPlates>): SafeHtml {
  const one = (i: number): SafeHtml =>
    plates([plateOf(specs[i]!)], { gate: "hero" });
  const op = (sign: string): SafeHtml =>
    html`<span class="${styles.op}" aria-hidden="true">${sign}</span>`;
  return html`<span class="${styles.lead}" aria-hidden="true"></span>${one(0)}${op("+")}${one(1)}${op("=")}${one(2)}`;
}

function linkItem(text: string, href: string | null): ToolLinkItem {
  return href === null ? { text } : { text, href };
}

function linksOf(
  handoffs: ReturnType<typeof elapsedHandoffs> | null,
): SafeHtml {
  return toolLinks({
    label: "Other tools",
    links: [
      linkItem(
        ELAPSED_LINKS[0].text,
        handoffs?.timeline == null ? null : handoffHref(handoffs.timeline),
      ),
      linkItem(
        ELAPSED_LINKS[1].text,
        handoffs?.clocks == null ? null : handoffHref(handoffs.clocks),
      ),
    ],
  });
}

/** The four rows of cells, plus the dates, that the rulers draw from one model. */
type Row = "clock" | "tapeClock" | "tapeElapsed" | "elapsed" | "dates";

const LEAP_MANY_PX = 76;

/** A run narrower than this has no room for a date; the ends and the list carry it. */
const DATE_MIN_PX = 80;

function cellOf(row: Row, c: RulerCell): SafeHtml {
  const titleAttr = c.leap
    ? html`title="${c.day} ${c.time}: the inserted second"`
    : "";
  const lead = c.leap ? styles.leap : "";
  if (row === "clock") {
    return html`<div class="${styles.cell} ${lead}" style="--b:${c.basis}px" ${titleAttr}
      >${c.label ? html`<span class="${styles.time}">${c.compact ? ":60" : c.time}</span>` : ""}${c.leap && !c.compact ? html`<span class="${styles.tag}">inserted second</span>` : ""}</div
    >`;
  }
  if (row === "elapsed") {
    const text = c.leap
      ? c.compact
        ? "+1"
        : "+1 s"
      : c.ordinal === null
        ? ""
        : String(c.ordinal);
    return html`<div class="${styles.cell} ${lead}" style="--b:${c.basis}px" ${titleAttr}
      >${text === "" ? "" : html`<span class="${styles.time}">${text}</span>`}</div
    >`;
  }
  const gap = row === "tapeClock" && c.leap ? styles.gap : "";
  return html`<div class="${styles.cell} ${styles.tape} ${lead} ${gap}" style="--b:${c.basis}px" ${titleAttr}></div>`;
}

function manyOf(row: Row, count: number): SafeHtml {
  if (row === "clock") {
    return html`<div class="${styles.cell} ${styles.leap}" style="--b:${LEAP_MANY_PX}px"
      ><span class="${styles.time}">+${count}</span><span class="${styles.tag}">inserted seconds</span></div
    >`;
  }
  if (row === "elapsed") {
    return html`<div class="${styles.cell} ${styles.leap}" style="--b:${LEAP_MANY_PX}px"
      ><span class="${styles.time}">+${count} s</span></div
    >`;
  }
  const gap = row === "tapeClock" ? styles.gap : "";
  return html`<div class="${styles.cell} ${styles.tape} ${styles.leap} ${gap}" style="--b:${LEAP_MANY_PX}px"></div>`;
}

/** One date, or the two a run crosses, written short. */
function dateText(cells: readonly RulerCell[]): string {
  const first = cells[0]!.day;
  const last = cells[cells.length - 1]!.day;
  return first === last ? first : `${first} → ${last.slice(5)}`;
}

function pieceOf(row: Row, piece: RulerPiece): SafeHtml {
  if (piece.kind === "break") {
    return html`<div class="${styles.brk}" style="--w:${piece.px}px" title="${piece.skipped} seconds not drawn"></div>`;
  }
  if (piece.kind === "many") {
    return html`<div class="${styles.run}" style="--b:${LEAP_MANY_PX}px"
      >${row === "dates" ? "" : manyOf(row, piece.count)}</div
    >`;
  }
  const px = piece.cells.reduce((n, c) => n + c.basis, 0);
  const inner =
    row === "dates"
      ? px >= DATE_MIN_PX
        ? html`<span class="${styles.date}">${dateText(piece.cells)}</span>`
        : ""
      : piece.cells.map((c) => cellOf(row, c));
  return html`<div class="${styles.run}" style="--b:${px}px">${inner}</div>`;
}

function rowOf(row: Row, model: RulerModel): SafeHtml {
  return html`${model.pieces.map((p) => pieceOf(row, p))}`;
}

/** The whole drawing of the rulers: dates, clock face, two tapes, seconds that passed. */
function rulersOf(
  model: RulerModel | null,
  clockOk: boolean,
  elapsedOk: boolean,
  blank: boolean,
): SafeHtml {
  const quiet = blank
    ? html`<span class="${styles.hint}">Give a start and an end.</span>`
    : html`<span class="${styles.nosignal}">${NO_SIGNAL_RULER}</span>`;
  const strip = (ok: boolean, row: Row): SafeHtml =>
    ok && model !== null ? rowOf(row, model) : quiet;
  const tape = (ok: boolean, row: Row, series: string): SafeHtml =>
    html`<div class="${styles.tapes} ${series} ${ok ? "" : styles.empty}"
      >${ok && model !== null ? rowOf(row, model) : ""}</div
    >`;
  return html`<div class="${styles.dates}">${model === null ? "" : rowOf("dates", model)}</div
    ><div class="${styles.ruler} ${styles.s2}"
      ><span class="${styles.name}">UTC clock</span><div class="${styles.strip}">${strip(clockOk, "clock")}</div></div
    >${tape(clockOk, "tapeClock", styles.s2!)}${tape(elapsedOk, "tapeElapsed", styles.s1!)}<div class="${styles.ruler} ${styles.s1} ${styles.reverse}"
      ><span class="${styles.name}">Seconds that passed</span><div class="${styles.strip}">${strip(elapsedOk, "elapsed")}</div></div
    >`;
}

function endsOf(low: string, high: string, compressed: boolean): SafeHtml {
  return html`<span>${low}</span><span class="${styles.mid} ${compressed ? styles.midShown : ""}" aria-hidden="true">not to scale between breaks</span><span>${high}</span>`;
}

function listOf(read: ElapsedRead): SafeHtml {
  if (read.count === null) {
    return html`<li class="${styles.note}">${NOT_READ_TEXT}</li>`;
  }
  if (read.counted.length === 0) {
    return html`<li class="${styles.note}">${NONE_COUNTED_TEXT}</li>`;
  }
  return html`${read.counted.map((s) => html`<li><code>${s}</code></li>`)}`;
}

/**
 * The widget's chrome, seeded with `args` so the first paint shows them. With no
 * args it shows the first preset. The plates, the drawing and the list are
 * drawn by `mount`, because they come from the real library calls.
 */
export function renderElapsedVsClockTemplate(
  idPrefix: string,
  args: ElapsedVsClockArgs = {},
): SafeHtml {
  const id = idScope(idPrefix);
  const state: ElapsedState = isSeeded(args)
    ? readArgs(args)
    : presetState(ELAPSED_PRESETS[0]!);
  const note = hint(
    id("hint"),
    "Both are UTC instants. A 23:59:60 is allowed on a day when a second was inserted.",
  );
  const text = (local: string, label: string, value: string): SafeHtml =>
    field({
      id: id(local),
      label,
      control: ({ id: cid }) =>
        textInput({
          id: cid,
          value,
          autocomplete: "off",
          spellcheck: false,
          maxLength: 64,
          describedBy: note.id,
        }),
    });

  const readings = section(
    { id: id("readings"), heading: "1. Set a start and an end", level: 4 },
    html`${preset({
      id: id("preset"),
      label: "Preset",
      value: matchPreset(state),
      options: [
        { value: CUSTOM_PRESET_ID, label: "Custom", description: "" },
        ...ELAPSED_PRESETS.map((p) => ({
          value: p.id,
          label: p.label,
          description: p.description,
        })),
      ],
    })}${fieldGrid(
      html`${text("start", "Start", state.start)}${text("end", "End", state.end)}<div class="${styles.wide}">${range(
        {
          id: id("end-slider"),
          label: "Move the end",
          min: 0,
          max: 1,
          step: 1,
          value: 0,
          valueText: "",
          ends: [INTEGER_UTC_FROM.slice(0, 10), "latest"],
        },
      )}</div>`,
    )}${note.html}`,
  );

  const rulers = section(
    {
      id: id("rulers"),
      heading: "2. The same span, counted two ways",
      level: 4,
    },
    html`<div class="${styles.frame}" id="${id("frame")}" data-gate="frame"
        ><div class="${styles.eq}" id="${id("heroes")}">${equationOf(blankPlates())}</div
        ><div class="${styles.figure}" id="${id("figure")}" data-gate="drawn" role="img" aria-label=""
          ><div class="${styles.drawing}" id="${id("drawing")}">${rulersOf(null, false, false, true)}</div></div
        ><div class="${styles.ends}" id="${id("ends")}" role="group" aria-label="Where the span starts and ends">${endsOf("", "", false)}</div
        ><ul class="${styles.legend}" aria-label="Legend"
          ><li class="${styles.legendItem}">${swatch({ series: 2 })}counted by the clock</li
          ><li class="${styles.legendItem}">${swatch({ series: 1 })}counted through TAI</li
          ><li class="${styles.legendItem}">${swatch({ series: 3 })}an inserted second</li></ul
        ></div
      ><p role="status" aria-label="Reading summary" id="${id("summary")}">${srOnly("")}</p
      ><h5 class="${styles.listTitle}">The seconds inserted between the two</h5
      ><ul class="${styles.list}" id="${id("list")}" data-gate="drawn" tabindex="0" aria-label="Seconds inserted between the two"></ul>`,
  );

  const calls = section(
    { id: id("calls"), heading: "3. What the library returns", level: 4 },
    html`${GROUPS.map(
      (g) =>
        html`<div class="${styles.group}">
          <h5 class="${styles.groupTitle}">${g.heading}: <code>${g.calls}</code></h5>
          ${grow(
            html`<div id="${id(`${g.id}-calls`)}">${codeFrame({
              label: `${g.heading}: calls made`,
              copyLabel: `Copy ${g.heading.toLowerCase()} calls`,
              copyText: "",
              gate: "codeframe",
            })}</div>`,
          )}${grow(
            html`<div id="${id(`${g.id}-output`)}">${callOutput({
              label: `${g.heading}: what the calls returned`,
              state: "empty",
              lines: [],
            })}</div>`,
          )}${grow(html`<div id="${id(`${g.id}-reason`)}"></div>`)}
        </div>`,
    )}<div id="${id("links")}">${linksOf(null)}</div>`,
  );

  return widget(
    {
      name: WIDGET_NAME,
      label: "Elapsed vs. Clock Difference",
      scope: idPrefix,
    },
    html`${readings}${rulers}${calls}`,
  );
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

interface Controller {
  readState(): ElapsedState;
  apply(state: ElapsedState): void;
  render(): void;
  syncPreset(): void;
  release(): void;
}

function setupWidget(
  root: HTMLElement,
  lib: TimescaleLib,
  signal: AbortSignal,
): Controller {
  const { el: widgetEl, part: el } = findWidget(root, WIDGET_NAME);
  const presetEl = widgetEl.querySelector<GmtPreset>("gmt-preset")!;
  const sliderEl = widgetEl.querySelector<GmtRange>("gmt-range")!;
  const startEl = el<HTMLInputElement>("start");
  const endEl = el<HTMLInputElement>("end");
  const frameEl = el("frame");
  // Every slot the render writes: a missing one throws now, not on the first keystroke.
  const slots = {
    heroes: el("heroes"),
    figure: el("figure"),
    drawing: el("drawing"),
    ends: el("ends"),
    summary: el("summary"),
    list: el("list"),
    links: el("links"),
  };
  const groups = GROUPS.map((g) => ({
    id: g.id,
    heading: g.heading,
    calls: el(`${g.id}-calls`),
    output: el(`${g.id}-output`),
    reason: el(`${g.id}-reason`),
  }));

  let spoken = "";

  const readState = (): ElapsedState => ({
    start: startEl.value,
    end: endEl.value,
  });

  function syncPreset(): void {
    presetEl.value = matchPreset(readState());
  }

  /** The slider follows the reader's today, so its range is set on each draw. */
  function drawSlider(state: ElapsedState, now: number): void {
    const max = sliderMax(now);
    sliderEl.max = max;
    sliderEl.ends = [
      INTEGER_UTC_FROM.slice(0, 10),
      sliderDate(max).slice(0, 10),
    ];
    const position = sliderPosition(state.end, now);
    sliderEl.disabled = position === null;
    if (position === null) {
      sliderEl.formatValue = () => "no end";
      return;
    }
    sliderEl.value = position;
    sliderEl.formatValue = (n) => sliderDate(n).slice(0, 10);
  }

  /** What the last draw was for, so a change of width can draw the rulers again. */
  let last: { state: ElapsedState; read: ElapsedRead } | null = null;

  function drawRulers(state: ElapsedState, read: ElapsedRead): void {
    last = { state, read };
    const blank = read.clockCalls.length === 0;
    const model: RulerModel | null = blank
      ? null
      : rulerModel(state, read, frameEl.clientWidth);
    const placed = model !== null;
    setHtml(
      slots.drawing,
      rulersOf(
        model,
        placed && read.clock !== null,
        placed && read.elapsed !== null,
        blank,
      ),
    );

    const a = drawMs(state.start);
    const b = drawMs(state.end);
    let low = "";
    let high = "";
    if (a !== null && b !== null) {
      low = (a <= b ? state.start : state.end).trim().slice(0, 10);
      high = (a <= b ? state.end : state.start).trim().slice(0, 10);
    }
    setHtml(slots.ends, endsOf(low, high, model?.compressed === true));
  }

  function drawGroup(
    g: (typeof groups)[number],
    calls: ElapsedRead["clockCalls"],
    ok: boolean,
    reason: string,
  ): void {
    const { code, plain } = callLines(calls);
    setHtml(
      g.calls,
      codeFrame({
        label: `${g.heading}: calls made`,
        copyLabel: `Copy ${g.heading.toLowerCase()} calls`,
        copyText: plain,
        code,
        gate: "codeframe",
      }),
    );
    const label = `${g.heading}: what the calls returned`;
    if (calls.length === 0) {
      setHtml(
        g.output,
        callOutput({
          label,
          state: "empty",
          lines: [{ text: BLANK_TEXT, lost: false }],
        }),
      );
    } else {
      const out = outputOf(ok ? "ok" : "sentinel", calls);
      setHtml(
        g.output,
        callOutput({ label, state: out.state, lines: out.lines }),
      );
    }
    setHtml(
      g.reason,
      calls.length > 0 && !ok && reason !== ""
        ? aside(
            {
              label: `Why there is no result: ${g.heading.toLowerCase()}`,
              tone: "caution",
              title: NO_RESULT_TITLE,
            },
            html`<p>${reason}</p>`,
          )
        : html``,
    );
  }

  function render(): void {
    const state = readState();
    const now = getUnixNow();
    const read = readElapsed(lib, state);
    const text = summaryText(state, read);

    setHtml(slots.heroes, equationOf(elapsedPlates(read, state)));
    drawSlider(state, now);
    drawRulers(state, read);
    setHtml(slots.list, listOf(read));

    const [clockG, elapsedG, countG] = groups as [
      (typeof groups)[number],
      (typeof groups)[number],
      (typeof groups)[number],
    ];
    drawGroup(clockG, read.clockCalls, read.clock !== null, read.clockReason);
    drawGroup(
      elapsedG,
      read.elapsedCalls,
      read.elapsed !== null,
      read.elapsedReason,
    );
    drawGroup(countG, read.countCalls, read.count !== null, read.countReason);

    setHtml(slots.links, linksOf(elapsedHandoffs(state, read)));
    slots.figure.setAttribute("aria-label", text);
    if (text !== spoken) {
      spoken = text;
      setHtml(slots.summary, srOnly(text));
    }
  }

  function apply(state: ElapsedState): void {
    startEl.value = state.start;
    endEl.value = state.end;
  }

  widgetEl.addEventListener(
    "input",
    (e) => {
      const target = e.target;
      if (target === sliderEl) {
        endEl.value = sliderDate(sliderEl.value);
        syncPreset();
        render();
      } else if (target === startEl || target === endEl) {
        syncPreset();
        render();
      }
    },
    { signal },
  );
  widgetEl.addEventListener(
    "change",
    (e) => {
      if (e.target !== presetEl) return;
      const chosen = ELAPSED_PRESETS.find((p) => p.id === presetEl.value);
      if (!chosen) return;
      apply(presetState(chosen));
      syncPreset();
      render();
    },
    { signal },
  );

  // A new width can change how many seconds the rulers have room to draw.
  const release = onWidthChange(frameEl, () => {
    if (last) drawRulers(last.state, last.read);
  });

  sliderEl.min = 0;
  syncPreset();
  render();

  return { readState, apply, render, syncPreset, release };
}

export const mountElapsedVsClock: MountFn<ElapsedVsClockArgs> = async (
  root,
  args,
  signal,
) => {
  defineElements();
  let lib: TimescaleLib;
  try {
    lib = await loadTimescaleLib();
  } catch (cause) {
    // Loud, not inert: the host decides what to show (see `WidgetLoadError`).
    throw cause instanceof WidgetLoadError ? cause : new WidgetLoadError(cause);
  }
  if (signal.aborted) return onceDestroy(() => {});

  let controller: Controller;
  try {
    controller = setupWidget(root, lib, signal);
    if (isSeeded(args)) {
      controller.apply(readArgs(args));
      controller.syncPreset();
      controller.render();
    }
  } catch (cause) {
    throw new WidgetLoadError(cause);
  }

  return onceDestroy(
    () => controller.release(),
    () => permalinkOf(controller.readState()),
  );
};
