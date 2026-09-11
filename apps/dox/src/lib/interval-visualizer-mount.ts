/**
 * DOX-C3b (#139) — the interval algebra visualizer, mountable.
 *
 * Second of the three Tier 2 extractions. Architecturally the cleanest of them:
 * every listener is already delegated on the container, so there is nothing
 * bound to `window` or `document` and the host dropping the subtree is a
 * complete teardown.
 *
 * The care goes into the template instead. Six rows share one timeline and are
 * positioned as percentages against it, so a single wrong class or a dropped
 * `data-role` misaligns a result bar against the intervals it describes — and
 * every lookup below is a null-tolerant `q()`, so it fails silently rather than
 * throwing. `scripts/html-diff.mjs` compares the built markup byte for byte,
 * and `interval-visualizer-mount.test.tsx` asserts the template carries every
 * role the mount reads.
 *
 * See `widget-mount.ts` for the `renderTemplate` / `mount` split and why the
 * markup is a string rather than JSX.
 */
import { codeFrameHtml } from "./code-frame";
import { normaliseZonedInput } from "./zoned-input";
import { onceDestroy, type MountFn } from "./widget-mount";
import {
  FIXED_YEAR_SCALE,
  INTERVAL_OPERATIONS,
  RELATIONSHIP_PRESETS,
  buildRelationshipPreset,
  classifyRelationship,
  fitTimelineScale,
  formatInterval,
  formatIntervalList,
  type IntervalOperationId,
  type TimelineScale,
  type ZonedInterval,
} from "./interval-visualizer";
import { GMT_MODULES } from "./gmt-modules";
import {
  codeSpan,
  renderAside,
  renderCallLine,
  renderWidgetOutput,
  wireCopyButtons,
} from "./widget-ui";

export interface IntervalArgs {
  aStart?: string;
  aEnd?: string;
  bStart?: string;
  bEnd?: string;
}

/**
 * The widget's chrome.
 *
 * The typed inputs deliberately carry no `value`: `applyPreset()` fills them on
 * mount from the selected relationship preset, and a value here would be
 * overwritten a frame later — which is also exactly what the built page does
 * today, so this keeps it byte-identical.
 */
export function renderIntervalTemplate(): string {
  const presetOptions = RELATIONSHIP_PRESETS.map(
    (p) =>
      `<option value="${p.type}"${p.type === "overlapping" ? " selected" : ""}>${p.label}</option>`,
  ).join("");

  const handle = (role: string, label: string) =>
    `<div class="gmt-interval-handle" data-role="${role}" tabindex="0" role="slider" aria-orientation="horizontal" aria-label="${label}"></div>`;

  const intervalRow = (id: "a" | "b", label: string) =>
    `<div class="gmt-interval-row">` +
    `<span class="gmt-interval-row-label">${label}</span>` +
    `<div class="gmt-interval-track" data-role="track-${id}">` +
    `<div class="gmt-interval-bar gmt-interval-bar--${id}" data-role="bar-${id}">` +
    handle(`handle-${id}-start`, `Interval ${label} start`) +
    handle(`handle-${id}-end`, `Interval ${label} end`) +
    `</div></div></div>`;

  const opRows = INTERVAL_OPERATIONS.map(
    (op) =>
      `<div class="gmt-interval-row">` +
      `<span class="gmt-interval-row-label">${op.label}</span>` +
      `<div class="gmt-interval-track gmt-interval-track--result gmt-interval-track--${op.id}" data-role="op-track-${op.id}"></div>` +
      `</div>`,
  ).join("");

  const typedPair = (id: "a" | "b", label: string) =>
    `<div class="gmt-widget-controls">` +
    `<label class="gmt-label gmt-label-wide"><span>${label} start</span>` +
    `<input class="gmt-input" data-role="${id}-start" type="text" spellcheck="false"></label>` +
    `<label class="gmt-label gmt-label-wide"><span>${label} end</span>` +
    `<input class="gmt-input" data-role="${id}-end" type="text" spellcheck="false"></label>` +
    `</div>`;

  const opSections = INTERVAL_OPERATIONS.map(
    (op) =>
      `<div class="gmt-interval-op">` +
      `<p class="gmt-interval-op-label">${op.label}</p>` +
      codeFrameHtml(op.id) +
      `<output class="gmt-widget-output" data-role="op-output-${op.id}">&nbsp;</output>` +
      `</div>`,
  ).join("");

  return (
    `<div class="gmt-interval gmt-widget">` +
    `<div class="gmt-widget-card">` +
    `<!-- Step 1 — place two intervals -->` +
    `<div class="gmt-widget-section">` +
    `<h4>1. Place two intervals</h4>` +
    `<div class="gmt-widget-controls">` +
    `<label class="gmt-label gmt-label-wide"><span>Relationship preset</span>` +
    `<select class="gmt-select gmt-select-wide" data-role="relationship-preset">${presetOptions}</select>` +
    `</label></div>` +
    `<p class="gmt-widget-hint" data-role="preset-description"></p>` +
    `<!-- Six aligned rows on one timeline: A, B, then a mini result bar per operation. -->` +
    `<div class="gmt-interval-timeline" data-role="timeline">` +
    `<div class="gmt-interval-rows">` +
    intervalRow("a", "A") +
    intervalRow("b", "B") +
    opRows +
    `</div>` +
    `<div class="gmt-interval-axis" data-role="axis"><span>Jan 2024</span><span>Jul</span><span>Dec</span></div>` +
    `</div>` +
    `<!-- Typed-input equivalent to dragging (context/dox/overview.md §3). -->` +
    typedPair("a", "A") +
    typedPair("b", "B") +
    `<div data-role="relationship-aside"></div>` +
    `</div>` +
    `<!-- Step 2 — compare the four operations -->` +
    `<div class="gmt-widget-section">` +
    `<h4>2. Compare the four operations</h4>` +
    opSections +
    `</div>` +
    `</div>` +
    `</div>`
  );
}

