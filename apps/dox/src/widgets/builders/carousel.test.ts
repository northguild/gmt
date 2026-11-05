// @vitest-environment jsdom
import { screen, within } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { expectNoAxeViolations, scrolled, wheelOn } from "~/test/render-widget";
import { renderHtml } from "../test-fixture";
import { wireCarousel, type CarouselBy, type CarouselHandle } from "./carousel";
import { html, setHtml } from "./html";

const controllers: AbortController[] = [];
afterEach(() => {
  for (const c of controllers.splice(0)) c.abort();
});

interface Setup {
  host: HTMLElement;
  intro: HTMLElement;
  about: HTMLElement;
  prev: HTMLButtonElement;
  next: HTMLButtonElement;
  dots: HTMLElement;
  live: HTMLElement;
  handle: CarouselHandle;
  steps: [number, number, CarouselBy][];
  clock: { t: number };
  user: ReturnType<typeof userEvent.setup>;
  signal: AbortController;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  inner?: ReturnType<typeof html>,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (inner) setHtml(e, inner);
  return e;
}

function setup(
  o: { leave?: boolean | ((el: HTMLElement, hide: () => void) => void) } = {},
): Setup {
  const fx = renderHtml(html`<div></div>`);
  const root = fx.first();
  const intro = el(
    "section",
    {},
    html`<p>Intro text</p><a href="#x">A link</a>`,
  );
  const about = el(
    "section",
    {},
    html`<label>Search <input type="text" /></label>`,
  );
  const prev = el("button", { type: "button", "aria-label": "Previous page" });
  const next = el("button", { type: "button", "aria-label": "Next page" });
  const dots = el("div");
  const live = el("p", { "aria-live": "polite" });
  root.append(intro, about, prev, next, dots, live);
  const signal = new AbortController();
  controllers.push(signal);
  const steps: [number, number, CarouselBy][] = [];
  const clock = { t: 1000 };
  const handle = wireCarousel(root, {
    signal: signal.signal,
    pages: [
      { el: intro, label: "Intro" },
      { el: about, label: "About gmt" },
    ],
    prev,
    next,
    dots,
    live,
    keyArea: root,
    wheelArea: root,
    label: "The landing",
    idPrefix: "c",
    now: () => clock.t,
    onSelect: (i, from, by) => steps.push([i, from, by]),
    ...(o.leave
      ? { leave: typeof o.leave === "function" ? o.leave : () => {} }
      : {}),
  });
  return {
    host: fx.host,
    intro,
    about,
    prev,
    next,
    dots,
    live,
    handle,
    steps,
    clock,
    user: userEvent.setup(),
    signal,
  };
}

const shown = (el: HTMLElement): boolean =>
  el.hasAttribute("data-shown") && !el.inert;

