/**
 * The text-floor family of the slide-deck gate, at the first size. Every visible piece of text on
 * every slide at every build is read at a stage of 1920x1080 and again at 3840x2160 (DPR 1), and its
 * size is taken as a share of the stage's width (cqi):
 *
 *  - Floor: at least TEXT_FLOOR_CQI, or FINE_PRINT_CQI inside `[data-fine-print]` (the component that
 *    renders fine print sets the marker).
 *  - Scale: the same text is the same share at both stages, within 2%; if not, it is set in `px` or
 *    `rem` somewhere.
 *  - Safe edges (1920 only): each text leaf of the slide, and each text leaf, control and named
 *    picture of the space layer, lies at least SAFE_TITLE of the stage's height from its top and
 *    bottom, so a TV that crops 5% loses nothing the room reads. The sides may reach SAFE_ACTION,
 *    the most a TV crops: the owner traded the last 1.5% of each side for width (DOX-G15).
 *  - Guide (1920 only, once, on the first slide): `G` shows the safe-area guide with its two
 *    rectangles at 3.5% and 5% of the stage and moves nothing; `G` again hides it.
 *
 * The two floors are the owner's (DOX-G15); the tokens `--gmt-deck-text-sm` and `--gmt-deck-text-fine`
 * (`gmt-tokens.css`) are the only other place they are written.
 */
import { blockOffSite } from "../../gate-checks.mjs";
import { unlockDecks } from "../slides-check-helpers.mjs";
import { frames } from "../page-frames.mjs";
import { arrive, sizeDeck } from "./presenter-parity.mjs";
import { findingAt, readSlides, STAGE, visible } from "./reads.mjs";

const TEXT_FLOOR_CQI = 1.25;
const FINE_PRINT_CQI = 1.0;
const SCALE_TOLERANCE = 0.02;
const SAFE_ACTION = 0.035;
const SAFE_TITLE = 0.05;
/** A text box may sit this far inside the line (sub-pixel layout, rounded glyph boxes). */
const SAFE_SLACK = 0.002;
const GUIDE_PX = 1;
const SLIDE_PX = 0.5;
const PASSES = [
  { width: 1920, height: 1080 },
  { width: 3840, height: 2160 },
];