/* Steps are counted in the canvas's own snap unit (see `TimelineScale`), not in
   days. On the fixed-year canvas that unit *is* a day, so keyboard behaviour
   there is unchanged; on a three-hour canvas it becomes a minute. */
const STEP_UNITS = 1;
const BIG_STEP_UNITS = 7;

type IntervalFn = (
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
) => ZonedInterval | ZonedInterval[] | null;

async function loadModules() {
  const [intervalMod, validateMod] = await Promise.all([
    GMT_MODULES["zoned/interval"](),
    GMT_MODULES["zoned/validate"](),
  ]);
  const fns: Record<IntervalOperationId, IntervalFn> = {} as Record<
    IntervalOperationId,
    IntervalFn
  >;
  for (const op of INTERVAL_OPERATIONS) {
    fns[op.id] = intervalMod[op.fnName] as IntervalFn;
  }
  return {
    fns,
    isValidZonedDateTime: validateMod["isValidZonedDateTime"] as (
      v: string,
    ) => boolean,
    isValidZonedRange: validateMod["isValidZonedRange"] as (args: {
      value1: string;
      value2: string;
      options?: { allowEqual?: boolean };
    }) => boolean,
  };
}

// -----------------------------------------------------------------------
// Render helpers
// -----------------------------------------------------------------------

function updateBar(
  barEl: HTMLElement,
  startIso: string,
  endIso: string,
  scale: TimelineScale,
): void {
  const left = scale.toPercent(startIso);
  const right = scale.toPercent(endIso);
  if (Number.isNaN(left) || Number.isNaN(right)) {
    barEl.hidden = true;
    return;
  }
  barEl.hidden = false;
  barEl.style.left = `${left}%`;
  barEl.style.width = `${Math.max(0.5, right - left)}%`;
}

function updateHandleAria(
  handle: HTMLElement | null,
  iso: string,
  scale: TimelineScale,
): void {
  if (!handle) return;
  const pct = scale.toPercent(iso);
  handle.setAttribute("aria-valuemin", "0");
  handle.setAttribute("aria-valuemax", "100");
  handle.setAttribute(
    "aria-valuenow",
    Number.isNaN(pct) ? "0" : String(Math.round(pct)),
  );
  handle.setAttribute("aria-valuetext", iso);
}

function renderResultTrack(
  trackEl: HTMLElement | null,
  result: ZonedInterval | ZonedInterval[] | null,
  scale: TimelineScale,
): void {
  if (!trackEl) return;
  trackEl.innerHTML = "";
  if (result === null) return;
  const list = Array.isArray(result) ? result : [result];
  for (const seg of list) {
    const left = scale.toPercent(seg.start);
    const right = scale.toPercent(seg.end);
    if (Number.isNaN(left) || Number.isNaN(right)) continue;
    const span = document.createElement("span");
    span.className = "gmt-interval-op-segment";
    span.style.left = `${left}%`;
    span.style.width = `${Math.max(0.5, right - left)}%`;
    trackEl.appendChild(span);
  }
}

