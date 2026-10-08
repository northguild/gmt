/**
 * The DTM Decoder widget (INT-15), mountable on its tool page and in the chat
 * rail.
 *
 * A pasted UN/EDIFACT `DTM` segment, or a value and its data element 2379 format
 * code, read by `parseEdifactDtm`: the members the code states, whether the
 * offset is stated, not stated or zone text, which is not an offset, the instant an
 * offsetless value names in each zone the reader chooses, and the value written
 * back by `formatEdifactDtm`. Every printed result is the real call's; the
 * site-side code only splits the segment (`splitDtm`) and joins the members a
 * parser returned into the string a formatter takes.
 *
 * `null` and `""` from the library render as NO SIGNAL with a reason decided by
 * probing the library (`explainNull`, `resolveReason`). A state with no library
 * call behind it renders as empty, never amber.
 *
 * Follows the Billing Deadlines widget's split: every listener is delegated on
 * the root, so the host dropping the subtree is a complete teardown. Nothing in
 * the server-rendered template holds a result, and the clock is read only by the
 * library and only after mount (`yearWindow: "rolling"`).
 */
import { codeFrameHtml } from "./code-frame";
import {
  CUSTOM_PRESET_ID,
  DTM_PRESETS,
  MEMBER_ROWS,
  detailText,
  dtmBlank,
  dtmFigure,
  dtmParts,
  dtmTexts,
  effective,
  explainNull,
  gapRows,
  matchPreset,
  memberText,
  nullReasonText,
  permalinkOf,
  presetState,
  readArgs,
  splitDtm,
  splitText,
  stripApplies,
  stripNote,
  timelineEmptyText,
  verdictText,
  windowApplies,
  windowOffNote,
  writeBack,
  type DtmDecoderArgs,
  type DtmState,
} from "./dtm-decoder";
import { loadEdiLib } from "./edi-lib";
import {
  asideSizer,
  callOutputSizer,
  callSizer,
  figureSizer,
  holdHtml,
  lit,
  outputSizer,
  sizerHtml,
  textSizers,
} from "./edi-picture";
import { drawFigure, drawTimeline } from "./edi-render";
import {
  EDI_ZONES,
  GAP_PROMPT,
  SHORT_ZONE,
  NO_RESULT_TITLE,
  callArgs,
  formatValue,
  readoutOf,
  readoutRowsHtml,
  REJECT,
  widestGap,
  yearWindowFieldsHtml,
  yearWindowFromControls,
  yearWindowControls,
  yearWindowOptions,
  zoneOptionsHtml,
  type EdiLib,
} from "./edi-widgets";
import { setPresetDescription } from "./punctuality-widgets";
import { onceDestroy, WidgetLoadError, type MountFn } from "./widget-mount";
import {
  escapeAttr,
  escapeHtml,
  labelTextHtml,
  renderAside,
  clearCallLine,
  renderCallLine,
  renderWidgetOutput,
  setControlValue,
  wireCopyButtons,
} from "./widget-ui";

export type { DtmDecoderArgs } from "./dtm-decoder";

/** The options of the preset `<select>`. Custom first, unselected unless no
 *  preset matches. */
function presetOptions(presetId: string): string {
  return (
    `<option value="${CUSTOM_PRESET_ID}"${presetId === CUSTOM_PRESET_ID ? " selected" : ""}>Custom</option>` +
    DTM_PRESETS.map(
      (p) =>
        `<option value="${escapeAttr(p.id)}"${p.id === presetId ? " selected" : ""}>${escapeHtml(p.label)}</option>`,
    ).join("")
  );
}

function stripRowHtml(n: number, zone: string): string {
  return (
    `<div class="gmt-dtm-row" data-series="${n}" data-role="strip-row-${n}">` +
    `<span class="gmt-dtm-badge">${n}</span>` +
    `<select class="gmt-select" data-role="zone-${n}" aria-label="Zone ${n}">${zoneOptionsHtml(EDI_ZONES, zone, "No zone")}</select>` +
    `<span class="gmt-dtm-cell" data-label="instant" data-role="instant-${n}"></span>` +
    `<span class="gmt-dtm-cell" data-label="offset" data-role="offset-${n}"></span>` +
    `<span class="gmt-dtm-cell" data-label="as 205" data-role="as205-${n}"></span>` +
    `</div>`
  );
}