/** Each visible text leaf of the shown slide: its class, text, and its size as a share of the stage. */
const READ_TEXT = ({ stageSelector, visibleSource }) => {
  const visible = new Function(`return (${visibleSource})`)();
  const slide = document.querySelector("[data-slide][data-shown]");
  const stage = document.querySelector(stageSelector).getBoundingClientRect();
  const hidden = (el) => {
    if (!visible(el, slide)) return true;
    const r = el.getBoundingClientRect();
    return r.width === 0 || r.height === 0;
  };
  /** How much the nearest fit box (a transform) scales `el` as drawn; it already holds any outer one's. */
  const fitted = (el) => {
    const box = el.closest(".gmt-stage-fit");
    return box && box.offsetWidth > 0
      ? box.getBoundingClientRect().width / box.offsetWidth
      : 1;
  };
  const leaves = [];
  /** The part of the text's box the page draws: what a scrolling or clipping box hides is cut off. */
  const drawn = (node, slideRoot) => {
    let r;
    if (node.nodeType === Node.TEXT_NODE) {
      const range = document.createRange();
      range.selectNodeContents(node);
      r = range.getBoundingClientRect();
    } else r = node.getBoundingClientRect();
    let { top, bottom, left, right } = r;
    for (
      let a = node.parentElement;
      a && a !== slideRoot;
      a = a.parentElement
    ) {
      const { overflowX, overflowY } = getComputedStyle(a);
      if ([overflowX, overflowY].every((o) => o === "visible")) continue;
      const c = a.getBoundingClientRect();
      top = Math.max(top, c.top);
      bottom = Math.min(bottom, c.bottom);
      left = Math.max(left, c.left);
      right = Math.min(right, c.right);
    }
    return { top, bottom, left, right };
  };
  /** How far that part is from each stage edge, as a share of that dimension; null when none of it is drawn. */
  const edges = (node, slideRoot) => {
    const r = drawn(node, slideRoot);
    if (r.bottom <= r.top || r.right <= r.left) return null;
    return {
      top: (r.top - stage.top) / stage.height,
      bottom: (stage.bottom - r.bottom) / stage.height,
      left: (r.left - stage.left) / stage.width,
      right: (stage.right - r.right) / stage.width,
    };
  };
  const space = document.querySelector("[data-deck-space]");
  const roots = [slide, ...(space ? [space] : [])];
  for (const root of roots) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement;
      if (
        n.textContent.trim() === "" ||
        el.closest(".gmt-sr-only") ||
        hidden(el)
      )
        continue;
      const px = parseFloat(getComputedStyle(el).fontSize);
      const svg = el instanceof SVGElement;
      const drawn = svg ? px * (el.getScreenCTM()?.a ?? 1) : px * fitted(el);
      leaves.push({
        cls: String(el.getAttribute("class") ?? el.localName).trim(),
        text: n.textContent.trim().slice(0, 30),
        cqi: (drawn / stage.width) * 100,
        fine: el.closest("[data-fine-print]") !== null,
        space: root === space,
        edges: edges(n, root),
      });
    }
  }
  /** A control or a named picture in the space layer is held to the same edge, by its border box. */
  if (space) {
    const named = (el) =>
      (
        el.getAttribute("aria-label") ??
        el.querySelector("title")?.textContent ??
        ""
      ).trim();
    const controls = space.querySelectorAll(
      "button, a[href], [role=button], img[alt]:not([alt='']), svg[role=img], canvas[aria-label]",
    );
    for (const el of controls) {
      if (el.closest(".gmt-sr-only") || hidden(el)) continue;
      const name = (
        named(el) ||
        el.getAttribute("alt") ||
        el.textContent ||
        ""
      ).trim();
      leaves.push({
        cls: String(el.getAttribute("class") ?? el.localName).trim(),
        text: `[${el.localName}] ${name}`.slice(0, 30),
        cqi: 0,
        fine: false,
        space: true,
        edges: edges(el, space),
      });
    }
  }
  return leaves;
};

/** The shown slide's box, and the guide's, as the page draws them, for the guide check. */
const READ_GUIDE = (stageSelector) => {
  const box = (el) => {
    const r = el?.getBoundingClientRect();
    return r && { x: r.x, y: r.y, width: r.width, height: r.height };
  };
  const guide = document.querySelector("[data-deck-guide]");
  return {
    stage: box(document.querySelector(stageSelector)),
    slide: box(document.querySelector("[data-slide][data-shown]")),
    shown: guide ? !guide.hidden && guide.getClientRects().length > 0 : false,
    action: box(guide?.querySelector('[data-safe="action"]')),
    title: box(guide?.querySelector('[data-safe="title"]')),
  };
};

const moved = (a, b, px) =>
  ["x", "y", "width", "height"].some((k) => Math.abs(a[k] - b[k]) > px);

/** Presses `G` on the first slide: the guide shows at 3.5% and 5%, moves nothing, and hides again. Returns what is wrong. */
async function readGuide(deck) {
  const read = () => deck.evaluate(READ_GUIDE, STAGE);
  const before = await read();
  const problems = [];
  await deck.keyboard.press("g");
  await frames(deck);
  const open = await read();
  if (!open.shown) problems.push("G does not show the guide");
  else {
    const { stage } = open;
    for (const [name, inset] of [
      ["action", SAFE_ACTION],
      ["title", SAFE_TITLE],
    ]) {
      const box = open[name];
      const want = {
        x: stage.x + inset * stage.width,
        y: stage.y + inset * stage.height,
        width: stage.width * (1 - 2 * inset),
        height: stage.height * (1 - 2 * inset),
      };
      if (!box || moved(box, want, GUIDE_PX))
        problems.push(
          `the ${name}-safe rectangle is not inset ${inset * 100}% of the stage`,
        );
    }
  }
  if (moved(open.slide, before.slide, SLIDE_PX))
    problems.push("showing the guide moved the shown slide");
  await deck.keyboard.press("g");
  await frames(deck);
  const closed = await read();
  if (closed.shown) problems.push("a second G does not hide the guide");
  if (moved(closed.slide, before.slide, SLIDE_PX))
    problems.push("hiding the guide left the shown slide moved");
  return problems;
}

