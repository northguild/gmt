/**
 * The EPCIS Event Reader widget (INT-14), mountable on its tool page and in the
 * chat rail.
 *
 * The two required time fields of a GS1 EPCIS 2.0 event, `eventTime` and
 * `eventTimeZoneOffset`. The widget calls `parseEpcisEvent` with both, shows
 * whether the offset is stated and what instant, offset and local time came
 * back, draws the same moment on a UTC day rail and a local day rail with the
 * two dates compared, and shows the result written back by `formatEpcisEvent`.
 * Every printed call and result is the real one. The site-side code only builds
 * the event object, places the rails' marks and words the verdicts.
 *
 * `null` from the library renders as NO SIGNAL with one sentence saying why
 * (`epcisNullText`, decided by the library's validators). A state with no
 * library call behind it renders as empty, never amber.
 *
 * Follows the DTM Decoder's split: every listener is delegated on the root, so
 * the host dropping the subtree is a complete teardown. Nothing in the
 * server-rendered template holds a result.
 */
import { codeFrameHtml } from "./code-frame";
import { loadEpcisLib } from "./edi-lib";
import {
  asideSizer,
  callOutputSizer,
  callSizer,
  figureSizer,
  holdHtml,
  lit,
  outputSizer,
  takenApartHtml,
  textSizers,
} from "./edi-picture";
import { callResultsText, drawFigure, renderCalls } from "./edi-render";
import {
  NO_RESULT_TEXT,
  NO_RESULT_TITLE,
  readoutOf,
  readoutRowsHtml,
} from "./edi-widgets";
import type { EpcisLib } from "./edi-lib";
import {
  CUSTOM_PRESET_ID,
  DATE_ROWS,
  EPCIS_PRESETS,
  EVENT_TIME_MAX,
  HANDOFF_LABEL,
  MEMBER_ROWS,
  OFFSET_MAX,
  WIDEST_EVENT,
  WIDEST_RESULT,
  cutEventTime,
  datesWords,
  detailText,
  DATES_NULL_TEXT,
  epcisFigure,
  epcisNullText,
  epcisTexts,
  handoffArgs,
  isSeeded,
  matchPreset,
  memberText,
  permalinkOf,
  presetState,
  railAria,
  railEmptyText,
  railHtml,
  railName,
  railsOf,
  readArgs,
  readEpcis,
  verdictText,
  writeBack,
  type EpcisEventReaderArgs,
  type EpcisRead,
  type EpcisState,
  type RailRole,
  type RailSpec,
} from "./epcis-event-reader";
import { setPresetDescription } from "./punctuality-widgets";
import { onceDestroy, WidgetLoadError, type MountFn } from "./widget-mount";
import { encodeWidgetPermalink } from "./widget-permalink";
import {
  clearCallLine,
  escapeAttr,
  escapeHtml,
  labelTextHtml,
  renderAside,
  renderWidgetOutput,
  setControlValue,
  wireCopyButtons,
} from "./widget-ui";

export type { EpcisEventReaderArgs } from "./epcis-event-reader";

/** The options of the preset `<select>`. Custom first, unselected unless no
 *  preset matches. */
function presetOptions(presetId: string): string {
  return (
    `<option value="${CUSTOM_PRESET_ID}"${presetId === CUSTOM_PRESET_ID ? " selected" : ""}>Custom</option>` +
    EPCIS_PRESETS.map(
      (p) =>
        `<option value="${escapeAttr(p.id)}"${p.id === presetId ? " selected" : ""}>${escapeHtml(p.label)}</option>`,
    ).join("")
  );
}

/**
 * The sizers of one rail's hold: the rail in every empty state, and the rail
 * with the widest name and date and the most days a rail draws.
 */
