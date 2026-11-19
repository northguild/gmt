#!/usr/bin/env node
/**
 * Sound gate: the autoplay contract, the mute rule and the press cue (DOX-G11).
 *
 * A wrapper installed before any page script logs into `window.__sound` every `AudioContext` the
 * page constructs, each state change, and each oscillator `start(t)`. A voice schedules its
 * sources at one time `t`, so the distinct times are the voices that played. The gate asserts on
 * that log and never listens to sound.
 *
 * Sound is opt-in, so every scenario but those marked `sound: "default"` stands for a reader who
 * turned it on: an init script saves an unmuted `dox:sound` record whenever none is saved.
 *
 * Per browser and page it runs four scenarios, each in a fresh context:
 *   - `first visit` (`sound: "default"`): storage empty. `data-sound="off"`; no context is ever
 *     constructed, press or not.
 *   - `opted in`: `data-sound="on"`; no context before a gesture; the first press makes one and
 *     it runs; a button press then starts exactly one voice; a press on a link that goes to
 *     another page (its navigation cancelled) starts exactly one more.
 *   - `reduced, opted in`: reduced motion emulated, sound saved on. A press plays: the system's
 *     settings never mute.
 *   - `saved-mute`: `dox:sound` saved muted. No context; the mute survives a reload.
 *   - `control` (slice 2, the header's settings control): at 320, 390, 768 and 1440 the
 *     "Settings" button is in the bar and in the tab order; from 50rem it sits right after the Dox
 *     link and before GitHub. Closed, the popover's theme switch, mute button, fader and Aura
 *     switch are not visible. Keyboard: Enter on the button opens the popover and puts focus on
 *     the "Dark theme" switch, Tab reaches the mute button, the fader, then the Aura switch, an
 *     arrow key moves the fader one notch, Escape closes and focus returns to the button. Open, the popover is inside the viewport
 *     and under the button. A mute survives a reload and the button's icon paints muted before any
 *     script. On a first visit (`sound: "default"`) the mute button reads pressed and one press
 *     turns sound on and starts a voice. Hold still: the header items' boxes and the button's stay put
 *     (0.5 px) while a drag sweeps the fader 1 to 11 to 1 and the mute button toggles.
 *   - `chrome` (slice 3, once per browser, on fixed pages): after a first press unlocks, each cue is
 *     read as a shape: the sorted start offsets of its oscillators (the press ping, the Distant
 *     sonar, 0,0 at 1050 Hz for a link, a button and a copy alike), and for a Felt slide, a noise swell, its low tone's fall (opening 170 to 140 Hz,
 *     closing 150 to 120 Hz). On `/guides/conversion/databases/` at 390 px the
 *     mobile menu plays the opening then the closing slide (button, then Escape); the settings
 *     gear plays the press ping and Escape nothing; at 1440 px the "Dark theme" switch plays the Ice snap once and nothing else. On
 *     `/tools/converter-bench/` a copy button plays the press ping once; on a guide a code block's
 *     copy plays it once, not twice.
 *   - `link hold` (every browser, a guide): after unlock, a press on a link to another page plays one
 *     voice, the press ping, and is held: 200 ms later the URL is unchanged, then it goes there.
 *   - `aura` (slice 4, Chromium, `/`): no aura source before a gesture; after one, seven held sources
 *     and a bus ramp to 0.25 over 3 s; hiding the page fades it out over 0.6 s and starts nothing for
 *     2 s; showing it ramps back over 1.5 s. The Aura switch (in the settings popover, at 1440 and 390)
 *     fades it out and back in, and `dox:sound` holds `aura` across a reload. Picking Deep drone in
 *     the popover crossfades (the new track's gain ramps to 1 over 1.5 s, the bus makes no new
 *     ramp) and starts its sources; `dox:sound` holds `track` across a reload, and the next gesture
 *     starts Deep drone, not Ice cavern's seven held sources. A guide never requests the aura module.
 *   - `entrance` (Chromium only, launched with autoplay allowed): arriving on `/` from a stand-in
 *     for northguild.dev (the origin's `/`, outside this site), a Crystal dust sparkle (tones of 5200
 *     to 8000 Hz) starts at each computed freeze `animation-delay` the page had
 *     at `t0`, and a Steel shing at each `::before` glint delay, each shing higher than the one
 *     before (compared as offsets from the first sparkle, within 40 ms on the audio clock: the
 *     sounds follow `animationstart`, one frame late at most); under reduced motion with sound
 *     saved on, none. Arriving from a guide by an in-site link, the landing is shown `static`:
 *     the entrance never runs, no button animates, and nothing is heard.
 *   - `chat cues` / `chat error` / `chat copy failure` (slice 5, Chromium, `/dox/` with the Worker
 *     stubbed in the page): two typed keys play two Data blips and an IME composition none; a sent
 *     question plays Sonar launch once, the Sonar idle (587 Hz pings, read apart from the cues)
 *     swells once, pings, and dims once when the first chunk arrives, Morse beeps are 60 ms or more apart on the audio clock, the Ice bell rings once; a 500
 *     plays one Low double buzz and no bell; a failed copy on a tool page plays the buzz.
 *   - `tool cues` (slice 6, Chromium): on `/tools/dwell-ledger/` an arrow key on a handle plays one
 *     Glass tick per step; on `/tools/cutoff-countdown/` typing plays Data blips and the readout
 *     falling to NO SIGNAL plays one Low double buzz, not again while it stays there; on a
 *     playground page typing plays a blip and IME composition none; on `/dox/` a widget opened
 *     from a stubbed answer plays Lock-in once, and with its chunk held back by `page.route`, the
 *     Servo spin-up first (three noise bursts, the last ramping its filter to 1950 Hz).
 *   - `list ticks` (Chromium): on `/` the zone list's arrow keys play one servo tick per step (a
 *     noise burst, no oscillator, pitched higher further down), and the reader's wheel plays servo
 *     ticks as rows pass.
 *   - `globe locate` (Chromium): on `/tools/zoned-earth/` a zone chosen from the globe's list plays
 *     one Sonar lock, two pings 70 ms apart with their echoes, and no press ping.
 *   - `typing everywhere` / `typing enter` (Chromium): on `/tools/gtfs-trip-board/` two keys typed
 *     in the text area play two Data blips of one oscillator each; on `/tools/cutoff-countdown/`
 *     Enter in the one-line "Now" field starts nothing.
 *   - `globe zoom` (Chromium): on `/tools/zoned-earth/` one wheel notch plays one Lens servo step
 *     (a noise burst, no oscillator), a trackpad's stream plays steps 60 ms or more apart, and the
 *     Zoom out button plays a step and no press ping.
 *   - `arrival map` / `arrival globe` (Chromium): with the Worker stubbed, the US Sunshine
 *     Protection Act map coming into view after the first gesture plays the Sonar dawn once
 *     (0,0.9,0.9), not again when it comes back, and nothing when it was on screen before the
 *     gesture; the Zoned Earth globe coming into view plays the Steel horizon (one burst, one tone).
 * Every scenario fails on a console error or an uncaught page error.
 *
 * Serve a build statically first (never `astro preview`, never the owner's dev server), for example:
 *   pnpm exec astro build --outDir /tmp/dist-x/gmt
 *   node scripts/lib/static-server.mjs /tmp/dist-x 4351
 *
 * Usage: node scripts/sound-check.mjs --base http://127.0.0.1:4351/gmt [--browsers chromium,webkit,firefox]
 *        [--pages /,/tools/zoned-earth/] [--list-pages]
 * Exits non-zero on any failure.
 */
import { readFileSync } from "node:fs";
import { launchBrowser } from "./lib/browser-launch.mjs";
import { blockOffSite } from "./gate-checks.mjs";
import { applyPageContract } from "./gates/contract.mjs";
import { recordFinding, recordMeasured } from "./gates/findings.mjs";

const GATE = "sound-check";
const PAGES = ["/", "/tools/zoned-earth/"];
const SOUND_KEY = "dox:sound";
/** `SOUND_VERSION` in src/lib/sound/settings.ts: a record without it reads as muted. */
const SOUND_VERSION = 1;
const ENGINES = ["chromium", "firefox", "webkit"];

const PAGES_ARG = await applyPageContract({ gate: GATE, pages: PAGES });
const SELECTED = PAGES_ARG ?? PAGES;

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};
const base = flag("base", "http://127.0.0.1:4351/gmt").replace(/\/$/, "");
const browsers = flag("browsers", "chromium,webkit,firefox").split(",");
// `--only aura` runs just the scenarios whose name contains it.
const ONLY = flag("only", "");
for (const name of browsers) {
  if (!ENGINES.includes(name)) {
    console.error(`${GATE}: unknown browser "${name}"`);
    process.exit(2);
  }
}

const failures = [];
let measured = 0;
const fail = (rule, browser, path, message) => {
  failures.push(`${browser} ${path}: ${message}`);
  console.error(`  ! ${rule} · ${browser} ${path}: ${message}`);
  recordFinding({
    gate: GATE,
    rule,
    page: path,
    target: "page",
    browser,
    message,
  });
};

