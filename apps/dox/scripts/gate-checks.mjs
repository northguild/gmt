/**
 * The pass/fail decisions of the two browser gates, as plain functions.
 *
 * `grow-measure.mjs` and `readout-still.mjs` drive a real browser, so nothing
 * in them can run in a unit test. A gate that measures nothing still exits 0,
 * though, and that is the failure these functions exist to catch: a wrong
 * `--base`, a 404, a renamed root class, a control that is not on the page, a
 * drag that moves nothing, or a run that checked zero things. Each function
 * takes what the browser observed and returns the problems, as strings; an
 * empty array is a pass. They import nothing, so they are tested in
 * `gate-checks.test.ts`.
 *
 * `blockOffSite` is the one function here that every browser gate calls: a
 * gate measures a local build, so its result must not depend on a host
 * outside it.
 */

/** Fewest animation frames a measurement may hold before it counts as taken. */
export const MIN_FRAMES = 5;

/**
 * Problems with one grow-measure page load, before any statistic is read.
 * `status` is the HTTP status of the navigation (null when there was no
 * response), `rootFound` whether `rootSelector` matched an element once the
 * pass ended, `frames` how many frames the sampler recorded.
 */
export function pageProblems({ status, rootSelector, rootFound, frames }) {
  const problems = [];
  if (status !== 200) {
    problems.push(
      status == null
        ? "no HTTP response for the page"
        : `the page answered HTTP ${status}, not 200 (wrong --base or a missing build?)`,
    );
  }
  if (!rootFound) {
    problems.push(`root selector ${rootSelector} matched nothing on the page`);
  } else if (frames < MIN_FRAMES) {
    problems.push(
      `only ${frames} frame${frames === 1 ? "" : "s"} recorded (need ${MIN_FRAMES}); nothing was measured`,
    );
  }
  return problems;
}

/**
 * A skipped interaction is a failed one: a pass that never clicked, selected or
 * dragged measured a page that sat still. `skip` is the reason the script gave
 * for not doing it (null when it ran).
 */
export function skippedProblem(what, skip) {
  return skip ? [`${what} did not happen: ${skip}`] : [];
}

/**
 * A drag that left the value where it was did not drag. Either value may be
 * null when the control exposes none (then nothing can be said, and nothing is
 * claimed).
 */
export function dragProblem(before, after) {
  if (before == null || after == null) return [];
  return before === after
    ? [`the drag did not change the value (still ${before})`]
    : [];
}

/**
 * The largest change between neighbouring frames in a series of heights. The
 * series is the PAINTED height of each frame (grow-measure's `p` reading, taken
 * after the frame's last ResizeObserver callback), so a height that was laid out
 * but replaced before paint is not in it. An empty or one-frame series has no
 * jump.
 */
export function maxFrameJump(heights) {
  let max = 0;
  for (let i = 1; i < heights.length; i++) {
    max = Math.max(max, Math.abs(heights[i] - heights[i - 1]));
  }
  return max;
}

/** A browser run that threw (a closed page, a crashed browser) is a failed run. */
export function crashProblem(error) {
  return [
    `the run crashed: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`,
  ];
}

/** The largest-jump assertion, applied to the page root and to `<main>`. */
export function jumpProblems({ maxJump, mainMaxJump, limit, reduce }) {
  // Reduced motion is the reference: its heights snap by design.
  if (reduce) return [];
  const problems = [];
  if (maxJump > limit) {
    problems.push(`max jump ${Math.round(maxJump)} px > ${limit}`);
  }
  if (mainMaxJump > limit) {
    problems.push(`<main> max jump ${Math.round(mainMaxJump)} px > ${limit}`);
  }
  return problems;
}

/** Zero runs is never a pass. */
export function emptyRunProblem(count, what) {
  return count === 0 ? `no ${what} were run; nothing was checked` : null;
}

