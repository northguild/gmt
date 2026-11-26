/**
 * The presenter family of the slide-deck gate, at the first size. The deck page is sized so its
 * stage is exactly 1920x1080, and the presenter page opens beside it in one context. The parity
 * check (`presenter-parity.mjs`) runs over every slide; the laptop check (`presenter-laptop.mjs`)
 * runs once per laptop size.
 */
import { blockOffSite } from "../../gate-checks.mjs";
import { unlockDecks } from "../slides-check-helpers.mjs";
import { checkLaptop, presenterPath } from "./presenter-laptop.mjs";
import { checkParity, DECK_STAGE, sizeDeck } from "./presenter-parity.mjs";
import { findingAt, readSlides } from "./reads.mjs";

/** The presenter page's laptop sizes, with the narrowest frames each must give. */
const LAPTOPS = [
  { width: 1440, height: 900, current: 720, next: 400 },
  { width: 1280, height: 800, current: 620, next: 340 },
];

export async function checkPresenter(env) {
  const { browser, base, pagePath, size } = env;
  const at = findingAt(env);
  const context = await browser.newContext({ viewport: size });
  let measured = 0;
  try {
    await blockOffSite(context, base);
    await unlockDecks(context);
    const deck = await context.newPage();
    const deckUrl = `${base}${pagePath}?globe=canvas2d`;
    await deck.goto(deckUrl, { waitUntil: "load" });
    const all = await readSlides(deck);
    const main = all.filter((s) => !s.spare);
    const stage = await sizeDeck(deck);
    if (
      Math.abs(stage.width - DECK_STAGE.width) > 1 ||
      Math.abs(stage.height - DECK_STAGE.height) > 1
    ) {
      at(
        "presenter-reference",
        `the deck's stage is ${Math.round(stage.width)}x${Math.round(stage.height)}, not 1920x1080`,
      );
      return 0;
    }
    const presenter = await context.newPage();
    await presenter.setViewportSize({
      width: LAPTOPS[0].width,
      height: LAPTOPS[0].height,
    });
    await presenter.goto(`${base}${presenterPath(pagePath)}?globe=canvas2d`, {
      waitUntil: "load",
    });
    await presenter.waitForSelector("[data-pv-stage] [data-slide-stage]");
    measured += await checkParity({
      deck,
      deckUrl,
      presenter,
      main,
      total: all.length,
      at,
    });
    await presenter.close();
    await deck.close();
    for (const laptop of LAPTOPS)
      measured += await checkLaptop({ context, base, pagePath, laptop, at });
    return measured;
  } catch (error) {
    at(
      "check-crashed",
      `the presenter check crashed: ${String(error?.message ?? error).split("\n")[0]}`,
    );
    return measured;
  } finally {
    await context.close().catch(() => {});
  }
}
