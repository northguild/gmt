/**
 * Opens the landing page in a headed Chromium with its clock set to an instant, and leaves it for
 * your own clicks: the way to look at the sky at a moment a test pins (Apophis's pass of
 * 2029-04-13T20:00Z, say) without waiting for it. The page's clock runs on from the instant
 * (`page.clock.install`), so the sky keeps moving as it would then.
 *
 * Usage, from `apps/dox`:
 *
 *     node scripts/sky-at.mjs 2029-04-13T20:00Z [1440x900] [--base http://127.0.0.1:4351/gmt]
 *
 * The instant is a UTC instant (parsed with gmt); the size defaults to 1440x900; `--base` defaults
 * to the dev server (`pnpm dox:dev`, http://localhost:4321/gmt). Close the window to end it.
 */
import { loadGmt } from "../../../scripts/lib/gmt.mjs";
import { launchBrowser } from "./lib/browser-launch.mjs";
import { gateOptions, usageError } from "./lib/gate-cli.mjs";

const GATE = "sky-at";
const USAGE =
  "usage: node scripts/sky-at.mjs <UTC instant> [<width>x<height>] [--base <url>]";

const args = process.argv.slice(2);
const opt = gateOptions(GATE, args, ["--base"]);
const base = opt("base", "http://localhost:4321/gmt").replace(/\/$/, "");
const [instant, sizeText = "1440x900"] = args.filter(
  (arg, i) => !arg.startsWith("--") && args[i - 1] !== "--base",
);

const { convertUtcToUnix } = await loadGmt();
const at = instant ? convertUtcToUnix(instant) : null;
if (at === null)
  usageError(GATE, `needs a UTC instant such as 2029-04-13T20:00Z. ${USAGE}`);
const size = /^(\d+)x(\d+)$/.exec(sizeText);
if (!size)
  usageError(GATE, `the size is <width>x<height>, got "${sizeText}". ${USAGE}`);

const browser = await launchBrowser("chromium", { headless: false });
const context = await browser.newContext({
  viewport: { width: Number(size[1]), height: Number(size[2]) },
});
await context.clock.install({ time: at });
const page = await context.newPage();
await page.goto(`${base}/`);
console.log(
  `${GATE}: ${instant} at ${sizeText} on ${base}/ (close the window to end)`,
);
await new Promise((resolve) => browser.on("disconnected", resolve));
