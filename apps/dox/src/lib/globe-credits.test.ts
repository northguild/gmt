/**
 * @vitest-environment jsdom
 *
 * The globe's data-credits button is the fourth of its control stack (CORE-88), on every mount.
 */
import { watchDataCredits } from "./data-credits";
import { renderGlobeTemplate } from "./globe-mount";

function stack(idPrefix?: string): HTMLElement {
  document.body.innerHTML = renderGlobeTemplate({ idPrefix });
  return document.querySelector<HTMLElement>(".gmt-globe-zoom")!;
}

describe("the globe's control stack", () => {
  it("is one group named Globe controls", () => {
    const group = stack();
    expect(group.getAttribute("role")).toBe("group");
    expect(group.getAttribute("aria-label")).toBe("Globe controls");
  });

  it("holds +, −, ⊙ and the data-credits button, in that tab order", () => {
    const buttons = [...stack().querySelectorAll("button")];
    expect(buttons.map((b) => b.getAttribute("aria-label"))).toEqual([
      "Zoom in",
      "Zoom out",
      "Reset zoom",
      "Data credits",
    ]);
    expect(buttons.every((b) => b.tabIndex === 0)).toBe(true);
    expect(buttons[3]!.getAttribute("data-placement")).toBe("stack");
  });

  it("credits both data sets, with a popover id unique to the mount", () => {
    const group = stack("rail-3");
    const button = group.querySelector("[popovertarget]")!;
    expect(button.getAttribute("popovertarget")).toBe("rail-3-data-credits");
    const panel = document.getElementById("rail-3-data-credits")!;
    expect(panel.hasAttribute("popover")).toBe(true);
    expect(panel.textContent).toContain("Time zone boundaries");
    expect(panel.textContent).toContain("Earth imagery");
  });

  it("is not a zoom button, so the zoom handler never sees it", () => {
    const info = stack().querySelector("[popovertarget]")!;
    expect(info.hasAttribute("data-globe-zoom")).toBe(false);
  });

  it("keeps aria-expanded true to the panel, since WebKit does not expose it for a popover button", () => {
    const button = stack("rail-4").querySelector("[popovertarget]")!;
    const panel = document.getElementById("rail-4-data-credits")!;
    expect(button.getAttribute("aria-expanded")).toBe("false");
    watchDataCredits();
    watchDataCredits(); // idempotent: one listener, not two
    const toggle = (newState: string) =>
      panel.dispatchEvent(Object.assign(new Event("toggle"), { newState }));
    toggle("open");
    expect(button.getAttribute("aria-expanded")).toBe("true");
    toggle("closed");
    expect(button.getAttribute("aria-expanded")).toBe("false");
  });
});