/** Runs in the page before any script of its own: the log. */
function installLog() {
  const log = {
    constructed: 0,
    states: [],
    starts: [],
    // Each logged start's pitch in Hz, with its own count: the press ping is read by its pitch.
    pitches: [],
    // Each noise burst's start time (a buffer source, never the aura's): a Lens servo step has no
    // oscillator.
    noises: [],
    aura: [],
    ramps: [],
    exps: [],
    combs: [],
    // Each Felt slide's low tone as [open or close, start time]: the panels' cue.
    slides: [],
  };
  window.__sound = log;
  Error.stackTraceLimit = 40;
  const Native = window.AudioContext || window.webkitAudioContext;
  if (!Native) return;
  class Logged extends Native {
    constructor(...options) {
      super(...options);
      log.constructed += 1;
      this.addEventListener("statechange", () => log.states.push(this.state));
    }
  }
  window.AudioContext = Logged;
  if (window.webkitAudioContext) window.webkitAudioContext = Logged;
  const start = OscillatorNode.prototype.start;
  OscillatorNode.prototype.start = function (when, ...rest) {
    const time = Number((when ?? 0).toFixed(4));
    // The aura's sources (its chunk is in the stack) are logged apart, so the voice counts of the
    // other scenarios on `/` stay the voices a reader's actions made.
    if (/aura/.test(new Error().stack ?? "")) log.aura.push(time);
    else {
      log.starts.push(time);
      log.pitches.push(Math.round(this.frequency.__fromValue ?? 0));
    }
    return start.call(this, when, ...rest);
  };
  const play = AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start = function (when, ...rest) {
    if (!/aura/.test(new Error().stack ?? ""))
      log.noises.push(Number((when ?? 0).toFixed(4)));
    return play.call(this, when, ...rest);
  };
  // Every gain ramp as [target, seconds from its last setValueAtTime to its end].
  const set = AudioParam.prototype.setValueAtTime;
  AudioParam.prototype.setValueAtTime = function (value, time) {
    this.__from = time;
    this.__fromValue = value;
    return set.call(this, value, time);
  };
  const ramp = AudioParam.prototype.linearRampToValueAtTime;
  AudioParam.prototype.linearRampToValueAtTime = function (value, end) {
    log.ramps.push([value, Number((end - (this.__from ?? end)).toFixed(3))]);
    return ramp.call(this, value, end);
  };
  // Every exponential ramp as [target, seconds from its last setValueAtTime]: the Servo spin-up's
  // last burst ramps its filter to 1950 Hz (its frequency is never set with setValueAtTime, so the
  // span reads 0), and noise has no oscillator start to log.
  const createDelay = BaseAudioContext.prototype.createDelay;
  BaseAudioContext.prototype.createDelay = function (...options) {
    const node = createDelay.apply(this, options);
    node.delayTime.__delay = true;
    return node;
  };
  const exp = AudioParam.prototype.exponentialRampToValueAtTime;
  AudioParam.prototype.exponentialRampToValueAtTime = function (value, end) {
    log.exps.push([value, Number((end - (this.__from ?? end)).toFixed(3))]);
    // A steel comb's delay sweep as [target, start time, start value]: only a delay's time ramps
    // in seconds (an envelope's gain ramps to 0.0001 too, and is not one).
    if (this.__delay && this.__from !== undefined)
      log.combs.push([value, Number(this.__from.toFixed(4)), this.__fromValue]);
    // A Felt slide's low tone falls 170 to 140 Hz opening, 150 to 120 Hz closing.
    const slide =
      this.__fromValue === 170 && value === 140
        ? "open"
        : this.__fromValue === 150 && value === 120
          ? "close"
          : null;
    if (slide && this.__from !== undefined)
      log.slides.push([slide, Number(this.__from.toFixed(4))]);
    return exp.call(this, value, end);
  };
}

/**
 * Runs in the page: what the log holds, with the voices counted as distinct start times. The
 * landing's entrance sparkles (Crystal dust, 5200 to 8000 Hz) are left out: a piece that arms late
 * sparkles after the first press has unlocked sound, and is no press's voice.
 */
function readLog() {
  const log = window.__sound;
  const pressed = log.starts.filter(
    (_, i) => !(log.pitches[i] >= 5200 && log.pitches[i] <= 8000),
  );
  return {
    constructed: log.constructed,
    states: log.states,
    voices: new Set(pressed).size,
    sound: document.documentElement.dataset.sound ?? null,
  };
}

/** The first button a reader could press that stays on the page and has no cue of its own. */
const PRESSABLE =
  "button:visible:not([data-cue]):not([disabled]):not([aria-disabled=true])";
/** A link that goes to another page of the site. */
const NAVIGATING =
  'a[href]:visible:not([href^="#"]):not([href^="http"]):not([target])';

async function newPage(browser, options, listeners) {
  // Clipboard permissions are Chromium's to grant; WebKit and Firefox let a press copy without them.
  const { permissions, sound, ...rest } = options;
  const chromium = browser.browserType().name() === "chromium";
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ...rest,
    ...(permissions && chromium ? { permissions } : {}),
  });
  await blockOffSite(context, base);
  await context.addInitScript(installLog);
  // A reader who turned sound on, unless the scenario is a first visit. Only when nothing is
  // saved, so a scenario's own choice survives its reloads.
  if (sound !== "default")
    await context.addInitScript(
      ([key, record]) => {
        try {
          if (localStorage.getItem(key) === null)
            localStorage.setItem(key, record);
        } catch {
          // about:blank has no storage.
        }
      },
      [
        SOUND_KEY,
        JSON.stringify({
          v: SOUND_VERSION,
          level: 5,
          muted: false,
          aura: true,
          track: "ice",
        }),
      ],
    );
  const page = await context.newPage();
  page.on("console", (message) => {
    if (message.type() === "error") listeners.errors.push(message.text());
  });
  page.on("pageerror", (error) =>
    listeners.errors.push(String(error.message ?? error)),
  );
  return { context, page };
}

async function load(page, path) {
  await page.goto(`${base}${path}`, { waitUntil: "load" });
  // Past the idle callback that loads the engine, so a press lands on a ready engine.
  await page.waitForTimeout(1500);
}

async function press(page, selector) {
  const target = page.locator(selector).first();
  if ((await target.count()) === 0) return false;
  await target.click({ timeout: 5000 });
  // A press on Starlight's Search opens its modal; close it so the next press can land.
  const modal = page.locator("dialog[open]");
  if ((await modal.count()) > 0) {
    await page.keyboard.press("Escape");
    await modal
      .first()
      .waitFor({ state: "detached", timeout: 5000 })
      .catch(() => modal.first().waitFor({ state: "hidden", timeout: 5000 }));
  }
  return true;
}

/** Poll the page log until `ok(log)` or 3 s pass; returns the last log. */
async function settle(page, ok) {
  let log = await page.evaluate(readLog);
  for (let i = 0; i < 15 && !ok(log); i++) {
    await page.waitForTimeout(200);
    log = await page.evaluate(readLog);
  }
  return log;
}

async function scenario(browser, name, path, options, run) {
  if (ONLY && !String(options.scenario).includes(ONLY)) return;
  const listeners = { errors: [] };
  const { context, page } = await newPage(browser, options, listeners);
  const where = (rule, message) => fail(rule, name, path, message);
  try {
    await run(page, where);
    for (const text of listeners.errors)
      where("console-error", `${options.scenario}: ${text}`);
    measured++;
  } catch (error) {
    where(
      "gate-error",
      `${options.scenario}: ${String(error?.message ?? error).split("\n")[0]}`,
    );
  } finally {
    await context.close();
  }
}

/** Save a record as `writeSound` does, with this build's version. */
const saved = (page, value) =>
  page.evaluate(
    ([key, v]) => localStorage.setItem(key, JSON.stringify(v)),
    [SOUND_KEY, { v: SOUND_VERSION, ...value }],
  );

const GUIDE = "/guides/conversion/databases/";
/** The origin's `/`, where northguild.dev sits above this site; a fixture stands in for it. */
const SITE_ORIGIN = new URL(base).origin;
const NG_LANDING = readFileSync(
  new URL("./fixtures/ng-landing.html", import.meta.url),
  "utf8",
);
// Zoned Earth has no copy button; the converter bench shows one on load.
const COPY_PAGE = "/tools/converter-bench/";

/** Runs in the page: the oscillator start times logged so far. */
const readStarts = () => window.__sound.starts.slice();
/** Runs in the page: the start of each Crystal dust tone (`paint`), 5200 to 8000 Hz. */
const sparkles = () =>
  window.__sound.starts.filter((_, i) => {
    const hz = window.__sound.pitches[i];
    return hz >= 5200 && hz <= 8000;
  });

/** The cue a run of oscillator starts makes: sorted offsets from the first, as one string. */
function shape(starts) {
  if (starts.length === 0) return "none";
  const first = Math.min(...starts);
  return starts
    .map((t) => Number((t - first).toFixed(3)))
    .sort((a, b) => a - b)
    .join(",");
}
/**
 * A Felt slide, a noise swell with one low tone: read by its tone's fall (170 to 140 Hz opening,
 * 150 to 120 Hz closing), in the order they started.
 */
function slidesOf(slides) {
  return slides
    .slice()
    .sort((a, b) => a[1] - b[1])
    .map(([kind]) => `slide ${kind}`);
}

/** The Felt slides' low tones, which `pingOf` leaves out when it reads a press ping's pitch. */
const SLIDE_HZ = new Set([170, 150]);
/** The Sonar idle ping, the chat's thinking loop: read apart from the cues it runs under. */
const IDLE_HZ = 587;
/** Runs in the page: the oscillator starts of one pitch, or of every pitch but it (`but`). */
const readPitch = ([hz, but]) =>
  window.__sound.starts.filter(
    (_, i) => (window.__sound.pitches[i] === hz) !== but,
  );

/** The press ping's pitch: every press, a link, a button or a copy, plays the Distant sonar. */
const PING_HZ = 1050;

const SHAPES = {
  open: "slide open",
  close: "slide close",
  // The press ping is a tone and its send to the space, together: 0,0; `pingOf` adds the pitch.
  ping: `0,0 at ${PING_HZ} Hz`,
  // The Settings gear: the ping of the links beside it, and its panel's Felt slide.
  pingOpen: `0,0 + slide open at ${PING_HZ} Hz`,
  toggle: "0,0.004",
  // A copy plays the press ping too, read without its pitch.
  copy: "0,0",
  none: "none",
};

/** Do `act`, wait for the sound to land, and return the shape of what started during it. */
/** `waitMs`: how long after the act the cue may start; a globe lock waits for its flight to land. */
async function cueOf(page, act, waitMs = 450) {
  const counts = () =>
    page.evaluate(() => [
      window.__sound.starts.length,
      window.__sound.slides.length,
    ]);
  const [starts, slides] = await counts();
  await act();
  await page.waitForTimeout(waitMs);
  const log = await page.evaluate(() => window.__sound);
  const slid = log.slides.slice(slides);
  // A slide's tone is read as the slide, not as an oscillator of the shape.
  const toned = new Set(slid.map(([, at]) => at));
  const parts = [
    shape(log.starts.slice(starts).filter((t) => !toned.has(t))),
    ...slidesOf(slid),
  ];
  return parts.filter((part) => part !== "none").join(" + ") || "none";
}

/** `cueOf` with the lowest pitch that started, which tells the press ping from other voices. */
async function pingOf(page, act, waitMs = 450) {
  const from = await page.evaluate(() => window.__sound.pitches.length);
  const got = await cueOf(page, act, waitMs);
  const pitches = (
    await page.evaluate((n) => window.__sound.pitches.slice(n), from)
  ).filter((hz) => !SLIDE_HZ.has(hz));
  return pitches.length ? `${got} at ${Math.min(...pitches)} Hz` : got;
}

