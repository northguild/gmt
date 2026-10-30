#!/usr/bin/env node
/**
 * Tab-walk gate: walks every page with the keyboard and checks that focus goes everywhere it
 * should and is visible when it gets there.
 *
 * Per page and width (1440 and 390) it collects the candidates (visible links, buttons, fields,
 * summaries, `tabindex` and `contenteditable` elements, minus disabled, inert, aria-hidden and
 * closed-details content), presses Tab from the top up to candidates + 20 times (Alt+Tab in WebKit),
 * and records the focused element each time. Rules:
 *
 *   tab-unreached     a candidate never took focus
 *   tab-trap          focus came back to a visited element while candidates were unvisited
 *   focus-invisible   focus changed no outline, box-shadow, border or background colour
 *   focus-obscured    the focused element's centre is covered by something else (the sticky header)
 *   arrow-no-move     a slider (range, role=slider, drag handle) ignores ArrowRight / ArrowLeft
 *
 * At 390 the mobile menu is opened only when the walk reaches its toggle; the menu's links count as
 * candidates only once it is open. `/dox/` is walked as it opens and once more with a widget in the
 * rail. The pages are every page outside `/reference/`, plus the first function page and the first
 * type page: reference pages share one template and each carries the full sidebar.
 *
 * Usage (a built site served, as `pnpm --filter dox gates --only a11y-tab-walk` does):
 *   node scripts/a11y-tab-walk.mjs [--base http://127.0.0.1:48291/gmt] [--browsers chromium,webkit]
 *     [--theme dark|light] [--widths 1440,390] [--pages /a/,/b/] [--list-pages] [--concurrency 4]
 *
 * Exit 0 pass, 1 any finding or nothing measured, 2 usage.
 */
import {
  arrowMoveProblems,
  controlPresence,
  focusVisibleProblem,
  obscuredByProblem,
  obscuredMessage,
  SEGMENT_CAP,
  tabWalkPages,
  tabWalkProblems,
} from "./gate-checks.mjs";
import { distPages, openRail, parseSweep, sweep } from "./lib/a11y-sweep.mjs";

const GATE = "a11y-tab-walk";
const EXTRA_PRESSES = 20;

const run = parseSweep({
  gate: GATE,
  pages: tabWalkPages(distPages(GATE)),
  defaults: { widths: "1440,390" },
});