/**
 * The widget's chrome, seeded with `args` so the first paint shows them. With no
 * `input` it shows the first preset. Results are drawn by `mount`, because they
 * come from the real library calls.
 */
export function renderDtmDecoderTemplate(args: DtmDecoderArgs = {}): string {
  const seeded = args.input !== undefined;
  const state: DtmState = seeded
    ? readArgs(args)
    : presetState(DTM_PRESETS[0]!);
  const presetId = matchPreset(state);
  const preset = DTM_PRESETS.find((p) => p.id === presetId);
  const segment = splitDtm(state.input).kind === "segment";
  const shownFormat = segment ? effective(state).format : state.format;

  const t = dtmTexts();
  const hint = "gmt-widget-hint";
  const aside = [asideSizer("No result", [t.reasons.reduce((a, b) => (b.length > a.length ? b : a), "")])];
  const figures = figureSizer([
    {
      parts: [
        { text: "DTM", caption: "segment", after: "+", kind: "tag" },
        { text: "137", caption: "qualifier", after: ":", kind: "plain" },
        { text: "202406151430202406201600", caption: "value", after: ":", kind: "value" },
        { text: "719", caption: "format", after: "'", kind: "code" },
      ],
      halves: [
        { label: "start", fields: [lit("2024", "CCYY", "date"), lit("06", "MM", "date"), lit("15", "DD", "date"), lit("14", "HH", "time"), lit("30", "MM", "time")] },
        { label: "end", fields: [lit("2024", "CCYY", "date"), lit("06", "MM", "date"), lit("20", "DD", "date"), lit("16", "HH", "time"), lit("00", "MM", "time")] },
      ],
      separator: "",
      closing: "no offset",
    },
    {
      parts: [
        { text: "DTM", caption: "segment", after: "+", kind: "tag" },
        { text: "137", caption: "qualifier", after: ":", kind: "plain" },
        { text: "20240615143045+0200", caption: "value", after: ":", kind: "value" },
        { text: "208", caption: "format", after: "'", kind: "code" },
      ],
      halves: [
        { label: "", fields: [lit("2024", "CCYY", "date"), lit("06", "MM", "date"), lit("15", "DD", "date"), lit("14", "HH", "time"), lit("30", "MM", "time"), lit("45", "SS", "time"), lit("+0200", "ZHHMM", "offset")] },
      ],
      separator: "",
      closing: "",
    },
  ]);
  return (
    `<div class="gmt-dtm-decoder gmt-widget not-content">` +
    `<div class="gmt-widget-card">` +
    // 1. Paste: one compact line where it fits
    `<div class="gmt-widget-section gmt-widget-section--wide">` +
    `<h4>1. Paste a segment or a value</h4>` +
    `<div class="gmt-field-grid gmt-edi-top">` +
    `<label class="gmt-label gmt-edi-preset">${labelTextHtml("Preset")}` +
    `<select class="gmt-select" data-role="preset">${presetOptions(presetId)}</select>` +
    `</label>` +
    `<label class="gmt-label gmt-edi-main">${labelTextHtml("Segment or value")}` +
    `<input class="gmt-input" data-role="input" type="text" maxlength="64" spellcheck="false" autocomplete="off" autocapitalize="off" value="${escapeAttr(state.input)}"></label>` +
    `<label class="gmt-label">${labelTextHtml("Format code (2379)")}` +
    `<input class="gmt-input" data-role="format" type="text" maxlength="8" spellcheck="false" autocomplete="off" autocapitalize="off" value="${escapeAttr(shownFormat)}"${segment ? " disabled" : ""}></label>` +
    yearWindowFieldsHtml(state.yearWindow, true) +
    `</div>` +
    holdHtml(
      `<p class="gmt-widget-hint" data-role="preset-description" data-grow="slot">${escapeHtml(preset?.description ?? "")}</p>`,
      textSizers("p", hint, t.descriptions),
    ) +
    holdHtml(`<p class="gmt-widget-hint" data-role="split" data-grow="slot"></p>`, [
      sizerHtml("p", hint, t.split.map((x) => `<span class="gmt-edi-line">${escapeHtml(x)}</span>`).join("")),
    ]) +
    `</div>` +
    // 2. What the value states: the value taken apart, and what it states
    `<div class="gmt-widget-section gmt-widget-section--wide">` +
    `<h4>2. What the value states</h4>` +
    `<div class="gmt-edi-split">` +
    `<div class="gmt-edi-pane">` +
    `<div class="gmt-edi-panel">` +
    holdHtml(`<div class="gmt-edi-figure" data-role="figure" role="img" aria-label=""></div>`, [figures]) +
    holdHtml(`<p class="gmt-widget-hint gmt-edi-figure-note" data-role="figure-note"></p>`, textSizers("p", "gmt-widget-hint gmt-edi-figure-note", t.yearNotes)) +
    holdHtml(`<div data-role="reason-aside"></div>`, aside) +
    `</div>` +
    holdHtml(`<div class="gmt-edi-call" data-role="parse-block">${codeFrameHtml("parse")}</div>`, [callSizer(t.parseCall)]) +
    `</div>` +
    `<div class="gmt-edi-pane">` +
    holdHtml(`<p class="gmt-edi-verdict" data-role="verdict" aria-live="polite"></p>`, textSizers("p", "gmt-edi-verdict", t.verdicts)) +
    holdHtml(`<p class="gmt-edi-detail" data-role="verdict-detail"></p>`, textSizers("p", "gmt-edi-detail", t.details)) +
    `<dl class="gmt-edi-readouts" data-role="readouts">${readoutRowsHtml(MEMBER_ROWS)}</dl>` +
    holdHtml(`<output class="gmt-widget-output gmt-edi-out" data-role="parse-output">&nbsp;</output>`, [outputSizer("gmt-widget-output gmt-edi-out", t.parseOutput)]) +
    `</div>` +
    `</div>` +
    `</div>` +
    // 3. Where an offsetless value lands
    `<div class="gmt-widget-section gmt-widget-section--wide">` +
    `<h4>3. Where an offsetless value lands</h4>` +
    holdHtml(`<p class="gmt-widget-hint" data-role="strip-note" data-grow="slot"></p>`, textSizers("p", hint, t.stripNotes)) +
    `<div class="gmt-edi-split">` +
    `<div class="gmt-edi-pane">` +
    `<div class="gmt-edi-timeline gmt-edi-panel" data-role="timeline" role="img" aria-label=""></div>` +
    holdHtml(`<p class="gmt-edi-verdict gmt-edi-verdict--long" data-role="gap"></p>`, textSizers("p", "gmt-edi-verdict gmt-edi-verdict--long", [...t.gaps, GAP_PROMPT])) +
    `</div>` +
    `<div class="gmt-edi-pane">` +
    `<div class="gmt-dtm-strip" data-role="gap-strip" role="group" aria-label="The same local time in up to four zones">` +
    `<div class="gmt-dtm-head" aria-hidden="true"><span></span><span>Zone</span><span>Instant</span><span>Offset</span><span>As 205</span></div>` +
    [1, 2, 3, 4].map((n) => stripRowHtml(n, state.zones[n - 1] ?? "")).join("") +
    `</div>` +
    `<p class="gmt-transport-visually-hidden" data-role="strip-summary" aria-live="polite"></p>` +
    holdHtml(`<div data-role="strip-aside"></div>`, [
      asideSizer(NO_RESULT_TITLE, [t.reasons[0]!, t.reasons[0]!].map(() => `${SHORT_ZONE}: The 01:30 time happens twice in ${SHORT_ZONE} on that date. With disambiguation: "reject", resolveLocal does not pick one.`)),
    ]) +
    holdHtml(
      `<div class="gmt-edi-call" data-role="resolve-block" hidden>` +
        codeFrameHtml("resolve") +
        `<output class="gmt-widget-output" data-role="resolve-output">&nbsp;</output>` +
        `</div>`,
      [callOutputSizer(t.resolveCall, '"2024-06-15T18:30:00Z"')],
    ) +
    `</div>` +
    `</div>` +
    `</div>` +
    // 4. Written back: the value and its call on one line
    `<div class="gmt-widget-section gmt-widget-section--wide">` +
    `<h4>4. Written back by <code>formatEdifactDtm</code></h4>` +
    `<div class="gmt-edi-written">` +
    `<output class="gmt-widget-output gmt-edi-out" data-role="format-output">&nbsp;</output>` +
    holdHtml(`<div class="gmt-edi-call" data-role="format-block" hidden>${codeFrameHtml("format")}</div>`, [callSizer(t.formatCall)]) +
    `</div>` +
    holdHtml(`<p class="gmt-widget-hint" data-role="format-note" data-grow="slot"></p>`, textSizers("p", hint, t.writeNotes)) +
    `</div>` +
    `</div>` +
    `</div>`
  );
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

/** A readout cell: plain text, or the sentinel through `renderWidgetOutput`. */
function setCell(el: HTMLElement | null, text: string, sentinel = false): void {
  if (!el) return;
  if (sentinel) {
    renderWidgetOutput(el, text, "sentinel");
    return;
  }
  el.classList.remove("gmt-playground-sentinel");
  el.textContent = text;
}

function setupWidget(root: HTMLElement, lib: EdiLib, signal: AbortSignal) {
  const q = <T extends HTMLElement>(role: string) =>
    root.querySelector(`[data-role="${role}"]`) as T | null;
  const presetEl = q<HTMLSelectElement>("preset")!;
  const inputEl = q<HTMLInputElement>("input")!;
  const formatEl = q<HTMLInputElement>("format")!;
  const windowEl = q<HTMLSelectElement>("year-window")!;
  const startEl = q<HTMLInputElement>("year-start")!;
  const zoneEls = [1, 2, 3, 4].map((n) => q<HTMLSelectElement>(`zone-${n}`)!);

  // The format the reader typed for a bare value. A segment shows its own code
  // in the same field, and the typed one comes back when the segment goes.
  let typedFormat = formatEl.disabled ? "" : formatEl.value;
  let destroyed = false;
  signal.addEventListener("abort", () => {
    destroyed = true;
  });

  const readState = (): DtmState => ({
    input: inputEl.value,
    format: splitDtm(inputEl.value).kind === "segment" ? "" : typedFormat,
    yearWindow: yearWindowFromControls(windowEl.value, startEl.value),
    zones: zoneEls.map((z) => z.value) as DtmState["zones"],
  });

  function syncPreset(s: DtmState): void {
    const id = matchPreset(s);
    presetEl.value = id;
    const slot = q("preset-description");
    if (slot) {
      setPresetDescription(
        slot,
        DTM_PRESETS.find((p) => p.id === id)?.description ?? "",
      );
    }
  }

  function renderStrip(s: DtmState, result: ReturnType<EdiLib["parseEdifactDtm"]>) {
    const applies = result !== null && stripApplies(result);
    const note = q("strip-note");
    if (note) note.textContent = stripNote(result);
    const rows = applies
      ? gapRows(result.local!, s.zones, lib)
      : s.zones.map((zone) => ({
          zone: zone.trim(),
          instant: "",
          offset: "",
          as205: "",
          reason: "",
        }));

    rows.forEach((row, i) => {
      const n = i + 1;
      const zoneEl = zoneEls[i]!;
      zoneEl.disabled = !applies;
      const instant = q(`instant-${n}`);
      if (!applies) setCell(instant, "");
      else if (row.zone === "") setCell(instant, "no zone chosen");
      else if (row.instant === "") setCell(instant, "NO SIGNAL", true);
      else setCell(instant, row.instant);
      setCell(q(`offset-${n}`), applies ? row.offset : "");
      setCell(q(`as205-${n}`), applies ? row.as205 : "");
    });

    const gapEl = q("gap");
    const gap = applies ? widestGap(rows, lib) : null;
    if (gapEl) {
      gapEl.textContent = applies ? (gap ? gap.text : GAP_PROMPT) : "";
    }

    // The one shared UTC timeline: the zones' marks, the one instant a value
    // states, or an empty state in words.
    const timeline = q("timeline");
    if (applies) {
      drawTimeline(timeline, {
        kind: "marks",
        rows: rows
          .map((r, i) => ({ n: i + 1, zone: r.zone, instant: r.instant }))
          .filter((r) => r.zone !== ""),
        gap,
      });
    } else if (result?.instant !== undefined) {
      drawTimeline(timeline, { kind: "stated", instant: result.instant });
    } else {
      drawTimeline(timeline, { kind: "empty", text: timelineEmptyText(result) });
    }

    const summary = q("strip-summary");
    if (summary) {
      summary.textContent = applies
        ? rows
            .map((r, i) =>
              r.zone === ""
                ? `Zone ${i + 1}: no zone chosen.`
                : r.instant === ""
                  ? `Zone ${i + 1}, ${r.zone}: no signal. ${r.reason}`
                  : `Zone ${i + 1}, ${r.zone}: ${r.instant}, offset ${r.offset}, written ${r.as205}.`,
            )
            .join(" ") + (gap ? ` ${gap.text}.` : "")
        : stripNote(result);
    }

    const aside = q("strip-aside");
    if (aside) {
      const refused = rows.filter((r) => r.reason !== "");
      if (refused.length === 0) aside.innerHTML = "";
      else {
        renderAside(
          aside,
          "caution",
          NO_RESULT_TITLE,
          refused
            .map(
              (r) =>
                `<p>${escapeHtml(`${r.zone}: ${r.reason}`)}</p>`,
            )
            .join(""),
        );
      }
    }

    // The first chosen zone's resolveLocal, shown as the real call.
    const block = q("resolve-block");
    const first = applies ? rows.find((r) => r.zone !== "") : undefined;
    if (block) block.hidden = first === undefined;
    if (first === undefined) clearCallLine(q("call-resolve"));
    if (first !== undefined && result?.local !== undefined) {
      const [html, plain] = callArgs([result.local, first.zone, REJECT]);
      renderCallLine(q("call-resolve"), "resolveLocal", html, plain);
      const out = q("resolve-output");
      if (out) {
        if (first.instant === "") renderWidgetOutput(out, "NO SIGNAL", "sentinel");
        else renderWidgetOutput(out, formatValue(first.instant), "live");
      }
    }
  }

  function render(): void {
    if (destroyed) return;
    const s = readState();
    const { value, format, split } = effective(s);

    // Section 1: the format field mirrors a segment's code.
    if (split.kind === "segment") {
      formatEl.value = split.format;
      formatEl.disabled = true;
      formatEl.dataset["derived"] = "1";
    } else {
      if (formatEl.dataset["derived"] === "1") {
        formatEl.value = typedFormat;
        delete formatEl.dataset["derived"];
      }
      formatEl.disabled = false;
    }
    const applies = windowApplies(s, lib);
    windowEl.disabled = !applies;
    startEl.disabled = !applies || windowEl.value !== "fixed";
    const splitEl = q("split");
    if (splitEl) {
      const off = windowOffNote(s, lib);
      splitEl.innerHTML =
        `<span class="gmt-edi-line">${escapeHtml(splitText(s))}</span>` +
        (off ? `<span class="gmt-edi-line">${escapeHtml(off)}</span>` : "");
    }

    // Section 2: parseEdifactDtm. A blank form makes no call: it is the empty
    // state, never the sentinel.
    const blank = dtmBlank(s);
    const options = applies ? yearWindowOptions(s.yearWindow) : undefined;
    const result = blank ? null : lib.parseEdifactDtm(value, format, options);
    const parseBlock = q("parse-block");
    if (parseBlock) parseBlock.hidden = blank;
    const out = q("parse-output");
    if (blank) {
      if (out) renderWidgetOutput(out, "nothing to read", "empty");
    } else {
      const [parseHtml, parsePlain] = callArgs(
        options === undefined ? [value, format] : [value, format, options],
      );
      renderCallLine(q("call-parse"), "parseEdifactDtm", parseHtml, parsePlain);
      if (out) {
        if (result === null) renderWidgetOutput(out, "NO SIGNAL", "sentinel");
        else renderWidgetOutput(out, formatValue(result), "live");
      }
    }
    const verdict = q("verdict");
    if (verdict) verdict.textContent = result === null ? "" : verdictText(result);
    const detail = q("verdict-detail");
    if (detail) detail.textContent = result === null ? "" : detailText(result);
    for (const row of MEMBER_ROWS) {
      const cell = q(row.role);
      if (!cell) continue;
      const r = readoutOf(
        result === null ? null : memberText(result, row.key),
        result !== null,
      );
      cell.textContent = r.text;
      cell.dataset["state"] = r.state;
    }
    // The value taken apart.
    if (blank) {
      drawFigure(q("figure"), { kind: "empty", text: "Paste a segment or a value to take it apart." });
      const noteEl = q("figure-note");
      if (noteEl) noteEl.textContent = "";
    } else {
      const fig = dtmFigure(s, result, lib);
      drawFigure(q("figure"), {
        kind: "value",
        parts: dtmParts(s),
        halves: fig.halves,
        separator: fig.separator,
        closing: fig.closing,
        aria: fig.aria,
      });
      const noteEl = q("figure-note");
      if (noteEl) noteEl.textContent = fig.note;
    }
    const aside = q("reason-aside");
    if (aside) {
      if (!blank && result === null) {
        renderAside(
          aside,
          "caution",
          NO_RESULT_TITLE,
          `<p>${escapeHtml(nullReasonText(explainNull(s, lib), s))}</p>`,
        );
      } else {
        aside.innerHTML = "";
      }
    }

    // Section 3: the strip.
    renderStrip(s, result);

    // Section 4: written back.
    const written = writeBack(s, result, lib);
    const fmtOut = q("format-output");
    const fmtNote = q("format-note");
    const fmtBlock = q("format-block");
    if (fmtBlock) fmtBlock.hidden = written === null;
    if (written === null) {
      if (fmtOut) renderWidgetOutput(fmtOut, "no value to write back", "empty");
      if (fmtNote) fmtNote.textContent = "";
    } else {
      const [html, plain] = callArgs(written.args);
      renderCallLine(q("call-format"), "formatEdifactDtm", html, plain);
      if (fmtOut) {
        if (written.output === "") {
          renderWidgetOutput(fmtOut, "NO SIGNAL", "sentinel");
        } else {
          renderWidgetOutput(fmtOut, formatValue(written.output), "live");
        }
      }
      if (fmtNote) fmtNote.textContent = written.note;
    }
  }

  /** Write a whole state onto the controls. */
  function apply(s: DtmState): void {
    setControlValue(inputEl, s.input);
    typedFormat = s.format;
    delete formatEl.dataset["derived"];
    formatEl.value = s.format;
    const { mode, start } = yearWindowControls(s.yearWindow);
    setControlValue(windowEl, mode);
    setControlValue(startEl, start);
    zoneEls.forEach((el, i) => setControlValue(el, s.zones[i] ?? ""));
  }

  function applyPreset(): void {
    const preset = DTM_PRESETS.find((p) => p.id === presetEl.value);
    if (!preset) return;
    apply(presetState(preset));
    syncPreset(readState());
    render();
  }

  const onTyped = (role: string): boolean =>
    role === "input" || role === "format" || role === "year-start";

  root.addEventListener("input", (e) => {
    if (destroyed) return;
    const role = (e.target as HTMLElement).dataset?.["role"] ?? "";
    if (!onTyped(role)) return;
    if (role === "format") typedFormat = formatEl.value;
    syncPreset(readState());
    render();
  });

  root.addEventListener("change", (e) => {
    if (destroyed) return;
    const role = (e.target as HTMLElement).dataset?.["role"] ?? "";
    if (role === "preset") applyPreset();
    else if (role === "year-window" || /^zone-\d$/.test(role)) {
      syncPreset(readState());
      render();
    }
  });

  wireCopyButtons(root);
  syncPreset(readState());
  render();

  return {
    readState,
    apply,
    render,
    syncPreset,
    destroy: () => {
      destroyed = true;
    },
  };
}

export const mountDtmDecoder: MountFn<DtmDecoderArgs> = async (
  root,
  args,
  signal,
) => {
  let lib: EdiLib;
  try {
    lib = await loadEdiLib();
  } catch (cause) {
    // Loud, not inert: the host decides what to show (see `WidgetLoadError`).
    throw new WidgetLoadError(cause);
  }
  if (signal.aborted) return onceDestroy(() => {});

  const widget = setupWidget(root, lib, signal);
  if (args.input !== undefined) {
    widget.apply(readArgs(args));
    widget.syncPreset(widget.readState());
    widget.render();
  }

  return onceDestroy(
    () => widget.destroy(),
    () => permalinkOf(widget.readState()),
  );
};