/**
 * readout-still: a required control that is not visible fails; an optional one
 * (the preset may not show it) is skipped. Returns the problems and whether to
 * go on with the control.
 */
export function controlPresence({ visible, optional, id }) {
  if (visible) return { problems: [], proceed: true };
  if (optional) return { problems: [], proceed: false };
  return {
    problems: [`${id}: required control is missing or hidden`],
    proceed: false,
  };
}

/**
 * readout-still, keyboard sweep. `home` is the value after Home, `up` the
 * values after each PageUp, `down` those after each PageDown from the far end.
 * A handle that never leaves its minimum, or never comes back, did not move,
 * so identical snapshots prove nothing.
 */
export function keyboardMoveProblems({ home, up, down }) {
  const problems = [];
  if (home == null) {
    problems.push("the control exposes no value (aria-valuenow or value)");
    return problems;
  }
  if (!up.some((v) => v !== home)) {
    problems.push(`PageUp never moved the value off ${home}`);
  }
  const end = up.length ? up[up.length - 1] : home;
  if (!down.some((v) => v !== end)) {
    problems.push(`PageDown never moved the value off ${end}`);
  }
  return problems;
}

/** readout-still, pointer pass: the value at the far end must differ from the start. */
export function pointerMoveProblems({ start, far }) {
  if (start == null || far == null) {
    return ["the control exposes no value (aria-valuenow or value)"];
  }
  return start === far
    ? [`the pointer drag never moved the value off ${start}`]
    : [];
}

/**
 * True when `url` is an `http:` or `https:` request to an origin other than
 * `base`'s. A `data:`, `blob:` or `about:` URL makes no request and is never
 * off-site. `url` is a string or a URL object, as Playwright hands a route
 * predicate.
 */
export function isOffSite(url, base) {
  const target = new URL(url);
  if (target.protocol !== "http:" && target.protocol !== "https:") return false;
  return target.origin !== new URL(base).origin;
}

/**
 * Keep a gate's pages on the site under test. `target` is a Playwright
 * context or page; `base` is the URL the gate loads from.
 *
 * The production build carries an analytics script from another host, and
 * that script posts back to it. A gate that waits for `networkidle` then
 * settles only as fast as that host answers, and never where it does not, so
 * the same build passes on one machine and times out on another. Every
 * off-site request is answered here instead, with an empty script: nothing
 * leaves the machine. It is answered, not aborted, because an aborted request
 * logs a console error and `globe-smoke.mjs` counts every console error as a
 * failure.
 *
 * The rule is "not the base's origin", never a list of hosts, so a tag added
 * later cannot bring the fault back. Only off-site requests are routed (by a URL
 * pattern, which `isOffSite` agrees with); a same-site request is never intercepted.
 */
export async function blockOffSite(target, base) {
  // A URL pattern, not a function: Playwright's server matches a pattern itself, so a same-site
  // request (the module chunks, the library) never waits for this script to be asked about it.
  const origin = new URL(base).origin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  await target.route(
    new RegExp(`^(?!${origin}(?:[/?#]|$))https?://`),
    (route) =>
      route.fulfill({ status: 200, contentType: "text/javascript", body: "" }),
  );
}

// ---------------------------------------------------------------------------------------------
// The a11y gates (`a11y-axe.mjs`, `a11y-tab-walk.mjs`, `a11y-media.mjs`). Each function takes what
// the browser observed and returns findings as `{ rule, selector, message }` objects, so a rule's
// logic is tested without a browser. An empty array is a pass.
// ---------------------------------------------------------------------------------------------

/**
 * The pages the Tab walk visits: every page outside `/reference/`, plus the first function page and
 * the first type page in sorted order. Reference pages share one template and each carries the full
 * sidebar, so one of each stands for the 940.
 */
