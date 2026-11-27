/**
 * @vitest-environment jsdom
 *
 * Mounting the globe's chrome onto a stand-in engine: the real one needs a canvas and WebGPU,
 * which jsdom has neither of. What is tested is the wiring a reader feels: choosing a zone in
 * the search box focuses it, the zoom buttons zoom, and a selection on the globe fills the box.
 */
import { screen, within } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { renderHtml } from "~/widgets/test-fixture";
import { installJsdomShims } from "../test/jsdom-shims";
import { renderGlobeTemplate } from "./globe-mount";
import { HOME_LOCKED_QUERY } from "./home-carousel";

installJsdomShims();

const calls: string[] = [];
let selectListener: ((reading: { id: string } | null) => void) | undefined;
let interactListener: ((kind?: string) => void) | undefined;
let zoomListener: ((dir: 1 | -1, closeness: number) => void) | undefined;
/* What the stand-in globe has selected: a tap picks a zone, or clears the choice, before it reports. */
let selected: string | null = "Europe/London";
/* Whether the stand-in's `focusZone` reports a selection, as the real one does. Off by default, so
   the wiring tests see only the selections they make. */
let focusSelects = false;
/* The reader's own zone as the stand-in places it, or null when it cannot. */
let homeZone: string | null = "Europe/London";
let engineOptions:
  | {
      framing: (
        width: number,
        height: number,
      ) => { cx: number; cy: number; radius: number };
      framingWatch: Element[];
      entrance?: string;
      pauseWhenHidden?: Element;
      pauseWhile?: (hold: (held: boolean) => void) => () => void;
    }
  | undefined;

const cue = vi.fn();
/** Locks the globe was asked for, each waiting for the globe to start it. */
const locks: (() => void)[] = [];
vi.mock("./sound/cue", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./sound/cue")>()),
  cue: (...args: unknown[]) => cue(...args),
}));

const cueOnAppear = vi.fn();
vi.mock("./sound/appear", () => ({
  cueOnAppear: (...args: unknown[]) => cueOnAppear(...args),
}));

vi.mock("./globe", () => ({
  initGlobe: async (
    _surface: unknown,
    _panel: unknown,
    _filters: unknown,
    options: { engine?: typeof engineOptions },
  ) => {
    engineOptions = options.engine;
    return {
      getZones: () => [{ id: "Asia/Tokyo" }, { id: "Europe/London" }],
      getSelected: () => selected,
      homeZone,
      focusZone: (id: string) => {
        calls.push(`focus ${id}`);
        if (focusSelects) selectListener?.({ id });
      },
      zoomBy: (factor: number) => calls.push(`zoomBy ${factor.toFixed(2)}`),
      setZoom: (value: number) => calls.push(`setZoom ${value}`),
      onSelect: (fn: typeof selectListener) => {
        selectListener = fn;
      },
      lockOn: (onStart: () => void) => locks.push(onStart),
      onInteract: (fn: (kind?: string) => void) => {
        interactListener = fn;
      },
      onZoom: (fn: typeof zoomListener) => {
        zoomListener = fn;
      },
      requestRender: () => calls.push("render"),
      destroy: () => calls.push("destroy"),
    };
  },
}));

let lifetime: AbortController;
/* Every mount is torn down after its test: its page-level listeners must not outlive it. */
const mounted: { destroy(): void }[] = [];

async function mount(
  args: { zone?: string } = {},
  options?: Parameters<typeof renderGlobeTemplate>[0],
) {
  const { mountGlobe } = await import("./globe-mount");
  const r = renderHtml(renderGlobeTemplate(options));
  const handle = await mountGlobe(r.host, args, lifetime.signal);
  mounted.push(handle);
  return { handle, host: r.host };
}

beforeEach(() => {
  calls.length = 0;
  cue.mockClear();
  cueOnAppear.mockClear();
  locks.length = 0;
  selectListener = undefined;
  interactListener = undefined;
  zoomListener = undefined;
  selected = "Europe/London";
  focusSelects = false;
  homeZone = "Europe/London";
  engineOptions = undefined;
  lifetime = new AbortController();
});

