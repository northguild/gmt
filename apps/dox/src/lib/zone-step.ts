/**
 * The planner's step, on its own so the server-rendered template (no polyfill) and the pure
 * helpers (`zone-anchor.ts`, which load gmt) can both name it.
 */

/** The granularity of everything the reader can move: the slider's step, the reference-time
 *  field's own step, and what a seeded or restored anchor is rounded to. Named once and
 *  derived everywhere, so two steppers cannot disagree. */
export const SLIDER_STEP_MIN = 5;
