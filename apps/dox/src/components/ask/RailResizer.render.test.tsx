/** @vitest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RailResizer } from "./RailResizer";

/* jsdom has no layout, so the body and rail report the width their CSS would
   give them: the rail's width var when set, otherwise the default. A 1440 px
   page gives bounds of 489.6 to 720 px (`rail-width.test.ts`). */
const BODY_WIDTH = 1440;
const DEFAULT_WIDTH = 489.6;

function railWidth(body: HTMLElement): number {
  const set = body.style.getPropertyValue("--gmt-hive-rail-width");
  return set ? Math.min(Math.max(parseFloat(set), DEFAULT_WIDTH), 720) : DEFAULT_WIDTH;
}

function rect(width: number): DOMRect {
  return { width, height: 800, top: 0, left: 0, right: width, bottom: 800, x: 0, y: 0, toJSON: () => ({}) };
}

function renderResizer() {
  const result = render(
    <div className="gmt-hive-body" data-testid="body">
      <RailResizer railId="rail" />
      <aside id="rail" />
    </div>,
  );
  const body = screen.getByTestId("body");
  return { ...result, body, handle: screen.getByRole("separator") };
}

beforeEach(() => {
  window.localStorage.clear();
  vi.spyOn(window, "innerWidth", "get").mockReturnValue(BODY_WIDTH);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      if (this.id === "rail") return rect(railWidth(this.parentElement!));
      if (this.classList.contains("gmt-hive-body")) return rect(BODY_WIDTH);
      return rect(0);
    },
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("RailResizer", () => {
  it("is a focusable vertical separator for the rail", () => {
    const { handle } = renderResizer();
    expect(handle.getAttribute("aria-orientation")).toBe("vertical");
    expect(handle.getAttribute("aria-controls")).toBe("rail");
    expect(handle.getAttribute("tabindex")).toBe("0");
  });

  it("widens the rail with ArrowLeft and remembers the width", async () => {
    const { body, handle } = renderResizer();
    handle.focus();
    await userEvent.keyboard("{ArrowLeft}");
    expect(body.style.getPropertyValue("--gmt-hive-rail-width")).toBe("505.6px");
    expect(window.localStorage.getItem("gmt-dox-rail-width")).toBe("506");
  });

  it("goes no wider than half the page with End", async () => {
    const { body, handle } = renderResizer();
    handle.focus();
    await userEvent.keyboard("{End}");
    expect(body.style.getPropertyValue("--gmt-hive-rail-width")).toBe("720px");
    expect(handle.getAttribute("aria-valuenow")).toBe("720");
    expect(handle.getAttribute("aria-valuetext")).toBe("50% of the page");
  });

  it("goes no narrower than the default with ArrowRight", async () => {
    const { body, handle } = renderResizer();
    handle.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(body.style.getPropertyValue("--gmt-hive-rail-width")).toBe(
      `${DEFAULT_WIDTH}px`,
    );
  });

  it("restores the stored width on mount", () => {
    window.localStorage.setItem("gmt-dox-rail-width", "600");
    const { body } = renderResizer();
    expect(body.style.getPropertyValue("--gmt-hive-rail-width")).toBe("600px");
  });

  it("clamps a stored width wider than half the page", () => {
    window.localStorage.setItem("gmt-dox-rail-width", "5000");
    const { body } = renderResizer();
    expect(body.style.getPropertyValue("--gmt-hive-rail-width")).toBe("720px");
  });

  it("remembers the final width when the drag ends before the next frame", () => {
    /* Hold every frame: the pointer is released before the last move is drawn. */
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 1);
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
    const { body, handle } = renderResizer();
    const captured = new Set<number>();
    Object.assign(handle, {
      setPointerCapture: (id: number) => captured.add(id),
      hasPointerCapture: (id: number) => captured.has(id),
      releasePointerCapture: (id: number) => captured.delete(id),
    });

    fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientX: 900 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 800 });
    fireEvent.pointerUp(handle, { pointerId: 1, clientX: 800 });

    expect(body.style.getPropertyValue("--gmt-hive-rail-width")).toBe("589.6px");
    expect(window.localStorage.getItem("gmt-dox-rail-width")).toBe("590");
    expect(body.hasAttribute("data-resizing")).toBe(false);
  });

  it("resets to the default width on double-click", async () => {
    const { body, handle } = renderResizer();
    handle.focus();
    await userEvent.keyboard("{End}");
    fireEvent.doubleClick(handle);
    expect(body.style.getPropertyValue("--gmt-hive-rail-width")).toBe("");
    expect(window.localStorage.getItem("gmt-dox-rail-width")).toBeNull();
  });
});
