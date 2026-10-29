#!/usr/bin/env node
/**
 * Media-preference gate: loads every page under each user preference and checks that the site
 * honours it (gmt-a11y.css and the motion reset in gmt-controls.css).
 *
 * Each check first asserts that `matchMedia` reports the emulated value; a mismatch is the finding
 * `emulation-unsupported`, never a silent pass.
 *
 *   reduced motion       `motion-running`: a `document.getAnimations()` entry still running 2s after
 *                        load with infinite iterations or more than 1s left
 *   reduced transparency (Chromium, CDP) an element with a `backdrop-filter` in the normal run must
 *                        have none (`transparency-blur`) and a background alpha of at least 0.9
 *                        (`transparency-fill`)
 *   more contrast        `contrast-border-token`: `--gmt-border` on :root equals `--gmt-border-strong`;
 *                        `contrast-text-shadow`: no visible text keeps a `text-shadow`
 *   forced colours       (Chromium) `forced-colors-boundary`: a button, input, select, textarea,
 *                        `[role=button]`, `[role=slider]` or `[role=tab]` has a border or, focused,
 *                        an outline
 *
 * WebKit and Firefox run reduced motion and more contrast only, and the line says so.
 *
 * One page load serves all four checks: the load is made with reduced motion on (animations start
 * at load), and the other preferences are switched on the loaded page, which re-evaluates the media
 * queries live. The preference is switched back off between checks.
 *
 * Usage (a built site served, as `pnpm --filter dox gates --only a11y-media` does):
 *   node scripts/a11y-media.mjs [--base http://127.0.0.1:48291/gmt] [--browsers chromium,webkit]
 *     [--theme dark|light] [--widths 1440] [--pages /a/,/b/] [--list-pages] [--concurrency 4]
 *
 * The preferences do not change with the viewport, so the default is one width (1440).
 * Exit 0 pass, 1 any finding or nothing measured, 2 usage.
 */
import {
  contrastApplied,
  emulationNotAppliedProblem,
  motionProblem,
  transparencyProblems,
  waitForFrames,
} from "./gate-checks.mjs";
import {
  distPages,
  parseSweep,
  settleTransitions,
  sweep,
} from "./lib/a11y-sweep.mjs";

const GATE = "a11y-media";
const MOTION_WAIT_MS = 2000;
/** How long the contrast check waits for the emulated state to reach the page. */
const EMULATION_WAIT_MS = 2000;

const run = parseSweep({
  gate: GATE,
  pages: distPages(GATE),
  defaults: { widths: "1440" },
});

const fullSet = (browserName) => browserName === "chromium";

const matches = (page, query) =>
  page.evaluate((q) => matchMedia(q).matches, query);

async function emulationMissing(page, query, what) {
  return (await matches(page, query))
    ? []
    : [
        {
          rule: "emulation-unsupported",
          target: "page",
          message: `${what}: matchMedia(${query}) is false after emulating it`,
        },
      ];
}

async function checkMotion(page) {
  const bad = await emulationMissing(
    page,
    "(prefers-reduced-motion: reduce)",
    "reduced motion",
  );
  if (bad.length) return bad;
  await page.waitForTimeout(MOTION_WAIT_MS);
  const running = await page.evaluate(() =>
    document.getAnimations().map((a) => {
      const timing = a.effect?.getComputedTiming?.() ?? {};
      const target = a.effect?.target;
      return {
        playState: a.playState,
        iterations:
          timing.iterations === Infinity ? "infinite" : timing.iterations,
        remainingMs: (timing.endTime ?? 0) - (a.currentTime ?? 0),
        name: a.animationName ?? a.transitionProperty ?? a.id ?? "animation",
        target: target ? window.__gmtIdentity(target) : null,
        selector: target ? window.__gmtCssPath(target) : null,
      };
    }),
  );
  return running
    .filter((a) =>
      motionProblem({
        playState: a.playState,
        iterations: a.iterations === "infinite" ? Infinity : a.iterations,
        remainingMs: a.remainingMs,
      }),
    )
    .map((a) => ({
      rule: "motion-running",
      // An animation with no target element (a document timeline effect) names the page.
      target: a.target ?? "page",
      selector: a.selector,
      message: `${a.name} is still running ${MOTION_WAIT_MS / 1000}s after load under prefers-reduced-motion (${a.iterations === "infinite" ? "infinite" : `${Math.round(a.remainingMs)}ms left`})`,
    }));
}

async function checkTransparency(page, cdp) {
  // Elements that blur in the normal run; the references live on `window` across the switch.
  await page.evaluate(() => {
    window.__blurred = [...document.querySelectorAll("*")].filter((el) => {
      const c = getComputedStyle(el);
      return (
        c.backdropFilter !== "none" &&
        el.checkVisibility({ checkVisibilityCSS: true })
      );
    });
  });
  await cdp.send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-transparency", value: "reduce" }],
  });
  try {
    const supported = await emulationMissing(
      page,
      "(prefers-reduced-transparency: reduce)",
      "reduced transparency",
    );
    if (supported.length) return supported;
    await settleTransitions(page);
    const after = await page.evaluate(() =>
      window.__blurred.map((el) => {
        const c = getComputedStyle(el);
        return {
          target: window.__gmtIdentity(el),
          selector: window.__gmtCssPath(el),
          backdropFilter: c.backdropFilter,
          backgroundColor: c.backgroundColor,
        };
      }),
    );
    return after.flatMap((el) =>
      transparencyProblems(el).map((f) => ({
        ...f,
        target: el.target,
        selector: el.selector,
      })),
    );
  } finally {
    await cdp.send("Emulation.setEmulatedMedia", {
      features: [
        { name: "prefers-reduced-transparency", value: "no-preference" },
      ],
    });
  }
}