function renderRelationshipAside(
  el: HTMLElement,
  a: ZonedInterval,
  b: ZonedInterval,
): void {
  const kind = classifyRelationship(a, b);
  const sentences: Record<typeof kind, string> = {
    invalid: "One of the intervals is reversed (its start is after its end).",
    identical:
      "A and B are exactly the same span — intersection and union both equal A (and B); difference and xor are both empty.",
    disjoint:
      "A and B share no time at all — intersection and union are both empty; difference returns all of A; xor returns both A and B.",
    adjacent:
      "A ends the instant B starts — they touch but don't overlap. Intersection is a single-instant span; union merges them into one; difference returns all of A; xor returns both.",
    "a-contains-b":
      "B sits entirely inside A — intersection and union both equal A's outer bounds (union) or B (intersection); difference returns the two pieces of A on either side of B; xor returns those same two pieces.",
    "b-contains-a":
      'A sits entirely inside B — mirror image of "A contains B": intersection equals A, union equals B, difference is empty (B fully covers A), xor returns the two pieces of B around A.',
    overlapping:
      "A and B partially overlap — intersection is the shared middle; union is the full merged span; difference is A's outer edge; xor is both outer edges.",
  };
  renderAside(
    el,
    kind === "invalid" ? "caution" : "note",
    kind === "invalid" ? "Invalid input" : "Note",
    `<p>${sentences[kind]}</p>`,
  );
}

// -----------------------------------------------------------------------
// Widget wiring
// -----------------------------------------------------------------------

interface WidgetController {
  /** Refit the canvas to whatever the four inputs currently hold, then redraw. */
  refit(): void;
}