export function tabWalkPages(allPages) {
  const sorted = [...allPages].sort();
  const outside = sorted.filter((p) => !p.startsWith("/reference/"));
  // /reference/<namespace>/<category>/<function>/ is a function page; /reference/types/<Name>/ a type.
  const fn = sorted.find((p) =>
    /^\/reference\/(?!types\/)[^/]+\/[^/]+\/[^/]+\/$/.test(p),
  );
  const type = sorted.find((p) => /^\/reference\/types\/[^/]+\/$/.test(p));
  return [...outside, ...[fn, type].filter(Boolean)];
}

/** Most Tab presses one control may take in a row before it counts as holding focus. A date field
 *  has up to six segments (`datetime-local`: month, day, year, hour, minute, AM/PM) and Tab moves
 *  through them one press each, so a longer stay is not a field. */
export const SEGMENT_CAP = 8;

/**
 * Folds the consecutive repeats of one path in a Tab sequence into a single stop, as long as the run
 * is at most `cap` presses (the segments of one date field). A longer run is left as it came, two or
 * more entries of the same path, which `tabWalkProblems` reads as focus held by that control.
 */
export function collapseStops(sequence, cap = SEGMENT_CAP) {
  const out = [];
  for (let i = 0; i < sequence.length;) {
    let j = i;
    while (j < sequence.length && sequence[j] === sequence[i]) j++;
    const run = j - i;
    if (sequence[i] == null || run > cap) out.push(...sequence.slice(i, j));
    else out.push(sequence[i]);
    i = j;
  }
  return out;
}

/**
 * Tab walk: `candidates` are the paths of the elements that should take focus, `sequence` the paths
 * focused by each Tab press in order (null where focus sat on nothing, e.g. the page body).
 *
 * `tab-trap`: focus came back to an element other than the first stop while candidates were still
 * unvisited, so Tab cycles in a loop short of the page end. `tab-unreached`: a candidate never took focus. With a trap the
 * unreached ones are named in the trap's message instead of one finding each.
 */
export function tabWalkProblems({ candidates, sequence }) {
  const visited = new Set();
  let trap = null;
  let first = null;
  let previous = null;
  for (const path of collapseStops(sequence)) {
    if (path == null) continue;
    if (visited.has(path)) {
      // Back at the first stop is Tab wrapping round the page: whatever it skipped is unreached,
      // and a control Tab cannot reach looks exactly like this. Back at any other stop is a loop,
      // and so is the same stop again straight away, which is focus that will not leave it.
      if (
        (path !== first || path === previous) &&
        candidates.some((c) => !visited.has(c))
      )
        trap = path;
      break;
    }
    previous = path;
    first ??= path;
    visited.add(path);
  }
  const unreached = candidates.filter((c) => !visited.has(c));
  if (trap) {
    return [
      {
        rule: "tab-trap",
        selector: trap,
        message: `Tab returned to ${trap} with ${unreached.length} of ${candidates.length} controls still unreached (first: ${unreached[0]})`,
      },
    ];
  }
  return unreached.map((selector) => ({
    rule: "tab-unreached",
    selector,
    message: "Tab never reached this control",
  }));
}

/**
 * Tab walk: is the focused control covered? `samples` holds one `{ ok, by }` per box the control
 * draws (a link that wraps has one per line): `ok` when the element at that box's centre is the
 * control, its part or its label, `by` a name for what was there instead. The control is covered
 * only when every box is, and then the answer is what covers the last one. No samples (off screen,
 * no pointer events) is not covered.
 */
export function obscuredByProblem(samples) {
  if (!samples || samples.length === 0) return null;
  if (samples.some((s) => s.ok)) return null;
  return samples[samples.length - 1].by;
}

/** A computed `outline-width` such as "2px" as a number (0 when it does not parse). */
function px(value) {
  const n = Number.parseFloat(value ?? "");
  return Number.isFinite(n) ? n : 0;
}

/**
 * Tab walk: does focus change how a control looks? `before` and `after` are the computed
 * `{ outlineStyle, outlineWidth, boxShadow, borderColor, backgroundColor }` of the element unfocused
 * and focused. A visible change is an outline of at least 2px that is not `none` (the UA's `auto`
 * ring counts), a box-shadow that is not `none` and not the one it already had, or a different
 * border or background colour.
 */
