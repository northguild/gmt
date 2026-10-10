/**
 * The X12 Time Reader widget (INT-15), mountable on its tool page and in the
 * chat rail.
 *
 * The main section takes the three elements a freight segment carries side by
 * side (`AT7`, `G62`, `DTM-02`/`03`/`04`): a date (element 373), a time (element
 * 337) and a time code (element 623), any of which may be empty. It reads them
 * with `parseX12DateAndTime` (or `parseX12Date` or `parseX12Time` when only one is
 * sent), classifies the code with `classifyX12TimeCode`, and then asks
 * `x12TimeCodeOffset` or `x12TimeCodeZone`. A code that states an offset gives the
 * instant with `resolveLocal(local, offset)`; a code that does not leaves the
 * instant to the zones the reader picks. The call line prints every call as made.
 * X12 is a United States standard.
 *
 * A second, smaller section reads an element 1251 value against its 1250
 * qualifier: it classifies the qualifier and calls the parser of its kind. It has
 * no time code and no instant.
 *
 * `null` and `""` from the library render as NO SIGNAL with one sentence saying
 * why. A state with no library call behind it renders as empty, never amber.
 * Nothing derives a zone from a time code or a zone name: a preset states its own
 * example's zones, and every other zone is the reader's. Follows the DTM
 * Decoder's split: every listener is delegated on the root, so the host dropping
 * the subtree is a complete teardown.
 */
