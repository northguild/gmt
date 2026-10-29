/**
 * The Punctuality Board widget (TRAN-57), mountable on its tool page and in the
 * chat rail.
 *
 * Arrivals on one axis against a tolerance the reader drags: each deviation in
 * exact time, early, on time or late with both edges outside, and the on-time
 * rate. The printed results are always the real `scheduleDeviation`,
 * `classifyPunctuality` and `punctualityRate` calls'; the bars and the band are
 * a picture of them. The tool's one naive value is the wall-clock reading.
 *
 * Built on the component kit: `renderPunctualityBoardTemplate` writes the markup from
 * builders only, with ids from `idScope(idPrefix)`, and `mount` finds its parts by those
 * ids and reads and writes element `value` properties. The rows are not editable: they
 * come from a preset, the chat or a permalink, and the tolerance is the manipulation.
 *
 * Each tolerance has three ways in: pointer drag and keyboard on its `<gmt-handle>`, and
 * the typed field the handle writes. The axis never rescales while a handle is dragged;
 * it refits when a handle's value commits (`change`), on a typed value's `change`, on a
 * switch, on a preset and on a seed. The rate readout is not a live region; a visually
 * hidden status line reads it once a change settles.
 */
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
  raw,
  section,
  setHtml,
  srOnly,
  table,
  textInput,
  widget,
  type SafeHtml,
} from "~/widgets/builders";
import {
  callOutput,
  type CallOutputLine,
} from "~/widgets/families/gnss/call-output";
import {
  noSignal,
  punctBoard,
  punctCalls,
  punctLane,
  punctNaive,
  punctRate,
  punctRow,
  punctTicks,
  punctWord,
  type BarSpan,
} from "~/widgets/families/punctuality/punct-board";
import {
  punctHero,
  punctHeroStrip,
} from "~/widgets/families/punctuality/punct-hero";
import { chips, type GmtChips } from "~/widgets/primitives/chips/chips";
import { grow } from "~/widgets/primitives/grow/grow";
import {
  handle,
  handleTrack,
  type GmtHandle,
} from "~/widgets/primitives/handle/handle";
import { preset, type GmtPreset } from "~/widgets/primitives/preset/preset";
import styles from "~/widgets/tools/punctuality-board.module.css";
import { onWidthChange, thinTickLabels } from "./label-fit";
import {
  PUNCTUALITY_PRESETS,
  axisMinutes,
  barLayout,
  boardNullReason,
  boardReasonText,
  collectBoardFacts,
  CUSTOM_PRESET_ID,
  initialState,
  matchPreset,
  permalinkOf,
  rowLabel,
  rowTimeText,
  toleranceA,
  toleranceB,
  type BoardFacts,
  type BoardState,
  type PunctualityBoardArgs,
} from "./punctuality-board";
import { loadPunctualityLib } from "./punctuality-lib";
import {
  PUNCTUALITY_LABELS,
  SETTLE_MS,
  callArgs,
  formatValue,
  isoToMinutes,
  minutesToIso,
  signedText,
  spokenMinutes,
  stepMinutesFor,
  toleranceText,
  type Punctuality,
  type PunctualityLib,
} from "./punctuality-widgets";
import { onceDestroy, WidgetLoadError, type MountFn } from "./widget-mount";
import { codeSpan } from "./widget-ui";

export type { PunctualityBoardArgs } from "./punctuality-board";

const WIDGET_NAME = "punctuality-board";

/** The widest readings the hero plates show, so they keep their width while a handle drags. */
const HERO_SAMPLES = ["6 of 6"];
const HERO_LINE_SAMPLES: readonly (readonly string[])[] = [
  ["second late tolerance", "late tolerance 24 h"],
  ["early 24 h", "24 h early 24 h"],
];

const wordOf = (c: Punctuality | null): string =>
  c === null ? "" : PUNCTUALITY_LABELS[c];

/** A tolerance field as minutes for the band and the bars, or `null` when it does not read
 *  as an exact, non-negative length. */
const lengthOf = (text: string): number | null => {
  const m = isoToMinutes(text);
  return m === null || m < 0 ? null : m;
};

const clamp = (n: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, n));