function setupWidget(
  container: HTMLElement,
  fns: Record<IntervalOperationId, IntervalFn>,
  isValidZonedDateTime: (v: string) => boolean,
  isValidZonedRange: (args: {
    value1: string;
    value2: string;
    options?: { allowEqual?: boolean };
  }) => boolean,
): WidgetController | null {
  const q = <T extends HTMLElement>(role: string) =>
    container.querySelector(`[data-role="${role}"]`) as T | null;

  const presetEl = q<HTMLSelectElement>("relationship-preset");
  const aStartEl = q<HTMLInputElement>("a-start");
  const aEndEl = q<HTMLInputElement>("a-end");
  const bStartEl = q<HTMLInputElement>("b-start");
  const bEndEl = q<HTMLInputElement>("b-end");
  const barA = q("bar-a");
  const barB = q("bar-b");

  if (
    !presetEl ||
    !aStartEl ||
    !aEndEl ||
    !bStartEl ||
    !bEndEl ||
    !barA ||
    !barB
  )
    return null;

  /* The presets' canvas is the default; seeded or typed values fit their own.
     See `TimelineScale` in interval-visualizer.ts for why this is a value. */
  let scale: TimelineScale = FIXED_YEAR_SCALE;

  function isIntervalValid(start: string, end: string): boolean {
    return (
      isValidZonedDateTime(start) &&
      isValidZonedDateTime(end) &&
      isValidZonedRange({
        value1: start,
        value2: end,
        options: { allowEqual: true },
      })
    );
  }

  function renderAxis(): void {
    const axisEl = q("axis");
    if (!axisEl) return;
    const spans = axisEl.querySelectorAll("span");
    const labels = scale.labels();
    spans.forEach((span, i) => {
      const next = labels[i];
      // Guarded so an axis with a different number of ticks can't blank one.
      if (next !== undefined) span.textContent = next;
    });
  }

  function refit(): void {
    const fitted = fitTimelineScale([
      aStartEl!.value,
      aEndEl!.value,
      bStartEl!.value,
      bEndEl!.value,
    ]);
    if (fitted) scale = fitted;
    render();
  }

  function render(): void {
    const aStart = aStartEl!.value;
    const aEnd = aEndEl!.value;
    const bStart = bStartEl!.value;
    const bEnd = bEndEl!.value;

    updateBar(barA!, aStart, aEnd, scale);
    updateBar(barB!, bStart, bEnd, scale);
    updateHandleAria(q("handle-a-start"), aStart, scale);
    updateHandleAria(q("handle-a-end"), aEnd, scale);
    updateHandleAria(q("handle-b-start"), bStart, scale);
    updateHandleAria(q("handle-b-end"), bEnd, scale);
    renderAxis();

    const aValid = isIntervalValid(aStart, aEnd);
    const bValid = isIntervalValid(bStart, bEnd);
    barA!.classList.toggle("gmt-interval-bar--invalid", !aValid);
    barB!.classList.toggle("gmt-interval-bar--invalid", !bValid);
    const bothValid = aValid && bValid;

    const relEl = q("relationship-aside");
    if (relEl) {
      if (bothValid) {
        renderRelationshipAside(
          relEl,
          { start: aStart, end: aEnd },
          { start: bStart, end: bEnd },
        );
      } else {
        renderAside(
          relEl,
          "caution",
          "Invalid input",
          "<p>One or both intervals fail validation (unparseable, or start after end) — highlighted below. The four operations can't run on invalid input.</p>",
        );
      }
    }

    for (const op of INTERVAL_OPERATIONS) {
      const trackEl = q(`op-track-${op.id}`);
      const outputEl = q(`op-output-${op.id}`);
      const codeEl = q(`call-${op.id}`);

      renderCallLine(
        codeEl,
        op.fnName,
        `${codeSpan("str", `"${aStart}"`)}, ${codeSpan("str", `"${aEnd}"`)}, ${codeSpan("str", `"${bStart}"`)}, ${codeSpan("str", `"${bEnd}"`)}`,
        `"${aStart}", "${aEnd}", "${bStart}", "${bEnd}"`,
      );

      if (!bothValid) {
        renderResultTrack(trackEl, null, scale);
        if (outputEl) renderWidgetOutput(outputEl, "NO SIGNAL", "sentinel");
        continue;
      }

      const result = fns[op.id](aStart, aEnd, bStart, bEnd);
      renderResultTrack(trackEl, result, scale);

      if (outputEl) {
        const isEmpty =
          result === null || (Array.isArray(result) && result.length === 0);
        if (isEmpty) {
          renderWidgetOutput(
            outputEl,
            op.isArray ? "[] — correctly empty" : "null — correctly empty",
            "empty",
          );
        } else if (Array.isArray(result)) {
          renderWidgetOutput(outputEl, formatIntervalList(result), "live");
        } else {
          renderWidgetOutput(outputEl, formatInterval(result), "live");
        }
      }
    }
  }

  function applyPreset(): void {
    const { aStart, aEnd, bStart, bEnd } = buildRelationshipPreset(
      presetEl!.value as (typeof RELATIONSHIP_PRESETS)[number]["type"],
    );
    aStartEl!.value = aStart;
    aEndEl!.value = aEnd;
    bStartEl!.value = bStart;
    bEndEl!.value = bEnd;

    /* Presets are composed against the fixed year — `disjoint` filling only the
       left two-thirds is the point, so this must not refit. */
    scale = FIXED_YEAR_SCALE;

    const descEl = q("preset-description");
    if (descEl) {
      const info = RELATIONSHIP_PRESETS.find((p) => p.type === presetEl!.value);
      descEl.textContent = info?.description ?? "";
    }

    render();
  }

  // ---- Drag (pointer) ----

  const inputByHandle: Record<string, HTMLInputElement> = {
    "handle-a-start": aStartEl,
    "handle-a-end": aEndEl,
    "handle-b-start": bStartEl,
    "handle-b-end": bEndEl,
  };
  const siblingByHandle: Record<
    string,
    { input: HTMLInputElement; isEnd: boolean }
  > = {
    "handle-a-start": { input: aEndEl, isEnd: true },
    "handle-a-end": { input: aStartEl, isEnd: false },
    "handle-b-start": { input: bEndEl, isEnd: true },
    "handle-b-end": { input: bStartEl, isEnd: false },
  };

  function clampAgainstSibling(role: string, iso: string): string {
    const sibling = siblingByHandle[role];
    const input = inputByHandle[role];
    if (!sibling || !input) return iso;
    const siblingPct = scale.toPercent(sibling.input.value);
    const pct = scale.toPercent(iso);
    if (Number.isNaN(siblingPct) || Number.isNaN(pct)) return iso;
    // A start handle can't pass its own end handle, and vice versa.
    if (sibling.isEnd && pct > siblingPct) return sibling.input.value;
    if (!sibling.isEnd && pct < siblingPct) return sibling.input.value;
    return iso;
  }

  function setHandleValue(role: string, iso: string): void {
    const input = inputByHandle[role];
    if (!input) return;
    input.value = clampAgainstSibling(role, iso);
    render();
  }

  let dragging: string | null = null;

  container.addEventListener("pointerdown", (e) => {
    const target = (e.target as HTMLElement).closest(
      '[data-role^="handle-"]',
    ) as HTMLElement | null;
    if (!target) return;
    dragging = target.dataset.role ?? null;
    target.setPointerCapture((e as PointerEvent).pointerId);
  });

  container.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const handle = container.querySelector(
      `[data-role="${dragging}"]`,
    ) as HTMLElement | null;
    const track = handle?.closest(".gmt-interval-track");
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const pct = (((e as PointerEvent).clientX - rect.left) / rect.width) * 100;
    setHandleValue(dragging, scale.fromPercent(pct));
  });

  const stopDrag = () => {
    dragging = null;
  };
  container.addEventListener("pointerup", stopDrag);
  container.addEventListener("pointercancel", stopDrag);

  // ---- Keyboard (non-drag equivalent, required by DOX-B2c) ----

  container.addEventListener("keydown", (e) => {
    const target = (e.target as HTMLElement).closest(
      '[data-role^="handle-"]',
    ) as HTMLElement | null;
    if (!target) return;
    const role = target.dataset.role;
    if (!role) return;
    const input = inputByHandle[role];
    if (!input) return;
    const ev = e as KeyboardEvent;
    const units = ev.shiftKey ? BIG_STEP_UNITS : STEP_UNITS;

    switch (ev.key) {
      case "ArrowLeft":
      case "ArrowDown":
        setHandleValue(role, scale.step(input.value, -units));
        ev.preventDefault();
        break;
      case "ArrowRight":
      case "ArrowUp":
        setHandleValue(role, scale.step(input.value, units));
        ev.preventDefault();
        break;
      case "Home":
        setHandleValue(role, scale.fromPercent(0));
        ev.preventDefault();
        break;
      case "End":
        setHandleValue(role, scale.fromPercent(100));
        ev.preventDefault();
        break;
    }
  });

  // ---- Typed input (the other non-drag equivalent) ----

  [aStartEl, aEndEl, bStartEl, bEndEl].forEach((input) => {
    input.addEventListener("input", render);
    /* Refit on commit rather than per keystroke — rescaling the canvas under a
       half-typed date is disorienting, and it would fight the caret. This is
       also what keeps a typed interval and a seeded one on the same canvas. */
    input.addEventListener("change", refit);
  });

  presetEl.addEventListener("change", applyPreset);

  wireCopyButtons(container);

  applyPreset();

  return { refit };
}