import { codeFrameHtml } from "./code-frame";
import { loadEdiLib } from "./edi-lib";
import {
  asideSizer,
  callSizer,
  figureSizer,
  holdHtml,
  lit,
  outputSizer,
  sizerHtml,
  textSizers,
} from "./edi-picture";
import {
  callResultsText,
  drawFigure,
  drawTimeline,
  renderCalls,
} from "./edi-render";
import {
  EDI_ZONES,
  NO_RESULT_TITLE,
  callArgs,
  formatValue,
  GAP_PROMPT,
  SHORT_ZONE,
  readoutOf,
  readoutRowsHtml,
  REJECT,
  widestGap,
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
import {
  CUSTOM_PRESET_ID,
  DTP_MEMBER_ROWS,
  DTP_PRESETS,
  MEMBER_ROWS,
  X12_PRESETS,
  dtpBlank,
  dtpFigure,
  dtpMemberText,
  dtpParts,
  dtpPresetState,
  dtpSentinelText,
  dtpWriteBack,
  elementFigure,
  gapRows,
  instantPlan,
  isSeeded,
  mainBlank,
  matchDtpPreset,
  matchPreset,
  memberText,
  ok,
  permalinkOf,
  presetState,
  readArgs,
  readDtp,
  readX12,
  sentinelText,
  stripApplies,
  stripNote,
  timelineEmptyText,
  verdictOf,
  writeDate,
  writeTime,
  x12Texts,
  type DtpState,
  type X12State,
  type X12TimeReaderArgs,
} from "./x12-time-reader";

export type { X12TimeReaderArgs } from "./x12-time-reader";

/** The options of a preset `<select>`. Custom first, unselected unless no
 *  preset matches. */
function presetOptions(
  presets: readonly { id: string; label: string }[],
  presetId: string,
): string {
  return (
    `<option value="${CUSTOM_PRESET_ID}"${presetId === CUSTOM_PRESET_ID ? " selected" : ""}>Custom</option>` +
    presets
      .map(
        (p) =>
          `<option value="${escapeAttr(p.id)}"${p.id === presetId ? " selected" : ""}>${escapeHtml(p.label)}</option>`,
      )
      .join("")
  );
}

function textField(
  role: string,
  label: string,
  value: string,
  opts: { optional?: boolean; maxlength?: number } = {},
): string {
  return (
    `<label class="gmt-label">${labelTextHtml(label, { optional: opts.optional })}` +
    `<input class="gmt-input" data-role="${role}" type="text" maxlength="${opts.maxlength ?? 64}" spellcheck="false" autocomplete="off" autocapitalize="off" value="${escapeAttr(value)}"></label>`
  );
}

function stripRowHtml(n: number, zone: string): string {
  return (
    `<div class="gmt-dtm-row" data-series="${n}" data-role="strip-row-${n}">` +
    `<span class="gmt-dtm-badge">${n}</span>` +
    `<select class="gmt-select" data-role="zone-${n}" aria-label="Zone ${n}">${zoneOptionsHtml(EDI_ZONES, zone, "No zone")}</select>` +
    `<span class="gmt-dtm-cell" data-label="instant" data-role="instant-${n}"></span>` +
    `<span class="gmt-dtm-cell" data-label="offset" data-role="offset-${n}"></span>` +
    `<span class="gmt-dtm-cell" data-label="with offset" data-role="withoffset-${n}"></span>` +
    `</div>`
  );
}

/**
 * The widget's chrome, seeded with `args` so the first paint shows them. With no
 * date, time, time code or `DTP` pair it shows the first preset of each
 * section. Results are drawn by `mount`, because they come from the real library
 * calls.
 */
export function renderX12TimeReaderTemplate(
  args: X12TimeReaderArgs = {},
): string {
  const seeded = isSeeded(args);
  const read = readArgs(args);
  const main: X12State = seeded ? read.main : presetState(X12_PRESETS[0]!);
  const dtp: DtpState = seeded ? read.dtp : dtpPresetState(DTP_PRESETS[0]!);
  const presetId = matchPreset(main);
  const dtpPresetId = matchDtpPreset(dtp);
  const preset = X12_PRESETS.find((p) => p.id === presetId);
  const dtpPreset = DTP_PRESETS.find((p) => p.id === dtpPresetId);

  const t = x12Texts();
  const hint = "gmt-widget-hint";
  const longest = (xs: readonly string[]): string =>
    xs.reduce((a, b) => (b.length > a.length ? b : a), "");
  const noteSlot = (role: string, texts: readonly string[], cls = hint) =>
    holdHtml(
      `<p class="${cls}" data-role="${role}" data-grow="slot"></p>`,
      textSizers("p", cls, texts),
    );
  const refusal = (reasons: readonly string[], times = 1) =>
    asideSizer(
      NO_RESULT_TITLE,
      Array.from({ length: times }, () => longest(reasons)),
    );
  const elementFigures = figureSizer([
    {
      halves: [
        {
          label: "373",
          fields: [
            lit("2024", "CCYY", "date"),
            lit("06", "MM", "date"),
            lit("15", "DD", "date"),
          ],
        },
        {
          label: "337",
          fields: [
            lit("14", "HH", "time"),
            lit("30", "MM", "time"),
            lit("00", "SS", "time"),
            lit("12", "DD", "time"),
          ],
        },
        { label: "623", fields: [lit("ABCDEFGH", "623", "offset")] },
      ],
      separator: "",
      closing: "",
    },
  ]);
  const dtpFigures = figureSizer([
    {
      parts: [
        { text: "06152024", caption: "1251 value", after: "", kind: "value" },
        { text: "DB", caption: "1250", after: "", kind: "code" },
      ],
      halves: [
        {
          label: "",
          fields: [
            lit("06", "MM", "date"),
            lit("15", "DD", "date"),
            lit("2024", "CCYY", "date"),
          ],
        },
      ],
      separator: "",
      closing: "no offset",
    },
    {
      parts: [
        {
          text: "20240615143000-20240620160000",
          caption: "1251 value",
          after: "",
          kind: "value",
        },
        { text: "DTS", caption: "1250", after: "", kind: "code" },
      ],
      halves: [
        {
          label: "start",
          fields: [
            lit("2024", "CCYY", "date"),
            lit("06", "MM", "date"),
            lit("15", "DD", "date"),
            lit("14", "HH", "time"),
            lit("30", "MM", "time"),
            lit("00", "SS", "time"),
          ],
        },
        {
          label: "end",
          fields: [
            lit("2024", "CCYY", "date"),
            lit("06", "MM", "date"),
            lit("20", "DD", "date"),
            lit("16", "HH", "time"),
            lit("00", "MM", "time"),
            lit("00", "SS", "time"),
          ],
        },
      ],
      separator: "-",
      closing: "no offset",
    },
  ]);
  return (
    `<div class="gmt-x12-time-reader gmt-widget not-content">` +
    `<div class="gmt-widget-card">` +
    // 1. The three elements: one compact line where it fits
    `<div class="gmt-widget-section gmt-widget-section--wide">` +
    `<h4>1. The date, the time and the time code</h4>` +
    `<div class="gmt-field-grid gmt-edi-top" data-line="main">` +
    `<label class="gmt-label gmt-edi-preset">${labelTextHtml("Preset")}` +
    `<select class="gmt-select" data-role="preset">${presetOptions(X12_PRESETS, presetId)}</select>` +
    `</label>` +
    textField("date", "Date (373)", main.date, { optional: true }) +
    textField("time", "Time (337)", main.time, { optional: true }) +
    textField("time-code", "Time code (623)", main.timeCode, {
      optional: true,
      maxlength: 8,
    }) +
    `</div>` +
    holdHtml(
      `<p class="gmt-widget-hint" data-role="preset-description" data-grow="slot">${escapeHtml(preset?.description ?? "")}</p>`,
      textSizers("p", hint, t.descriptions),
    ) +
    `<p class="gmt-widget-hint">Element 373 is CCYYMMDD. Element 337 is HHMM, HHMMSS, HHMMSSD or HHMMSSDD. Any of the three may be empty, and an empty element is left out of the call.</p>` +
    `</div>` +
    // 2. What parseX12DateTime returns: the elements taken apart, and what they state
    `<div class="gmt-widget-section gmt-widget-section--wide">` +
    `<h4>2. What the calls return</h4>` +
    `<div class="gmt-edi-split">` +
    `<div class="gmt-edi-pane">` +
    `<div class="gmt-edi-panel">` +
    holdHtml(
      `<div class="gmt-edi-figure" data-role="figure" role="img" aria-label=""></div>`,
      [elementFigures],
    ) +
    holdHtml(
      `<p class="gmt-widget-hint gmt-edi-figure-note" data-role="figure-note"></p>`,
      [
        sizerHtml(
          "p",
          "gmt-widget-hint gmt-edi-figure-note",
          t.timeNotes
            .map((n) => `<span class="gmt-edi-line">${escapeHtml(n)}</span>`)
            .join(""),
        ),
      ],
    ) +
    holdHtml(`<div data-role="reason-aside"></div>`, [refusal(t.reasons)]) +
    `</div>` +
    holdHtml(
      `<div class="gmt-edi-call" data-role="parse-block">${codeFrameHtml("parse")}</div>`,
      [callSizer(t.parseCall)],
    ) +
    `</div>` +
    `<div class="gmt-edi-pane">` +
    holdHtml(
      `<p class="gmt-edi-verdict" data-role="verdict" aria-live="polite"></p>`,
      textSizers("p", "gmt-edi-verdict", t.verdicts),
    ) +
    holdHtml(
      `<p class="gmt-edi-detail" data-role="verdict-detail"></p>`,
      textSizers("p", "gmt-edi-detail", t.details),
    ) +
    `<dl class="gmt-edi-readouts" data-role="readouts">${readoutRowsHtml(MEMBER_ROWS)}</dl>` +
    holdHtml(
      `<output class="gmt-widget-output gmt-edi-out" data-role="parse-output">&nbsp;</output>`,
      [outputSizer("gmt-widget-output gmt-edi-out", t.parseOutput)],
    ) +
    `</div>` +
    `</div>` +
    `</div>` +
    // 3. The instant, and where the same digits land
    `<div class="gmt-widget-section gmt-widget-section--wide">` +
    `<h4>3. The instant, and where the same digits land</h4>` +
    noteSlot("strip-note", t.stripNotes) +
    `<div class="gmt-edi-split">` +
    `<div class="gmt-edi-pane">` +
    `<div class="gmt-edi-timeline gmt-edi-panel" data-role="timeline" role="img" aria-label=""></div>` +
    holdHtml(
      `<p class="gmt-edi-verdict gmt-edi-verdict--long" data-role="gap"></p>`,
      textSizers("p", "gmt-edi-verdict gmt-edi-verdict--long", [
        ...t.gaps,
        GAP_PROMPT,
      ]),
    ) +
    holdHtml(
      `<div class="gmt-edi-call" data-role="resolve-block" hidden>${codeFrameHtml("resolve")}</div>`,
      [callSizer(t.resolveCall)],
    ) +
    `</div>` +
    `<div class="gmt-edi-pane">` +
    `<div class="gmt-dtm-strip" data-role="gap-strip" role="group" aria-label="The same local time in up to four zones">` +
    `<div class="gmt-dtm-head" aria-hidden="true"><span></span><span>Zone</span><span>Instant</span><span>Offset</span><span>With offset</span></div>` +
    [1, 2, 3, 4].map((n) => stripRowHtml(n, main.zones[n - 1] ?? "")).join("") +
    `</div>` +
    `<p class="gmt-transport-visually-hidden" data-role="strip-summary" aria-live="polite"></p>` +
    holdHtml(`<div data-role="strip-aside"></div>`, [
      asideSizer(
        NO_RESULT_TITLE,
        Array.from(
          { length: 2 },
          () =>
            `${SHORT_ZONE}: The 01:30 time happens twice in ${SHORT_ZONE} on that date. With disambiguation: "reject", resolveLocal does not pick one.`,
        ),
      ),
    ]) +
    `<output class="gmt-widget-output gmt-edi-out" data-role="instant-output">&nbsp;</output>` +
    noteSlot("instant-note", t.instantNotes) +
    `</div>` +
    `</div>` +
    `</div>` +
    // 4. Written back: each element and its call on one line
    `<div class="gmt-widget-section gmt-widget-section--wide">` +
    `<h4>4. Written back by <code>formatX12Date</code> and <code>formatX12TimeElement</code></h4>` +
    `<div class="gmt-edi-pairs">` +
    `<div class="gmt-edi-written">` +
    `<div class="gmt-edi-written-cell">` +
    `<p class="gmt-widget-hint">The date as element 373, with D8.</p>` +
    `<output class="gmt-widget-output gmt-edi-out" data-role="date-output">&nbsp;</output>` +
    `</div>` +
    holdHtml(
      `<div class="gmt-edi-call" data-role="date-block" hidden>${codeFrameHtml("write-date")}</div>`,
      [callSizer(t.writeCall)],
    ) +
    `</div>` +
    `<div class="gmt-edi-written">` +
    `<div class="gmt-edi-written-cell">` +
    `<p class="gmt-widget-hint">The time as element 337, in the form it was sent.</p>` +
    `<output class="gmt-widget-output gmt-edi-out" data-role="time-output">&nbsp;</output>` +
    `</div>` +
    holdHtml(
      `<div class="gmt-edi-call" data-role="time-block" hidden>${codeFrameHtml("write-time")}</div>`,
      [callSizer(t.writeCall)],
    ) +
    `</div>` +
    `</div>` +
    noteSlot("format-note", t.formatNotes) +
    `</div>` +
    // 5. A DTP value: one compact line where it fits
    `<div class="gmt-widget-section gmt-widget-section--wide">` +
    `<h4>5. A DTP value</h4>` +
    `<div class="gmt-field-grid gmt-edi-top" data-line="dtp">` +
    `<label class="gmt-label gmt-edi-preset">${labelTextHtml("Preset")}` +
    `<select class="gmt-select" data-role="dtp-preset">${presetOptions(DTP_PRESETS, dtpPresetId)}</select>` +
    `</label>` +
    textField("dtp-format", "Qualifier (1250)", dtp.format, { maxlength: 8 }) +
    textField("dtp-value", "Value (1251)", dtp.value) +
    `</div>` +
    holdHtml(
      `<p class="gmt-widget-hint" data-role="dtp-preset-description" data-grow="slot">${escapeHtml(dtpPreset?.description ?? "")}</p>`,
      textSizers("p", hint, t.dtpDescriptions),
    ) +
    `<p class="gmt-widget-hint">A DTP segment carries a 1250 qualifier and an element 1251 value. It carries no time code, and no 1250 code states an offset.</p>` +
    `</div>` +
    // 6. What the DTP calls return: the value taken apart, and its members
    `<div class="gmt-widget-section gmt-widget-section--wide">` +
    `<h4>6. What the DTP calls return</h4>` +
    `<div class="gmt-edi-split">` +
    `<div class="gmt-edi-pane">` +
    `<div class="gmt-edi-panel">` +
    holdHtml(
      `<div class="gmt-edi-figure" data-role="dtp-figure" role="img" aria-label=""></div>`,
      [dtpFigures],
    ) +
    holdHtml(`<div data-role="dtp-reason-aside"></div>`, [
      refusal(t.dtpReasons),
    ]) +
    `</div>` +
    `</div>` +
    `<div class="gmt-edi-pane">` +
    `<dl class="gmt-edi-readouts" data-role="dtp-readouts">${readoutRowsHtml(DTP_MEMBER_ROWS)}</dl>` +
    holdHtml(
      `<div class="gmt-edi-call" data-role="dtp-parse-block">${codeFrameHtml("dtp-parse")}</div>`,
      [callSizer(t.dtpParseCall)],
    ) +
    holdHtml(
      `<output class="gmt-widget-output gmt-edi-out" data-role="dtp-parse-output">&nbsp;</output>`,
      [outputSizer("gmt-widget-output gmt-edi-out", t.dtpParseOutput)],
    ) +
    holdHtml(
      `<div class="gmt-edi-call" data-role="dtp-format-block" hidden>${codeFrameHtml("dtp-format")}</div>`,
      [callSizer(t.dtpFormatCall)],
    ) +
    `<output class="gmt-widget-output gmt-edi-out" data-role="dtp-format-output">&nbsp;</output>` +
    noteSlot("dtp-format-note", t.dtpFormatNotes) +
    `</div>` +
    `</div>` +
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
  const dateEl = q<HTMLInputElement>("date")!;
  const timeEl = q<HTMLInputElement>("time")!;
  const codeEl = q<HTMLInputElement>("time-code")!;
  const zoneEls = [1, 2, 3, 4].map((n) => q<HTMLSelectElement>(`zone-${n}`)!);
  const dtpPresetEl = q<HTMLSelectElement>("dtp-preset")!;
  const dtpFormatEl = q<HTMLInputElement>("dtp-format")!;
  const dtpValueEl = q<HTMLInputElement>("dtp-value")!;

  let destroyed = false;
  signal.addEventListener("abort", () => {
    destroyed = true;
  });

  const readMain = (): X12State => ({
    date: dateEl.value,
    time: timeEl.value,
    timeCode: codeEl.value,
    zones: zoneEls.map((z) => z.value) as X12State["zones"],
  });
  const readDtpState = (): DtpState => ({
    format: dtpFormatEl.value,
    value: dtpValueEl.value,
  });

  function syncPreset(): void {
    const id = matchPreset(readMain());
    presetEl.value = id;
    const slot = q("preset-description");
    if (slot) {
      setPresetDescription(
        slot,
        X12_PRESETS.find((p) => p.id === id)?.description ?? "",
      );
    }
    const dtpId = matchDtpPreset(readDtpState());
    dtpPresetEl.value = dtpId;
    const dtpSlot = q("dtp-preset-description");
    if (dtpSlot) {
      setPresetDescription(
        dtpSlot,
        DTP_PRESETS.find((p) => p.id === dtpId)?.description ?? "",
      );
    }
  }

  // -- The main section --------------------------------------------------

  function renderStrip(
    s: X12State,
    read: ReturnType<typeof readX12>,
  ): ReturnType<typeof gapRows> {
    const applies = stripApplies(read);
    const note = q("strip-note");
    if (note) note.textContent = stripNote(read);
    const rows = applies
      ? gapRows(read.house!, s.zones, lib)
      : s.zones.map((zone) => ({
          zone: zone.trim(),
          instant: "",
          offset: "",
          withOffset: "",
          reason: "",
        }));

    rows.forEach((row, i) => {
      const n = i + 1;
      zoneEls[i]!.disabled = !applies;
      const instant = q(`instant-${n}`);
      if (!applies) setCell(instant, "");
      else if (row.zone === "") setCell(instant, "no zone chosen");
      else if (row.instant === "") setCell(instant, "NO SIGNAL", true);
      else setCell(instant, row.instant);
      setCell(q(`offset-${n}`), applies ? row.offset : "");
      setCell(q(`withoffset-${n}`), applies ? row.withOffset : "");
    });

    const gapEl = q("gap");
    const gap = applies ? widestGap(rows, lib) : null;
    if (gapEl) gapEl.textContent = applies ? (gap ? gap.text : GAP_PROMPT) : "";

    // The one shared UTC timeline: the zones' marks, the one instant the time
    // code states, or an empty state in words.
    const timeline = q("timeline");
    if (applies) {
      drawTimeline(timeline, {
        kind: "marks",
        rows: rows
          .map((r, i) => ({ n: i + 1, zone: r.zone, instant: r.instant }))
          .filter((r) => r.zone !== ""),
        gap,
      });
    } else if (read.instant !== "") {
      drawTimeline(timeline, { kind: "stated", instant: read.instant });
    } else {
      drawTimeline(timeline, { kind: "empty", text: timelineEmptyText(read) });
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
                  : `Zone ${i + 1}, ${r.zone}: ${r.instant}, offset ${r.offset}.`,
            )
            .join(" ") + (gap ? ` ${gap.text}.` : "")
        : stripNote(read);
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
            .map((r) => `<p>${escapeHtml(`${r.zone}: ${r.reason}`)}</p>`)
            .join(""),
        );
      }
    }
    return rows;
  }

  function renderMain(): void {
    const s = readMain();
    const blank = mainBlank(s);
    const read = readX12(
      blank ? { ...s, date: "", time: "", timeCode: "" } : s,
      lib,
    );
    const valid = ok(read);

    // Section 2: the element parse, the code's classifier and its offset or zone.
    const parseBlock = q("parse-block");
    if (parseBlock) parseBlock.hidden = blank || read.calls.length === 0;
    const out = q("parse-output");
    if (blank) {
      if (out) renderWidgetOutput(out, "nothing to read", "empty");
      clearCallLine(q("call-parse"));
    } else {
      renderCalls(q("call-parse"), read.calls);
      if (out) {
        if (!valid) renderWidgetOutput(out, "NO SIGNAL", "sentinel");
        else renderWidgetOutput(out, callResultsText(read.calls), "live");
      }
    }
    const v = verdictOf(read);
    const verdict = q("verdict");
    if (verdict) verdict.textContent = v.verdict;
    const detail = q("verdict-detail");
    if (detail) detail.textContent = v.detail;
    for (const row of MEMBER_ROWS) {
      const cell = q(row.role);
      if (!cell) continue;
      const r = readoutOf(memberText(read, row.key), valid);
      cell.textContent = r.text;
      cell.dataset["state"] = r.state;
    }
    // The three elements taken apart.
    const figureNote = q("figure-note");
    if (blank) {
      drawFigure(q("figure"), {
        kind: "empty",
        text: "Type a date, a time or a time code to take it apart.",
      });
      if (figureNote) figureNote.innerHTML = "";
    } else {
      const fig = elementFigure(s, read);
      drawFigure(q("figure"), {
        kind: "value",
        parts: [],
        halves: fig.halves,
        separator: "",
        closing: "",
        aria: fig.aria,
      });
      if (figureNote) {
        figureNote.innerHTML = fig.notes
          .map((n) => `<span class="gmt-edi-line">${escapeHtml(n)}</span>`)
          .join("");
      }
    }
    const aside = q("reason-aside");
    if (aside) {
      if (!blank && !valid) {
        renderAside(
          aside,
          "caution",
          NO_RESULT_TITLE,
          `<p>${escapeHtml(sentinelText(read, lib))}</p>`,
        );
      } else {
        aside.innerHTML = "";
      }
    }

    // Section 3: the instant, and the strip.
    const rows = renderStrip(s, read);
    const plan = instantPlan(blank ? null : read, s.zones);
    const instantOut = q("instant-output");
    const resolveBlock = q("resolve-block");
    const showsResolve = plan.kind === "resolve" || plan.kind === "stated";
    if (resolveBlock) resolveBlock.hidden = !showsResolve;
    if (!showsResolve) clearCallLine(q("call-resolve"));
    if (instantOut) {
      if (plan.kind === "stated" && read.resolve !== null) {
        renderCalls(q("call-resolve"), [read.resolve]);
        renderWidgetOutput(instantOut, formatValue(read.instant), "live");
      } else if (plan.kind === "resolve") {
        const first = rows.find((r) => r.zone !== "")!;
        const [html, plain] = callArgs([read.house, first.zone, REJECT]);
        renderCallLine(q("call-resolve"), "resolveLocal", html, plain);
        if (first.instant === "") {
          renderWidgetOutput(instantOut, "NO SIGNAL", "sentinel");
          // The reason is the first line of the strip's aside, beside the table.
        } else {
          renderWidgetOutput(instantOut, formatValue(first.instant), "live");
        }
      } else {
        renderWidgetOutput(instantOut, "no instant", "empty");
      }
    }
    const instantNote = q("instant-note");
    if (instantNote) instantNote.textContent = plan.note;

    // Section 4: written back, one element each.
    const dateW = blank ? null : writeDate(read, lib);
    const timeW = blank ? null : writeTime(read, lib);
    const emptyText = !valid ? "nothing to write back" : "not sent";
    const dateOut = q("date-output");
    const dateBlock = q("date-block");
    if (dateBlock) dateBlock.hidden = dateW === null;
    if (dateW === null) {
      clearCallLine(q("call-write-date"));
      if (dateOut) renderWidgetOutput(dateOut, emptyText, "empty");
    } else {
      renderCalls(q("call-write-date"), [dateW.call]);
      if (dateOut) {
        if (dateW.output === "")
          renderWidgetOutput(dateOut, "NO SIGNAL", "sentinel");
        else renderWidgetOutput(dateOut, formatValue(dateW.output), "live");
      }
    }
    const timeOut = q("time-output");
    const timeBlock = q("time-block");
    if (timeBlock) timeBlock.hidden = timeW === null;
    if (timeW === null) {
      clearCallLine(q("call-write-time"));
      if (timeOut) renderWidgetOutput(timeOut, emptyText, "empty");
    } else {
      renderCalls(q("call-write-time"), [timeW.call]);
      if (timeOut) {
        if (timeW.output === "")
          renderWidgetOutput(timeOut, "NO SIGNAL", "sentinel");
        else renderWidgetOutput(timeOut, formatValue(timeW.output), "live");
      }
    }
    const fmtNote = q("format-note");
    if (fmtNote) {
      fmtNote.textContent = [dateW?.note, timeW?.note]
        .filter((n): n is string => n !== undefined && n !== "")
        .join(" ");
    }
  }

  // -- The DTP section ----------------------------------------------------

  function renderDtp(): void {
    const d = readDtpState();
    const blank = dtpBlank(d);
    const read = readDtp(d, lib);
    const parseBlock = q("dtp-parse-block");
    if (parseBlock) parseBlock.hidden = blank || read.calls.length === 0;
    const out = q("dtp-parse-output");
    if (blank) {
      if (out) renderWidgetOutput(out, "nothing to read", "empty");
      clearCallLine(q("call-dtp-parse"));
    } else {
      renderCalls(q("call-dtp-parse"), read.calls);
      if (out) {
        if (read.house === null)
          renderWidgetOutput(out, "NO SIGNAL", "sentinel");
        else renderWidgetOutput(out, callResultsText(read.calls), "live");
      }
    }
    for (const row of DTP_MEMBER_ROWS) {
      const cell = q(row.role);
      if (!cell) continue;
      const r = readoutOf(dtpMemberText(read, row.key), read.house !== null);
      cell.textContent = r.text;
      cell.dataset["state"] = r.state;
    }
    if (blank) {
      drawFigure(q("dtp-figure"), {
        kind: "empty",
        text: "Type a qualifier and a value to take it apart.",
      });
    } else {
      const fig = dtpFigure(read, lib);
      drawFigure(q("dtp-figure"), {
        kind: "value",
        parts: dtpParts(d),
        halves: fig.halves,
        separator: fig.separator,
        closing: fig.closing,
        aria: fig.aria,
      });
    }
    const aside = q("dtp-reason-aside");
    if (aside) {
      if (!blank && read.house === null) {
        renderAside(
          aside,
          "caution",
          NO_RESULT_TITLE,
          `<p>${escapeHtml(dtpSentinelText(read))}</p>`,
        );
      } else {
        aside.innerHTML = "";
      }
    }

    const written = dtpWriteBack(read, lib);
    const fmtOut = q("dtp-format-output");
    const fmtNote = q("dtp-format-note");
    const fmtBlock = q("dtp-format-block");
    if (fmtBlock) fmtBlock.hidden = written === null;
    if (written === null) {
      clearCallLine(q("call-dtp-format"));
      if (fmtOut) renderWidgetOutput(fmtOut, "nothing to write back", "empty");
      if (fmtNote) fmtNote.textContent = "";
    } else {
      renderCalls(q("call-dtp-format"), [written.call]);
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

  function render(): void {
    if (destroyed) return;
    renderMain();
    renderDtp();
  }

  /** Write the main section's state onto the controls. */
  function applyMain(s: X12State): void {
    setControlValue(dateEl, s.date);
    setControlValue(timeEl, s.time);
    setControlValue(codeEl, s.timeCode);
    zoneEls.forEach((el, i) => setControlValue(el, s.zones[i] ?? ""));
  }

  /** Write the `DTP` section's state onto the controls. */
  function applyDtp(d: DtpState): void {
    setControlValue(dtpFormatEl, d.format);
    setControlValue(dtpValueEl, d.value);
  }

  const TYPED = new Set([
    "date",
    "time",
    "time-code",
    "dtp-format",
    "dtp-value",
  ]);

  root.addEventListener("input", (e) => {
    if (destroyed) return;
    const role = (e.target as HTMLElement).dataset?.["role"] ?? "";
    if (!TYPED.has(role)) return;
    syncPreset();
    render();
  });

  root.addEventListener("change", (e) => {
    if (destroyed) return;
    const role = (e.target as HTMLElement).dataset?.["role"] ?? "";
    if (role === "preset") {
      const preset = X12_PRESETS.find((p) => p.id === presetEl.value);
      if (!preset) return;
      applyMain(presetState(preset));
      syncPreset();
      render();
    } else if (role === "dtp-preset") {
      const preset = DTP_PRESETS.find((p) => p.id === dtpPresetEl.value);
      if (!preset) return;
      applyDtp(dtpPresetState(preset));
      syncPreset();
      render();
    } else if (/^zone-\d$/.test(role)) {
      syncPreset();
      render();
    }
  });

  wireCopyButtons(root);
  syncPreset();
  render();

  return {
    readMain,
    readDtp: readDtpState,
    applyMain,
    applyDtp,
    render,
    syncPreset,
    destroy: () => {
      destroyed = true;
    },
  };
}

export const mountX12TimeReader: MountFn<X12TimeReaderArgs> = async (
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
  if (isSeeded(args)) {
    const seed = readArgs(args);
    widget.applyMain(seed.main);
    widget.applyDtp(seed.dtp);
    widget.syncPreset();
    widget.render();
  }

  return onceDestroy(
    () => widget.destroy(),
    () => permalinkOf(widget.readMain(), widget.readDtp()),
  );
};