async function checkContrast(page) {
  await page.emulateMedia({ contrast: "more" });
  try {
    const bad = await emulationMissing(
      page,
      "(prefers-contrast: more)",
      "more contrast",
    );
    if (bad.length) return bad;
    await settleTransitions(page);
    /* One reading after the next animation frame. The emulation reaches the tokens and the text
       a frame or more after `emulateMedia` resolves, so a reading taken at once can be of the
       page before it. */
    const sample = () =>
      page.evaluate(
        () =>
          new Promise((resolve) =>
            requestAnimationFrame(() => {
              const root = getComputedStyle(document.documentElement);
              const shadows = [];
              const walker = document.createTreeWalker(
                document.body,
                NodeFilter.SHOW_TEXT,
              );
              const seen = new Set();
              for (
                let node = walker.nextNode();
                node;
                node = walker.nextNode()
              ) {
                const el = node.parentElement;
                if (!el || seen.has(el) || !node.textContent.trim()) continue;
                seen.add(el);
                if (!el.checkVisibility({ checkVisibilityCSS: true })) continue;
                const c = getComputedStyle(el);
                if (c.textShadow !== "none")
                  shadows.push({
                    target: window.__gmtIdentity(el),
                    selector: window.__gmtCssPath(el),
                    textShadow: c.textShadow,
                  });
              }
              resolve({
                matches: matchMedia("(prefers-contrast: more)").matches,
                border: root.getPropertyValue("--gmt-border").trim(),
                strong: root.getPropertyValue("--gmt-border-strong").trim(),
                shadows,
              });
            }),
          ),
      );
    const waited = await waitForFrames(
      sample,
      (r) =>
        contrastApplied({
          border: r.border,
          strong: r.strong,
          shadowCount: r.shadows.length,
        }),
      { maxMs: EMULATION_WAIT_MS, now: () => performance.now() },
    );
    const read = waited.last;
    if (!waited.ok && !read.matches) {
      /* The emulation never reached the page, so neither product rule is recorded: both read
         state that is not there. With the media query matching and the state still wrong after
         the wait, the page is wrong and the rules below say how. */
      return [
        emulationNotAppliedProblem({
          frames: waited.frames,
          matches: read.matches,
          border: read.border,
          strong: read.strong,
          shadowCount: read.shadows.length,
        }),
      ];
    }
    const found = [];
    if (read.border !== read.strong) {
      found.push({
        rule: "contrast-border-token",
        target: "root",
        selector: ":root",
        message: `--gmt-border is ${read.border}, not --gmt-border-strong (${read.strong}), under prefers-contrast: more`,
      });
    }
    for (const s of read.shadows) {
      found.push({
        rule: "contrast-text-shadow",
        target: s.target,
        selector: s.selector,
        message: `visible text keeps text-shadow ${s.textShadow} under prefers-contrast: more`,
      });
    }
    return found;
  } finally {
    await page.emulateMedia({ contrast: "no-preference" });
  }
}

async function checkForcedColors(page) {
  await page.emulateMedia({ forcedColors: "active" });
  try {
    const bad = await emulationMissing(
      page,
      "(forced-colors: active)",
      "forced colours",
    );
    if (bad.length) return bad;
    await settleTransitions(page);
    const controls = await page.evaluate(() => {
      const SEL =
        'button, input, select, textarea, [role="button"], [role="slider"], [role="tab"]';
      const out = [];
      for (const el of document.querySelectorAll(SEL)) {
        if (el.localName === "input" && el.type === "hidden") continue;
        if (!el.checkVisibility({ checkVisibilityCSS: true })) continue;
        const r = el.getBoundingClientRect();
        if (r.width <= 2 || r.height <= 2) continue;
        const c = getComputedStyle(el);
        const border = ["Top", "Right", "Bottom", "Left"].some(
          (side) =>
            c[`border${side}Style`] !== "none" &&
            parseFloat(c[`border${side}Width`]) > 0,
        );
        if (border) continue;
        el.focus({ focusVisible: true });
        const f = getComputedStyle(el);
        const outline =
          f.outlineStyle !== "none" &&
          (f.outlineStyle === "auto" || parseFloat(f.outlineWidth) > 0);
        el.blur();
        if (!outline)
          out.push({
            target: window.__gmtIdentity(el),
            selector: window.__gmtCssPath(el),
          });
      }
      return out;
    });
    return controls.map(({ target, selector }) => ({
      rule: "forced-colors-boundary",
      target,
      selector,
      message:
        "under forced colours the control has no border and, focused, no outline, so it has no visible edge",
    }));
  } finally {
    await page.emulateMedia({ forcedColors: "none" });
  }
}

await sweep({
  gate: GATE,
  run,
  contextOptions: { reducedMotion: "reduce" },
  browserNote: (browserName) =>
    fullSet(browserName) ? "" : "  (reduced motion and more contrast only)",
  check: async ({ page, context, browserName }) => {
    const found = [...(await checkMotion(page))];
    if (fullSet(browserName)) {
      const cdp = await context.newCDPSession(page);
      found.push(...(await checkTransparency(page, cdp)));
    }
    found.push(...(await checkContrast(page)));
    if (fullSet(browserName)) found.push(...(await checkForcedColors(page)));
    return found;
  },
});