describe("carousel", () => {
  it("is a named carousel region whose pages are numbered slides", async () => {
    const s = setup();
    const region = screen.getByRole("region", { name: "The landing" });
    expect(region).toHaveAttribute("aria-roledescription", "carousel");
    expect(s.intro).toHaveAttribute("role", "tabpanel");
    expect(s.intro).toHaveAttribute("aria-roledescription", "slide");
    expect(s.intro).toHaveAttribute("aria-label", "Intro, 1 of 2");
    expect(s.about).toHaveAttribute("aria-label", "About gmt, 2 of 2");
    expect(shown(s.intro)).toBe(true);
    expect(shown(s.about)).toBe(false);
    await expectNoAxeViolations(s.host);
  });

  it("names the button that has a page to open and turns the other off", () => {
    const s = setup();
    expect(s.next).toHaveAccessibleName("Next: About gmt");
    expect(s.next).toHaveAttribute("aria-controls", s.about.id);
    expect(s.prev).toHaveAttribute("tabindex", "-1");
  });

  it("opens the next page from its button and says so politely", async () => {
    const s = setup();
    await s.user.click(s.next);
    expect(shown(s.about)).toBe(true);
    expect(shown(s.intro)).toBe(false);
    expect(s.steps).toEqual([[1, 0, "control"]]);
    expect(s.live).toHaveTextContent("About gmt, 2 of 2");
    expect(s.prev).toHaveAccessibleName("Previous: Intro");
    expect(s.next).toHaveAttribute("tabindex", "-1");
  });

  it("hands focus to the other button, quietly, when its own turns off", async () => {
    const s = setup();
    s.next.focus();
    await s.user.keyboard("{Enter}");
    expect(s.prev).toHaveFocus();
    // Moved by script, so it takes focus without the sonar ping until it next blurs. The mark is
    // the contract with the sonar's CSS, which jsdom does not run.
    /* oxlint-disable dox-test/no-implementation-assert */
    expect(s.prev).toHaveAttribute("data-quiet-focus");
    expect(s.next).not.toHaveAttribute("data-quiet-focus");
    s.prev.blur();
    expect(s.prev).not.toHaveAttribute("data-quiet-focus");
    /* oxlint-enable dox-test/no-implementation-assert */
  });

  it("selects the page of a dot and moves along the dots by key", async () => {
    const s = setup();
    const tabs = within(s.dots).getAllByRole("tab");
    expect(tabs.map((t) => t.getAttribute("aria-selected"))).toEqual([
      "true",
      "false",
    ]);
    await s.user.click(tabs[1]);
    expect(s.handle.index).toBe(1);
    await s.user.keyboard("{Home}");
    expect(s.handle.index).toBe(0);
    expect(tabs[0]).toHaveFocus();
    await s.user.keyboard("{End}");
    expect(s.handle.index).toBe(1);
    expect(s.steps.map((x) => x[2])).toEqual(["control", "key", "key"]);
  });

  it("steps with the arrow keys, except inside a text field", async () => {
    const s = setup();
    screen.getByRole("link", { name: "A link" }).focus();
    await s.user.keyboard("{ArrowRight}");
    expect(s.handle.index).toBe(1);
    // Focus was in the page that closed, so it moves to the page that opens.
    expect(s.about).toHaveFocus();
    await s.user.click(screen.getByRole("textbox", { name: "Search" }));
    await s.user.keyboard("{ArrowLeft}");
    expect(s.handle.index).toBe(1);
    s.about.focus();
    await s.user.keyboard("{ArrowLeft}");
    expect(s.handle.index).toBe(0);
  });

  it("puts every page in the tab order", () => {
    const s = setup();
    expect(s.intro).toHaveAttribute("tabindex", "0");
    expect(s.about).toHaveAttribute("tabindex", "0");
  });

  describe("the wheel", () => {
    it("steps forward once per gesture and holds the rest", () => {
      const s = setup();
      expect(wheelOn(s.intro, { deltaY: 30 })).toBe(true);
      expect(s.handle.index).toBe(0);
      s.clock.t += 20;
      expect(wheelOn(s.intro, { deltaY: 30 })).toBe(true);
      expect(s.handle.index).toBe(1);
      // Momentum after the step is cancelled.
      for (let i = 0; i < 5; i++) {
        s.clock.t += 50;
        expect(wheelOn(s.about, { deltaY: -40 })).toBe(true);
      }
      expect(s.steps).toHaveLength(1);
    });

    it("counts a line as 16 pixels", () => {
      const s = setup();
      wheelOn(s.intro, { deltaY: 3, deltaMode: 1 });
      expect(s.handle.index).toBe(1);
    });

    it("lets a page that scrolls scroll, and goes back only from its top", () => {
      const s = setup();
      s.handle.select(1);
      s.clock.t += 2000;
      s.about.scrollTop = 120;
      scrolled(s.about);
      s.clock.t += 20;
      expect(wheelOn(s.about, { deltaY: -50 })).toBe(false);
      expect(s.handle.index).toBe(1);
      // A fresh gesture at the top returns.
      s.about.scrollTop = 0;
      s.clock.t += 1000;
      expect(wheelOn(s.about, { deltaY: -50 })).toBe(true);
      expect(s.handle.index).toBe(0);
    });

    it("leaves a pinch and Ctrl with the wheel to the browser's zoom", () => {
      const s = setup();
      for (let i = 0; i < 5; i++) {
        s.clock.t += 20;
        expect(wheelOn(s.intro, { deltaY: 60, ctrlKey: true })).toBe(false);
      }
      expect(s.handle.index).toBe(0);
      // Nor does a pinch during a held gesture cancel it.
      s.clock.t += 1000;
      wheelOn(s.intro, { deltaY: 60 });
      expect(s.handle.index).toBe(1);
      s.clock.t += 20;
      expect(wheelOn(s.about, { deltaY: 60, ctrlKey: true })).toBe(false);
    });

    it("does nothing on the last page going down", () => {
      const s = setup();
      s.handle.select(1);
      s.clock.t += 2000;
      expect(wheelOn(s.about, { deltaY: 200 })).toBe(false);
      expect(s.handle.index).toBe(1);
    });
  });

  it("hides a closed page late when a leave hook takes over", () => {
    const s = setup({ leave: true });
    s.handle.select(1);
    expect(shown(s.about)).toBe(true);
    // The hook never calls hide: the intro keeps `data-shown` (the page's CSS keeps it on
    // screen), but is inert at once.
    // oxlint-disable-next-line dox-test/no-implementation-assert
    expect(s.intro).toHaveAttribute("data-shown");
    expect(s.intro.inert).toBe(true);
  });

  it("puts everything back when destroyed", () => {
    const s = setup();
    s.handle.select(1);
    s.signal.abort();
    expect(shown(s.intro)).toBe(false);
    expect(s.about.inert).toBe(false);
    expect(s.about).not.toHaveAttribute("tabindex");
    // The id was the kit's, for the buttons' aria-controls.
    // oxlint-disable-next-line dox-test/no-implementation-assert
    expect(s.about).not.toHaveAttribute("id");
    expect(s.next).not.toHaveAttribute("tabindex");
    expect(s.prev).not.toHaveAttribute("aria-controls");
    expect(s.prev).toHaveAccessibleName("Previous page");
    expect(s.next).toHaveAccessibleName("Next page");
    expect(s.dots).toBeEmptyDOMElement();
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    wheelOn(s.intro, { deltaY: 200 });
    expect(s.steps).toHaveLength(1);
  });

  it("lets no fade still running at teardown hide its page afterwards", () => {
    const held: (() => void)[] = [];
    const s = setup({ leave: (_el, hide) => held.push(hide) });
    s.handle.select(1);
    s.signal.abort();
    for (const hide of held) hide();
    expect(s.intro.inert).toBe(false);
  });

  it("drops the quiet focus mark when destroyed", async () => {
    const s = setup();
    s.next.focus();
    await s.user.keyboard("{Enter}");
    expect(s.prev).toHaveFocus();
    s.signal.abort();
    // oxlint-disable-next-line dox-test/no-implementation-assert
    expect(s.prev).not.toHaveAttribute("data-quiet-focus");
  });

  it("refuses fewer than two pages", () => {
    const root = renderHtml(html`<div></div>`).first();
    const one = el("section");
    const b = el("button");
    root.append(one, b);
    const c = new AbortController();
    controllers.push(c);
    expect(() =>
      wireCarousel(root, {
        signal: c.signal,
        pages: [{ el: one, label: "One" }],
        prev: b,
        next: b,
        dots: root,
        live: root,
        keyArea: root,
        label: "One",
        idPrefix: "z",
      }),
    ).toThrow(/at least two pages/);
  });
});
