/**
 * Which sound-check rules a browser is held to. Imported by `scripts/sound-check.mjs`; the test is
 * `sound-scope.test.ts`.
 */

/**
 * The rules that need audio running. CI's Linux Firefox and WebKit have no audio sink, so a
 * context there never runs and each of these fails on the runner, not on the site. In CI they
 * are held to Chromium; on a Mac every engine is held to all of them, and the local WebKit run
 * stands in for Safari. Mute and no-autoplay hold on every engine everywhere.
 */
const RUNNING_AUDIO = new Set([
  "unlock",
  "click",
  "link",
  "link-hold",
  "chrome-cue",
  "control-pop",
  "control-still",
]);
export { RUNNING_AUDIO };

/**
 * Whether a failure of `rule` in `browser` is dropped because the runner has no audio sink: only
 * in CI, only for the running-audio rules, and never in Chromium.
 *
 * @param {string} rule
 * @param {string} browser
 * @param {Record<string, string | undefined>} env
 */
export function sinkless(rule, browser, env) {
  return env.CI === "true" && browser !== "chromium" && RUNNING_AUDIO.has(rule);
}
