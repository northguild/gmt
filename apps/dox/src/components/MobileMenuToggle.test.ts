/**
 * @vitest-environment jsdom
 *
 * The mobile menu button announces its state: `aria-expanded` is on the `<button>`, and flips on
 * open, close and Escape. Starlight 0.41 sets it on the custom element instead.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { defineMenuButton } from "~/lib/menu-button";

/**
 * The element reads its button and nav in its constructor, as Starlight's markup supplies them.
 * Building the tree in an inert document defers the upgrade until it is attached with its children.
 */
function mount(): void {
  const doc = document.implementation.createHTMLDocument("");
  const nav = doc.createElement("nav");
  const host = doc.createElement("starlight-menu-button");
  const button = doc.createElement("button");
  button.setAttribute("aria-expanded", "false");
  button.setAttribute("aria-label", "Menu");
  button.setAttribute("aria-controls", "starlight__sidebar");
  host.append(button);
  nav.append(host);
  const page = doc.createElement("main");
  // The override queries Starlight's own page-frame class, so the fixture must carry it.
  // oxlint-disable-next-line dox-test/no-class-query
  page.className = "main-frame";
  document.body.append(document.adoptNode(nav), document.adoptNode(page));
}

beforeAll(defineMenuButton);

// The setup file unstubs globals after each test, so the stub is renewed before each.
beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({
    addEventListener: () => {},
    matches: false,
  }));
});

afterEach(() => {
  document.body.replaceChildren();
  document.body.removeAttribute("data-mobile-menu-expanded");
});

describe("the mobile menu button", () => {
  it("reports expanded on the button while the menu is open", async () => {
    const user = userEvent.setup();
    mount();
    const button = screen.getByRole("button", { name: "Menu" });
    const page = screen.getByRole("main", { hidden: true });
    expect(button).toHaveAttribute("aria-expanded", "false");
    await user.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(page).toHaveAttribute("inert");
    await user.click(button);
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(page).not.toHaveAttribute("inert");
  });

  it("closes on Escape and returns focus to the button", async () => {
    const user = userEvent.setup();
    mount();
    const button = screen.getByRole("button", { name: "Menu" });
    await user.click(button);
    await user.keyboard("{Escape}");
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button).toHaveFocus();
  });
});

/**
 * Retirement canary: Starlight 0.42 ships a native `popovertarget` menu button that is correct.
 * When this fails, delete `src/components/MobileMenuToggle.astro`, `src/lib/menu-button.ts`, this
 * file and the `MobileMenuToggle` entry in `astro.config.mjs`, and the rule in `gmt-controls.css`
 * keeps working against the native button.
 */
describe("the menu button override's retirement", () => {
  it("is deleted once Starlight 0.42 is installed", () => {
    const pkg = resolve(
      import.meta.dirname,
      "../../node_modules/@astrojs/starlight/package.json",
    );
    const [major, minor] = (
      JSON.parse(readFileSync(pkg, "utf8")) as { version: string }
    ).version
      .split(".")
      .map(Number);
    const older = major === 0 && minor < 42;
    expect(
      older,
      "Starlight is 0.42 or newer: delete the MobileMenuToggle override (src/components/MobileMenuToggle.astro, src/lib/menu-button.ts, this test, and its entry in astro.config.mjs)",
    ).toBe(true);
  });
});