export function focusVisibleProblem({ before, after }) {
  const outline =
    after.outlineStyle !== "none" &&
    (after.outlineStyle === "auto" || px(after.outlineWidth) >= 2) &&
    (after.outlineStyle !== before.outlineStyle ||
      after.outlineWidth !== before.outlineWidth);
  const shadow =
    after.boxShadow !== "none" && after.boxShadow !== before.boxShadow;
  const border = after.borderColor !== before.borderColor;
  const fill = after.backgroundColor !== before.backgroundColor;
  return outline || shadow || border || fill
    ? []
    : [
        {
          rule: "focus-invisible",
          message: `focus changes nothing visible (outline ${after.outlineStyle} ${after.outlineWidth}, box-shadow ${after.boxShadow})`,
        },
      ];
}

/**
 * Tab walk: a slider answers ArrowRight and ArrowLeft. `before` is its value as found, `moved` the
 * value after the first key and `restored` after the opposite key. A slider already at its far end
 * is tried the other way round by the script, and `keys` names the two keys used.
 */
export function arrowMoveProblems({ before, moved, restored, keys }) {
  if (before == null) {
    return ["the control exposes no value (aria-valuenow or value)"];
  }
  const problems = [];
  if (moved === before)
    problems.push(`${keys[0]} did not change the value (still ${before})`);
  else if (restored !== before) {
    problems.push(`${keys[1]} did not restore ${before} (got ${restored})`);
  }
  return problems;
}

/**
 * axe: does an exclusion entry cover a result? Rule, selector and page must all match; an entry's
 * `pages` holds site paths or `"*"`.
 */
export function exclusionMatches(entry, { rule, selector, page }) {
  return (
    entry.rule === rule &&
    entry.selector === selector &&
    Array.isArray(entry.pages) &&
    (entry.pages.includes("*") || entry.pages.includes(page))
  );
}

/** Whether any entry of `exclusions` covers the result. */
export function isExcluded(exclusions, result) {
  return exclusions.some((entry) => exclusionMatches(entry, result));
}

/** Problems with the exclusions file itself: an entry without a reason excludes nothing. */
export function exclusionProblems(entries) {
  if (!Array.isArray(entries))
    return ["the exclusions file must hold a JSON array"];
  const problems = [];
  entries.forEach((e, i) => {
    const where = `entry ${i}`;
    if (typeof e?.rule !== "string" || !e.rule)
      problems.push(`${where}: rule is required`);
    if (typeof e?.selector !== "string" || !e.selector)
      problems.push(`${where}: selector is required`);
    if (
      !Array.isArray(e?.pages) ||
      e.pages.length === 0 ||
      e.pages.some((p) => typeof p !== "string")
    ) {
      problems.push(`${where}: pages must list site paths or "*"`);
    }
    if (typeof e?.reason !== "string" || e.reason.trim().length < 20) {
      problems.push(
        `${where}: reason must say, with the measured evidence, why this is a false positive`,
      );
    }
  });
  return problems;
}

/**
 * The alpha channel of a computed CSS colour: `rgb(1, 2, 3)` is 1, `rgba(1, 2, 3, 0.5)` and
 * `color(srgb 1 1 1 / 0.5)` are 0.5, `transparent` is 0. Null when the string is not a colour.
 */
export function colorAlpha(css) {
  const text = String(css ?? "")
    .trim()
    .toLowerCase();
  if (text === "transparent") return 0;
  const open = text.indexOf("(");
  if (open === -1 || !text.endsWith(")")) return null;
  const inner = text.slice(open + 1, -1);
  const slash = inner.indexOf("/");
  let raw = null;
  if (slash !== -1) raw = inner.slice(slash + 1).trim();
  else if (text.startsWith("rgba(") || text.startsWith("hsla(")) {
    raw = inner.split(",")[3]?.trim() ?? null;
  }
  if (raw == null) return 1;
  const n = raw.endsWith("%")
    ? Number.parseFloat(raw) / 100
    : Number.parseFloat(raw);
  return Number.isFinite(n) ? n : null;
}

