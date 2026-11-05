/**
 * The one place a gate launches a browser.
 *
 * Playwright 1.63's Firefox does not launch on macOS 27 ("Could not find profile folder"). When
 * `GMT_PW_FIREFOX_WS` names a Playwright run-server (see `scripts/firefox-server.mjs`), Firefox
 * connects to it instead and reaches the host's static server through Playwright's network
 * tunnel. Chromium and WebKit, and Firefox with the variable unset (CI), launch as before.
 *
 * The runbook is `context/dox/built.md` § Runbooks, "Firefox on macOS 27 (Docker route)". That
 * entry also says how to retire this route: delete `firefoxEndpoint` and the connect branch,
 * and keep `launchBrowser` as the single launch seam.
 */

import { chromium, firefox, webkit } from "@playwright/test";

const ENGINES = { chromium, firefox, webkit };

/** Playwright's `exposeNetwork` keyword for localhost, `*.localhost`, 127.0.0.1 and [::1]. */
const LOOPBACK = "<loopback>";

/** The Firefox run-server to connect to, or `null` to launch Firefox itself. */
export function firefoxEndpoint(env = process.env) {
  const value = (env.GMT_PW_FIREFOX_WS ?? "").trim();
  if (value === "") return null;
  if (!/^wss?:\/\//.test(value)) {
    throw new Error(
      `GMT_PW_FIREFOX_WS must be a ws:// or wss:// URL, got "${value}"`,
    );
  }
  return value;
}

/**
 * @param {"chromium" | "firefox" | "webkit"} name
 * @param {object} [options] Playwright launch options.
 * @param {{ engines?: typeof ENGINES, env?: NodeJS.ProcessEnv }} [inject] Test seams.
 */
export async function launchBrowser(name, options = {}, inject = {}) {
  const engines = inject.engines ?? ENGINES;
  const engine = Object.hasOwn(engines, name) ? engines[name] : undefined;
  if (!engine) {
    throw new Error(
      `Unknown browser "${name}": chromium, firefox and webkit run here.`,
    );
  }
  const endpoint = name === "firefox" ? firefoxEndpoint(inject.env) : null;
  if (endpoint === null) return engine.launch(options);
  const browser = await engine.connect(endpoint, {
    exposeNetwork: LOOPBACK,
    timeout: 30_000,
  });
  console.error(`firefox: connected to ${endpoint} (${browser.version()})`);
  return browser;
}