/** Every leaf of every slide at every build on one stage, keyed by where it is and what it says. */
async function readStage(
  browser,
  base,
  pagePath,
  want,
  { guide = false } = {},
) {
  const context = await browser.newContext({ viewport: want });
  try {
    await blockOffSite(context, base);
    await unlockDecks(context);
    const deck = await context.newPage();
    const url = `${base}${pagePath}?globe=canvas2d`;
    await deck.goto(url, { waitUntil: "load" });
    const slides = await readSlides(deck);
    await sizeDeck(deck, want);
    const seen = new Map();
    let guideProblems = [];
    if (guide && slides[0]) {
      await arrive(deck, url, slides[0], 0);
      guideProblems = await readGuide(deck);
    }
    for (const s of slides)
      for (let build = 0; build <= s.builds; build += 1) {
        await arrive(deck, url, s, build);
        const counts = new Map();
        for (const leaf of await deck.evaluate(READ_TEXT, {
          stageSelector: STAGE,
          visibleSource: String(visible),
        })) {
          const id = `${leaf.cls}|${leaf.text}`;
          const n = counts.get(id) ?? 0;
          counts.set(id, n + 1);
          seen.set(`${s.id}/${build}|${id}|${n}`, {
            ...leaf,
            slide: s.title,
            build,
          });
        }
      }
    return { seen, guideProblems };
  } finally {
    await context.close().catch(() => {});
  }
}

export async function checkTextFloor(env) {
  const { browser, base, pagePath } = env;
  const at = findingAt(env);
  try {
    const first = await readStage(browser, base, pagePath, PASSES[0], {
      guide: true,
    });
    const small = first.seen;
    const large = (await readStage(browser, base, pagePath, PASSES[1])).seen;
    const said = new Set();
    const once = (rule, leaf, message) => {
      const key = `${rule}|${leaf.slide}|${leaf.cls}|${leaf.text}`;
      if (said.has(key)) return;
      said.add(key);
      at(
        rule,
        `slide "${leaf.slide}", .${leaf.cls} "${leaf.text}" ${message}`,
        `text › slide "${leaf.slide}"`,
      );
    };
    for (const problem of first.guideProblems)
      at("safe-guide", `the safe-area guide: ${problem}`, "text › guide");
    for (const [key, a] of small) {
      for (const [edge, share] of Object.entries(a.edges ?? {})) {
        const line =
          edge === "left" || edge === "right" ? SAFE_ACTION : SAFE_TITLE;
        if (share < line - SAFE_SLACK)
          once(
            "safe-edge",
            a,
            `(build ${a.build}) is ${(share * 100).toFixed(1)}% from the ${edge} edge, inside the ${line * 100}% a TV may crop`,
          );
      }
      if (a.space) continue;
      for (const leaf of [a, large.get(key)]) {
        const floor = leaf?.fine ? FINE_PRINT_CQI : TEXT_FLOOR_CQI;
        if (leaf && leaf.cqi < floor - 0.005)
          once(
            "text-floor",
            leaf,
            `is ${leaf.cqi.toFixed(2)}cqi, under the ${floor}cqi floor`,
          );
      }
      const b = large.get(key);
      if (
        b &&
        Math.abs(a.cqi - b.cqi) > SCALE_TOLERANCE * Math.max(a.cqi, b.cqi)
      )
        once(
          "text-scale",
          a,
          `is ${a.cqi.toFixed(2)}cqi at 1920 and ${b.cqi.toFixed(2)}cqi at 3840: it is set in px or rem somewhere`,
        );
    }
    return small.size;
  } catch (error) {
    at(
      "check-crashed",
      `the text-floor check crashed: ${String(error?.message ?? error).split("\n")[0]}`,
    );
    return 0;
  }
}