/** Reduced transparency: the fill of a blurred element must be at least this opaque. */
export const MIN_OPAQUE_ALPHA = 0.9;

/**
 * Media gate, reduced transparency, for an element that had a `backdrop-filter` in the normal run:
 * the blur must be gone (`transparency-blur`) and the background at least 0.9 opaque
 * (`transparency-fill`). `backdropFilter` and `backgroundColor` are the computed values under the
 * emulated preference.
 */
export function transparencyProblems({ backdropFilter, backgroundColor }) {
  const out = [];
  if (backdropFilter !== "none") {
    out.push({
      rule: "transparency-blur",
      message: `backdrop-filter is still ${backdropFilter} under prefers-reduced-transparency`,
    });
  }
  const alpha = colorAlpha(backgroundColor);
  if (alpha == null || alpha < MIN_OPAQUE_ALPHA) {
    out.push({
      rule: "transparency-fill",
      message: `background ${backgroundColor} has alpha ${alpha ?? "unknown"}, under ${MIN_OPAQUE_ALPHA}, under prefers-reduced-transparency`,
    });
  }
  return out;
}

/** Media gate, reduced motion: an animation still going 2s after load is a `motion-running` finding. */
export function motionProblem({ playState, iterations, remainingMs }) {
  if (playState !== "running") return false;
  return iterations === Infinity || remainingMs > 1000;
}

/** A number printed to 0.1 px, the precision the gates' messages state sizes and positions at. */
export const px1 = (n) => (Math.round(n * 10) / 10).toFixed(1);

/** `{ left, top, width, height }` of a rect as `x,y WxH`, to 0.1 px. */
export const rectText = (r) =>
  r ? `${px1(r.left)},${px1(r.top)} ${px1(r.width)}x${px1(r.height)}` : "none";

/**
 * Samples once per animation frame until `done(sample)` holds or `maxMs` has passed.
 * `sample` returns one reading after the next frame (the caller waits for the frame inside it);
 * `now` is the clock, injected so a test needs no real time. Returns
 * `{ ok, frames, last }`: `frames` counts the readings taken, `last` is the final one.
 */
export async function waitForFrames(sample, done, { maxMs, now }) {
  const start = now();
  let frames = 0;
  let last;
  for (;;) {
    last = await sample();
    frames++;
    if (done(last)) return { ok: true, frames, last };
    if (now() - start >= maxMs) return { ok: false, frames, last };
  }
}

/** True when `prefers-contrast: more` has reached the page's tokens and text. */
export const contrastApplied = ({ border, strong, shadowCount }) =>
  border === strong && shadowCount === 0;

/**
 * Contrast check: the finding for a page that never reached the emulated state. The cell fails
 * on this alone, and neither product rule is recorded, since both read the state that is missing.
 */
export function emulationNotAppliedProblem({
  frames,
  matches,
  border,
  strong,
  shadowCount,
}) {
  return {
    rule: "emulation-not-applied",
    target: "root",
    selector: ":root",
    message:
      `prefers-contrast: more did not reach the page within ${frames} animation frames: ` +
      `matchMedia(prefers-contrast: more) is ${matches}, --gmt-border is ${border}, ` +
      `--gmt-border-strong is ${strong}, ${shadowCount} visible text element(s) still have a text-shadow`,
  };
}

/**
 * Tab walk: the full message for a control that is covered. `info` is what the page read at the
 * moment of the check: `by` (the covering element's identity), `byRect`, `byDisplay`, `byPosition`,
 * `byZIndex`, `rect` (the focused control), `container` (the nearest scroll container's identity,
 * `rect`, `scrollTop`, `scrollPaddingBlock`), `viewport` ({ width, height }) and `narrow`
 * (`matchMedia('(max-width: 60rem)').matches`).
 */