function railSizers(role: RailRole, empties: readonly string[]): string[] {
  const rails = railsOf(WIDEST_RESULT);
  const widest = railHtml(
    {
      role,
      name: railName(role, WIDEST_RESULT),
      date: WIDEST_RESULT.instant.slice(0, 13),
      layout: rails[role],
      pin: rails.pin,
      emptyText: "",
      aria: "",
    },
    true,
  );
  const empty = [...new Set(empties)].map((emptyText) =>
    railHtml(
      {
        role,
        name: railName(role, null),
        date: NO_RESULT_TEXT,
        layout: null,
        pin: rails.pin,
        emptyText,
        aria: "",
      },
      true,
    ),
  );
  return [widest, ...empty];
}

/**
 * The widget's chrome, seeded with `args` so the first paint shows them. With no
 * seed it shows the first preset. Results are drawn by `mount`, because they
 * come from the real library calls.
 */
export function renderEpcisEventReaderTemplate(
  args: EpcisEventReaderArgs = {},
): string {
  const state: EpcisState = isSeeded(args)
    ? readArgs(args)
    : presetState(EPCIS_PRESETS[0]!);
  const presetId = matchPreset(state);
  const preset = EPCIS_PRESETS.find((p) => p.id === presetId);

  const t = epcisTexts();
  const hint = "gmt-widget-hint";
  const widestTime = cutEventTime(WIDEST_EVENT.eventTime);
  const figures = figureSizer([
    {
      halves: [
        { label: "eventTime", fields: widestTime },
        {
          label: "eventTimeZoneOffset",
          fields: [lit(WIDEST_EVENT.eventTimeZoneOffset, "±hh:mm", "offset")],
        },
      ],
      separator: "",
      closing: "",
    },
  ]);

  return (
    `<div class="gmt-epcis-event-reader gmt-widget not-content">` +
    `<div class="gmt-widget-card">` +
    // 1. The event's two fields
    `<div class="gmt-widget-section gmt-widget-section--wide">` +
    `<h4>1. The event's two fields</h4>` +
    `<div class="gmt-field-grid gmt-edi-top">` +
    `<label class="gmt-label gmt-edi-preset">${labelTextHtml("Preset")}` +
    `<select class="gmt-select" data-role="preset">${presetOptions(presetId)}</select>` +
    `</label>` +
    `<label class="gmt-label gmt-edi-main">${labelTextHtml("eventTime")}` +
    `<input class="gmt-input" data-role="event-time" type="text" maxlength="${EVENT_TIME_MAX}" spellcheck="false" autocomplete="off" autocapitalize="off" value="${escapeAttr(state.eventTime)}"></label>` +
    `<label class="gmt-label">${labelTextHtml("eventTimeZoneOffset")}` +
    `<input class="gmt-input" data-role="offset" type="text" maxlength="${OFFSET_MAX}" spellcheck="false" autocomplete="off" autocapitalize="off" value="${escapeAttr(state.eventTimeZoneOffset)}"></label>` +
    `</div>` +
    holdHtml(
      `<p class="gmt-widget-hint" data-role="preset-description" data-grow="slot">${escapeHtml(preset?.description ?? "")}</p>`,
      textSizers("p", hint, t.descriptions),
    ) +
    `</div>` +
    // 2. What the event states
    `<div class="gmt-widget-section gmt-widget-section--wide">` +
    `<h4>2. What the event states</h4>` +
    `<div class="gmt-edi-split">` +
    `<div class="gmt-edi-pane">` +
    `<div class="gmt-edi-panel">` +
    holdHtml(
      `<div class="gmt-edi-figure" data-role="figure" role="img" aria-label=""></div>`,
      [figures],
    ) +
    `<p class="gmt-widget-hint">The tool cuts each field only to draw it. The library reads each field whole.</p>` +
    holdHtml(
      `<div data-role="reason-aside"></div>`,
      t.nulls.map((n) => asideSizer(NO_RESULT_TITLE, [n])),
    ) +
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
    `<dl class="gmt-edi-readouts gmt-epcis-members" data-role="readouts">${readoutRowsHtml(MEMBER_ROWS)}</dl>` +
    holdHtml(
      `<output class="gmt-widget-output gmt-edi-out" data-role="parse-output">&nbsp;</output>`,
      [outputSizer("gmt-widget-output gmt-edi-out", t.parseOutput)],
    ) +
    `</div>` +
    `</div>` +
    `</div>` +
    // 3. The same moment on two clocks
    `<div class="gmt-widget-section gmt-widget-section--wide">` +
    `<h4>3. The same moment on two clocks</h4>` +
    `<div class="gmt-edi-split">` +
    `<div class="gmt-edi-pane">` +
    `<div class="gmt-edi-panel gmt-epcis-rails">` +
    (["utc", "local"] as const)
      .map((role) =>
        holdHtml(
          railHtml({
            role,
            name: railName(role, null),
            date: NO_RESULT_TEXT,
            layout: null,
            pin: 50,
            emptyText: "Nothing to place yet.",
            aria: "",
          }),
          railSizers(role, t.railEmpty),
        ),
      )
      .join("") +
    `</div>` +
    `</div>` +
    `<div class="gmt-edi-pane">` +
    `<dl class="gmt-edi-readouts gmt-epcis-dates" data-role="dates">${readoutRowsHtml(DATE_ROWS)}</dl>` +
    holdHtml(
      `<p class="gmt-edi-verdict gmt-edi-verdict--long" data-role="words"></p>`,
      textSizers("p", "gmt-edi-verdict gmt-edi-verdict--long", t.words),
    ) +
    holdHtml(`<div data-role="dates-aside"></div>`, [
      asideSizer(NO_RESULT_TITLE, [t.datesNull]),
    ]) +
    holdHtml(
      `<div class="gmt-edi-call" data-role="dates-block" hidden>` +
        codeFrameHtml("dates") +
        `<output class="gmt-widget-output gmt-edi-out" data-role="dates-output">&nbsp;</output>` +
        `</div>`,
      [callOutputSizer(t.dateCalls, t.dateOutput)],
    ) +
    `</div>` +
    `</div>` +
    `</div>` +
    // 4. Written back
    `<div class="gmt-widget-section gmt-widget-section--wide">` +
    `<h4>4. Written back by formatEpcisEvent</h4>` +
    `<div class="gmt-edi-written">` +
    holdHtml(
      `<output class="gmt-widget-output gmt-edi-out" data-role="format-output">&nbsp;</output>`,
      [outputSizer("gmt-widget-output gmt-edi-out", t.formatOutput)],
    ) +
    holdHtml(
      `<div class="gmt-edi-call" data-role="format-block" hidden>${codeFrameHtml("format")}</div>`,
      [callSizer(t.formatCall)],
    ) +
    `</div>` +
    holdHtml(
      `<p class="gmt-widget-hint" data-role="format-note" data-grow="slot"></p>`,
      textSizers("p", hint, t.writeNotes),
    ) +
    `<div class="gmt-widget-controls"><a class="gmt-button gmt-button--pad" data-role="handoff" aria-disabled="true">${escapeHtml(HANDOFF_LABEL)}</a></div>` +
    `</div>` +
    `</div>` +
    `</div>`
  );
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

function setupWidget(root: HTMLElement, lib: EpcisLib, signal: AbortSignal) {
  const q = <T extends HTMLElement>(role: string) =>
    root.querySelector(`[data-role="${role}"]`) as T | null;
  const presetEl = q<HTMLSelectElement>("preset")!;
  const timeEl = q<HTMLInputElement>("event-time")!;
  const offsetEl = q<HTMLInputElement>("offset")!;

  let destroyed = false;
  signal.addEventListener("abort", () => {
    destroyed = true;
  });

  const readState = (): EpcisState => ({
    eventTime: timeEl.value,
    eventTimeZoneOffset: offsetEl.value,
  });

  function syncPreset(s: EpcisState): void {
    const id = matchPreset(s);
    presetEl.value = id;
    const slot = q("preset-description");
    if (slot) {
      setPresetDescription(
        slot,
        EPCIS_PRESETS.find((p) => p.id === id)?.description ?? "",
      );
    }
  }

  /** Replaces the live rail of a role (the hold's sizers carry no `data-role`). */
  function drawRail(spec: RailSpec): void {
    const live = q(`rail-${spec.role}`);
    if (!live) return;
    const holder = root.ownerDocument.createElement("div");
    holder.innerHTML = railHtml(spec);
    live.replaceWith(holder.firstElementChild!);
  }

  function renderRails(s: EpcisState, read: EpcisRead): void {
    const rails =
      read.result !== null && read.dates !== null ? railsOf(read.result) : null;
    for (const role of ["utc", "local"] as const) {
      const date = role === "utc" ? read.dates?.utcDate : read.dates?.localDate;
      const drawn = rails !== null && date !== undefined && date !== "";
      const emptyText = drawn ? "" : railEmptyText(role, read, s);
      drawRail({
        role,
        name: railName(role, read.result),
        date: drawn ? date : NO_RESULT_TEXT,
        layout: drawn ? rails[role] : null,
        pin: rails?.pin ?? 50,
        emptyText,
        aria: railAria(role, read.result, drawn ? date : "", emptyText),
      });
    }
  }

  function render(): void {
    if (destroyed) return;
    const s = readState();
    const read = readEpcis(s, lib);

    // Section 2: the parse call.
    const parseBlock = q("parse-block");
    if (parseBlock) parseBlock.hidden = read.parse === null;
    const out = q("parse-output");
    if (read.parse === null) {
      if (out) renderWidgetOutput(out, "nothing to read", "empty");
      clearCallLine(q("call-parse"));
    } else {
      renderCalls(q("call-parse"), [read.parse]);
      if (out) {
        if (read.result === null) {
          renderWidgetOutput(out, "NO SIGNAL", "sentinel");
        } else {
          renderWidgetOutput(out, callResultsText([read.parse]), "live");
        }
      }
    }
    const verdict = q("verdict");
    if (verdict) verdict.textContent = verdictText(read, s);
    const detail = q("verdict-detail");
    if (detail) detail.textContent = detailText(read);
    for (const row of MEMBER_ROWS) {
      const cell = q(row.role);
      if (!cell) continue;
      const r = readoutOf(memberText(read, row.key), read.result !== null);
      cell.textContent = r.text;
      cell.dataset["state"] = r.state;
    }

    // The two fields taken apart.
    const figure = q("figure");
    if (figure) {
      if (read.blank) {
        drawFigure(figure, {
          kind: "empty",
          text: "Type an eventTime and an eventTimeZoneOffset to take them apart.",
        });
      } else {
        const fig = epcisFigure(s, lib);
        figure.dataset["state"] = "value";
        figure.dataset["scale"] = "md";
        figure.innerHTML = takenApartHtml(fig.halves, "", "");
        figure.setAttribute("aria-label", fig.aria);
      }
    }
    const aside = q("reason-aside");
    if (aside) {
      if (!read.blank && read.result === null) {
        renderAside(
          aside,
          "caution",
          NO_RESULT_TITLE,
          `<p>${escapeHtml(epcisNullText(s, lib))}</p>`,
        );
      } else {
        aside.innerHTML = "";
      }
    }

    // Section 3: the two dates on two rails.
    renderRails(s, read);
    for (const row of DATE_ROWS) {
      const cell = q(row.role);
      if (!cell) continue;
      const text =
        row.key === "utc" ? read.dates?.utcDate : read.dates?.localDate;
      const r = readoutOf(
        text === undefined || text === "" ? null : text,
        read.dates !== null,
      );
      cell.textContent = r.text;
      cell.dataset["state"] = r.state;
    }
    const words = q("words");
    if (words) words.textContent = datesWords(read.dates);
    const datesBlock = q("dates-block");
    const datesOut = q("dates-output");
    const datesAside = q("dates-aside");
    if (datesBlock) datesBlock.hidden = read.dates === null;
    if (read.dates === null) {
      clearCallLine(q("call-dates"));
      if (datesOut)
        renderWidgetOutput(datesOut, "no dates to compare", "empty");
      if (datesAside) datesAside.innerHTML = "";
    } else {
      renderCalls(q("call-dates"), read.dates.calls);
      if (datesOut) {
        if (read.dates.sameness === null) {
          renderWidgetOutput(datesOut, "NO SIGNAL", "sentinel");
        } else {
          renderWidgetOutput(
            datesOut,
            callResultsText(read.dates.calls),
            "live",
          );
        }
      }
      if (datesAside) {
        if (read.dates.sameness === null) {
          renderAside(
            datesAside,
            "caution",
            NO_RESULT_TITLE,
            `<p>${escapeHtml(DATES_NULL_TEXT)}</p>`,
          );
        } else {
          datesAside.innerHTML = "";
        }
      }
    }

    // Section 4: written back, and the hand-off.
    const written = writeBack(read, lib);
    const fmtOut = q("format-output");
    const fmtNote = q("format-note");
    const fmtBlock = q("format-block");
    if (fmtBlock) fmtBlock.hidden = written === null;
    if (written === null) {
      clearCallLine(q("call-format"));
      if (fmtOut) renderWidgetOutput(fmtOut, "no value to write back", "empty");
      if (fmtNote) fmtNote.textContent = "";
    } else {
      renderCalls(q("call-format"), [written.call]);
      if (fmtOut) {
        if (written.written === null) {
          renderWidgetOutput(fmtOut, "NO SIGNAL", "sentinel");
        } else {
          renderWidgetOutput(fmtOut, callResultsText([written.call]), "live");
        }
      }
      if (fmtNote) fmtNote.textContent = written.note;
    }
    const link = q<HTMLAnchorElement>("handoff");
    const handoff = handoffArgs(read);
    if (link) {
      if (handoff !== null) {
        link.setAttribute("href", encodeWidgetPermalink("bldate", handoff));
        link.removeAttribute("aria-disabled");
      } else {
        link.removeAttribute("href");
        link.setAttribute("aria-disabled", "true");
      }
    }
  }

  /** Write a whole state onto the controls. */
  function apply(s: EpcisState): void {
    setControlValue(timeEl, s.eventTime);
    setControlValue(offsetEl, s.eventTimeZoneOffset);
  }

  function applyPreset(): void {
    const preset = EPCIS_PRESETS.find((p) => p.id === presetEl.value);
    if (!preset) return;
    apply(presetState(preset));
    syncPreset(readState());
    render();
  }

  root.addEventListener("input", (e) => {
    if (destroyed) return;
    const role = (e.target as HTMLElement).dataset?.["role"] ?? "";
    if (role !== "event-time" && role !== "offset") return;
    syncPreset(readState());
    render();
  });

  root.addEventListener("change", (e) => {
    if (destroyed) return;
    const role = (e.target as HTMLElement).dataset?.["role"] ?? "";
    if (role === "preset") applyPreset();
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

export const mountEpcisEventReader: MountFn<EpcisEventReaderArgs> = async (
  root,
  args,
  signal,
) => {
  let lib: EpcisLib;
  try {
    lib = await loadEpcisLib();
  } catch (cause) {
    // Loud, not inert: the host decides what to show (see `WidgetLoadError`).
    throw new WidgetLoadError(cause);
  }
  if (signal.aborted) return onceDestroy(() => {});

  const widget = setupWidget(root, lib, signal);
  if (isSeeded(args)) {
    widget.apply(readArgs(args));
    widget.syncPreset(widget.readState());
    widget.render();
  }

  return onceDestroy(
    () => widget.destroy(),
    () => permalinkOf(widget.readState()),
  );
};
