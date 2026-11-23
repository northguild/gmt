/**
 * @vitest-environment jsdom
 *
 * The presenter's previews over a fixture of three slides (0, 4 and 1 builds): the copy a preview
 * is, and what the next preview shows after each state. Nothing here is asynchronous.
 *
 * A preview is aria-hidden and inert, so no role reaches it: its fixture is the deck's own markup
 * and its structure (house classes, `data-*`) is what the copy promises.
 */
/* oxlint-disable dox-test/no-markup-read, dox-test/no-house-class, dox-test/no-implementation-assert -- see the header */
import { screen, within } from "@testing-library/dom";
import { createDeck } from "./deck";
import { deckSlides, readDeckParts, type DeckPart } from "./deck-parts";
import type { PresenterElements } from "./presenter-elements";
import { createSlideView, nextState, slidePreview } from "./presenter-page";

let parts: DeckPart[] = [];

beforeEach(() => {
  document.body.innerHTML = `<div hidden data-presenter-source>
    <section id="first" class="gmt-slide" aria-labelledby="first-title" data-slide data-minutes="1">
      <h2 id="first-title">First</h2>
      <div data-wall-figures aria-label="Wall of five sites"><figure><figcaption>One</figcaption></figure></div>
      <script>1</script><link rel="preload" href="/x">
      <aside data-notes><h3>Speaker notes</h3><p>Greet the room.</p></aside>
    </section>
    <section id="second" class="gmt-slide" data-slide data-minutes="2">
      <h2>Second</h2>
      <div data-build="1"><p>Build one</p></div><div data-build="2"><p>Build two</p></div>
      <div data-build="3"><p>Build three</p></div><div data-build="4"><p>Build four</p></div>
      <astro-island><template data-astro-template></template><p>Island words</p></astro-island>
    </section>
    <section id="third" class="gmt-slide" data-slide data-minutes="1">
      <h2>Third</h2><div data-build="1"><p>Last build</p></div>
    </section>
  </div>`;
  parts = readDeckParts(document.body);
});

afterEach(() => {
  document.body.replaceChildren();
});

/** The preview's builds: `[data-reached]` is how a build is shown or held back. */
function reached(preview: HTMLElement): string[] {
  // oxlint-disable-next-line testing-library/no-node-access, dox-test/no-class-query -- the preview is aria-hidden: no role reaches it
  return Array.from(preview.querySelectorAll<HTMLElement>("[data-build]")).map(
    (el) => el.dataset["reached"] ?? "",
  );
}

/** A preview in the page, so a query finds it. */
function shownPreview(index: number, build: number): HTMLElement {
  const preview = slidePreview(parts[index] as DeckPart, build);
  document.body.append(preview);
  return preview;
}

describe("slidePreview", () => {
  it("is one fit box holding one shown slide, with no ids, notes, scripts or islands", () => {
    const preview = slidePreview(parts[0] as DeckPart, 0);
    expect(preview).toHaveClass("gmt-stage-fit");
    expect(preview).toHaveAttribute("data-slide-stage");
    // oxlint-disable-next-line testing-library/no-node-access, dox-test/no-class-query -- the preview is aria-hidden: no role reaches it
    const slides = preview.querySelectorAll(".gmt-slide");
    expect(slides).toHaveLength(1);
    expect(slides[0]).toHaveAttribute("data-shown");
    for (const gone of [
      "[id]",
      "[aria-labelledby]",
      "[data-notes]",
      "script",
      "link",
      "astro-island",
    ])
      // oxlint-disable-next-line testing-library/no-node-access, dox-test/no-class-query -- the preview is aria-hidden: no role reaches it
      expect(preview.querySelector(gone)).toBeNull();
  });

  it("lays the island's server-rendered words out in place of the island", () => {
    const preview = shownPreview(1, 0);
    expect(within(preview).getByText("Island words")).toBeInTheDocument();
  });

  it("is hidden from assistive technology and inert", () => {
    const preview = slidePreview(parts[0] as DeckPart, 0);
    expect(preview).toHaveAttribute("aria-hidden", "true");
    expect(preview.inert).toBe(true);
  });

  it("stands a plate named by the piece's own name where the wall's figures were", () => {
    const preview = shownPreview(0, 0);
    expect(within(preview).getByText("Wall of five sites")).toBeInTheDocument();
    /* oxlint-disable testing-library/no-node-access, dox-test/no-class-query, jest-dom/prefer-in-document -- the preview is aria-hidden: no role reaches it */
    expect(preview.querySelectorAll("[data-wall-figures]")).toHaveLength(0);
    /* oxlint-enable testing-library/no-node-access, dox-test/no-class-query, jest-dom/prefer-in-document */
    expect(within(preview).queryByText("One")).not.toBeInTheDocument();
  });

  it("reaches the builds up to the one asked for", () => {
    expect(reached(slidePreview(parts[1] as DeckPart, 2))).toEqual([
      "true",
      "true",
      "false",
      "false",
    ]);
  });
});

