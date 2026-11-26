/**
 * The article family of the slide-deck gate: the deck with scripts off (every slide heading in the
 * page, in order) and in print (each slide section breaks after the page, no controls bar, no canvas).
 */
import { blockOffSite } from "../../gate-checks.mjs";
import { unlockDecks } from "../slides-check-helpers.mjs";
import { findingAt, readSlides } from "./reads.mjs";

/** What the print stylesheet does to the live page. Resolves to the slide titles read on the way, or what was read before a crash. */
async function checkPrint({ browser, base, pagePath, size }, at) {
  let expected = [];
  const live = await browser.newContext({ viewport: size });
  try {
    await blockOffSite(live, base);
    await unlockDecks(live);
    const page = await live.newPage();
    await page.goto(`${base}${pagePath}?globe=canvas2d`, { waitUntil: "load" });
    expected = (await readSlides(page)).map((s) => s.title);
    await page.emulateMedia({ media: "print" });
    const print = await page.evaluate(() => ({
      sections: [...document.querySelectorAll("[data-slide]")].map((s) => ({
        title: s.querySelector("h2")?.textContent?.trim() ?? "",
        breakAfter: getComputedStyle(s).breakAfter,
      })),
      bar: [...document.querySelectorAll(".gmt-deck-bar")].filter(
        (c) => getComputedStyle(c).display !== "none",
      ).length,
      canvases: [...document.querySelectorAll("canvas")].filter(
        (c) => getComputedStyle(c).display !== "none",
      ).length,
    }));
    for (const s of print.sections)
      if (s.breakAfter !== "page")
        at(
          "print-break",
          `in print, slide "${s.title}" has break-after "${s.breakAfter}", not "page"`,
        );
    if (print.bar > 0)
      at(
        "print-controls",
        "in print, the controls bar is displayed and adds a blank page",
      );
    if (print.canvases > 0)
      at(
        "print-canvas",
        `in print, ${print.canvases} canvas(es) are displayed`,
      );
    return expected;
  } catch (error) {
    at(
      "check-crashed",
      `the print check crashed: ${String(error?.message ?? error).split("\n")[0]}`,
    );
    return expected;
  } finally {
    await live.close().catch(() => {});
  }
}

/** Resolves to the cells measured: 1 when the no-script read ran, 0 when it crashed. */
export async function checkArticle(env) {
  const { browser, base, pagePath, size } = env;
  const at = findingAt(env);
  const expected = await checkPrint(env, at);

  const plain = await browser.newContext({
    viewport: size,
    javaScriptEnabled: false,
  });
  try {
    await blockOffSite(plain, base);
    const page = await plain.newPage();
    await page.goto(`${base}${pagePath}`, { waitUntil: "load" });
    const titles = await page.evaluate(() =>
      [...document.querySelectorAll("[data-slide] h2")].map(
        (h) => h.textContent?.trim() ?? "",
      ),
    );
    if (JSON.stringify(titles) !== JSON.stringify(expected))
      at(
        "no-js-order",
        `without scripts the slide headings read ${JSON.stringify(titles)}, not ${JSON.stringify(expected)}`,
      );
    return 1;
  } catch (error) {
    at(
      "check-crashed",
      `the no-script check crashed: ${String(error?.message ?? error).split("\n")[0]}`,
    );
    return 0;
  } finally {
    await plain.close().catch(() => {});
  }
}
