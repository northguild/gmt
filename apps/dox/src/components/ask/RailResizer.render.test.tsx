/** @vitest-environment jsdom */
import { useRef } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { installJsdomShims } from "~/test/jsdom-shims";
import { RailResizer, STORAGE_KEY, WIDTH_PROPERTY } from "./RailResizer";

installJsdomShims();

/* jsdom has no layout, so the body and rail report the width their CSS would
   give them: the rail's width var when set, otherwise the default. A 1440 px
   page gives bounds of 489.6 to 720 px (`rail-width.test.ts`). */
const BODY_WIDTH = 1440;
const DEFAULT_WIDTH = 489.6;
const MAX_WIDTH = 720;
const BODY_LABEL = "Page body";

/** The parent that renders the resizer and hands it the container by ref. */
function Page() {
  const body = useRef<HTMLDivElement>(null);
  return (
    <section ref={body} aria-label={BODY_LABEL}>
      <RailResizer railId="rail" container={body} />
      <aside id="rail" aria-label="Widget rail" />
    </section>
  );
}

/** The width the component last asked for, as the layout would apply it. */
let requestedWidth: string | undefined;

function railWidth(): number {
  return requestedWidth
    ? Math.min(Math.max(parseFloat(requestedWidth), DEFAULT_WIDTH), MAX_WIDTH)
    : DEFAULT_WIDTH;
}

function rect(width: number): DOMRect {
  return {
    width,
    height: 800,
    top: 0,
    left: 0,
    right: width,
    bottom: 800,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  };
}

/** The separator, when it reports `now` as its value. */
function handleAt(now: number): HTMLElement {
  return screen.getByRole("separator", {
    name: "Resize the widget panel",
    value: { now },
  });
}

function renderResizer() {
  render(<Page />);
  return {
    handle: screen.getByRole("separator", { name: "Resize the widget panel" }),
    body: screen.getByRole("region", { name: BODY_LABEL }),
  };
}

beforeEach(() => {
  window.localStorage.clear();
  requestedWidth = undefined;
  const setProperty = CSSStyleDeclaration.prototype.setProperty;
  const removeProperty = CSSStyleDeclaration.prototype.removeProperty;
  vi.spyOn(CSSStyleDeclaration.prototype, "setProperty").mockImplementation(
    function (this: CSSStyleDeclaration, name: string, value: string | null) {
      if (name === WIDTH_PROPERTY) requestedWidth = value ?? undefined;
      return setProperty.call(this, name, value);
    },
  );
  vi.spyOn(CSSStyleDeclaration.prototype, "removeProperty").mockImplementation(
    function (this: CSSStyleDeclaration, name: string) {
      if (name === WIDTH_PROPERTY) requestedWidth = undefined;
      return removeProperty.call(this, name);
    },
  );
  vi.spyOn(window, "innerWidth", "get").mockReturnValue(BODY_WIDTH);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      if (this.getAttribute("aria-label") === "Widget rail")
        return rect(railWidth());
      if (this.getAttribute("aria-label") === BODY_LABEL)
        return rect(BODY_WIDTH);
      return rect(0);
    },
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("RailResizer", () => {
  it("is a focusable vertical separator that controls the rail", () => {
    const { handle } = renderResizer();
    expect(handle).toHaveAttribute("aria-orientation", "vertical");
    expect(handle).toHaveAttribute("aria-controls", "rail");
    expect(handle).toHaveAttribute("tabindex", "0");
  });

  it("reports the default width and the page share it holds", () => {
    const { handle } = renderResizer();
    expect(handleAt(490)).toBeInTheDocument();
    expect(handle).toHaveAttribute("aria-valuemin", "490");
    expect(handle).toHaveAttribute("aria-valuemax", "720");
    expect(handle).toHaveAttribute("aria-valuetext", "34% of the page");
  });

  it("widens the rail with ArrowLeft and remembers the width", async () => {
    const user = userEvent.setup();
    const { handle } = renderResizer();
    await user.tab();
    expect(handle).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(handleAt(506)).toBeInTheDocument();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("506");
  });

  it("goes no wider than half the page with End", async () => {
    const user = userEvent.setup();
    const { handle } = renderResizer();
    await user.tab();
    await user.keyboard("{End}");
    expect(handleAt(720)).toBeInTheDocument();
    expect(handle).toHaveAttribute("aria-valuetext", "50% of the page");
  });

  it("goes no narrower than the default with ArrowRight", async () => {
    const user = userEvent.setup();
    renderResizer();
    await user.tab();
    await user.keyboard("{ArrowRight}");
    expect(handleAt(490)).toBeInTheDocument();
  });

  it("restores the stored width on mount", () => {
    window.localStorage.setItem(STORAGE_KEY, "600");
    renderResizer();
    expect(handleAt(600)).toBeInTheDocument();
  });

  it("clamps a stored width wider than half the page", () => {
    window.localStorage.setItem(STORAGE_KEY, "5000");
    renderResizer();
    expect(handleAt(720)).toBeInTheDocument();
  });

  it("remembers the final width when the drag ends before the next frame", async () => {
    /* Hold every frame: the pointer is released before the last move is drawn. */
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 1);
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
    const user = userEvent.setup();
    const { handle } = renderResizer();

    await user.pointer([
      { keys: "[MouseLeft>]", target: handle, coords: { clientX: 900 } },
      { target: handle, coords: { clientX: 800 } },
      { keys: "[/MouseLeft]", target: handle, coords: { clientX: 800 } },
    ]);

    expect(handleAt(590)).toBeInTheDocument();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("590");
  });

  it("resets to the default width on double-click", async () => {
    const user = userEvent.setup();
    const { handle } = renderResizer();
    await user.tab();
    await user.keyboard("{End}");
    expect(handleAt(720)).toBeInTheDocument();
    await user.dblClick(handle);
    expect(handleAt(490)).toBeInTheDocument();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
