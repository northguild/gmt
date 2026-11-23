/**
 * The presenter family's parity check: the text of the current preview sits where it sits on the
 * deck's stage (each box over its stage's box, within 0.005), the preview lies inside its frame,
 * and the next label says what Next does. Run for every slide at its first and last build.
 */
import { frames } from "../page-frames.mjs";
import { insideBox } from "../slides-check-helpers.mjs";
import { settle, STAGE, visible } from "./reads.mjs";

export const DECK_STAGE = { width: 1920, height: 1080 };
const PARITY = 0.005;

/** Visible text leaves of a slide (an element with text of its own), outside stand-ins, as boxes over `stage`. */
const READ_LEAVES = ({ slide, stage, visibleSource }) => {
  const visible = new Function(`return (${visibleSource})`)();
  const root = document.querySelector(slide);
  const outer = document.querySelector(stage).getBoundingClientRect();
  const leaves = [...root.querySelectorAll("*")].filter(
    (el) =>
      !el.closest(
        "[data-notes], [data-plate], [data-wall-figures], [data-live], astro-island, canvas",
      ) &&
      [...el.childNodes].some(
        (n) => n.nodeType === 3 && n.textContent.trim() !== "",
      ) &&
      visible(el, root),
  );
  return {
    leaves: leaves.map((el) => {
      const r = el.getBoundingClientRect();
      return {
        text: el.textContent.trim().slice(0, 24),
        x: (r.x - outer.x) / outer.width,
        y: (r.y - outer.y) / outer.height,
        width: r.width / outer.width,
        height: r.height / outer.height,
        abs: { x: r.x, y: r.y, width: r.width, height: r.height },
      };
    }),
    frame: (() => {
      const f = document
        .querySelector("[data-pv-stage]")
        ?.getBoundingClientRect();
      return f ? { x: f.x, y: f.y, width: f.width, height: f.height } : null;
    })(),
  };
};

const rectOf = (page, selector) =>
  page
    .locator(selector)
    .first()
    .evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    });

/** Waits until the shown slide's boxes have not changed for 30 frames: typed and staged text is in. */
const textStill = (page) =>
  page.waitForFunction(
    () => {
      const slide = document.querySelector("[data-slide][data-shown]");
      if (!slide) return false;
      const sign = [...slide.querySelectorAll("*")]
        .map((e) => {
          const r = e.getBoundingClientRect();
          return `${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.width)},${Math.round(r.height)},${getComputedStyle(e).opacity}`;
        })
        .join(";");
      window.__still = window.__sign === sign ? (window.__still ?? 0) + 1 : 0;
      window.__sign = sign;
      return window.__still >= 30;
    },
    undefined,
    { polling: "raf" },
  );

/**
 * Sizes the deck window so the stage is 1920x1080: the stage takes what the nav and the bar leave,
 * so the window grows by what the stage lacks until it has it.
 */
export async function sizeDeck(page, want = DECK_STAGE) {
  let height = want.height + 160;
  let stage = null;
  for (let tries = 0; tries < 4; tries += 1) {
    await page.setViewportSize({ width: want.width, height });
    await frames(page);
    stage = await rectOf(page, STAGE);
    const lack = want.height - stage.height;
    if (Math.abs(lack) <= 0.5) break;
    height += Math.round(lack);
  }
  return stage;
}

/** Opens the deck at `slide`'s `build` by its address and waits until the stage and the text are still. */
export async function arrive(deck, deckUrl, slide, build) {
  await deck.goto(`${deckUrl}#${slide.id}${build > 0 ? `/${build}` : ""}`);
  await deck.waitForFunction(
    (id) => document.querySelector("[data-slide][data-shown]")?.id === id,
    slide.id,
  );
  await settle(deck);
  // The flight and the wall hold some slides' text back until they rest.
  await deck.waitForFunction(() => {
    const d = document.querySelector("[data-deck-space]")?.dataset;
    return (
      !d ||
      (d.flight !== "moving" && d.wall !== "approach" && d.wall !== "breaking")
    );
  });
  await textStill(deck);
}

