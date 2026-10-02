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
