// @vitest-environment jsdom
import { screen, within } from "@testing-library/dom";
import type { LoadedWidget } from "~/components/ask/widget-registry";
import { onceDestroy } from "~/lib/widget-mount";
import { html } from "~/widgets/builders";
import {
  cellsInColumn,
  blankBlockCount,
  expectNoAxeViolations,
  flushWidget,
  growRegionOf,
  heldSamples,
  renderWidget,
  scrolled,
  setRange,
  sharesStyling,
  skeletonRows,
  wheelOn,
} from "./render-widget";

const fixture: LoadedWidget<never> = {
  renderTemplate: () =>
    html`<label>Level <input type="range" min="0" max="10" value="1"></label>
     <button type="button">Go</button><p role="status"></p>`,
  mount: async (root) => {
    const view = within(root);
    const out = view.getByRole("status");
    view.getByRole("slider").addEventListener("change", (e) => {
      out.textContent = (e.target as HTMLInputElement).value;
    });
    return onceDestroy(() => {});
  },
};

const scoped: LoadedWidget<never> = {
  renderTemplate: (idPrefix) =>
    html`<p role="status" id="${idPrefix}-out">scope ${idPrefix}</p>`,
  mount: async () => onceDestroy(() => {}),
};

// The listener `leaky` never removes, which this file removes itself so the next file sharing
// the worker does not inherit it.
const strays: Array<() => void> = [];
afterEach(() => {
  for (const remove of strays.splice(0)) remove();
});

const leaky: LoadedWidget<never> = {
  renderTemplate: () => html`<p>x</p>`,
  mount: async () => {
    const stray = () => {};
    window.addEventListener("resize", stray);
    strays.push(() => window.removeEventListener("resize", stray));
    return onceDestroy(() => {});
  },
};

const tidy: LoadedWidget<never> = {
  renderTemplate: () => html`<p>x</p>`,
  mount: async (_root, _args, signal) => {
    window.addEventListener("resize", () => {}, { signal });
    return onceDestroy(() => {});
  },
};

describe("renderWidget", () => {
  it("mounts the template and drives it with the user", async () => {
    const w = await renderWidget(fixture);
    await w.user.click(screen.getByRole("button", { name: "Go" }));
    setRange(screen.getByRole("slider", { name: "Level" }), 7);
    expect(screen.getByRole("status")).toHaveTextContent("7");
    w.destroy();
    expect(document.body).not.toContainElement(w.root);
  });

  it("scopes the template with idPrefix, which defaults to test", async () => {
    const plain = await renderWidget(scoped);
    expect(screen.getByRole("status")).toHaveTextContent(/^scope test$/);
    plain.destroy();
    const named = await renderWidget(scoped, { idPrefix: "alpha" });
    expect(screen.getByRole("status")).toHaveTextContent(/^scope alpha$/);
    named.destroy();
  });

  it("keeps two renders apart with different prefixes", async () => {
    const a = await renderWidget(scoped, { idPrefix: "a" });
    const b = await renderWidget(scoped, { idPrefix: "b" });
    const [first, second] = screen.getAllByRole("status");
    expect(first).toHaveTextContent(/scope a/);
    expect(second).toHaveTextContent(/scope b/);
    a.destroy();
    b.destroy();
  });

  it("accepts a listener released by the abort signal", async () => {
    const w = await renderWidget(tidy);
    expect(() => w.destroy()).not.toThrow();
  });

  it("catches a leaked listener", async () => {
    const w = await renderWidget(leaky);
    expect(() => w.destroy()).toThrow(/left 1 listener/);
  });

  it("takes its listener recorder off window when the load fails", async () => {
    const add = window.addEventListener;
    const remove = window.removeEventListener;
    const failing: LoadedWidget<never> = {
      renderTemplate: () => html`<p>x</p>`,
      mount: async () => {
        throw new Error("load failed");
      },
    };
    await expect(renderWidget(failing)).rejects.toThrow("load failed");
    expect(window.addEventListener).toBe(add);
    expect(window.removeEventListener).toBe(remove);
    expect(screen.queryByText("x")).not.toBeInTheDocument();
  });

  it("flushWidget settles", async () => {
    await expect(flushWidget()).resolves.toBeUndefined();
  });
});

describe("setRange", () => {
  it("throws on a non-slider", async () => {
    const w = await renderWidget(fixture);
    expect(() => setRange(screen.getByRole("button"), 3)).toThrow(
      /type="range"/,
    );
    w.destroy();
  });
});

describe("expectNoAxeViolations", () => {
  it("passes a named button", async () => {
    const w = await renderWidget(fixture);
    await expect(expectNoAxeViolations(w.root)).resolves.toBeUndefined();
    w.destroy();
  });

  it("fails a button with no name", async () => {
    const w = await renderWidget({
      renderTemplate: () => html`<button type="button"></button>`,
      mount: async () => onceDestroy(() => {}),
    });
    const failure = await expectNoAxeViolations(w.root).catch(
      (e: unknown) => e,
    );
    expect(String(failure)).toMatch(/button-name/);
    w.destroy();
  });
});