/** Installed in the page: collecting candidates, and reading the focused element. */
function install() {
  const SEL =
    'a[href], button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"]), [contenteditable]';
  const snaps = {};

  // An identity key is an element's name for the whole walk, so it is computed once: a sibling
  // added later (a tooltip, a re-rendered row) must not turn the same control into another one.
  // The readable CSS path of each key is kept for the `selector` field of a finding.
  const keys = new WeakMap();
  const cssMap = {};
  const pathOf = (el) => {
    if (!keys.has(el)) {
      const key = window.__gmtIdentity(el);
      keys.set(el, key);
      cssMap[key] ??= window.__gmtCssPath(el);
    }
    return keys.get(el);
  };

  const snap = (el) => {
    const c = getComputedStyle(el);
    return {
      outlineStyle: c.outlineStyle,
      outlineWidth: c.outlineWidth,
      boxShadow: c.boxShadow,
      borderColor: [
        c.borderTopColor,
        c.borderRightColor,
        c.borderBottomColor,
        c.borderLeftColor,
      ].join(" "),
      backgroundColor: c.backgroundColor,
    };
  };

  const hiddenByDetails = (el) => {
    for (let a = el.parentElement; a; a = a.parentElement) {
      if (a.localName === "details" && !a.open) {
        const summary = [...a.children].find((c) => c.localName === "summary");
        if (!summary || !(el === summary || summary.contains(el))) return true;
      }
    }
    return false;
  };

  const eligible = (el) => {
    if (el.disabled || el.matches(":disabled")) return false;
    if (el.localName === "input" && el.type === "hidden") return false;
    if (el.closest("[inert]") || el.closest('[aria-hidden="true"]'))
      return false;
    if (el.getAttribute("contenteditable") === "false") return false;
    const tab = el.getAttribute("tabindex");
    // A negative tabindex removes a control from the order on purpose in a roving group (a menu,
    // a listbox row, a toolbar button), so those are not candidates. A form field has no such
    // pattern: a range or input taken out of the order is a control Tab can no longer reach.
    const field = ["input", "select", "textarea"].includes(el.localName);
    if (tab !== null && Number(tab) < 0 && !field) return false;
    if (hiddenByDetails(el)) return false;
    if (!el.checkVisibility({ checkVisibilityCSS: true })) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };

  /** An element's identity key and its rect, rounded to 0.1 px. */
  const describe = (el) => {
    const r = el.getBoundingClientRect();
    const n = (v) => Math.round(v * 10) / 10;
    return `${window.__gmtIdentity(el)} (${n(r.left)}, ${n(r.top)}, ${n(r.width)} x ${n(r.height)})`;
  };

  window.__tw = {
    pathOf,
    cssMap,
    collect() {
      const all = [...document.querySelectorAll(SEL)].filter(eligible);
      // A radio group is one tab stop: the checked radio, else the first.
      const groups = new Map();
      for (const el of all) {
        if (el.localName === "input" && el.type === "radio" && el.name) {
          const key = `${el.form ? pathOf(el.form) : ""}|${el.name}`;
          const cur = groups.get(key);
          if (!cur || (el.checked && !cur.checked)) groups.set(key, el);
        }
      }
      const paths = [];
      for (const el of all) {
        if (el.localName === "input" && el.type === "radio" && el.name) {
          const key = `${el.form ? pathOf(el.form) : ""}|${el.name}`;
          if (groups.get(key) !== el) continue;
        }
        const p = pathOf(el);
        if (!(p in snaps)) snaps[p] = snap(el);
        paths.push(p);
      }
      return [...new Set(paths)];
    },
    async active() {
      const el = document.activeElement;
      if (!el || el === document.body || el === document.documentElement)
        return null;
      const running = el
        .getAnimations()
        .filter((a) => a instanceof CSSTransition)
        .map((a) => a.finished.catch(() => {}));
      await Promise.race([
        Promise.all(running),
        new Promise((r) => setTimeout(r, 500)),
      ]);
      const path = pathOf(el);
      // A link that wraps onto two lines has one box per line and a bounding box between them
      // whose centre may sit on neither. It is reachable when the centre of any one box hits it.
      const boxes = [...el.getClientRects()].filter(
        (r) => r.width > 2 && r.height > 2,
      );
      const onScreen = boxes.filter(
        (r) =>
          r.left + r.width / 2 >= 0 &&
          r.top + r.height / 2 >= 0 &&
          r.left + r.width / 2 < innerWidth &&
          r.top + r.height / 2 < innerHeight,
      );
      const hitOk = (hit) =>
        hit &&
        (el === hit ||
          el.contains(hit) ||
          hit.contains(el) ||
          (el.labels &&
            [...el.labels].some((l) => l === hit || l.contains(hit))));
      // One sample per box: did the element at its centre belong to the control?
      const samples =
        getComputedStyle(el).pointerEvents === "none"
          ? []
          : onScreen.map((r) => {
              const hit = document.elementFromPoint(
                r.left + r.width / 2,
                r.top + r.height / 2,
              );
              if (!hit) return { ok: false, by: "nothing" };
              const cs = getComputedStyle(hit);
              const box = hit.getBoundingClientRect();
              return {
                ok: !!hitOk(hit),
                by: describe(hit),
                byRect: {
                  left: box.left,
                  top: box.top,
                  width: box.width,
                  height: box.height,
                },
                byDisplay: cs.display,
                byPosition: cs.position,
                byZIndex: cs.zIndex,
              };
            });
      const scroller = (() => {
        for (let a = el.parentElement; a; a = a.parentElement) {
          const oy = getComputedStyle(a).overflowY;
          if (/(auto|scroll)/.test(oy) && a.scrollHeight > a.clientHeight)
            return a;
        }
        return document.scrollingElement;
      })();
      const focusRect = el.getBoundingClientRect();
      const scrollBox = scroller.getBoundingClientRect();
      const detail = {
        rect: {
          left: focusRect.left,
          top: focusRect.top,
          width: focusRect.width,
          height: focusRect.height,
        },
        container: {
          identity: describe(scroller),
          rect: {
            left: scrollBox.left,
            top: scrollBox.top,
            width: scrollBox.width,
            height: scrollBox.height,
          },
          scrollTop: scroller.scrollTop,
          scrollPaddingBlock:
            getComputedStyle(scroller).scrollPaddingBlock || "auto",
        },
        viewport: { width: innerWidth, height: innerHeight },
        narrow: matchMedia("(max-width: 60rem)").matches,
      };
      return {
        detail,
        path,
        before: snaps[path] ?? null,
        after: snap(el),
        samples,
        menuToggle:
          el.matches(
            'starlight-menu-button button, [aria-controls="starlight__sidebar"]',
          ) && el.getAttribute("aria-expanded") === "false",
      };
    },
    /**
     * The focus indicator can sit on a container (`:focus-within`, a composer panel around a bare
     * textarea). Blur the focused control, read up to four ancestors, focus it again and read them
     * again.
     */
    async ancestorProbe() {
      const el = document.activeElement;
      if (!el) return [];
      const chain = [];
      for (
        let a = el.parentElement;
        a && a !== document.body && chain.length < 4;
        a = a.parentElement
      )
        chain.push(a);
      const settleFx = async () => {
        const running = chain
          .flatMap((a) => a.getAnimations())
          .map((a) => a.finished.catch(() => {}));
        await Promise.race([
          Promise.all(running),
          new Promise((r) => setTimeout(r, 500)),
        ]);
      };
      el.blur();
      await settleFx();
      const before = chain.map(snap);
      el.focus({ focusVisible: true });
      await settleFx();
      const after = chain.map(snap);
      return chain.map((_, i) => ({ before: before[i], after: after[i] }));
    },
    sliders() {
      const els = [
        ...document.querySelectorAll('input[type="range"], [role="slider"]'),
      ].filter(
        (el) =>
          !el.disabled && el.checkVisibility({ checkVisibilityCSS: true }),
      );
      return els.map((el, i) => {
        el.setAttribute("data-a11y-slider", String(i));
        return { index: i, path: pathOf(el) };
      });
    },
    sliderValue(index) {
      const el = document.querySelector(`[data-a11y-slider="${index}"]`);
      if (!el) return { value: null, atMax: false };
      const now =
        el.getAttribute("aria-valuenow") ??
        (el.value !== undefined ? String(el.value) : null);
      // A rounded aria-valuenow can hide a real step; the spoken text shows it.
      const text = el.getAttribute("aria-valuetext");
      const max = el.getAttribute("aria-valuemax") ?? el.getAttribute("max");
      return {
        value: now !== null && text ? `${now} (${text})` : now,
        atMax: max !== null && now !== null && Number(now) >= Number(max),
      };
    },
  };
}