describe("nextState", () => {
  it("shows the same slide at its next build while builds are left", () => {
    const next = nextState(parts, createDeck(deckSlides(parts)), 1, 1);
    expect(next.label).toBe("Next: build 2 of 4");
    expect(next.part).toBe(parts[1]);
  });

  it("shows the next slide at build 0 after the last build", () => {
    const next = nextState(parts, createDeck(deckSlides(parts)), 1, 4);
    expect(next.label).toBe("Next: slide 3 of 3, Third");
    expect(next.part).toBe(parts[2]);
  });

  it("follows the deck: a spare goes back to the questions slide, the last slide has none", () => {
    document.body.insertAdjacentHTML(
      "beforeend",
      `<section id="spare" class="gmt-slide" data-slide data-spare><h2>Spare</h2></section>`,
    );
    const withSpare = readDeckParts(document.body);
    const deck = createDeck(deckSlides(withSpare));
    expect(nextState(withSpare, deck, 2, 1).part).toBeNull();
    expect(nextState(withSpare, deck, 3, 0).label).toBe(
      "Next: slide 2 of 4, Second",
    );
  });

  it("shows nothing after the last build of the last slide", () => {
    expect(nextState(parts, createDeck(deckSlides(parts)), 2, 1)).toEqual({
      part: null,
      label: "End of the deck",
    });
  });
});

describe("createSlideView", () => {
  function view() {
    const make = (tag: string): HTMLElement => {
      const el = document.createElement(tag);
      document.body.append(el);
      return el;
    };
    const els = {
      stage: make("div"),
      position: make("p"),
      notes: make("div"),
      nextLabel: make("p"),
      nextStage: make("div"),
    } satisfies Pick<
      PresenterElements,
      "stage" | "position" | "notes" | "nextLabel" | "nextStage"
    >;
    return { els, show: createSlideView(parts, els) };
  }

  it("shows the next build of this slide while builds are left", () => {
    const { els, show } = view();
    show({ slide: 1, build: 1, blanked: false });
    expect(screen.getByText("Next: build 2 of 4")).toBeInTheDocument();
    expect(reached(els.stage)).toEqual(["true", "false", "false", "false"]);
    expect(reached(els.nextStage)).toEqual(["true", "true", "false", "false"]);
  });

  it("flips the builds of the current slide without redrawing it", () => {
    const { els, show } = view();
    show({ slide: 1, build: 0, blanked: false });
    // oxlint-disable-next-line testing-library/no-node-access, dox-test/no-class-query -- the preview is aria-hidden: no role reaches it
    const before = els.stage.querySelector("[data-slide]");
    show({ slide: 1, build: 3, blanked: false });
    // oxlint-disable-next-line testing-library/no-node-access, dox-test/no-class-query -- the preview is aria-hidden: no role reaches it
    expect(els.stage.querySelector("[data-slide]")).toBe(before);
    expect(reached(els.stage)).toEqual(["true", "true", "true", "false"]);
  });

  it("shows the next slide from the last build", () => {
    const { els, show } = view();
    show({ slide: 1, build: 4, blanked: false });
    expect(screen.getByText("Next: slide 3 of 3, Third")).toBeInTheDocument();
    expect(within(els.nextStage).getByText("Third")).toBeInTheDocument();
  });

  it("says the deck has ended, with no preview, at its last state", () => {
    const { els, show } = view();
    show({ slide: 2, build: 1, blanked: false });
    expect(screen.getByText("End of the deck")).toBeInTheDocument();
    // oxlint-disable-next-line testing-library/no-node-access, dox-test/no-class-query -- the preview is aria-hidden: no role reaches it
    expect(els.nextStage.querySelector("[data-slide-stage]")).toBeNull();
  });
});