describe("cellsInColumn", () => {
  const grid: LoadedWidget<never> = {
    renderTemplate: () =>
      html`<table aria-label="Counters">
         <thead><tr><th scope="col">Counter</th><th scope="col">Week</th></tr></thead>
         <tbody>
           <tr><th scope="row">GPS</th><td>1</td></tr>
           <tr><th scope="row">GAL</th><td>2</td></tr>
         </tbody>
       </table>`,
    mount: async () => onceDestroy(() => {}),
  };

  it("returns that column's cell from each body row, row headers included", async () => {
    await renderWidget(grid);
    const table = screen.getByRole("table", { name: "Counters" });
    expect(cellsInColumn(table, "Week").map((c) => c.textContent)).toEqual([
      "1",
      "2",
    ]);
    expect(
      cellsInColumn(table, /^counter$/i).map((c) => c.textContent),
    ).toEqual(["GPS", "GAL"]);
  });

  it("throws when no header has that name", async () => {
    await renderWidget(grid);
    const table = screen.getByRole("table", { name: "Counters" });
    expect(() => cellsInColumn(table, "Era")).toThrow(/no column header "?Era/);
  });
});

describe("wheelOn and scrolled", () => {
  const probe: LoadedWidget<never> = {
    renderTemplate: () =>
      html`<div role="region" aria-label="Pane" id="pane"></div>`,
    mount: async () => onceDestroy(() => {}),
  };

  it("reports whether the page cancelled the wheel", async () => {
    const w = await renderWidget(probe);
    const pane = screen.getByRole("region", { name: "Pane" });
    expect(wheelOn(pane, { deltaY: 10 })).toBe(false);
    const stop = (e: Event) => e.preventDefault();
    pane.addEventListener("wheel", stop);
    expect(wheelOn(pane, { deltaY: 10 })).toBe(true);
    pane.removeEventListener("wheel", stop);
    w.destroy();
  });

  it("delivers the wheel's delta, mode and Ctrl key, and a scroll", async () => {
    const w = await renderWidget(probe);
    const pane = screen.getByRole("region", { name: "Pane" });
    const seen: string[] = [];
    const note = (e: Event) => {
      if (e instanceof WheelEvent)
        seen.push(`${e.type}:${e.deltaY}:${e.deltaMode}:${e.ctrlKey}`);
      else seen.push(e.type);
    };
    for (const type of ["wheel", "scroll"]) pane.addEventListener(type, note);
    wheelOn(pane, { deltaY: 3, deltaMode: 1 });
    wheelOn(pane, { deltaY: -2, ctrlKey: true });
    scrolled(pane);
    for (const type of ["wheel", "scroll"])
      pane.removeEventListener(type, note);
    expect(seen).toEqual(["wheel:3:1:false", "wheel:-2:0:true", "scroll"]);
    w.destroy();
  });
});

describe("the layout-filler helpers", () => {
  const filler: LoadedWidget<never> = {
    renderTemplate: () =>
      // oxlint-disable-next-line dox-test/no-house-class -- growRegionOf looks for this custom element, so the fixture has to write it
      html`<gmt-grow><p>live</p></gmt-grow><p>outside</p>
         <span data-sample="widest one"></span><span data-sample="second"></span>
         <table aria-label="Cards"><tbody>
           <tr data-skeleton aria-hidden="true"><td><span data-state="blank"></span><span data-state="blank"></span></td></tr>
           <tr aria-hidden="true"><td></td></tr>
         </tbody></table>
         <select aria-label="A" class="x y"></select><select aria-label="B" class="x y"></select>
         <select aria-label="C" class="z"></select>`,
    mount: async () => onceDestroy(() => {}),
  };

  it("lists the held samples in order", async () => {
    const w = await renderWidget(filler);
    expect(heldSamples(w.root)).toEqual(["widest one", "second"]);
    w.destroy();
  });

  it("finds the skeleton rows and counts a cell's blank blocks", async () => {
    const w = await renderWidget(filler);
    const rows = skeletonRows(w.root);
    expect(rows).toHaveLength(1);
    expect(
      blankBlockCount(within(rows[0]!).getByRole("cell", { hidden: true })),
    ).toBe(2);
    w.destroy();
  });

  it("finds the grow region around content, and none outside one", async () => {
    const w = await renderWidget(filler);
    const live = screen.getByText("live");
    const outside = screen.getByText("outside");
    expect(growRegionOf(live)).not.toBeNull();
    expect(growRegionOf(outside)).toBeNull();
    w.destroy();
  });

  it("tells controls that wear the same styling from ones that do not", async () => {
    const w = await renderWidget(filler);
    const [a, b, c] = ["A", "B", "C"].map((n) =>
      screen.getByRole("combobox", { name: n }),
    );
    expect(sharesStyling(a!, b!)).toBe(true);
    expect(sharesStyling(a!, c!)).toBe(false);
    w.destroy();
  });
});