/** One keyboard walk of the page as it stands; `label` prefixes the messages of a second state. */
async function walkPage(page, { width, browserName, label }) {
  const found = [];
  // `selector` holds an identity key here; it becomes `target`, and the readable CSS path
  // (filled in below, once the walk has seen every key) becomes `selector`.
  const tag = (f) => ({ ...f, message: `${label}${f.message}` });
  await page.evaluate(install);
  await page.evaluate(() => {
    // Put the sequential-focus starting point at the top of the page, so Tab begins at the first control.
    document.activeElement?.blur?.();
    window.scrollTo(0, 0);
    const start = document.createElement("div");
    start.tabIndex = -1;
    document.body.prepend(start);
    start.focus();
    start.remove();
  });
  // Collect once the page has stopped adding controls: a widget that mounts a beat late would
  // otherwise be a candidate on one run and not on the next. Stable is the same count on two
  // reads 200 ms apart, for at most 4 s.
  let candidates = await page.evaluate(() => window.__tw.collect());
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(200);
    const again = await page.evaluate(() => window.__tw.collect());
    const same = again.length === candidates.length;
    candidates = again;
    if (same) break;
  }
  const key = browserName === "webkit" ? "Alt+Tab" : "Tab";
  const reported = new Set();
  /** Tab until every candidate is visited or focus revisits a stop; run the per-press checks. */
  const walk = async (wanted) => {
    const sequence = [];
    const visited = new Set();
    let toggle = false;
    let stops = 0;
    let run = 0;
    let last = null;
    // Presses are counted in stops: the segments of a date field are several presses on one stop.
    for (
      let n = 0;
      stops < wanted.length + EXTRA_PRESSES &&
      n < (wanted.length + EXTRA_PRESSES) * (SEGMENT_CAP + 1);
      n++
    ) {
      await page.keyboard.press(key);
      const active = await page.evaluate(() => window.__tw.active());
      sequence.push(active?.path ?? null);
      if (active) {
        run = active.path === last ? run + 1 : 1;
        if (active.path === last) {
          // The same control again: the next segment of a date field, until the cap.
          if (run > SEGMENT_CAP) break;
          continue;
        }
        last = active.path;
        stops++;
        if (visited.has(active.path)) break;
        visited.add(active.path);
        if (active.menuToggle) toggle = true;
        if (active.before && !reported.has(active.path)) {
          for (const f of focusVisibleProblem({
            before: active.before,
            after: active.after,
          })) {
            const ancestors = await page.evaluate(() =>
              window.__tw.ancestorProbe(),
            );
            if (ancestors.some((a) => focusVisibleProblem(a).length === 0))
              continue;
            reported.add(active.path);
            found.push(tag({ ...f, selector: active.path }));
          }
        }
        let obscuredBy = obscuredByProblem(active.samples);
        let coverSample =
          active.samples.find((s) => !s.ok) ?? active.samples.at(-1);
        let coverDetail = active.detail;
        if (obscuredBy) {
          // Look again after a beat, on the same focus: a layout still moving under the control
          // (a region easing to height) is not a control that stays covered.
          await page.waitForTimeout(300);
          const again = await page.evaluate(() => window.__tw.active());
          if (again?.path === active.path) {
            obscuredBy = obscuredByProblem(again.samples);
            coverSample =
              again.samples.find((s) => !s.ok) ?? again.samples.at(-1);
            coverDetail = again.detail;
          }
        }
        if (obscuredBy) {
          found.push(
            tag({
              rule: "focus-obscured",
              selector: active.path,
              message: obscuredMessage(
                `the centre of the focused control ${active.path}`,
                { ...coverSample, ...coverDetail },
              ),
            }),
          );
        }
      }
      if (wanted.every((c) => visited.has(c))) break;
    }
    for (const f of tabWalkProblems({ candidates: wanted, sequence }))
      found.push(tag(f));
    return toggle;
  };
  const toggleSeen = await walk(candidates);
  let total = candidates.length;
  if (toggleSeen && width < 800) {
    // The mobile menu is modal while open, so the page is walked first and the menu on its own.
    const toggle = page.locator(
      'starlight-menu-button button, [aria-controls="starlight__sidebar"]',
    );
    await toggle.first().focus();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(400);
    const grown = await page.evaluate(() => window.__tw.collect());
    const menu = grown.filter((c) => !candidates.includes(c));
    total += menu.length;
    await walk(menu);
    // Close it again: an open modal menu makes the rest of the page inert.
    await page.keyboard.press("Escape");
    await toggle.first().focus();
    if ((await toggle.first().getAttribute("aria-expanded")) === "true")
      await page.keyboard.press("Enter");
    await page.waitForTimeout(400);
  }
  const css = await page.evaluate(() => window.__tw.cssMap);
  return {
    found: found.map(({ selector, ...rest }) => ({
      ...rest,
      target: selector,
      selector: css[selector] ?? null,
    })),
    candidateCount: total,
  };
}

