/**
 * The presenter family's laptop check, once per laptop size: the page does not scroll, the frames
 * are wide enough, the three nav buttons are one height, and the readouts, frames and nav row stay
 * still while each readout shows each of its samples and three slides are stepped.
 */
import { frames } from "../page-frames.mjs";
import { sameBox } from "../slides-check-helpers.mjs";

const BOXES = ["[data-pv-stage]", "[data-pv-next]"];

export const presenterPath = (pagePath) =>
  `${pagePath.replace(/\/$/, "")}/presenter/`;

async function boxesOf(page) {
  return page.evaluate(
    ({ boxes }) => {
      const rect = (el) => {
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      };
      const out = {};
      document.querySelectorAll("[data-pv-cell]").forEach((el) => {
        out[`cell ${el.getAttribute("data-pv-cell")}`] = rect(el);
      });
      for (const s of boxes) out[s] = rect(document.querySelector(s));
      out["nav row"] = rect(document.querySelector("#pv-prev").parentElement);
      return out;
    },
    { boxes: BOXES },
  );
}

const movedFrom = (before, after) =>
  Object.keys(before).filter((k) => !sameBox(before[k], after[k], 0.5));

export async function checkLaptop({ context, base, pagePath, laptop, at }) {
  const page = await context.newPage();
  const target = `presenter › ${laptop.width}x${laptop.height}`;
  try {
    await page.setViewportSize({ width: laptop.width, height: laptop.height });
    await page.goto(`${base}${presenterPath(pagePath)}?globe=canvas2d`, {
      waitUntil: "load",
    });
    await page.waitForSelector("[data-pv-stage] [data-slide-stage]");
    await frames(page);
    const shape = await page.evaluate(() => ({
      scroll: document.documentElement.scrollHeight - innerHeight,
      current: document.querySelector("[data-pv-stage]").getBoundingClientRect()
        .width,
      next: document.querySelector("[data-pv-next]").getBoundingClientRect()
        .width,
      buttons: ["#pv-prev", "#pv-next", "#pv-blank"].map(
        (id) => document.querySelector(id).getBoundingClientRect().height,
      ),
    }));
    if (shape.scroll > 0)
      at(
        "presenter-scroll",
        `the page is ${Math.round(shape.scroll)} px taller than the ${laptop.height} px window`,
        target,
      );
    if (shape.current < laptop.current)
      at(
        "presenter-frame",
        `the current frame is ${Math.round(shape.current)} px wide, under ${laptop.current}`,
        target,
      );
    if (shape.next < laptop.next)
      at(
        "presenter-frame",
        `the next frame is ${Math.round(shape.next)} px wide, under ${laptop.next}`,
        target,
      );
    if (Math.max(...shape.buttons) - Math.min(...shape.buttons) > 0.5)
      at(
        "presenter-buttons",
        `Previous, Next and Blank are ${shape.buttons.map(Math.round).join(", ")} px tall`,
        target,
      );

    // Stillness: each readout at each sample, then three slides stepped.
    const base0 = await boxesOf(page);
    const samples = await page.evaluate(() =>
      [...document.querySelectorAll("[data-pv-cell]")].map((cell) => ({
        key: cell.getAttribute("data-pv-cell"),
        texts: [
          ...cell.querySelectorAll("gmt-readout > span[aria-hidden]"),
        ].map((s) => s.textContent),
      })),
    );
    for (const { key, texts } of samples)
      for (const text of ["", ...texts]) {
        await page.evaluate(
          ({ k, t }) => {
            document.querySelector(`[data-pv-cell="${k}"] gmt-readout`).value =
              t;
          },
          { k: key, t: text },
        );
        await frames(page);
        const moved = movedFrom(base0, await boxesOf(page));
        if (moved.length)
          at(
            "presenter-still",
            `the ${key} readout showing "${text || "no signal"}" moved: ${moved.join(", ")}`,
            target,
          );
      }
    for (let n = 0; n < 3; n += 1) {
      for (let hops = 0; hops < 40; hops += 1) {
        const before = await page.locator("[data-pv-position]").textContent();
        await page.click("#pv-next");
        await frames(page);
        const after = await page.locator("[data-pv-position]").textContent();
        if (after?.split(":")[0] !== before?.split(":")[0]) break;
      }
      const moved = movedFrom(base0, await boxesOf(page));
      if (moved.length)
        at("presenter-still", `stepping moved: ${moved.join(", ")}`, target);
    }
    return 1;
  } finally {
    await page.close().catch(() => {});
  }
}
