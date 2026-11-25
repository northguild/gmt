/**
 * The deck's slide change as a same-document view transition: the leaving slide fades out and the
 * arriving one's text freezes in as the landing page's copy does (`slides.css`, the view-transition
 * rules). This module only decides whether a change gets the transition and keeps it from piling
 * up; the look is all CSS.
 *
 * The deck's state is always moved at once. Only the page's visible commit (which slide is shown,
 * its builds, the camera) is handed to `run`, which runs it inside the transition's update
 * callback so the browser has the old picture before the page changes.
 *
 * - A change between two slides gets the transition, typed `forward` or `back`. A build inside a
 *   slide does not: nothing leaves, so there is nothing to fade.
 * - No `document.startViewTransition`, a visitor who asked for reduced motion, or an open dialog:
 *   the change is a plain cut.
 * - While a commit waits for the update callback, further commits join it and run in order, so no
 *   press is lost and none starts a second transition.
 * - A press while a transition runs skips it, and the commit runs as a cut. Holding a key therefore
 *   never stacks transitions, and a burst (a press within `BURST_MS` of the last) is cut too, so
 *   a held key does not flicker between a transition and a cut.
 * - `afterSwap` holds work that moves something (the camera's flight) until the new picture is up.
 *   The frames that capture and first paint the arriving slide are the slowest of a change, and a
 *   flight started with them stutters at its start (`frame-budget` in `slides-check`). A cut has
 *   one such frame, the one that first paints what it shows: a build coming in restyles all of
 *   its content, which no longer hides.
 */

import { afterFrames } from "./frames";

type DeckDirection = "forward" | "back";

export interface DeckTransition {
  /**
   * Runs `commit`, inside a view transition when `direction` is given and one can play.
   * Without a direction the commit still joins a transition that is waiting for its update.
   */
  run(commit: () => void, direction?: DeckDirection): void;
  /**
   * Runs `fn` once the new picture is up: the playing transition's ready, then `SWAP_FRAMES`
   * painted frames, or `CUT_FRAMES` when none plays. A skipped transition runs it too.
   */
  afterSwap(fn: () => void): void;
}

interface DeckTransitionEnv {
  doc: Document;
  signal: AbortSignal;
  /** Whether the visitor asked for reduced motion, read at each change. */
  reduced: () => boolean;
  /** Whether something sits over the stage (a dialog), read at each change. */
  covered: () => boolean;
}

/** A press this soon after the last one is part of a burst and never starts a transition. */
export const BURST_MS = 300;

/** Painted frames after a transition is ready before `afterSwap` runs: the capture's, then the first. */
const SWAP_FRAMES = 2;

/** Painted frames after a cut before `afterSwap` runs: the one that first paints it. */
const CUT_FRAMES = 1;

/** The attribute the page's names for the transition hang on; set only while one plays. */
export const TRANSITION_ATTR = "data-deck-vt";

export function createDeckTransition(env: DeckTransitionEnv): DeckTransition {
  const { doc, signal } = env;
  const html = doc.documentElement;
  const win = doc.defaultView;
  /** Commits that wait for the update callback. */
  let queue: (() => void)[] = [];
  let active: ViewTransition | null = null;
  /** Whether `active` has run its update callback. */
  let updated = false;
  let burst = false;
  let burstTimer = 0;

  const flush = (): void => {
    const todo = queue;
    queue = [];
    for (const commit of todo) commit();
  };

  const end = (own: ViewTransition): void => {
    if (active !== own) return;
    active = null;
    updated = false;
    html.removeAttribute(TRANSITION_ATTR);
  };

  const touch = (): void => {
    burst = true;
    if (!win) return;
    win.clearTimeout(burstTimer);
    burstTimer = win.setTimeout(() => {
      burst = false;
    }, BURST_MS);
  };

  signal.addEventListener(
    "abort",
    () => {
      win?.clearTimeout(burstTimer);
      active?.skipTransition();
      html.removeAttribute(TRANSITION_ATTR);
      active = null;
      queue = [];
    },
    { once: true },
  );

  const run = (commit: () => void, direction?: DeckDirection): void => {
    const wasBurst = burst;
    touch();
    // A commit is waiting for the update callback: it goes in line, in order.
    if (active && !updated) {
      queue.push(commit);
      return;
    }
    // A transition is playing: this press skips it and the page changes as a cut.
    if (active) {
      active.skipTransition();
      html.removeAttribute(TRANSITION_ATTR);
      active = null;
      updated = false;
      commit();
      return;
    }
    if (
      !direction ||
      wasBurst ||
      signal.aborted ||
      typeof doc.startViewTransition !== "function" ||
      env.reduced() ||
      env.covered()
    ) {
      commit();
      return;
    }
    queue.push(commit);
    // The names are on before the browser captures the old picture, and off when it is done.
    html.setAttribute(TRANSITION_ATTR, direction);
    const own = doc.startViewTransition({
      update: () => {
        updated = true;
        flush();
      },
      types: [direction],
    });
    active = own;
    const done = (): void => end(own);
    own.finished.then(done, done);
  };

  const afterSwap = (fn: () => void): void => {
    const own = active;
    if (!win) {
      fn();
      return;
    }
    if (!own) {
      afterFrames(win, CUT_FRAMES, fn, signal);
      return;
    }
    const go = (): void => afterFrames(win, SWAP_FRAMES, fn, signal);
    own.ready.then(go, go);
  };

  return { run, afterSwap };
}