/** ArrowRight then ArrowLeft on each slider; a slider already at its far end is tried the other way. */
async function sliderPass(page, label) {
  const found = [];
  const sliders = await page.evaluate(() => window.__tw.sliders());
  for (const { index, path } of sliders) {
    const el = page.locator(`[data-a11y-slider="${index}"]`);
    const presence = controlPresence({
      visible: await el.isVisible(),
      optional: true,
      id: path,
    });
    if (!presence.proceed) continue;
    await el.focus();
    const read = () => page.evaluate((i) => window.__tw.sliderValue(i), index);
    const start = await read();
    const keys = start.atMax
      ? ["ArrowLeft", "ArrowRight"]
      : ["ArrowRight", "ArrowLeft"];
    await page.keyboard.press(keys[0]);
    const moved = (await read()).value;
    await page.keyboard.press(keys[1]);
    const restored = (await read()).value;
    for (const message of arrowMoveProblems({
      before: start.value,
      moved,
      restored,
      keys,
    })) {
      found.push({
        rule: "arrow-no-move",
        target: path,
        selector: await page.evaluate(
          (k) => window.__tw.cssMap[k] ?? null,
          path,
        ),
        message: `${label}${message}`,
      });
    }
  }
  return found;
}

await sweep({
  gate: GATE,
  run,
  check: async ({ page, path: pagePath, width, browserName }) => {
    const { found } = await walkPage(page, { width, browserName, label: "" });
    found.push(...(await sliderPass(page, "")));
    if (pagePath === "/dox/") {
      const closed = await openRail(page);
      if (closed)
        found.push({
          rule: "rail-not-opened",
          target: "page",
          message: closed,
        });
      else {
        const second = await walkPage(page, {
          width,
          browserName,
          label: "(rail open) ",
        });
        found.push(
          ...second.found,
          ...(await sliderPass(page, "(rail open) ")),
        );
      }
    }
    return found;
  },
});
