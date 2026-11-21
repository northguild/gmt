/**
 * What only Deck 0 promises in the browser: the live demos play recordings and say so, the page
 * tool shows both JSON panels and the deck page registers its three tools. `scripts/slides-check.mjs`
 * runs it once per engine, at the first size. What the built page holds (the quoted answers filled,
 * the Moon build on `day-off`) is read by `built.test.ts`; the slide order, the spares and the dev
 * key in `dist/` and the recordings are read once from the built files by `slides-built.test.ts`.
 */
import { blockOffSite } from "../../../scripts/gate-checks.mjs";
import { unlockDecks } from "../../../scripts/lib/slides-check-helpers.mjs";

/** Resolves to the cells measured: 1 when the check ran, 0 when it crashed. */
export async function checkDeckContent({
  browserName,
  browser,
  base,
  pagePath,
  size,
  report,
}) {
  const at = (rule, message) =>
    report(browserName, size.width, pagePath, rule, "deck", message);
  let measured = 0;
  const context = await browser.newContext({ viewport: size });
  try {
    await blockOffSite(context, base);
    await unlockDecks(context);
    await context.addInitScript(() => {
      window.__registeredTools = [];
      Object.defineProperty(navigator, "modelContext", {
        configurable: true,
        value: {
          registerTool(tool) {
            window.__registeredTools.push(tool?.name);
          },
        },
      });
    });
    const page = await context.newPage();
    await page.goto(`${base}${pagePath}?globe=canvas2d`, { waitUntil: "load" });

    // Offline, every live demo plays its recording and says so. A Dox slide plays only what the
    // presenter asks, so the gate goes to the slide by its deep link and clicks its first ready
    // question, as the presenter does.
    const goTo = (id) =>
      page.evaluate((i) => {
        location.hash = `#${i}`;
      }, id);
    for (const id of ["ask-dox", "qa"]) {
      await goTo(id);
      const source = page.locator(`#${id} [data-slot="source"]`).first();
      try {
        await page
          .locator(`#${id} .gmt-hive-example`)
          .first()
          .click({ timeout: 15000 });
        await source.waitFor({ state: "attached", timeout: 15000 });
        await page.waitForFunction(
          (el) => /Recorded/.test(el?.textContent ?? ""),
          await source.elementHandle(),
          { timeout: 15000 },
        );
      } catch {
        at(
          "live-recorded",
          `${id} does not show "Recorded" with the network cut`,
        );
      }
    }

    // The page tool runs as the slide shows: Dox's turn lists both Easters, and the receipt opens the grids.
    await goTo("page-tools");
    try {
      await page.waitForFunction(
        () => {
          const slide = document.getElementById("page-tools");
          const turn = slide?.querySelector(
            '.gmt-hive-turn[data-role="assistant"]',
          );
          return (
            /Julian:\s*\d{4}-\d{2}-\d{2}/.test(turn?.textContent ?? "") &&
            slide?.querySelector(".gmt-hive-receipt") !== null
          );
        },
        undefined,
        { timeout: 15000 },
      );
    } catch {
      at(
        "page-tools-answer",
        "page-tools shows no Easter dates or no receipt from the page tool",
      );
    }

    const tools = await page.evaluate(() => window.__registeredTools ?? []);
    if (tools.length !== 3)
      at(
        "page-tools-registered",
        `the deck page registered ${tools.length} tool(s), not 3: ${JSON.stringify(tools)}`,
      );
    measured += 1;
  } catch (error) {
    at(
      "check-crashed",
      `the deck content check crashed: ${String(error?.message ?? error).split("\n")[0]}`,
    );
  } finally {
    await context.close().catch(() => {});
  }
  return measured;
}