afterEach(() => {
  lifetime.abort();
  for (const handle of mounted.splice(0)) handle.destroy();
});

describe("mountGlobe", () => {
  it("starts the search box on the selected zone", async () => {
    await mount();
    expect(screen.getByRole("combobox", { name: "Find a zone" })).toHaveValue(
      "Europe/London",
    );
  });

  it("focuses a zone the reader picks from the search list", async () => {
    await mount();
    const user = userEvent.setup();
    const input = screen.getByRole("combobox", { name: "Find a zone" });
    await user.clear(input);
    await user.type(input, "tok");
    await user.click(screen.getByRole("option", { name: "Asia/Tokyo" }));
    expect(calls).toContain("focus Asia/Tokyo");
  });

  it("zooms in, out and back with the three buttons", async () => {
    await mount();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Zoom in" }));
    await user.click(screen.getByRole("button", { name: "Zoom out" }));
    await user.click(screen.getByRole("button", { name: "Reset zoom" }));
    expect(calls).toEqual(["zoomBy 1.40", "zoomBy 0.71", "setZoom 1"]);
  });

  it("goes back to the reader's own zone from Locate, after they have looked elsewhere", async () => {
    await mount({ zone: "Asia/Tokyo" });
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Go to my time zone" }));
    expect(calls).toEqual(["focus Asia/Tokyo", "focus Europe/London"]);
  });

  it("leaves Locate out when the globe cannot place the reader's zone", async () => {
    homeZone = null;
    await mount();
    expect(
      screen.queryByRole("button", { name: "Go to my time zone" }),
    ).not.toBeInTheDocument();
  });

  it("plays the Lens servo for every zoom step, rising in and falling out, at the camera's closeness", async () => {
    await mount();
    zoomListener?.(1, 0.25);
    zoomListener?.(-1, 0);
    expect(cue.mock.calls).toEqual([
      ["zoomIn", 0.25],
      ["zoomOut", 0],
    ]);
  });

  it("follows a selection made on the globe", async () => {
    await mount();
    selectListener?.({ id: "Asia/Tokyo" });
    expect(screen.getByRole("combobox", { name: "Find a zone" })).toHaveValue(
      "Asia/Tokyo",
    );
    selectListener?.(null);
    expect(screen.getByRole("combobox", { name: "Find a zone" })).toHaveValue(
      "",
    );
  });

  it("locates a place the reader chooses, and not the zone it was seeded with", async () => {
    focusSelects = true;
    await mount({ zone: "Asia/Tokyo" });
    expect(cue).not.toHaveBeenCalled();
    selectListener?.({ id: "Europe/London" });
    selectListener?.(null);
    expect(cue).not.toHaveBeenCalled();
    // The sound waits for the globe's lock on the pin, and plays once it starts.
    for (const start of locks) start();
    expect(cue.mock.calls).toEqual([["locate"]]);
  });

  it("seeds the zone it was asked for and tears down", async () => {
    const { handle } = await mount({ zone: "Asia/Tokyo" });
    expect(calls).toContain("focus Asia/Tokyo");
    handle.destroy();
    expect(calls).toContain("destroy");
  });
});

describe("every globe pauses", () => {
  it("watches the framed globe's own surface and the cover, as the hero does", async () => {
    await mount();
    expect(engineOptions?.pauseWhenHidden).toBeInstanceOf(HTMLElement);
    const holds: boolean[] = [];
    const stop = engineOptions?.pauseWhile?.((held) => holds.push(held));
    const menu = document.body;
    menu.setAttribute("data-mobile-menu-expanded", "");
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(holds).toEqual([true]);
    menu.removeAttribute("data-mobile-menu-expanded");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(holds).toEqual([true, false]);
    stop?.();
  });

  it("gives the hero the same hold, on its whole stage", async () => {
    await mount({}, { space: true });
    expect(engineOptions?.pauseWhenHidden).toBeInstanceOf(HTMLElement);
    expect(engineOptions?.pauseWhile).toBeTypeOf("function");
  });
});