// ---------------------------------------------------------------------------
// Markup
// ---------------------------------------------------------------------------

function handleOf(
  id: string,
  label: string,
  lo: number,
  hi: number,
  text: string,
  sign: 1 | -1,
): SafeHtml {
  const m = lengthOf(text);
  return handleTrack(
    handle({
      id,
      label,
      min: lo,
      max: hi,
      step: 1,
      largeStep: 10,
      value: m === null ? 0 : clamp(sign * m, lo, hi),
      valueText:
        m === null ? label : `${label} ${spokenMinutes(m)}, ${text.trim()}`,
    }),
  );
}

/**
 * `renderPunctualityBoardTemplate(idPrefix, args = {})`: the widget's chrome, seeded so
 * the first paint shows the tolerance. The rows, bars and results are drawn by `mount`,
 * because they come from the real library.
 */
export function renderPunctualityBoardTemplate(
  idPrefix: string,
  args: PunctualityBoardArgs = {},
): string {
  const id = idScope(idPrefix);
  const state = initialState(args);
  const presetId = matchPreset(state);
  const textField = (
    local: string,
    label: string,
    value: string,
    hintOf?: ReturnType<typeof hint>,
  ) =>
    html`<div class="${styles.box}">${field({
      id: id(local),
      label,
      ...(hintOf === undefined ? {} : { hint: hintOf }),
      control: ({ id: cid, describedBy }) =>
        textInput({
          id: cid,
          value,
          autocomplete: "off",
          spellcheck: false,
          ...(describedBy === undefined ? {} : { describedBy }),
        }),
    })}</div>`;

  const pick = section(
    { id: id("pick"), heading: "1. The arrivals and the tolerance", level: 4 },
    html`<div class="${styles.controls}">${preset({
      id: id("preset"),
      label: "Preset",
      value: presetId,
      options: [
        { value: CUSTOM_PRESET_ID, label: "Custom", description: "" },
        ...PUNCTUALITY_PRESETS.map((p) => ({
          value: p.id,
          label: p.label,
          description: p.description,
        })),
      ],
    })}${fieldGrid(
      html`${textField("late", "Late tolerance", state.late, hint(id("tolerance-hint"), "ISO 8601 durations of exact time: PT15M, PT1H30M, P1D. A day is 24 hours."))}${textField("early", "Early tolerance", state.early)}${textField("compare-late", "Second late tolerance", state.compareLate)}`,
    )}${chips({
      legend: "Compare",
      kind: "switch",
      name: id("compare"),
      items: [
        { value: "early", label: "Early tolerance", checked: state.earlyOn },
        {
          value: "compare",
          label: "A second late tolerance",
          checked: state.compareOn,
        },
      ],
    })}</div>`,
  );

  const summary = hint(id("summary"), "");
  const board = punctBoard({
    id: id("board"),
    summaryId: id("summary"),
    label: "Arrivals against the tolerance",
    rowsId: id("rows"),
    ticksId: id("ticks"),
    tolerance: html`${punctLane({
      id: id("lane-a"),
      series: 1,
      bandId: id("band-a"),
      bandTextId: id("band-a-text"),
      gate: "drawn",
      early: {
        id: id("early-half"),
        hidden: !state.earlyOn,
        handle: handleOf(
          id("handle-early"),
          "Early tolerance",
          -30,
          0,
          state.early,
          -1,
        ),
      },
      late: handleOf(id("handle-late"), "Late tolerance", 0, 30, state.late, 1),
    })}${punctLane({
      id: id("lane-b"),
      series: 3,
      second: true,
      hidden: !state.compareOn,
      bandId: id("band-b"),
      bandTextId: id("band-b-text"),
      gate: "drawn",
      late: handleOf(
        id("handle-compare"),
        "Second late tolerance",
        0,
        30,
        state.compareLate,
        1,
      ),
    })}`,
  });

  const read = section(
    { id: id("read"), heading: "2. Late, early or on time", level: 4 },
    html`${grow(html`<div class="${styles.rates}" id="${id("rate")}"></div>`)}
      <div role="status" aria-live="polite" aria-label="Rate summary" id="${id("live")}">${srOnly("")}</div>
      <div class="${styles.frame}" data-gate="frame">
        ${grow(html`<div id="${id("heroes")}"></div>`)}${board}${summary.html}
      </div>
      ${grow(html`<div id="${id("reason")}"></div>`)}`,
  );

  const calls = section(
    { id: id("calls"), heading: "3. What the calls return", level: 4 },
    html`${grow(
      html`<div id="${id("calls-slot")}">${codeFrame({
        label: "Calls made",
        copyLabel: "Copy calls",
        copyText: "",
        gate: "codeframe",
      })}</div>`,
    )}${grow(
      html`<div id="${id("output-slot")}">${callOutput({
        label: "What the calls returned",
        state: "empty",
        lines: [],
      })}</div>`,
    )}${grow(html`<div id="${id("table-slot")}"></div>`)}`,
  );

  return widget(
    { name: WIDGET_NAME, label: "Punctuality Board", scope: idPrefix },
    html`${pick}${read}${calls}`,
  ).toString();
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

/** `"4 of 6 on time, late tolerance 15 min (PT15M)"`, as words. */
function rateLine(
  rate: { onTime: number; total: number } | null,
  late: string,
  early: string | null,
): SafeHtml {
  const tolerance =
    `late tolerance ${toleranceText(late)} (${late})` +
    (early === null
      ? ""
      : `, early tolerance ${toleranceText(early)} (${early})`);
  return rate === null
    ? html`${noSignal()} no rate, ${tolerance}`
    : html`${`${rate.onTime} of ${rate.total} on time, ${tolerance}`}`;
}

const rateText = (
  rate: { onTime: number; total: number } | null,
  late: string,
  early: string | null,
): string => {
  const tolerance =
    `late tolerance ${toleranceText(late)} (${late})` +
    (early === null
      ? ""
      : `, early tolerance ${toleranceText(early)} (${early})`);
  return rate === null
    ? `NO SIGNAL no rate, ${tolerance}`
    : `${rate.onTime} of ${rate.total} on time, ${tolerance}`;
};

const cell = (value: string | null): SafeHtml | string =>
  value === null || value === "" ? noSignal() : JSON.stringify(value);

function summaryText(s: BoardState, facts: BoardFacts): string {
  return s.rows
    .map((r, i) => {
      const f = facts.rows[i]!;
      const head = `Arrival ${i + 1}, due ${rowTimeText(r.planned)}, came at ${rowTimeText(r.actual)}`;
      if (f.deviation === "") return `${head}: NO SIGNAL.`;
      const second = s.compareOn
        ? ` Under ${toleranceText(s.compareLate)}: ${f.classB === null ? "NO SIGNAL" : wordOf(f.classB)}.`
        : "";
      return `${head}: ${signedText(f.deviation)}, ${f.classA === null ? "NO SIGNAL" : wordOf(f.classA)}.${second}`;
    })
    .join(" ");
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

interface Controller {
  destroy(): void;
  state(): BoardState;
}

function setupWidget(
  root: HTMLElement,
  lib: PunctualityLib,
  start: BoardState,
  signal: AbortSignal,
): Controller {
  const { el: widgetEl, part: el } = findWidget(root, WIDGET_NAME);
  const presetEl = widgetEl.querySelector<GmtPreset>("gmt-preset")!;
  const chipsEl = widgetEl.querySelector<GmtChips>("gmt-chips")!;
  const lateEl = el<HTMLInputElement>("late");
  const earlyEl = el<HTMLInputElement>("early");
  const compareEl = el<HTMLInputElement>("compare-late");
  const handleLate = el<GmtHandle>("handle-late");
  const handleEarly = el<GmtHandle>("handle-early");
  const handleCompare = el<GmtHandle>("handle-compare");
  const ticksEl = el("ticks");

  // The seed reaches the controls here: the page server-renders the first preset.
  lateEl.value = start.late;
  earlyEl.value = start.early;
  compareEl.value = start.compareLate;
  chipsEl.value = [
    ...(start.earlyOn ? ["early"] : []),
    ...(start.compareOn ? ["compare"] : []),
  ];

  let rows = start.rows;
  let rowsPreset = start.preset;
  let half = 30; // R: the axis runs from -R to +R minutes.
  let drawnTicksFor = -1;
  let destroyed = false;

  const switches = (): readonly string[] => {
    const v = chipsEl.value;
    return Array.isArray(v) ? v : [v];
  };

  const state = (): BoardState => ({
    preset: rowsPreset,
    rows,
    late: lateEl.value,
    earlyOn: switches().includes("early"),
    early: earlyEl.value,
    compareOn: switches().includes("compare"),
    compareLate: compareEl.value,
  });

  /** Minutes along the axis (-R..+R) as a percent of the track. */
  const pct = (minutes: number): number =>
    clamp(((minutes + half) / (2 * half)) * 100, 0, 100);

  // The rate lines are read out once, when the change that made them has settled.
  let liveText = "";
  let timer: ReturnType<typeof setTimeout> | undefined;
  const cancelAnnounce = (): void => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };
  const announce = (): void => {
    cancelAnnounce();
    timer = setTimeout(() => {
      timer = undefined;
      if (!destroyed) setHtml(el("live"), srOnly(liveText));
    }, SETTLE_MS);
  };

  const syncPreset = (): void => {
    presetEl.value = matchPreset(state());
  };

  function drawHandle(
    h: GmtHandle,
    label: string,
    text: string,
    lo: number,
    hi: number,
    sign: 1 | -1,
  ): void {
    const step = stepMinutesFor(half);
    h.setAttribute("min", String(lo));
    h.setAttribute("max", String(hi));
    h.setAttribute("step", String(step));
    h.setAttribute("large-step", String(step * 10));
    const m = lengthOf(text);
    if (m === null) return; // an unreadable field leaves the handle where it was
    h.value = clamp(sign * m, lo, hi);
    h.formatValue = (n) => {
      const abs = Math.abs(Math.round(n));
      return `${label} ${spokenMinutes(abs)}, ${abs === m ? text.trim() : minutesToIso(abs)}`;
    };
  }

  function drawTicks(): void {
    if (drawnTicksFor !== half) {
      drawnTicksFor = half;
      const label = (m: number): string =>
        m === 0
          ? "on the plan"
          : signedText(m < 0 ? `-${minutesToIso(-m)}` : minutesToIso(m));
      setHtml(
        ticksEl,
        punctTicks(
          [-half, 0, half].map((m) => ({ at: pct(m), label: label(m) })),
        ),
      );
    }
    thinTickLabels(ticksEl, "[data-tick]");
  }

  function rowOf(
    s: BoardState,
    facts: BoardFacts,
    i: number,
    lateMin: number | null,
    earlyMin: number | null,
  ): SafeHtml {
    const r = s.rows[i]!;
    const f = facts.rows[i]!;
    const label = rowLabel(r.planned, r.actual);
    const naive: readonly [string, string] | undefined = facts.showNaive
      ? f.naiveDeviation === ""
        ? ["wall clock: NO SIGNAL", "(naive)"]
        : [
            `wall clock: ${signedText(f.naiveDeviation)}`,
            `${wordOf(f.naiveClass) || "no signal"} (naive)`,
          ]
      : undefined;
    const naiveOpt = naive === undefined ? {} : { naive };
    if (f.deviation === "") {
      return punctRow({
        label,
        inside: null,
        outside: null,
        negative: false,
        delta: noSignal(),
        word: "",
        ...naiveOpt,
      });
    }
    const dev = isoToMinutes(f.deviation) ?? 0;
    const layout = barLayout(dev, lateMin, earlyMin, f.classA);
    const span = (a: number, b: number): BarSpan => ({
      left: pct(Math.min(a, b)),
      width: Math.abs(pct(b) - pct(a)),
    });
    const insideRaw =
      layout.inside ?? (layout.outside === null ? { from: 0, to: 0 } : null);
    const second =
      s.compareOn && f.classA !== null
        ? f.classB === null
          ? "no signal"
          : `${wordOf(f.classB)} under ${toleranceText(s.compareLate)}`
        : undefined;
    return punctRow({
      label,
      inside: insideRaw === null ? null : span(insideRaw.from, insideRaw.to),
      outside:
        layout.outside === null
          ? null
          : span(layout.outside.from, layout.outside.to),
      negative: dev < 0,
      delta: signedText(f.deviation),
      word:
        f.classA === null
          ? noSignal()
          : punctWord(
              wordOf(f.classA),
              f.classA === "late" || f.classA === "early",
            ),
      ...(second === undefined ? {} : { second }),
      ...naiveOpt,
    });
  }

  /** Show a band's words only when they fit clear of a handle. The rows already carry the
   *  words, so hiding them loses nothing. */
  function fitBandText(bandLocal: string, textLocal: string): void {
    const band = el(bandLocal);
    const label = el(textLocal);
    label.hidden = false;
    const width = band.clientWidth;
    if (width === 0) return; // No layout (hidden, or jsdom): keep the words.
    const clear = 7 + 8;
    const open = el("board").dataset["open"] === "true";
    label.hidden = width < label.scrollWidth + (open ? clear + 4 : 2 * clear);
  }
  const fitBands = (): void => {
    fitBandText("band-a", "band-a-text");
    fitBandText("band-b", "band-b-text");
  };

  function render(): void {
    if (destroyed) return;
    const s = state();
    const facts = collectBoardFacts(s, lib);
    const reason = boardNullReason(s, facts, lib);
    const lateMin = lengthOf(s.late);
    const earlyMin = s.earlyOn ? lengthOf(s.early) : null;
    const compareMin = s.compareOn ? lengthOf(s.compareLate) : null;

    earlyEl.disabled = !s.earlyOn;
    compareEl.disabled = !s.compareOn;
    el("early-half").hidden = !s.earlyOn;
    el("lane-b").hidden = !s.compareOn;

    // The rate lines.
    const earlyText =
      s.earlyOn && s.early.trim() !== "" ? s.early.trim() : null;
    const texts = [rateText(facts.rateA, s.late.trim(), earlyText)];
    const lines: SafeHtml[] = [
      punctRate(rateLine(facts.rateA, s.late.trim(), earlyText)),
    ];
    if (s.compareOn) {
      texts.push(rateText(facts.rateB, s.compareLate.trim(), earlyText));
      lines.push(
        punctRate(rateLine(facts.rateB, s.compareLate.trim(), earlyText)),
      );
    }
    if (facts.showNaive) {
      const naive =
        facts.naiveRate === null
          ? "NO SIGNAL"
          : `${facts.naiveRate.onTime} of ${facts.naiveRate.total} on time`;
      texts.push(`Read off the wall clocks (naive): ${naive}`);
      lines.push(
        punctNaive(
          facts.naiveRate === null
            ? html`Read off the wall clocks (naive): ${noSignal()}`
            : html`${`Read off the wall clocks (naive): ${naive}`}`,
        ),
      );
    }
    liveText = texts.join(" ");
    setHtml(el("rate"), html`${lines}`);

    // The result plates above the board: the library's own rates, large.
    const earlyLine =
      s.earlyOn && s.early.trim() !== ""
        ? `early ${toleranceText(s.early.trim())}`
        : "";
    const plates: SafeHtml[] = [];
    if (facts.rateA !== null) {
      plates.push(
        punctHero({
          caption: "on time",
          value: `${facts.rateA.onTime} of ${facts.rateA.total}`,
          samples: HERO_SAMPLES,
          lines: [`late tolerance ${toleranceText(s.late.trim())}`, earlyLine],
          lineSamples: HERO_LINE_SAMPLES,
          series: 1,
          gate: "hero",
        }),
      );
    }
    if (s.compareOn && facts.rateB !== null) {
      plates.push(
        punctHero({
          caption: "on time",
          value: `${facts.rateB.onTime} of ${facts.rateB.total}`,
          samples: HERO_SAMPLES,
          lines: [
            "second late tolerance",
            toleranceText(s.compareLate.trim()),
            earlyLine,
          ],
          lineSamples: [["second late tolerance"], ["24 h"], ["early 24 h"]],
          series: 3,
          gate: "hero",
        }),
      );
    }
    setHtml(
      el("heroes"),
      plates.length === 0 ? html`` : punctHeroStrip(html`${plates}`),
    );

    // The tolerance track: band A, band B and the handles.
    const board = el("board");
    board.dataset["open"] = String(!s.earlyOn);
    board.dataset["compare"] = String(s.compareOn && compareMin !== null);
    board.dataset["noband"] = String(lateMin === null);
    const bandA = el("band-a");
    bandA.hidden = lateMin === null;
    if (lateMin !== null) {
      const left = earlyMin === null ? 0 : pct(-earlyMin);
      bandA.style.setProperty("--band-start", `${left}%`);
      bandA.style.setProperty(
        "--band-size",
        `${Math.max(0, pct(lateMin) - left)}%`,
      );
    }
    el("band-a-text").textContent = s.earlyOn
      ? "on time"
      : "← early is on time";
    const bandB = el("band-b");
    bandB.hidden = compareMin === null;
    if (compareMin !== null) {
      const left = earlyMin === null ? 0 : pct(-earlyMin);
      bandB.style.setProperty("--band-start", `${left}%`);
      bandB.style.setProperty(
        "--band-size",
        `${Math.max(0, pct(compareMin) - left)}%`,
      );
    }
    el("band-b-text").textContent =
      `${toleranceText(s.compareLate.trim())} late`;

    // The band runs down every row: its edges, in percent, on the board.
    board.style.setProperty(
      "--band-l",
      `${earlyMin === null ? 0 : pct(-earlyMin)}%`,
    );
    board.style.setProperty(
      "--band-r",
      `${lateMin === null ? 0 : pct(lateMin)}%`,
    );
    if (compareMin === null) board.style.removeProperty("--band-b");
    else board.style.setProperty("--band-b", `${pct(compareMin)}%`);

    drawHandle(handleLate, "Late tolerance", s.late, 0, half, 1);
    drawHandle(handleEarly, "Early tolerance", s.early, -half, 0, -1);
    drawHandle(
      handleCompare,
      "Second late tolerance",
      s.compareLate,
      0,
      half,
      1,
    );

    setHtml(
      el("rows"),
      html`${s.rows.map((_, i) => rowOf(s, facts, i, lateMin, earlyMin))}`,
    );
    drawTicks();
    fitBands();

    el("summary").textContent = summaryText(s, facts);
    setHtml(
      el("reason"),
      reason === null
        ? html``
        : aside(
            { label: "Why NO SIGNAL", tone: "caution", title: "Why NO SIGNAL" },
            html`<p>${boardReasonText(reason)}</p>`,
          ),
    );

    // What the calls return.
    const pairs = s.rows.map((r) => ({
      planned: r.planned.trim(),
      actual: r.actual.trim(),
    }));
    const callList = [
      { tolerance: toleranceA(s), rate: facts.rateA },
      ...(s.compareOn ? [{ tolerance: toleranceB(s), rate: facts.rateB }] : []),
    ];
    const built = callList.map((c) => {
      const [argsHtml, plain] = callArgs([pairs, c.tolerance]);
      return {
        html: `${codeSpan("fn", "punctualityRate")}(${argsHtml})`,
        plain: `punctualityRate(${plain})`,
      };
    });
    setHtml(
      el("calls-slot"),
      codeFrame({
        label: "Calls made",
        copyLabel: "Copy calls",
        copyText: built.map((b) => b.plain).join("\n"),
        code: raw(built.map((b) => b.html).join("\n")),
        gate: "codeframe",
      }),
    );
    const outLines = callList.map((c): CallOutputLine =>
      c.rate === null
        ? { text: "NO SIGNAL", lost: true }
        : { text: formatValue(c.rate), lost: false },
    );
    setHtml(
      el("output-slot"),
      callOutput({
        label: "What the calls returned",
        state: outLines.every((l) => l.lost) ? "sentinel" : "live",
        lines: outLines,
      }),
    );

    type Key = "arrival" | "deviation" | "a" | "b";
    const col = (key: Key, header: string) => ({
      key,
      header,
      align: "start" as const,
      numeric: false,
    });
    setHtml(
      el("table-slot"),
      punctCalls(
        table<Key>({
          caption: "The calls and what each returned",
          rowHeader: "arrival",
          columns: [
            col("arrival", "Arrival"),
            col("deviation", "scheduleDeviation"),
            ...(s.compareOn
              ? [
                  col(
                    "a",
                    `classifyPunctuality, late ${toleranceText(s.late)}`,
                  ),
                  col(
                    "b",
                    `classifyPunctuality, late ${toleranceText(s.compareLate)}`,
                  ),
                ]
              : [col("a", "classifyPunctuality")]),
          ],
          rows: s.rows.map((r, i) => {
            const f = facts.rows[i]!;
            return {
              arrival: rowLabel(r.planned, r.actual),
              deviation: cell(f.deviation),
              a: cell(f.classA),
              b: cell(f.classB),
            };
          }),
        }),
      ),
    );
  }

  function refit(): void {
    const s = state();
    half = axisMinutes(s, collectBoardFacts(s, lib));
    drawnTicksFor = -1;
    render();
  }

  function applyPreset(): void {
    const chosen = PUNCTUALITY_PRESETS.find((p) => p.id === presetEl.value);
    if (!chosen) return;
    const now = state();
    rows = chosen.rows.map((r) => ({ ...r }));
    rowsPreset = chosen.id;
    lateEl.value = chosen.late;
    chipsEl.value = [
      ...(chosen.early !== undefined ? ["early"] : []),
      ...(chosen.compareLate !== undefined ? ["compare"] : []),
    ];
    earlyEl.value = chosen.early ?? now.early;
    compareEl.value = chosen.compareLate ?? now.compareLate;
    syncPreset();
    refit();
  }

  // Each handle writes its value into its typed field; the field is the state.
  const handles: readonly [GmtHandle, HTMLInputElement][] = [
    [handleLate, lateEl],
    [handleEarly, earlyEl],
    [handleCompare, compareEl],
  ];
  const typed: readonly EventTarget[] = [lateEl, earlyEl, compareEl];

  widgetEl.addEventListener(
    "input",
    (e) => {
      if (destroyed) return;
      const pair = handles.find(([h]) => h === e.target);
      if (pair !== undefined) {
        pair[1].value = minutesToIso(Math.abs(Math.round(pair[0].value)));
        syncPreset();
        render();
        announce();
        return;
      }
      if (e.target !== null && typed.includes(e.target)) {
        syncPreset();
        render();
        announce();
      }
    },
    { signal },
  );

  widgetEl.addEventListener(
    "change",
    (e) => {
      if (destroyed) return;
      const target = e.target;
      if (target === presetEl) {
        applyPreset();
        announce();
      } else if (
        handles.some(([h]) => h === target) ||
        (target !== null && typed.includes(target))
      ) {
        refit();
        announce();
      } else if (target === chipsEl) {
        syncPreset();
        refit();
        announce();
      }
    },
    { signal },
  );

  syncPreset();
  refit();

  const refitText = (): void => {
    if (destroyed) return;
    thinTickLabels(ticksEl, "[data-tick]");
    fitBands();
  };
  const stopWidthWatch = onWidthChange(el("board"), refitText);
  const fonts = typeof document !== "undefined" ? document.fonts : undefined;
  if (fonts) {
    void fonts.ready.then(refitText);
    fonts.addEventListener?.("loadingdone", refitText, { signal });
  }
  const stop = (): void => {
    destroyed = true;
    stopWidthWatch();
    cancelAnnounce();
  };
  signal.addEventListener("abort", stop);

  return {
    state,
    destroy() {
      signal.removeEventListener("abort", stop);
      stop();
    },
  };
}

export const mountPunctualityBoard: MountFn<PunctualityBoardArgs> = async (
  root,
  args,
  signal,
) => {
  defineElements();
  let lib: PunctualityLib;
  try {
    lib = await loadPunctualityLib();
  } catch (cause) {
    throw cause instanceof WidgetLoadError ? cause : new WidgetLoadError(cause);
  }
  if (signal.aborted) return onceDestroy(() => {});

  const controller = setupWidget(root, lib, initialState(args), signal);
  return onceDestroy(
    () => controller.destroy(),
    () => permalinkOf(controller.state()),
  );
};