const CONTROL_WIDTHS = [320, 390, 768, 1440];
/** 50rem at the default 16 px. */
const WIDE_PX = 800;

/** Runs in the page: the box of the settings button, the open popover's parts and every header item. */
function readBoxes() {
  const box = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return [r.x, r.y, r.width, r.height].map((n) => Math.round(n * 2) / 2);
  };
  const q = (selector) => document.querySelector(selector);
  const bar = q("header .header");
  return {
    button: box(q("#gmt-settings-button")),
    pop: box(q("#gmt-settings-pop:popover-open")),
    mute: box(q("#gmt-sound-mute")),
    fader: box(q("gmt-range")),
    aura: box(q("#gmt-sound-aura")?.closest("label")),
    items: [...(bar?.children ?? [])].map(box),
  };
}

const sameBoxes = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** Wait until every animation and transition on `selector` and inside it has finished. */
async function settled(page, selector) {
  await page
    .locator(selector)
    .evaluate((el) =>
      Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)),
    );
}

/** Visible, in the tab order and inside the viewport width. */
async function inBar(page, selector) {
  const target = page.locator(selector).first();
  if (!(await target.isVisible())) return "not visible";
  const r = await target.boundingBox();
  const width = page.viewportSize().width;
  if (!r || r.x < 0 || r.x + r.width > width + 0.5)
    return `outside the viewport (x ${r?.x}, width ${r?.width})`;
  return "";
}

