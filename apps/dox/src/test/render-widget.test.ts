// @vitest-environment jsdom
import { screen, within } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vitest";
import type { LoadedWidget } from "~/components/ask/widget-registry";
import { onceDestroy } from "~/lib/widget-mount";
import { html } from "~/widgets/builders";
import {
  cellsInColumn,
  expectNoAxeViolations,
  flushWidget,
  renderWidget,
  setRange,
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