export function obscuredMessage(name, info) {
  const c = info.container;
  return (
    `${name} is covered by ${info.by} ` +
    `[${rectText(info.byRect)}; display ${info.byDisplay}, position ${info.byPosition}, z-index ${info.byZIndex}]. ` +
    `Focused control at ${rectText(info.rect)}. ` +
    (c
      ? `Nearest scroll container ${c.identity} at ${rectText(c.rect)}, scrollTop ${px1(c.scrollTop)}, scroll-padding-block ${c.scrollPaddingBlock}. `
      : "No scroll container above it. ") +
    `Viewport ${info.viewport.width}x${info.viewport.height}, (max-width: 60rem) ${info.narrow}.`
  );
}

/**
 * Contrast measure: did the layout move between the two screenshot passes? `before` and `after`
 * are `{ key, top, height }` lists in the same order. Returns `null` when no rect moved by more
 * than 0.5 px; otherwise `{ moved, largest, cause }`: `moved` is the key of the element that moved
 * most, `largest` its shift, `cause` the key of the first element above it whose height changed.
 */
export function staleRectProblem(before, after, tolerance = 0.5) {
  if (before.length !== after.length) {
    return {
      moved: "page",
      largest: Math.abs(after.length - before.length),
      cause: null,
      countChanged: true,
    };
  }
  let largest = 0;
  let movedAt = -1;
  for (let i = 0; i < before.length; i++) {
    const shift = Math.max(
      Math.abs(after[i].top - before[i].top),
      Math.abs(after[i].height - before[i].height),
    );
    if (shift > tolerance && shift > largest) {
      largest = shift;
      movedAt = i;
    }
  }
  if (movedAt === -1) return null;
  let cause = null;
  for (let i = 0; i < movedAt; i++) {
    if (Math.abs(after[i].height - before[i].height) > tolerance) {
      cause = before[i].key;
      break;
    }
  }
  return { moved: before[movedAt].key, largest, cause, countChanged: false };
}

/** The message for `staleRectProblem`'s result. */
export function staleRectMessage(problem) {
  return problem.countChanged
    ? `the page drew ${px1(problem.largest)} more or fewer elements during the measure, so the rects taken before the second screenshot no longer describe it`
    : `layout moved during the measure: ${problem.moved} shifted ${px1(problem.largest)} px between the two screenshots` +
        (problem.cause
          ? `; the first element above it whose height changed is ${problem.cause}`
          : "");
}

/**
 * Grow measure: why a frame jumped. `frame` is `{ index, msSinceNavigation, key, before, after }`
 * where `before` and `after` are the deepest resized element's `{ width, height }`; `fonts` is
 * `{ status, loaded }` (`document.fonts.status` and the families that loaded since the last frame).
 */
export function frameDiagnostic({
  index,
  msSinceNavigation,
  key,
  before,
  after,
  fonts,
}) {
  const size = (s) => `${px1(s.width)}x${px1(s.height)}`;
  return (
    `frame ${index}, ${Math.round(msSinceNavigation)} ms after navigation: ${key} went ${size(before)} -> ${size(after)}; ` +
    `document.fonts.status ${fonts.status}` +
    (fonts.loaded.length > 0
      ? `, newly loaded: ${fonts.loaded.join(", ")}`
      : ", no font newly loaded")
  );
}

/**
 * `--resolve-only`: the problem with one locator's match count, or `null` when it is in range.
 * `min` and `max` default to exactly one; an optional control passes `min: 0`.
 */
export function locatorCountProblem(name, count, { min = 1, max = 1 } = {}) {
  if (count >= min && count <= max) return null;
  const want = min === max ? `${min}` : `${min} to ${max}`;
  return `${name} matched ${count} element(s), expected ${want}`;
}