for (const name of browsers) {
  const browser = await launchBrowser(name);
  for (const path of SELECTED) {
    await scenario(
      browser,
      name,
      path,
      { scenario: "opted in" },
      async (page, bad) => {
        await load(page, path);
        let log = await page.evaluate(readLog);
        if (log.sound !== "on")
          bad("data-sound", `opted in: data-sound is "${log.sound}", not "on"`);
        if (log.constructed !== 0)
          bad(
            "autoplay",
            `opted in: ${log.constructed} context(s) before any gesture`,
          );
        if (!(await press(page, PRESSABLE)))
          return bad("no-target", "opted in: no pressable button on the page");
        log = await settle(
          page,
          (l) =>
            l.constructed >= 1 && l.states.includes("running") && l.voices >= 1,
        );
        if (log.constructed !== 1)
          bad(
            "unlock",
            `opted in: the first press made ${log.constructed} context(s), not 1`,
          );
        if (!log.states.includes("running"))
          bad(
            "unlock",
            "opted in: the context is not running after the first press",
          );
        if (log.voices !== 1)
          bad(
            "click",
            `opted in: the first button press started ${log.voices} voice(s), not 1`,
          );
        // A second press, a beat later, past the cue's gap: one more voice.
        await page.waitForTimeout(150);
        await press(page, PRESSABLE);
        await page.waitForTimeout(300);
        log = await page.evaluate(readLog);
        if (log.voices !== 2)
          bad(
            "click",
            `opted in: two presses started ${log.voices} voice(s), not 2`,
          );
        // A link that goes to another page: its navigation is cancelled so the log stays readable.
        await page.evaluate(() =>
          window.addEventListener(
            "click",
            (event) => event.preventDefault(),
            true,
          ),
        );
        if (await press(page, NAVIGATING)) {
          await page.waitForTimeout(400);
          const after = await page.evaluate(readLog);
          if (after.voices !== log.voices + 1)
            bad(
              "link",
              `opted in: a link press started ${after.voices - log.voices} voice(s), not 1`,
            );
        }
      },
    );

    await scenario(
      browser,
      name,
      path,
      { scenario: "first visit", sound: "default" },
      async (page, bad) => {
        await load(page, path);
        await press(page, PRESSABLE);
        await page.waitForTimeout(500);
        const log = await page.evaluate(readLog);
        if (log.sound !== "off")
          bad(
            "data-sound",
            `first visit: data-sound is "${log.sound}", not "off"`,
          );
        if (log.constructed !== 0)
          bad(
            "autoplay",
            `first visit: ${log.constructed} context(s) for a visitor who never turned sound on`,
          );
      },
    );

    await scenario(
      browser,
      name,
      path,
      { scenario: "reduced, opted in", reducedMotion: "reduce" },
      async (page, bad) => {
        await load(page, path);
        await saved(page, { level: 5, muted: false, aura: true });
        await page.reload({ waitUntil: "load" });
        await page.waitForTimeout(1500);
        const before = await page.evaluate(readLog);
        if (before.sound !== "on")
          bad(
            "data-sound",
            `reduced, opted in: data-sound is "${before.sound}", not "on"`,
          );
        await press(page, PRESSABLE);
        const log = await settle(page, (l) => l.voices >= 1);
        if (log.constructed !== 1 || log.voices !== 1)
          bad(
            "click",
            `reduced, opted in: a saved unmute plays ${log.voices} voice(s) in ${log.constructed} context(s), not 1 in 1`,
          );
      },
    );

    await scenario(
      browser,
      name,
      path,
      { scenario: "saved-mute" },
      async (page, bad) => {
        await load(page, path);
        await saved(page, { level: 5, muted: true, aura: true });
        for (const round of ["set", "reload"]) {
          await page.reload({ waitUntil: "load" });
          await page.waitForTimeout(1000);
          await press(page, PRESSABLE);
          await page.waitForTimeout(400);
          const log = await page.evaluate(readLog);
          if (log.sound !== "off")
            bad(
              "data-sound",
              `saved-mute (${round}): data-sound is "${log.sound}", not "off"`,
            );
          if (log.constructed !== 0)
            bad(
              "autoplay",
              `saved-mute (${round}): ${log.constructed} context(s) while muted`,
            );
        }
      },
    );

    for (const width of CONTROL_WIDTHS) {
      await scenario(
        browser,
        name,
        path,
        { scenario: `control ${width}`, viewport: { width, height: 800 } },
        async (page, bad) => {
          await load(page, path);
          const wide = width >= WIDE_PX;
          const button = page.locator("#gmt-settings-button");
          const buttonProblem = await inBar(page, "#gmt-settings-button");
          if (buttonProblem)
            bad(
              "control-button",
              `${width}: the Settings button is ${buttonProblem}`,
            );
          if ((await button.getAttribute("aria-label")) !== "Settings")
            bad(
              "control-button",
              `${width}: the button is not named "Settings"`,
            );
          // Placement: last in the group, right after Discord, the last of the places.
          const settings = await button.boundingBox();
          if (wide) {
            const discord = await page
              .locator(".header .social-icons > a[rel~='me']")
              .last()
              .boundingBox();
            const group = await page
              .locator(".header .right-group")
              .boundingBox();
            if (
              !discord ||
              !settings ||
              discord.x + discord.width > settings.x + 0.5
            )
              bad(
                "control-button",
                `${width}: the button is not right of Discord`,
              );
            else if (settings.x - (discord.x + discord.width) > 40)
              bad(
                "control-button",
                `${width}: something sits between Discord and the button`,
              );
            if (
              group &&
              settings &&
              group.x + group.width - (settings.x + settings.width) > 8
            )
              bad(
                "control-button",
                `${width}: the button is not last in the group`,
              );
          }
          for (const id of ["gmt-theme-dark", "gmt-sound-fader"])
            if (await page.locator(`#${id}`).isVisible())
              bad(
                "control-pop",
                `${width}: #${id} shows before the button opens the popover`,
              );

          // Keyboard: Enter opens and moves focus to the theme switch, Tab reaches the mute
          // button, the fader then the Aura switch, an arrow key moves a notch, Escape closes and
          // focus returns to the button.
          await button.focus();
          await page.keyboard.press("Enter");
          await page.waitForTimeout(150);
          if ((await button.getAttribute("aria-expanded")) !== "true")
            bad(
              "control-keys",
              `${width}: Enter on the button did not open the popover`,
            );
          const first = await page.evaluate(() => document.activeElement?.id);
          if (first !== "gmt-theme-dark")
            bad(
              "control-keys",
              `${width}: focus went to "${first}", not the theme switch`,
            );
          await page.keyboard.press("Tab");
          const onMute = await page.evaluate(() => document.activeElement?.id);
          if (onMute !== "gmt-sound-mute")
            bad(
              "control-keys",
              `${width}: Tab from the theme switch reached "${onMute}", not the mute button`,
            );
          await page.keyboard.press("Tab");
          const onFader = await page.evaluate(() => document.activeElement?.id);
          if (onFader !== "gmt-sound-fader")
            bad(
              "control-keys",
              `${width}: Tab from the mute button reached "${onFader}", not the fader`,
            );
          const before = await page.locator("#gmt-sound-fader").inputValue();
          await page.keyboard.press("ArrowRight");
          const after = await page.locator("#gmt-sound-fader").inputValue();
          if (Number(after) !== Number(before) + 1)
            bad(
              "control-keys",
              `${width}: ArrowRight moved the fader ${before} to ${after}`,
            );
          // The aura plays on the landing only, so only the landing's panel holds its switch and
          // track. Elsewhere the fader is the panel's last stop, and Tab would leave it.
          const landing = path === "/";
          const auraShown = await page
            .getByRole("switch", { name: "Aura" })
            .isVisible();
          const trackShown = await page
            .getByRole("group", { name: "Aura track" })
            .isVisible();
          if (auraShown !== landing || trackShown !== landing)
            bad(
              "control-keys",
              `${width}: the Aura switch ${auraShown ? "shows" : "hides"} and its track ${trackShown ? "shows" : "hides"}, wanted both ${landing ? "shown on the landing" : "hidden off the landing"}`,
            );
          if (landing) {
            await page.keyboard.press("Tab");
            const onAura = await page.evaluate(
              () => document.activeElement?.id,
            );
            if (onAura !== "gmt-sound-aura")
              bad(
                "control-keys",
                `${width}: Tab from the fader reached "${onAura}", not the switch`,
              );
          }
          await page.keyboard.press("Escape");
          await page.waitForTimeout(150);
          const back = await page.evaluate(() => document.activeElement?.id);
          if (back !== "gmt-settings-button")
            bad(
              "control-keys",
              `${width}: Escape did not return focus to the button`,
            );
          if ((await button.getAttribute("aria-expanded")) !== "false")
            bad(
              "control-keys",
              `${width}: the button still reads expanded after Escape`,
            );

          // Open: inside the viewport, under the button. The panel slides and fades in; its boxes
          // are read once that has finished.
          await button.click();
          await settled(page, "#gmt-settings-pop");
          const rest = await page.evaluate(readBoxes);
          const [px, , pw] = rest.pop ?? [];
          if (!rest.pop || px < -0.5 || px + pw > width + 0.5)
            bad(
              "control-pop",
              `${width}: the popover is not inside the viewport (${JSON.stringify(rest.pop)})`,
            );
          else if (rest.pop[1] < rest.button[1] + rest.button[3] - 0.5)
            bad("control-pop", `${width}: the popover is not under the button`);

          // Hold still: sweep the fader, press mute, and compare every box.
          const track = await page.locator("#gmt-sound-fader").boundingBox();
          if (track) {
            const y = track.y + track.height / 2;
            await page.mouse.move(track.x + 4, y);
            await page.mouse.down();
            for (const f of [0.25, 0.5, 0.75, 1, 0.75, 0.5, 0.25, 0]) {
              await page.mouse.move(track.x + 4 + (track.width - 8) * f, y, {
                steps: 4,
              });
              if (!sameBoxes(rest, await page.evaluate(readBoxes)))
                bad(
                  "control-still",
                  `${width}: a box moved while the fader was dragged`,
                );
            }
            await page.mouse.up();
          }
          await page.locator("#gmt-sound-mute").click();
          await page.waitForTimeout(100);
          if (!sameBoxes(rest, await page.evaluate(readBoxes)))
            bad(
              "control-still",
              `${width}: a box moved when the mute button toggled`,
            );
        },
      );
    }

    await scenario(
      browser,
      name,
      path,
      { scenario: "control mute" },
      async (page, bad) => {
        await load(page, path);
        await page.locator("#gmt-settings-button").click();
        await page.locator("#gmt-sound-mute").click();
        await page.reload({ waitUntil: "load" });
        // Before any script: `data-sound` is set, and the speaker's waves are not drawn.
        const pre = await page.evaluate(() => ({
          sound: document.documentElement.dataset.sound,
          waves: getComputedStyle(
            document.querySelector("#gmt-sound-mute [data-waves]"),
          ).display,
          slash: getComputedStyle(
            document.querySelector("#gmt-sound-mute [data-slash]"),
          ).display,
        }));
        if (pre.sound !== "off" || pre.waves !== "none" || pre.slash === "none")
          bad(
            "control-mute",
            `after reload data-sound is "${pre.sound}", waves ${pre.waves}, slash ${pre.slash}`,
          );
        await page.waitForTimeout(800);
        if ((await page.evaluate(readLog)).constructed !== 0)
          bad("control-mute", "a muted reload made an audio context");
      },
    );

    await scenario(
      browser,
      name,
      path,
      { scenario: "control first visit", sound: "default" },
      async (page, bad) => {
        await load(page, path);
        await page.locator("#gmt-settings-button").click();
        const pressed = await page
          .locator("#gmt-sound-mute")
          .getAttribute("aria-pressed");
        if (pressed !== "true")
          bad(
            "control-first-visit",
            `first visit: aria-pressed is "${pressed}", not "true"`,
          );
        await page.locator("#gmt-sound-mute").click();
        const log = await settle(page, (l) => l.voices >= 1);
        if (log.voices < 1)
          bad(
            "control-first-visit",
            "turning sound on with the mute button started no voice",
          );
        if (
          (await page
            .locator("#gmt-sound-mute")
            .getAttribute("aria-pressed")) !== "false"
        )
          bad(
            "control-first-visit",
            "the mute button still reads pressed after turning sound on",
          );
      },
    );
  }

  // Slice 3: the chrome cues, on fixed pages, once per browser.
  const expectCue = (bad, what, got, want) => {
    if (got !== SHAPES[want])
      bad(
        "chrome-cue",
        `${what}: heard shape "${got}", wanted ${want} "${SHAPES[want]}"`,
      );
  };
  await scenario(
    browser,
    name,
    GUIDE,
    { scenario: "chrome menu", viewport: { width: 390, height: 844 } },
    async (page, bad) => {
      await load(page, GUIDE);
      if (!(await press(page, PRESSABLE)))
        return bad("no-target", "chrome: no pressable button to unlock with");
      await page.waitForTimeout(500);
      const menu = page.locator("starlight-menu-button button");
      expectCue(
        bad,
        "menu button opens",
        await cueOf(page, () => menu.click()),
        "open",
      );
      expectCue(
        bad,
        "menu button closes",
        await cueOf(page, () => menu.click()),
        "close",
      );
      expectCue(
        bad,
        "menu opens again",
        await cueOf(page, () => menu.click()),
        "open",
      );
      expectCue(
        bad,
        "Escape closes the menu",
        await cueOf(page, () => page.keyboard.press("Escape")),
        "close",
      );
      // The settings popover: its gear plays the links' press ping and the panel its opening
      // Felt slide; Escape closing it plays the closing slide.
      const settingsButton = page.locator("#gmt-settings-button");
      expectCue(
        bad,
        "the settings button opens the popover",
        await pingOf(page, () => settingsButton.click()),
        "pingOpen",
      );
      expectCue(
        bad,
        "Escape closes the popover",
        await cueOf(page, () => page.keyboard.press("Escape")),
        "close",
      );
    },
  );
  await scenario(
    browser,
    name,
    GUIDE,
    {
      scenario: "chrome theme and code copy",
      permissions: ["clipboard-read", "clipboard-write"],
    },
    async (page, bad) => {
      await load(page, GUIDE);
      if (!(await press(page, PRESSABLE)))
        return bad("no-target", "chrome: no pressable button to unlock with");
      await page.waitForTimeout(500);
      await page.locator("#gmt-settings-button").click();
      await page.waitForTimeout(500);
      expectCue(
        bad,
        "the theme switch",
        await cueOf(page, () =>
          page.getByRole("switch", { name: "Dark theme" }).click(),
        ),
        "toggle",
      );
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
      const block = page.locator(".expressive-code").first();
      if ((await block.count()) === 0)
        return bad("no-target", "chrome: no code block on the guide");
      await block.hover();
      expectCue(
        bad,
        "a code block's copy",
        await cueOf(page, () => block.locator(".copy button").click()),
        "copy",
      );
    },
  );
  await scenario(
    browser,
    name,
    COPY_PAGE,
    {
      scenario: "chrome copy",
      permissions: ["clipboard-read", "clipboard-write"],
    },
    async (page, bad) => {
      await load(page, COPY_PAGE);
      if (!(await press(page, PRESSABLE)))
        return bad("no-target", "chrome: no pressable button to unlock with");
      await page.waitForTimeout(500);
      const copy = page.locator("gmt-copy button:visible").first();
      if ((await copy.count()) === 0)
        return bad("no-target", "chrome: no copy button on the page");
      expectCue(
        bad,
        "a copy button",
        await cueOf(page, () => copy.click()),
        "copy",
      );
    },
  );

  // The sidebar's arrival cue needs audio at load after an in-site link, with no flag.
  if (name === "chromium") {
    await scenario(
      browser,
      name,
      "/",
      { scenario: "sidebar arrival" },
      async (page, bad) => {
        const home = `${new URL(base).pathname}/`;
        // The cue is the first Felt slide; the landing's sparkles and shings are its entrance.
        const cluster = async () => {
          await page.waitForTimeout(1500);
          const slides = await page.evaluate(() =>
            window.__sound.slides.slice(),
          );
          return slidesOf(slides)[0] ?? "none";
        };
        await load(page, "/");
        const guide = page.locator(".gmt-hero-actions a:visible").first();
        if ((await guide.count()) === 0)
          return bad("no-target", "sidebar: no visible hero link on /");
        await guide.click();
        await page.waitForURL((url) => url.href !== `${base}/`);
        const log = await settle(page, (l) => l.states.includes("running"));
        if (!log.states.includes("running"))
          bad(
            "sidebar",
            `the guide's context did not run at load (states: ${log.states.join(",") || "none"})`,
          );
        expectCue(bad, "a guide after the landing", await cluster(), "open");
        await page.evaluate(() => window.__sound.slides.splice(0));
        await page.locator(`a[href="${home}"]`).first().click();
        await page.waitForURL(`${base}/`);
        expectCue(bad, "the landing after a guide", await cluster(), "close");
      },
    );
  }

  // A link to another page in this tab waits for its ping, then goes.
  await scenario(
    browser,
    name,
    GUIDE,
    { scenario: "link hold" },
    async (page, bad) => {
      await load(page, GUIDE);
      if (!(await press(page, PRESSABLE)))
        return bad(
          "no-target",
          "link hold: no pressable button to unlock with",
        );
      await page.waitForTimeout(500);
      const from = page.url();
      const link = page.locator(NAVIGATING).first();
      if ((await link.count()) === 0)
        return bad("no-target", "link hold: no link to another page");
      // Read, after the dispatch, whether the press was held.
      await page.evaluate(() =>
        window.addEventListener(
          "click",
          (event) =>
            setTimeout(() => {
              window.__held = event.defaultPrevented;
            }),
          true,
        ),
      );
      const before = (await page.evaluate(readLog)).voices;
      const pitchesBefore = await page.evaluate(
        () => window.__sound.pitches.length,
      );
      await link.click({ timeout: 5000 });
      await page.waitForTimeout(200);
      const held = await page.evaluate(
        (n) => ({
          held: window.__held,
          voices: new Set(window.__sound.starts).size,
          pitches: window.__sound.pitches.slice(n),
          url: location.href,
        }),
        pitchesBefore,
      );
      // A link plays the press ping.
      if (held.pitches.length && Math.min(...held.pitches) !== PING_HZ)
        bad(
          "link-hold",
          `the press on a link played ${Math.min(...held.pitches)} Hz, wanted the ping's ${PING_HZ} Hz`,
        );
      if (held.held !== true)
        bad("link-hold", "the press on a link to another page was not held");
      if (held.url !== from)
        bad("link-hold", "the page changed before the ping had played");
      if (held.voices !== before + 1)
        bad(
          "link-hold",
          `the press started ${held.voices - before} voice(s), not 1`,
        );
      await page
        .waitForURL((url) => url.href !== from, { timeout: 3000 })
        .catch(() => bad("link-hold", "the held link never went to its page"));
    },
  );

  // The landing's aura (slice 4), Chromium: the fade, the hidden page, the switch and the load.
  if (name === "chromium") {
    /** Runs in the page: the aura's logged starts and its bus ramps (0.25 in, 0 over 0.6 s out). */
    const readAura = () => ({
      starts: window.__sound.aura.length,
      sources: window.__sound.aura.filter((t) => t === 0).length,
      ins: window.__sound.ramps.filter(([v]) => v === 0.25).map(([, d]) => d),
      outs: window.__sound.ramps
        .filter(([v, d]) => v === 0 && d === 0.6)
        .map(([, d]) => d),
    });
    const hide = (page, hidden) =>
      page.evaluate((h) => {
        Object.defineProperty(document, "visibilityState", {
          value: h ? "hidden" : "visible",
          configurable: true,
        });
        document.dispatchEvent(new Event("visibilitychange"));
      }, hidden);

    await scenario(
      browser,
      name,
      "/",
      { scenario: "aura" },
      async (page, bad) => {
        await load(page, "/");
        const before = await page.evaluate(readAura);
        if (before.starts !== 0)
          bad("aura", `${before.starts} aura source(s) before any gesture`);
        if (!(await press(page, PRESSABLE)))
          return bad("no-target", "aura: no pressable button to unlock with");
        await page.waitForTimeout(800);
        const on = await page.evaluate(readAura);
        if (on.sources !== 7)
          bad(
            "aura",
            `${on.sources} held source(s) after the gesture, wanted 7`,
          );
        if (on.ins.length !== 1 || on.ins[0] !== 3)
          bad("aura", `fade in ${JSON.stringify(on.ins)}, wanted one of 3 s`);
        // Hidden: it fades out and schedules nothing for 2 s; visible: it returns over 1.5 s.
        await hide(page, true);
        await page.waitForTimeout(300);
        const hid = await page.evaluate(readAura);
        await page.waitForTimeout(2000);
        const still = await page.evaluate(readAura);
        if (hid.outs.length !== 1)
          bad(
            "aura",
            `hiding made ${hid.outs.length} fade(s) out of 0.6 s, wanted 1`,
          );
        if (still.starts !== hid.starts)
          bad(
            "aura",
            `${still.starts - hid.starts} source(s) started while hidden`,
          );
        await hide(page, false);
        await page.waitForTimeout(800);
        const back = await page.evaluate(readAura);
        if (!back.ins.includes(1.5))
          bad(
            "aura",
            `showing again made fades ${JSON.stringify(back.ins)}, wanted one of 1.5 s`,
          );
      },
    );

    for (const [label, width] of [
      ["inline", 1440],
      ["popover", 390],
    ]) {
      await scenario(
        browser,
        name,
        "/",
        { scenario: `aura switch ${label}`, viewport: { width, height: 900 } },
        async (page, bad) => {
          await load(page, "/");
          if (!(await press(page, PRESSABLE)))
            return bad("no-target", "aura switch: no pressable button");
          await page.waitForTimeout(800);
          const toggle = page.getByRole("switch", { name: "Aura" });
          if (!(await toggle.isVisible())) {
            await page.locator("#gmt-settings-button").click();
            await page.waitForTimeout(300);
          }
          const trackGroup = page.getByRole("group", { name: "Aura track" });
          await toggle.uncheck();
          await page.waitForTimeout(500);
          if (await trackGroup.isVisible())
            bad("aura", `${label}: the track still shows with the Aura off`);
          const off = await page.evaluate(readAura);
          if (off.outs.length !== 1)
            bad(
              "aura",
              `${label}: switching off made ${off.outs.length} fade(s) out, wanted 1`,
            );
          await page.reload({ waitUntil: "load" });
          await page.waitForTimeout(1000);
          const stored = await page.evaluate(
            (key) => JSON.parse(localStorage.getItem(key) ?? "{}").aura,
            SOUND_KEY,
          );
          if (stored !== false)
            bad(
              "aura",
              `${label}: dox:sound holds aura ${stored} after a reload, wanted false`,
            );
          await page.reload({ waitUntil: "load" });
          await page.waitForTimeout(1000);
          if (!(await press(page, PRESSABLE)))
            return bad("no-target", "aura switch: no pressable button");
          await page.waitForTimeout(800);
          if ((await page.evaluate(readAura)).starts !== 0)
            bad("aura", `${label}: the aura started with its switch off`);
          if (!(await toggle.isVisible())) {
            await page.locator("#gmt-settings-button").click();
            await page.waitForTimeout(300);
          }
          await toggle.check();
          await page.waitForTimeout(800);
          if (!(await trackGroup.isVisible()))
            bad("aura", `${label}: the track did not show with the Aura on`);
          const back = await page.evaluate(readAura);
          if (!back.ins.includes(1.5))
            bad(
              "aura",
              `${label}: switching on made fades ${JSON.stringify(back.ins)}, wanted one of 1.5 s`,
            );
        },
      );
    }

    // The aura's track: Deep drone crossfades in, and is what plays after a reload.
    await scenario(
      browser,
      name,
      "/",
      { scenario: "aura track" },
      async (page, bad) => {
        await load(page, "/");
        if (!(await press(page, PRESSABLE)))
          return bad("no-target", "aura track: no pressable button");
        await page.waitForTimeout(800);
        const ice = await page.evaluate(readAura);
        const fadesIn = () =>
          page.evaluate(
            () =>
              window.__sound.ramps.filter(([v, d]) => v === 1 && d === 1.5)
                .length,
          );
        const crossBefore = await fadesIn();
        await page.locator("#gmt-settings-button").click();
        await page.waitForTimeout(300);
        await page.getByRole("radio", { name: "Deep drone" }).check();
        await page.waitForTimeout(800);
        const deep = await page.evaluate(readAura);
        if ((await fadesIn()) - crossBefore !== 1)
          bad("aura", "picking Deep drone made no 1.5 s fade in of its track");
        if (deep.ins.length !== ice.ins.length || deep.outs.length !== 0)
          bad(
            "aura",
            `picking Deep drone moved the bus: fades in ${JSON.stringify(deep.ins)}, out ${JSON.stringify(deep.outs)}`,
          );
        if (deep.starts <= ice.starts)
          bad("aura", "picking Deep drone started no source");
        await page.reload({ waitUntil: "load" });
        await page.waitForTimeout(1000);
        const stored = await page.evaluate(
          (key) => JSON.parse(localStorage.getItem(key) ?? "{}").track,
          SOUND_KEY,
        );
        if (stored !== "deep")
          bad(
            "aura",
            `dox:sound holds track ${stored} after a reload, wanted deep`,
          );
        if (!(await press(page, PRESSABLE)))
          return bad("no-target", "aura track: no pressable button");
        await page.waitForTimeout(800);
        const next = await page.evaluate(readAura);
        if (next.starts === 0 || next.sources !== 0)
          bad(
            "aura",
            `after a reload the aura started ${next.starts} source(s), ${next.sources} held from 0: not Deep drone`,
          );
      },
    );

    // A page that is not the landing never requests the aura module.
    await scenario(
      browser,
      name,
      GUIDE,
      { scenario: "aura not loaded" },
      async (page, bad) => {
        const requested = [];
        page.on("request", (r) => {
          if (/aura/.test(r.url())) requested.push(r.url());
        });
        await load(page, GUIDE);
        if (!(await press(page, PRESSABLE)))
          return bad("no-target", "aura: no pressable button");
        await page.waitForTimeout(800);
        if (requested.length)
          bad("aura", `the guide requested ${requested.join(", ")}`);
      },
    );
  }

  // The entrance needs autoplay allowed before any gesture: Chromium with the flag.
  if (name === "chromium") {
    const allowed = await launchBrowser(name, {
      args: ["--autoplay-policy=no-user-gesture-required"],
    });
    for (const reduced of [false, true]) {
      await scenario(
        allowed,
        name,
        "/",
        {
          scenario: reduced ? "entrance reduced" : "entrance",
          ...(reduced ? { reducedMotion: "reduce" } : {}),
        },
        async (page, bad) => {
          // At t0 the sequencer sets data-entrance="run"; read the computed delays then, because
          // the rules are keyed on it and stop matching once the entrance is done. Chromium has
          // no `getAutoplayPolicy`, which the page reads as allowed after a same-origin arrival.
          await page.addInitScript(() => {
            const painted = [
              ".header .gmt-app-title",
              ".header site-search button[data-open-modal]",
              ".header .gmt-ask-dox-link",
              ".gmt-hero-actions .sl-link-button",
              ".gmt-hero-pager",
            ].join(",");
            const glinted = [
              ".header .gmt-ask-dox-link",
              ".header .gmt-settings-toggle",
              '.header .social-icons > a[rel~="me"]',
              ".gmt-hero-actions .sl-link-button",
            ].join(",");
            const seconds = (v) =>
              v.trim().endsWith("ms") ? parseFloat(v) / 1000 : parseFloat(v);
            /** The delay of the first animation, or nothing where none runs. */
            const first = (cs) =>
              cs.animationName.split(",")[0].trim() === "none"
                ? []
                : [seconds(cs.animationDelay.split(",")[0])];
            const read = () => {
              if (
                document.documentElement.dataset.entrance !== "run" ||
                window.__delays
              )
                return;
              window.__delays = {
                paint: [...document.querySelectorAll(painted)].flatMap((el) =>
                  first(getComputedStyle(el)),
                ),
                glint: [...document.querySelectorAll(glinted)].flatMap((el) =>
                  first(getComputedStyle(el, "::before")),
                ),
              };
            };
            new MutationObserver(read).observe(document, {
              attributes: true,
              subtree: true,
              attributeFilter: ["data-entrance"],
            });
          });
          // An arrival from northguild.dev, which shares the origin: its link to the landing.
          await page.route(`${SITE_ORIGIN}/`, (route) =>
            route.fulfill({
              status: 200,
              contentType: "text/html; charset=utf-8",
              body: NG_LANDING,
            }),
          );
          await page.goto(`${SITE_ORIGIN}/`, { waitUntil: "load" });
          await page.locator(".ng-home").click();
          await page.waitForURL(`${base}/`);
          await page.waitForTimeout(5000);
          const combs = await page.evaluate(() => window.__sound.combs.slice());
          // A sparkle (Crystal dust) is two or three tones between 5200 and 8000 Hz, the first at
          // the cue's time; a shing sweeps a comb's delay to under 0.25 ms.
          const paints = (await page.evaluate(sparkles)).sort((a, b) => a - b);
          const glints = combs
            .filter(([to]) => to < 0.00025)
            .sort((a, b) => a[1] - b[1]);
          if (reduced) {
            if (paints.length + glints.length !== 0)
              bad(
                "entrance",
                `reduced motion: ${paints.length} sparkle tone(s) and ${glints.length} shing(s), wanted none`,
              );
            return;
          }
          const delays = await page.evaluate(() => window.__delays);
          if (!delays || delays.paint.length === 0)
            return bad("entrance", "no animated piece was read at t0");
          if (paints.length === 0) return bad("entrance", "no sparkle started");
          const origin = paints[0] - Math.min(...delays.paint);
          /** Every expected offset, one sound within 40 ms of it. */
          const match = (label, want, got) => {
            for (const d of new Set(want.map((d) => d.toFixed(2)))) {
              if (!got.some((t) => Math.abs(t - origin - Number(d)) < 0.04))
                bad(
                  "entrance",
                  `no ${label} within 40 ms of ${d} s (heard at ${got.map((t) => (t - origin).toFixed(3)).join(", ")})`,
                );
            }
          };
          match("sparkle", delays.paint, paints);
          match(
            "shing",
            delays.glint,
            glints.map(([, at]) => at),
          );
          glints.forEach(([to], i) => {
            if (i > 0 && !(to < glints[i - 1][0]))
              bad("entrance", `shing ${i} is not higher than the one before`);
          });
        },
      );
    }

    // Back on the landing from another page of the site: shown as it is, silent.
    await scenario(
      allowed,
      name,
      "/",
      { scenario: "entrance in-site" },
      async (page, bad) => {
        await load(page, GUIDE);
        // The guide's sidebar flag is reset so this arrival is not also the sidebar's `close`.
        await page.evaluate(() => sessionStorage.setItem("dox:sidebar", "0"));
        await page
          .locator(`a[href="${new URL(base).pathname}/"]`)
          .first()
          .click();
        await page.waitForURL(`${base}/`);
        const animated = await page.evaluate(() =>
          document
            .getAnimations()
            .filter(
              (a) =>
                a.effect?.target instanceof Element &&
                a.effect.target.closest(".gmt-hero-actions"),
            )
            .map((a) => a.animationName ?? "?"),
        );
        await page.waitForTimeout(4000);
        const state = await page.evaluate(() => ({
          entrance: document.documentElement.dataset.entrance,
          combs: window.__sound.combs.filter(([to]) => to < 0.00025).length,
        }));
        state.combs += (await page.evaluate(sparkles)).length;
        if (state.entrance !== "static")
          bad(
            "entrance",
            `in-site arrival left the landing "${state.entrance}", wanted static`,
          );
        if (animated.length)
          bad(
            "entrance",
            `in-site arrival animated the buttons: ${animated.join(", ")}`,
          );
        if (state.combs)
          bad(
            "entrance",
            `in-site arrival played ${state.combs} sparkle tone(s) or shing(s), wanted none`,
          );
      },
    );
    await allowed.close();
  }

  // Slice 5: the chat's cues on /dox, Chromium, with the Worker stubbed (never the live API).
  if (name === "chromium") {
    /** Runs in the page before its scripts: `/api/chat` answers from a script, `/api/brains` is unreachable. */
    const stubWorker = (mode) => {
      window.__chatMode = mode;
      const real = window.fetch;
      window.fetch = (input, init) => {
        const url = String(input?.url ?? input);
        if (url.includes("/api/brains"))
          return Promise.resolve(new Response("{}", { status: 503 }));
        if (!url.includes("/api/chat")) return real.call(window, input, init);
        if (window.__chatMode === "tool") {
          const enc = new TextEncoder();
          const put = (o) => `data: ${JSON.stringify(o)}\n\n`;
          return Promise.resolve(
            new Response(
              enc.encode(
                put({ type: "start" }) +
                  put({
                    type: "tool-input-available",
                    toolCallId: "call-1",
                    toolName: "showDstInspector",
                    input: { zone: "Europe/Amsterdam", year: 2025 },
                  }) +
                  put({ type: "finish" }) +
                  "data: [DONE]\n\n",
              ),
              {
                status: 200,
                headers: {
                  "content-type": "text/event-stream",
                  "x-vercel-ai-ui-message-stream": "v1",
                },
              },
            ),
          );
        }
        if (window.__chatMode === "fail")
          return Promise.resolve(
            new Response(JSON.stringify({ error: "Stubbed failure." }), {
              status: 500,
              headers: { "content-type": "application/json" },
            }),
          );
        const enc = new TextEncoder();
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        const body = new ReadableStream({
          async start(c) {
            const put = (o) =>
              c.enqueue(enc.encode(`data: ${JSON.stringify(o)}\n\n`));
            put({ type: "start" });
            await wait(700);
            put({ type: "text-start", id: "t" });
            for (let i = 0; i < 12; i++) {
              put({ type: "text-delta", id: "t", delta: `word${i} ` });
              await wait(40);
            }
            put({ type: "text-end", id: "t" });
            put({ type: "finish" });
            c.enqueue(enc.encode("data: [DONE]\n\n"));
            c.close();
          },
        });
        return Promise.resolve(
          new Response(body, {
            status: 200,
            headers: {
              "content-type": "text/event-stream",
              "x-vercel-ai-ui-message-stream": "v1",
            },
          }),
        );
      };
    };
    /** Runs in the page: the thinking loop's bus ramps (in 0.3 s to 1, out 0.15 s to 0). */
    const readHum = () => ({
      ins: window.__sound.ramps.filter(([v, d]) => v === 1 && d === 0.3).length,
      outs: window.__sound.ramps.filter(([v, d]) => v === 0 && d === 0.15)
        .length,
    });
    /** Start times grouped as voices: starts within 1 ms are one cluster. */
    const clustersOf = (starts) => {
      const out = [];
      for (const t of starts.filter((s) => s > 0).sort((a, b) => a - b)) {
        const last = out.at(-1);
        if (last && t - last.at < 0.001) last.size += 1;
        else out.push({ at: t, size: 1 });
      }
      return out;
    };
    /**
     * The Low double buzzes heard: a cluster followed next by a lone note 0.11 s later. The first
     * note can land in the same audio block as another voice (the blip of the key that caused it),
     * so its cluster may hold more than one start.
     */
    const buzzes = (heard) =>
      heard.filter(
        (c, i) =>
          heard[i + 1]?.size === 1 &&
          Math.abs(heard[i + 1].at - c.at - 0.11) < 0.003,
      ).length;
    /** Every oscillator start in the clusters: what was heard, however it overlapped. */
    const notes = (heard) => heard.reduce((n, c) => n + c.size, 0);
    const arm = async (page, mode) => {
      await page.addInitScript(stubWorker, mode);
      await load(page, "/dox/");
      const box = page.getByRole("textbox").first();
      await box.click(); // the gesture that unlocks audio
      await page.waitForTimeout(500);
      await page.evaluate(() => window.__sound.starts.splice(0));
      return box;
    };

    await scenario(
      browser,
      name,
      "/dox/",
      { scenario: "chat cues" },
      async (page, bad) => {
        const box = await arm(page, "answer");
        await page.keyboard.type("hi", { delay: 90 });
        await page.waitForTimeout(300);
        let heard = clustersOf(await page.evaluate(readStarts));
        if (heard.length !== 2 || heard.some((c) => c.size !== 1))
          bad(
            "chat-cue",
            `typing two keys played ${JSON.stringify(heard)}, wanted two Data blips of one oscillator`,
          );
        // An input method mid-composition: its keydown carries isComposing. Headless has no IME.
        await page.evaluate(() => window.__sound.starts.splice(0));
        await box.evaluate((el) => {
          el.dispatchEvent(new CompositionEvent("compositionstart"));
          el.dispatchEvent(
            new KeyboardEvent("keydown", {
              key: "a",
              isComposing: true,
              bubbles: true,
            }),
          );
          el.dispatchEvent(new CompositionEvent("compositionend"));
        });
        await page.waitForTimeout(300);
        if ((await page.evaluate(readStarts)).length !== 0)
          bad("chat-cue", "IME composition played a Data blip");

        await page.evaluate(() => window.__sound.starts.splice(0));
        await page.keyboard.press("Enter");
        await page.waitForTimeout(400); // inside the stub's wait for the first chunk
        const waiting = await page.evaluate(readHum);
        if (waiting.ins !== 1 || waiting.outs !== 0)
          bad(
            "chat-cue",
            `while Dox waits the Sonar idle swelled ${waiting.ins}x and dimmed ${waiting.outs}x, wanted 1 and 0`,
          );
        await page.waitForTimeout(2200); // the answer streams and ends
        const hum = await page.evaluate(readHum);
        if (hum.ins !== 1 || hum.outs !== 1)
          bad(
            "chat-cue",
            `across the answer the Sonar idle swelled ${hum.ins}x and dimmed ${hum.outs}x, wanted 1 and 1`,
          );
        // The idle pings, 1.6 s apart, are read apart from the cues they run under.
        const pings = await page.evaluate(readPitch, [IDLE_HZ, false]);
        if (pings.length === 0)
          bad("chat-cue", "the Sonar idle played no ping while Dox waited");
        const starts = await page.evaluate(readPitch, [IDLE_HZ, true]);
        heard = clustersOf(starts);
        // Enter is the last key (1 oscillator) and the Sonar launch (2), at one instant when the
        // send lands in the same audio block as the key's blip. The send is a later task: on a
        // busy machine the clock can step past the engine's 5 ms lead between them, so a blip and
        // a launch within 11 ms (four 128-frame blocks at 48 kHz) are read as the one send.
        if (
          heard[0]?.size === 1 &&
          heard[1]?.size === 2 &&
          heard[1].at - heard[0].at < 0.011
        )
          heard.splice(0, 2, { at: heard[0].at, size: 3 });
        // The Ice bell is 5 partials; every other cluster is one Morse beep.
        if (heard[0]?.size !== 3)
          bad(
            "chat-cue",
            `the sent question played ${heard[0]?.size ?? 0} oscillators at once, wanted 3 (Enter's blip and the Sonar launch; clusters ${JSON.stringify(heard.slice(0, 4))})`,
          );
        const bells = heard.filter((c) => c.size === 5).length;
        if (bells !== 1) bad("chat-cue", `Ice bell played ${bells}x, wanted 1`);
        const beeps = heard.slice(1).filter((c) => c.size === 1);
        if (beeps.length < 2)
          bad("chat-cue", `only ${beeps.length} Morse beep(s) for 12 chunks`);
        beeps.forEach((c, i) => {
          if (i > 0 && c.at - beeps[i - 1].at < 0.0595)
            bad(
              "chat-cue",
              `Morse beeps ${(c.at - beeps[i - 1].at).toFixed(3)} s apart on the audio clock, wanted 0.06 or more`,
            );
        });
      },
    );

    await scenario(
      browser,
      name,
      "/dox/",
      { scenario: "chat error" },
      async (page, bad) => {
        await arm(page, "fail");
        await page.keyboard.type("hi", { delay: 90 });
        await page.keyboard.press("Enter");
        await page.waitForTimeout(1500);
        const starts = await page.evaluate(readPitch, [IDLE_HZ, true]);
        const heard = clustersOf(starts);
        const pair = buzzes(heard);
        if (pair !== 1)
          bad(
            "chat-cue",
            `a 500 played ${pair} Low double buzz(es), wanted 1 (clusters ${JSON.stringify(heard)})`,
          );
        if (heard.some((c) => c.size === 5))
          bad("chat-cue", "a 500 rang the Ice bell");
      },
    );

    await scenario(
      browser,
      name,
      COPY_PAGE,
      { scenario: "chat copy failure" },
      async (page, bad) => {
        await page.addInitScript(() => {
          Object.defineProperty(navigator, "clipboard", {
            value: { writeText: () => Promise.reject(new Error("denied")) },
            configurable: true,
          });
        });
        await load(page, COPY_PAGE);
        if (!(await press(page, PRESSABLE)))
          return bad("no-target", "chat: no pressable button to unlock with");
        await page.waitForTimeout(500);
        const copy = page.locator("gmt-copy button:visible").first();
        if ((await copy.count()) === 0)
          return bad("no-target", "chat: no copy button on the page");
        const got = await cueOf(page, () => copy.click());
        if (got !== "0,0.11")
          bad(
            "chat-cue",
            `a failed copy made shape "${got}", wanted the Low double buzz "0,0.11"`,
          );
      },
    );

    // Slice 6: the tool cues. Chromium, one gesture to unlock, then the voices are read as clusters
    // of oscillator starts (Glass tick 2 at one time, Data blip 1, Low double buzz 1 + 1 at +0.11,
    // Lock-in 2 at one time and 1 at +0.05) and the Servo spin-up, three noise bursts, as its last
    // burst's filter ramp to 1950 Hz (1500 Hz, raised by 1.3).
    const sweeps = (page) =>
      page.evaluate(
        () =>
          window.__sound.exps.filter(([v]) => Math.abs(v - 1950) < 0.5).length,
      );
    const lockIns = (heard, starts) =>
      heard.filter(
        (c) =>
          c.size === 2 && starts.some((s) => Math.abs(s - c.at - 0.05) < 0.003),
      ).length;
    const unlock = async (page, path) => {
      await load(page, path);
      if (!(await press(page, PRESSABLE))) return false;
      await page.waitForTimeout(500);
      await page.evaluate(() => window.__sound.starts.splice(0));
      return true;
    };

    await scenario(
      browser,
      name,
      "/tools/dwell-ledger/",
      { scenario: "tool cues handle" },
      async (page, bad) => {
        if (!(await unlock(page, "/tools/dwell-ledger/")))
          return bad(
            "no-target",
            "tool cues: no pressable button to unlock with",
          );
        const handle = page.getByRole("slider").first();
        await handle.focus();
        await page.waitForTimeout(450);
        await page.evaluate(() => window.__sound.starts.splice(0));
        const got = await cueOf(page, () => page.keyboard.press("ArrowRight"));
        if (got !== "0,0")
          bad(
            "tool-cue",
            `one arrow key on a handle made shape "${got}", wanted one Glass tick "0,0"`,
          );
        await page.waitForTimeout(100);
        await page.evaluate(() => window.__sound.starts.splice(0));
        await page.keyboard.press("ArrowRight");
        await page.waitForTimeout(100);
        await page.keyboard.press("ArrowRight");
        await page.waitForTimeout(450);
        const ticks = clustersOf(await page.evaluate(readStarts));
        if (ticks.length !== 2 || ticks.some((c) => c.size !== 2))
          bad(
            "tool-cue",
            `two arrow keys played ${JSON.stringify(ticks)}, wanted two Glass ticks`,
          );
      },
    );

    await scenario(
      browser,
      name,
      "/tools/cutoff-countdown/",
      { scenario: "tool cues readout" },
      async (page, bad) => {
        if (!(await unlock(page, "/tools/cutoff-countdown/")))
          return bad(
            "no-target",
            "tool cues: no pressable button to unlock with",
          );
        const now = page.getByRole("textbox", { name: "Now" });
        await now.click();
        await now.press("ControlOrMeta+a");
        await page.waitForTimeout(450);
        await page.evaluate(() => window.__sound.starts.splice(0));
        await page.keyboard.type("x", { delay: 60 });
        await page.waitForTimeout(450);
        const first = clustersOf(await page.evaluate(readStarts));
        const state = () =>
          page.evaluate(
            () => document.querySelector("gmt-readout")?.dataset.state,
          );
        if ((await state()) !== "sentinel")
          return bad(
            "tool-cue",
            "an invalid time did not turn the readout to NO SIGNAL",
          );
        if (buzzes(first) !== 1)
          bad(
            "tool-cue",
            `the readout falling to NO SIGNAL played ${buzzes(first)} Low double buzz(es), wanted 1 (${JSON.stringify(first)})`,
          );
        // Counted as notes, not clusters: the blip and the buzz's first note can start together.
        if (notes(first) !== 3)
          bad(
            "tool-cue",
            `one typed key and the fall played ${notes(first)} notes, wanted a Data blip and the buzz's two (${JSON.stringify(first)})`,
          );
        await page.evaluate(() => window.__sound.starts.splice(0));
        await page.keyboard.type("y", { delay: 60 });
        await page.waitForTimeout(450);
        const again = clustersOf(await page.evaluate(readStarts));
        if (again.length !== 1 || buzzes(again) !== 0)
          bad(
            "tool-cue",
            `typing while the readout stayed at NO SIGNAL played ${JSON.stringify(again)}, wanted one Data blip`,
          );
      },
    );

    const PLAYGROUND = "/reference/recurrence/calculate/cronRuns/";
    await scenario(
      browser,
      name,
      PLAYGROUND,
      { scenario: "tool cues playground" },
      async (page, bad) => {
        if (!(await unlock(page, PLAYGROUND)))
          return bad(
            "no-target",
            "tool cues: no pressable button to unlock with",
          );
        const box = page.locator("input[type=text]:visible").first();
        if ((await box.count()) === 0)
          return bad("no-target", "tool cues: no text field in the playground");
        await box.click();
        await page.waitForTimeout(450);
        await page.evaluate(() => window.__sound.starts.splice(0));
        await page.keyboard.type("1", { delay: 60 });
        await page.waitForTimeout(300);
        if ((await page.evaluate(readStarts)).length < 1)
          bad("tool-cue", "typing in a playground field played no Data blip");
        await page.evaluate(() => window.__sound.starts.splice(0));
        await box.evaluate((el) => {
          el.dispatchEvent(new CompositionEvent("compositionstart"));
          el.dispatchEvent(
            new KeyboardEvent("keydown", {
              key: "a",
              isComposing: true,
              bubbles: true,
            }),
          );
          el.dispatchEvent(new CompositionEvent("compositionend"));
        });
        await page.waitForTimeout(300);
        if ((await page.evaluate(readStarts)).length !== 0)
          bad(
            "tool-cue",
            "IME composition in a playground field played a Data blip",
          );
      },
    );

    for (const held of [false, true]) {
      await scenario(
        browser,
        name,
        "/dox/",
        { scenario: held ? "tool cues loading" : "tool cues ready" },
        async (page, bad) => {
          await page.route("**/dst-inspector-mount.*.js", async (route) => {
            if (held) await new Promise((r) => setTimeout(r, 900));
            await route.continue();
          });
          await page.addInitScript(stubWorker, "tool");
          await load(page, "/dox/");
          const box = page.getByRole("textbox").first();
          await box.click();
          await page.waitForTimeout(500);
          await page.evaluate(() => window.__sound.starts.splice(0));
          await page.keyboard.type("hi", { delay: 60 });
          await page.keyboard.press("Enter");
          await page.waitForTimeout(held ? 2500 : 1800);
          const starts = await page.evaluate(readPitch, [IDLE_HZ, true]);
          const heard = clustersOf(starts);
          const locks = lockIns(heard, starts);
          const sweep = await sweeps(page);
          if (locks !== 1)
            bad(
              "tool-cue",
              `the opened widget played Lock-in ${locks}x, wanted 1 (${JSON.stringify(heard)})`,
            );
          const wanted = held ? 1 : 0;
          if (sweep !== wanted)
            bad(
              "tool-cue",
              `the Servo spin-up played ${sweep}x, wanted ${wanted}`,
            );
        },
      );
    }

    // The globe's Sonar lock: a zone chosen from the globe's list plays two pings 70 ms apart, each
    // with its echo, and nothing else, so the row is not also pinged as a press. A zone on the far
    // side of the Earth locks as the globe lands on it, so the wait covers the longest flight (3 s).
    await scenario(
      browser,
      name,
      "/tools/zoned-earth/",
      { scenario: "globe locate" },
      async (page, bad) => {
        if (!(await unlock(page, "/tools/zoned-earth/")))
          return bad(
            "no-target",
            "globe locate: no pressable button to unlock with",
          );
        // Zoned Earth shows its pinned zones beside the globe, with no drawer to open.
        const rows = page
          .getByRole("listbox", { name: /^Pinned zones/ })
          .getByRole("option");
        if ((await rows.count()) < 3)
          return bad("no-target", "globe locate: the zone list is empty");
        await page.evaluate(() => window.__sound.starts.splice(0));
        const got = await cueOf(page, () => rows.nth(2).click(), 3500);
        if (got !== "0,0,0.07,0.07")
          bad(
            "locate",
            `choosing a zone made shape "${got}", wanted one Sonar lock "0,0,0.07,0.07"`,
          );
      },
    );

    // Moving through a list ticks: on the landing's zone list each arrow key that moves the active
    // row plays one servo tick (a noise burst, no oscillator, its filter higher the further down
    // the list), and the reader's wheel plays servo ticks as rows pass.
    /** Runs in the page: the noise bursts, oscillator starts and filter ramp targets so far. */
    const readTicks = () => ({
      noises: window.__sound.noises.length,
      tones: window.__sound.starts.length,
      // A burst's filter ramp is in Hz; an envelope's gain ramps to 0.0001.
      filters: window.__sound.exps.filter(([v]) => v > 100).map(([v]) => v),
    });
    const clearTicks = () => {
      window.__sound.noises.splice(0);
      window.__sound.starts.splice(0);
      window.__sound.exps.splice(0);
    };
    const rising = (hz) => hz.every((f, i) => i === 0 || f > hz[i - 1]);
    await scenario(
      browser,
      name,
      "/",
      { scenario: "list ticks" },
      async (page, bad) => {
        if (!(await unlock(page, "/")))
          return bad(
            "no-target",
            "list ticks: no pressable button to unlock with",
          );
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.locator("[data-globe-search]").click();
        await page.waitForTimeout(600);
        const list = page.locator('[data-drawer] [role="listbox"]').last();
        if (!(await list.isVisible()))
          return bad("no-target", "list ticks: the zone list is not showing");
        await list.focus();
        await page.waitForTimeout(450);
        await page.evaluate(clearTicks);
        await page.keyboard.press("ArrowDown");
        await page.waitForTimeout(100);
        await page.keyboard.press("ArrowDown");
        await page.waitForTimeout(450);
        const keyed = await page.evaluate(readTicks);
        if (
          keyed.noises !== 2 ||
          keyed.tones !== 0 ||
          keyed.filters.length !== 2 ||
          !rising(keyed.filters)
        )
          bad(
            "list-tick",
            `two arrow keys in the zone list played ${JSON.stringify(keyed)}, wanted two servo ticks rising`,
          );
        await page.evaluate(clearTicks);
        const box = await list.boundingBox();
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        for (let i = 0; i < 4; i++) {
          await page.mouse.wheel(0, 120);
          await page.waitForTimeout(120);
        }
        await page.waitForTimeout(450);
        const wheeled = await page.evaluate(readTicks);
        if (
          wheeled.noises < 2 ||
          wheeled.tones !== 0 ||
          wheeled.filters.length !== wheeled.noises ||
          !rising(wheeled.filters)
        )
          bad(
            "list-tick",
            `wheeling the zone list played ${JSON.stringify(wheeled)}, wanted servo ticks rising as rows pass`,
          );
      },
    );

    // Typing plays a Data blip in every text field, a text area included; Enter in a one-line
    // field plays nothing.
    await scenario(
      browser,
      name,
      "/tools/gtfs-trip-board/",
      { scenario: "typing everywhere" },
      async (page, bad) => {
        if (!(await unlock(page, "/tools/gtfs-trip-board/")))
          return bad("no-target", "typing: no pressable button to unlock with");
        const area = page.locator("textarea:visible").first();
        if ((await area.count()) === 0)
          return bad("no-target", "typing: no text area on the trip board");
        await area.click();
        await page.keyboard.press("End");
        await page.waitForTimeout(450);
        await page.evaluate(() => window.__sound.starts.splice(0));
        await page.keyboard.type("ab", { delay: 150 });
        await page.waitForTimeout(450);
        const typed = clustersOf(await page.evaluate(readStarts));
        if (typed.length !== 2 || typed.some((c) => c.size !== 1))
          bad(
            "typing",
            `two keys typed in the trip board's text area played ${JSON.stringify(typed)}, wanted two Data blips`,
          );
      },
    );
    await scenario(
      browser,
      name,
      "/tools/cutoff-countdown/",
      { scenario: "typing enter" },
      async (page, bad) => {
        if (!(await unlock(page, "/tools/cutoff-countdown/")))
          return bad("no-target", "typing: no pressable button to unlock with");
        const now = page.getByRole("textbox", { name: "Now" });
        await now.focus();
        await page.waitForTimeout(450);
        await page.evaluate(() => window.__sound.starts.splice(0));
        await page.keyboard.press("Enter");
        await page.waitForTimeout(450);
        const starts = await page.evaluate(readStarts);
        if (starts.length !== 0)
          bad(
            "typing",
            `Enter in a one-line field started ${starts.length} oscillator(s), wanted none`,
          );
      },
    );

    /** Do `act` and return the noise bursts and oscillator starts it made. */
    const burstsOf = async (page, act, waitMs = 450) => {
      const [noises, starts] = await page.evaluate(() => [
        window.__sound.noises.length,
        window.__sound.starts.length,
      ]);
      await act();
      await page.waitForTimeout(waitMs);
      return page.evaluate(
        ([n, s]) => ({
          noises: window.__sound.noises.slice(n),
          starts: window.__sound.starts.slice(s),
        }),
        [noises, starts],
      );
    };

    // The globe's zoom plays one Lens servo step (a noise burst, no oscillator) per wheel notch,
    // key or button press, at most one every 60 ms through a trackpad's stream, and its buttons
    // play the servo instead of the press ping.
    await scenario(
      browser,
      name,
      "/tools/zoned-earth/",
      { scenario: "globe zoom" },
      async (page, bad) => {
        if (!(await unlock(page, "/tools/zoned-earth/")))
          return bad(
            "no-target",
            "globe zoom: no pressable button to unlock with",
          );
        const canvas = page.locator('[data-gate="globe-stage"] canvas').first();
        if ((await canvas.count()) === 0)
          return bad("no-target", "globe zoom: no globe on the page");
        await canvas.scrollIntoViewIfNeeded();
        const box = await canvas.boundingBox();
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.waitForTimeout(450);
        const notch = await burstsOf(page, () => page.mouse.wheel(0, -100));
        if (notch.noises.length !== 1 || notch.starts.length !== 0)
          bad(
            "zoom",
            `one wheel notch made ${notch.noises.length} burst(s) and ${notch.starts.length} oscillator(s), wanted one Lens servo step`,
          );
        const stream = await burstsOf(page, async () => {
          for (let i = 0; i < 20; i++) {
            await page.mouse.wheel(0, -8);
            await page.waitForTimeout(10);
          }
        });
        const gaps = stream.noises.slice(1).map((t, i) => t - stream.noises[i]);
        if (stream.noises.length < 2 || Math.min(...gaps) < 0.059)
          bad(
            "zoom",
            `a trackpad stream made ${stream.noises.length} step(s), closest ${Math.min(...gaps).toFixed(3)} s apart, wanted steps 60 ms or more apart`,
          );
        const out = page.getByRole("button", { name: "Zoom out" });
        await out.hover();
        await page.waitForTimeout(300);
        const pressed = await burstsOf(page, () => out.click());
        if (pressed.noises.length !== 1 || pressed.starts.length !== 0)
          bad(
            "zoom",
            `the Zoom out button made ${pressed.noises.length} burst(s) and ${pressed.starts.length} oscillator(s), wanted one Lens servo step and no press ping`,
          );
      },
    );

    // The arrival cues: a feature map that comes into view after the first gesture plays the
    // Sonar dawn (a 110 Hz swell, then a 440 Hz ping and its echo 0.9 s on), once; one on screen
    // before the gesture stays silent. A page globe coming into view plays the Steel horizon (a
    // steel breath and one sub tone).
    const MAP_PAGE = "/check/us-sunshine-protection-act/";
    for (const [height, wanted] of [
      [330, "0,0.9,0.9"],
      [900, "none"],
    ]) {
      await scenario(
        browser,
        name,
        MAP_PAGE,
        {
          scenario: `arrival map ${height}`,
          viewport: { width: 1440, height },
        },
        async (page, bad) => {
          // The map draws from the Worker's answer; the stub is the one the credits gate uses.
          await page.route("**/api/sunshine-protection-act", (route) =>
            route.fulfill({
              status: 200,
              contentType: "application/json",
              headers: { "cache-control": "no-store" },
              body: JSON.stringify({ now: "2026-11-13T12:00:00Z", zones: [] }),
            }),
          );
          if (!(await unlock(page, MAP_PAGE)))
            return bad(
              "no-target",
              "arrival: no pressable button to unlock with",
            );
          const map = page.locator('[id="sunshine-today-map"]').first();
          if ((await map.count()) === 0)
            return bad("no-target", "arrival: no map on the page");
          const first = await cueOf(
            page,
            () => map.scrollIntoViewIfNeeded(),
            2500,
          );
          if (first !== wanted)
            bad(
              "arrival",
              `the map coming into view made shape "${first}", wanted "${wanted}"`,
            );
          const again = await cueOf(
            page,
            async () => {
              await page.evaluate(() => window.scrollTo(0, 0));
              await page.waitForTimeout(500);
              await map.scrollIntoViewIfNeeded();
            },
            1500,
          );
          if (again !== "none")
            bad(
              "arrival",
              `the map coming back into view made shape "${again}", wanted none`,
            );
        },
      );
    }
    await scenario(
      browser,
      name,
      "/tools/zoned-earth/",
      { scenario: "arrival globe", viewport: { width: 1440, height: 300 } },
      async (page, bad) => {
        if (!(await unlock(page, "/tools/zoned-earth/")))
          return bad(
            "no-target",
            "arrival: no pressable button to unlock with",
          );
        const stage = page.locator('[data-gate="globe-stage"]').first();
        if ((await stage.count()) === 0)
          return bad("no-target", "arrival: no globe on the page");
        const arrived = await burstsOf(
          page,
          () => stage.scrollIntoViewIfNeeded(),
          2500,
        );
        if (arrived.noises.length !== 1 || shape(arrived.starts) !== "0")
          bad(
            "arrival",
            `the globe coming into view made ${arrived.noises.length} burst(s) and shape "${shape(arrived.starts)}", wanted one Steel horizon`,
          );
      },
    );
  }

  await browser.close();
}

recordMeasured(GATE, measured);
if (failures.length) {
  console.error(
    `${GATE}: ${failures.length} failure(s) across ${measured} scenario(s)`,
  );
  process.exit(1);
}
console.log(`${GATE}: ${measured} scenario(s) pass`);