const positionIs = (page, slide, build) =>
  page.waitForFunction(
    ({ n, b, title, builds }) => {
      const t = document.querySelector("[data-pv-position]")?.textContent ?? "";
      const buildPart = / build (\d+) of /.exec(t);
      return (
        t.startsWith(`Slide ${n} of `) &&
        t.includes(`: ${title}`) &&
        (builds === 0 ? !buildPart : buildPart?.[1] === String(b))
      );
    },
    { n: slide.index + 1, b: build, title: slide.title, builds: slide.builds },
  );

/** What the label above the next preview should say after `state`. */
function nextLabelFor(main, total, i, build) {
  const s = main[i];
  if (build < s.builds) return `Next: build ${build + 1} of ${s.builds}`;
  if (i < main.length - 1)
    return `Next: slide ${i + 2} of ${total}, ${main[i + 1].title}`;
  return "End of the deck";
}

export async function checkParity({
  deck,
  deckUrl,
  presenter,
  main,
  total,
  at,
}) {
  let measured = 0;
  const steps = main.flatMap((s, i) =>
    [...new Set([0, s.builds])].map((build) => ({ i, build })),
  );
  for (const { i, build } of steps) {
    const s = main[i];
    const label = `slide "${s.title}" build ${build}`;
    const target = `presenter › slide "${s.title}"`;
    await arrive(deck, deckUrl, s, build);
    // Step the presenter to the state with its own buttons, from wherever it is.
    await stepTo(presenter, main, i, build);
    await positionIs(
      presenter,
      { index: i, title: s.title, builds: s.builds },
      build,
    );
    await settle(presenter);
    const room = await deck.evaluate(READ_LEAVES, {
      slide: "[data-slide][data-shown]",
      stage: STAGE,
      visibleSource: String(visible),
    });
    const view = await presenter.evaluate(READ_LEAVES, {
      slide: "[data-pv-stage] [data-slide]",
      stage: "[data-pv-stage] [data-slide-stage]",
      visibleSource: String(visible),
    });
    measured += 1;
    if (room.leaves.length !== view.leaves.length)
      at(
        "preview-parity",
        `${label}: the room shows ${room.leaves.length} text boxes, the preview ${view.leaves.length}`,
        target,
      );
    else
      for (const [k, a] of room.leaves.entries()) {
        const b = view.leaves[k];
        const off = Math.max(
          Math.abs(a.x - b.x),
          Math.abs(a.y - b.y),
          Math.abs(a.width - b.width),
          Math.abs(a.height - b.height),
        );
        if (off > PARITY) {
          at(
            "preview-parity",
            `${label}: "${a.text}" is ${off.toFixed(3)} of the stage off its place in the preview`,
            target,
          );
          break;
        }
      }
    for (const b of view.leaves)
      if (view.frame && !insideBox(b.abs, view.frame, 1.5)) {
        at(
          "preview-outside-frame",
          `${label}: "${b.text}" leaves the preview's frame`,
          target,
        );
        break;
      }
    const label2 = await presenter
      .locator("[data-pv-next-label]")
      .textContent();
    const want = nextLabelFor(main, total, i, build);
    if (label2?.trim() !== want)
      at(
        "next-label",
        `${label}: the next label reads "${label2?.trim()}", not "${want}"`,
        target,
      );
  }
  return measured;
}

/** Steps the presenter with its own buttons until it shows slide `i` at `build`. */
async function stepTo(presenter, main, i, build) {
  const reads = () => presenter.locator("[data-pv-position]").textContent();
  for (let guard = 0; guard < 400; guard += 1) {
    const t = (await reads()) ?? "";
    const slide = Number(/^Slide (\d+) of/.exec(t)?.[1]) - 1;
    const b = Number(/ build (\d+) of/.exec(t)?.[1] ?? 0);
    if (slide === i && b === build) return;
    const forward = slide < i || (slide === i && b < build);
    await presenter.click(forward ? "#pv-next" : "#pv-prev");
    await frames(presenter);
  }
  throw new Error(`the presenter never reached slide ${i + 1} build ${build}`);
}