export const mountIntervalVisualizer: MountFn<IntervalArgs> = async (
  root,
  args,
  signal,
) => {
  let modules: Awaited<ReturnType<typeof loadModules>>;
  try {
    modules = await loadModules();
  } catch {
    // The page stays readable without the library, exactly as before.
    return onceDestroy(() => {});
  }
  if (signal.aborted) return onceDestroy(() => {});

  const controller = setupWidget(
    root,
    modules.fns,
    modules.isValidZonedDateTime,
    modules.isValidZonedRange,
  );

  /* Seeded after `setupWidget`, because `applyPreset()` runs at the end of it
     and would otherwise overwrite these. Written into the typed inputs and
     re-rendered through the same path a reader's typing takes, so a seeded
     interval and a typed one cannot diverge. */
  const seeded = (["aStart", "aEnd", "bStart", "bEnd"] as const).filter(
    (key) => args[key],
  );
  if (seeded.length > 0) {
    const roleFor = {
      aStart: "a-start",
      aEnd: "a-end",
      bStart: "b-start",
      bEnd: "b-end",
    } as const;
    for (const key of seeded) {
      const input = root.querySelector(
        `[data-role="${roleFor[key]}"]`,
      ) as HTMLInputElement | null;
      /* Normalised, because this widget is the *zoned* one and a model answering
         "9am to 11am" has no zone to give — see zoned-input.ts. Without this the
         widget mounted, said "Invalid input" and drew nothing until the reader
         nudged a control. */
      if (input) input.value = normaliseZonedInput(args[key] as string);
    }
    /* `refit()`, not a bare re-render: seeded values are almost never on the
       presets' calendar-2024 canvas, and a three-hour meeting drawn on a
       one-year axis is a 0.02%-wide bar with all four handles on one pixel —
       correct arithmetic, unreadable picture. This is the same call the typed
       inputs' `change` listener makes, so a seeded interval and a typed one
       cannot diverge. */
    controller?.refit();
  }

  return onceDestroy(
    () => {
      /* Everything is delegated on `root`, which the host drops. `wireCopyButtons`
         owns its own reset timer. See widget-mount.ts. */
    },
    () => {
      const v = (role: string) =>
        (root.querySelector(`[data-role="${role}"]`) as HTMLInputElement | null)
          ?.value;
      return {
        aStart: v("a-start"),
        aEnd: v("a-end"),
        bStart: v("b-start"),
        bEnd: v("b-end"),
      };
    },
  );
};