describe("mountGlobe in space mode", () => {
  const finder = () =>
    screen.getByRole("region", { name: "Zone finder", hidden: true });
  const magnifier = () => screen.getByRole("button", { name: "Find a zone" });

  /* The landing's locked layout (a wide landscape screen) or the stacked one, read live. */
  function layout(locked: boolean) {
    vi.spyOn(window, "matchMedia").mockImplementation(
      (query: string) =>
        ({
          matches: query === HOME_LOCKED_QUERY ? locked : false,
          media: query,
        }) as MediaQueryList,
    );
  }

  /* The tests below run on the landing's locked layout, where a touch of the globe opens the finder. */
  beforeEach(() => layout(true));

  it("keeps the zone finder shut until the globe is worked", async () => {
    await mount({}, { space: true });
    expect(finder()).toHaveAttribute("inert");
    expect(magnifier()).toHaveAttribute("aria-expanded", "false");
    expect(magnifier()).toHaveAttribute("aria-controls", finder().id);
  });

  it("opens on the first work on the globe without moving focus", async () => {
    await mount({}, { space: true });
    const before = screen.getByRole("button", { name: "Find a zone" });
    before.focus();
    interactListener?.();
    expect(finder()).not.toHaveAttribute("inert");
    expect(magnifier()).toHaveAttribute("aria-expanded", "true");
    expect(before).toHaveFocus();
  });

  it("opens from the magnifier without scrolling the page to the search", async () => {
    await mount({}, { space: true });
    const user = userEvent.setup();
    const scrollY = window.scrollY;
    const focus = vi.spyOn(HTMLElement.prototype, "focus");
    await user.click(magnifier());
    const search = screen.getByRole("combobox", { name: "Find a zone" });
    expect(search).toHaveFocus();
    const onSearch = focus.mock.contexts.flatMap((target, i) =>
      target === search ? [focus.mock.calls[i]?.[0]] : [],
    );
    expect(onSearch.length).toBeGreaterThan(0);
    for (const options of onSearch)
      expect(options).toEqual({ preventScroll: true });
    expect(window.scrollY).toBe(scrollY);
    focus.mockRestore();
  });

  it("stays shut after the reader closes it, until the magnifier reopens it", async () => {
    await mount({}, { space: true });
    const user = userEvent.setup();
    interactListener?.();
    await user.click(screen.getByRole("button", { name: "Close zone list" }));
    expect(finder()).toHaveAttribute("inert");
    interactListener?.();
    expect(finder()).toHaveAttribute("inert");

    await user.click(magnifier());
    expect(finder()).not.toHaveAttribute("inert");
    expect(screen.getByRole("combobox", { name: "Find a zone" })).toHaveFocus();
  });

  describe("by layout", () => {
    it("stacked, a tap that picks a zone leaves the sheet shut; the magnifier opens it", async () => {
      layout(false);
      await mount({}, { space: true });
      interactListener?.("tap");
      expect(finder()).toHaveAttribute("inert");
      expect(magnifier()).toHaveAttribute("aria-expanded", "false");
      interactListener?.();
      expect(magnifier()).toHaveAttribute("aria-expanded", "false");

      await userEvent.setup().click(magnifier());
      expect(magnifier()).toHaveAttribute("aria-expanded", "true");
    });

    it("locked, a tap that picks a zone still opens the finder", async () => {
      layout(true);
      await mount({}, { space: true });
      interactListener?.("tap");
      expect(magnifier()).toHaveAttribute("aria-expanded", "true");
    });
  });

  it("reopens for a tap that picks a zone, with focus on the zone list", async () => {
    await mount({}, { space: true });
    const user = userEvent.setup();
    interactListener?.("drag");
    await user.click(screen.getByRole("button", { name: "Close zone list" }));
    expect(finder()).toHaveAttribute("inert");

    selected = "Asia/Tokyo";
    interactListener?.("tap");
    expect(finder()).not.toHaveAttribute("inert");
    expect(
      screen.getByRole("listbox", { name: /^Pinned zones/ }),
    ).toHaveFocus();
  });

  it("stays shut after the reader closes it for a tap on no place", async () => {
    await mount({}, { space: true });
    const user = userEvent.setup();
    interactListener?.("drag");
    await user.click(screen.getByRole("button", { name: "Close zone list" }));

    selected = null;
    interactListener?.("tap");
    expect(finder()).toHaveAttribute("inert");
    expect(magnifier()).toHaveFocus();
  });

  it("closes from the close button and from Escape, and tells the globe to place its card again", async () => {
    await mount({}, { space: true });
    const user = userEvent.setup();
    await user.click(magnifier());
    await user.click(screen.getByRole("button", { name: "Close zone list" }));
    expect(finder()).toHaveAttribute("inert");
    expect(magnifier()).toHaveFocus();
    await user.click(magnifier());
    await user.keyboard("{Escape}");
    expect(finder()).toHaveAttribute("inert");
    expect(magnifier()).toHaveFocus();
    expect(calls.filter((call) => call === "render")).toHaveLength(4);
  });

  it("hides the zoom stack while the list is open and brings it back, with focus on the magnifier, when it shuts", async () => {
    await mount({}, { space: true });
    const user = userEvent.setup();
    const stack = () =>
      screen.getByRole("group", { name: "Globe controls", hidden: true });
    expect(stack()).not.toHaveAttribute("inert");

    await user.click(magnifier());
    expect(stack()).toHaveAttribute("inert");

    await user.keyboard("{Escape}");
    expect(stack()).not.toHaveAttribute("inert");
    expect(magnifier()).toHaveFocus();
  });

  it("opens from the magnifier with focus in the search and its list shut", async () => {
    await mount({}, { space: true });
    const user = userEvent.setup();
    await user.click(magnifier());
    const search = screen.getByRole("combobox", { name: "Find a zone" });
    expect(search).toHaveFocus();
    expect(search).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByRole("option", { name: "Asia/Tokyo" }),
    ).not.toBeInTheDocument();
  });

  it("closes the open suggestions on the first Escape and the drawer on the second", async () => {
    await mount({}, { space: true });
    const user = userEvent.setup();
    await user.click(magnifier());
    const search = screen.getByRole("combobox", { name: "Find a zone" });
    await user.clear(search);
    await user.keyboard("tok");
    expect(search).toHaveAttribute("aria-expanded", "true");
    await user.keyboard("{Escape}");
    expect(search).toHaveAttribute("aria-expanded", "false");
    expect(finder()).not.toHaveAttribute("inert");
    expect(search).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(finder()).toHaveAttribute("inert");
    expect(magnifier()).toHaveFocus();
  });

  it.each([
    ["empty", ""],
    ["filled", "zzz"],
  ])(
    "closes the drawer on one Escape, search %s, and focuses the magnifier",
    async (_name, typed) => {
      await mount({}, { space: true });
      const user = userEvent.setup();
      await user.click(magnifier());
      if (typed) await user.keyboard(typed);
      const search = screen.getByRole("combobox", { name: "Find a zone" });
      expect(search).toHaveAttribute("aria-expanded", "false");
      await user.keyboard("{Escape}");
      expect(finder()).toHaveAttribute("inert");
      expect(magnifier()).toHaveFocus();
    },
  );

  it("opens the search list downward and names the box without a visible label", async () => {
    await mount({}, { space: true });
    expect(
      screen.getByRole("combobox", { name: "Find a zone" }),
    ).toHaveAttribute("placeholder", "Find zone, e.g. Asia/Tokyo");
    // The placement is the combobox's own attribute, set on a bare custom element with no role.
    // oxlint-disable-next-line dox-test/no-class-query, dox-test/no-house-class, dox-test/no-implementation-assert, testing-library/no-node-access
    expect(document.querySelector("gmt-combobox")).toHaveAttribute(
      "data-placement",
      "below",
    );
  });

  it("asks the globe to open with the dawn", async () => {
    await mount({}, { space: true });
    expect(engineOptions?.entrance).toBe("dawn");
  });

  it("leaves the landing's arrival to its dawn sounds, where a page globe plays the Steel horizon", async () => {
    await mount({}, { space: true });
    expect(cueOnAppear).not.toHaveBeenCalled();
    const { handle } = await mount();
    expect(cueOnAppear).toHaveBeenCalledExactlyOnceWith(
      expect.any(HTMLElement),
      "appearGlobe",
      expect.any(AbortSignal),
    );
    const [, , life] = cueOnAppear.mock.calls[0] as [
      unknown,
      unknown,
      AbortSignal,
    ];
    handle.destroy();
    expect(life.aborted).toBe(true);
  });

  it("orders the hero's stack: zoom, the two ways to a place, then Look at and the credits", async () => {
    await mount({}, { space: true });
    const stack = screen.getByRole("group", { name: "Globe controls" });
    const named = [
      "Zoom in",
      "Zoom out",
      "Reset zoom",
      "Find a zone",
      "Go to my time zone",
      "Look at",
      "About this sky",
    ].map((name) => within(stack).getByRole("button", { name }));
    /* The Look at bar is shut, so its rows are not among the stack's buttons. */
    expect(within(stack).getAllByRole("button")).toEqual(named);
  });

  it("leaves the page globe without a drawer or a magnifier", async () => {
    await mount();
    expect(
      screen.queryByRole("button", { name: "Find a zone" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Zone finder", hidden: true }),
    ).not.toBeInTheDocument();
  });
});

describe("the Earth's frame in space mode", () => {
  const box = (left: number, top: number, width: number, height: number) =>
    ({
      left,
      top,
      width,
      height,
      right: left + width,
      bottom: top + height,
    }) as DOMRect;

  /** Lay the surface, the stage and the zoom stack out at fixed boxes. */
  async function frame(stack: { left: number; top: number }) {
    const { host } = await mount({}, { space: true });
    /* The gate hooks are the page contract this layout test measures; they carry no role or name. */
    /* oxlint-disable dox-test/no-class-query, testing-library/no-node-access */
    const surface = host.querySelector<HTMLElement>(
      '[data-gate="globe-layer"]',
    );
    const stage = host.querySelector<HTMLElement>('[data-gate="globe-stage"]');
    const zoom = host.querySelector<HTMLElement>('[data-gate="globe-zoom"]');
    /* oxlint-enable dox-test/no-class-query, testing-library/no-node-access */
    if (!surface || !stage || !zoom)
      throw new Error("the hero's parts are missing");
    const place = (el: HTMLElement, rect: DOMRect) =>
      vi.spyOn(el, "getBoundingClientRect").mockReturnValue(rect);
    place(surface, box(0, 0, 400, 800));
    place(stage, box(0, 100, 400, 400));
    for (const [name, value] of [
      ["offsetLeft", stack.left],
      ["offsetTop", stack.top],
      ["offsetWidth", 34],
      ["offsetHeight", 166],
    ] as const)
      Object.defineProperty(zoom, name, { configurable: true, value });
    return {
      framing: engineOptions?.framing,
      watched: engineOptions?.framingWatch,
      stage,
      zoom,
      surface,
    };
  }

  it("fills the stage when the zoom stack is far from the disc", async () => {
    const { framing } = await frame({ left: 360, top: 360 });
    expect(framing?.(400, 800)).toEqual({
      cx: 200,
      cy: 300,
      radius: Math.min(200 * 0.94, (200 - 16) / 1.06),
    });
  });

  it("shrinks the disc just enough to keep the zoom stack off it", async () => {
    /* The stack's nearest corner is 150 px from the centre, so the disc stops 8 px short. */
    const { framing } = await frame({ left: 330, top: 220 });
    const near = Math.hypot(330 - 200, 100 + 220 - 300);
    expect(framing?.(400, 800).radius).toBeCloseTo(near - 8, 5);
  });

  it("measures again when the stage or the zoom stack changes size", async () => {
    const { watched, stage, zoom, surface } = await frame({
      left: 360,
      top: 360,
    });
    expect(watched).toEqual([stage, zoom, surface]);
  });

  describe("at 64rem and up", () => {
    /* A 2000 px page: the surface spans it, the stage is a 1000 px square at its second column. */
    async function wide(
      copyRight: number | null,
      stack = { left: 1960, top: 960 },
      column: DOMRect | null = null,
    ) {
      const matches = (query: string) => query.includes("64rem");
      vi.spyOn(window, "matchMedia").mockImplementation(
        (query: string) =>
          ({ matches: matches(query), media: query }) as MediaQueryList,
      );
      vi.spyOn(document.documentElement, "clientWidth", "get").mockReturnValue(
        2000,
      );
      const { host } = await mount({}, { space: true });
      /* oxlint-disable dox-test/no-class-query, testing-library/no-node-access */
      const part = (name: string) =>
        host.querySelector<HTMLElement>(`[data-gate="${name}"]`);
      /* oxlint-enable dox-test/no-class-query, testing-library/no-node-access */
      const surface = part("globe-layer");
      const stage = part("globe-stage");
      const zoom = part("globe-zoom");
      if (!surface || !stage || !zoom)
        throw new Error("the hero's parts are missing");
      const place = (el: HTMLElement, rect: DOMRect) =>
        vi.spyOn(el, "getBoundingClientRect").mockReturnValue(rect);
      place(surface, box(0, 0, 2000, 1000));
      place(stage, box(700, 0, 1000, 1000));
      for (const [name, value] of [
        ["offsetLeft", stack.left - 700],
        ["offsetTop", stack.top],
        ["offsetWidth", 34],
        ["offsetHeight", 34],
      ] as const)
        Object.defineProperty(zoom, name, { configurable: true, value });
      if (copyRight !== null) {
        const copy = document.createElement("div");
        copy.dataset["gate"] = "hero-copy";
        const word = document.createElement("p");
        word.getBoundingClientRect = () => box(100, 300, copyRight - 100, 40);
        copy.append(word);
        if (column) copy.getBoundingClientRect = () => column;
        host.append(copy);
      }
      return engineOptions?.framing?.(2000, 1000);
    }

    it("centres the disc on the page when the copy leaves room", async () => {
      const frame = await wide(500);
      expect(frame?.cx).toBe(1000);
    });

    it("moves the disc right only as far as keeps the atmosphere 16 px off the copy", async () => {
      const frame = await wide(900);
      expect(frame?.cx).toBeCloseTo(900 + 16 + 1.06 * (frame?.radius ?? 0), 5);
      expect(frame?.cx).toBeGreaterThan(1000);
    });

    it("never puts the disc left of the page's centre", async () => {
      const frame = await wide(100);
      expect(frame?.cx).toBe(1000);
    });

    it("keeps the area's centre while the copy cannot be found", async () => {
      const frame = await wide(null);
      expect(frame?.cx).toBe(1000);
    });

    describe("in the landing's carousel mode", () => {
      afterEach(() => {
        delete document.documentElement.dataset["homeCarousel"];
      });

      it("follows the column's own edge, not the widest panel inside it", async () => {
        document.documentElement.dataset["homeCarousel"] = "on";
        const frame = await wide(1300, undefined, box(100, 80, 800, 600));
        expect(frame?.cx).toBeCloseTo(
          900 + 16 + 1.06 * (frame?.radius ?? 0),
          5,
        );
      });

      it("keeps the area's centre while the column has no box", async () => {
        document.documentElement.dataset["homeCarousel"] = "wait";
        const frame = await wide(1300, undefined, box(0, 0, 0, 0));
        expect(frame?.cx).toBe(1000);
      });
    });
  });
});
