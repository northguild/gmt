/** @vitest-environment jsdom */
import { screen, within } from "@testing-library/dom";
import { expectNoAxeViolations } from "~/test/render-widget";
import { renderHtml } from "../test-fixture";
import { deckControls, deckDialogs, overviewItems } from "./deck-controls";
import { html } from "./html";

const KEYS = [
  { action: "next", keys: ["→", "Space"], label: "Next step" },
  { action: "blank", keys: ["B", "."], label: "Blank the stage" },
  { action: "fullscreen", keys: ["F"], label: "Fullscreen on or off" },
];

describe("deckControls", () => {
  it("names the pager and the info button, which holds the five tools", () => {
    renderHtml(deckControls(KEYS));
    for (const name of ["Previous", "Next", "Slide options"])
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    const info = screen.getByRole("button", { name: "Slide options" });
    const menu = document.getElementById(
      info.getAttribute("popovertarget") ?? "",
    );
    expect(menu).toHaveAttribute("popover");
    for (const name of ["Overview", "Keys", "Blank", "Fullscreen", "Unlock"])
      expect(
        within(menu!).getByRole("button", { name, hidden: true }),
      ).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("gives each tool the first key the key table has for it, and none when it has none", () => {
    renderHtml(deckControls(KEYS));
    expect(
      screen.getByRole("button", { name: "Blank", hidden: true }),
    ).toHaveAttribute("aria-keyshortcuts", "B");
    expect(
      screen.getByRole("button", { name: "Fullscreen", hidden: true }),
    ).toHaveAttribute("aria-keyshortcuts", "F");
    expect(
      screen.getByRole("button", { name: "Overview", hidden: true }),
    ).not.toHaveAttribute("aria-keyshortcuts");
  });
});

describe("deckDialogs", () => {
  it("writes the key rows it is given into a real table", () => {
    renderHtml(html`${deckControls(KEYS)}${deckDialogs(KEYS)}`);
    const table = screen.getByRole("table", {
      name: "Keys for the slides",
      hidden: true,
    });
    const rows = within(table).getAllByRole("row", { hidden: true });
    expect(rows.map((r) => r.textContent)).toEqual([
      "KeyWhat it does",
      "→ or SpaceNext step",
      "B or .Blank the stage",
      "FFullscreen on or off",
    ]);
  });

  it("asks for the secret phrase in a labelled field, with Unlock joined to it and an alert for a wrong phrase", () => {
    renderHtml(deckDialogs(KEYS));
    expect(
      screen.getByRole("heading", { name: "Unlock the slides", hidden: true }),
    ).toBeInTheDocument();
    const phrase = screen.getByRole("textbox", {
      name: "Secret phrase",
      hidden: true,
    });
    expect(phrase).toHaveAttribute("id", "deck-unlock-code");
    expect(phrase).toHaveAttribute("autocomplete", "off");
    expect(phrase).toHaveAttribute("spellcheck", "false");
    const go = screen.getByRole("button", {
      name: "Unlock",
      hidden: true,
    });
    expect(go).toHaveAttribute("id", "deck-unlock-go");
    // The add-on: the button sits straight after the input, in one row.
    expect(phrase.parentElement).toHaveClass("gmt-deck-addon");
    expect(phrase.nextElementSibling).toBe(go);
    expect(screen.getByRole("alert", { hidden: true })).toBeEmptyDOMElement();
  });

  it("gives the Unlock tool both padlocks, for the stylesheet to show one", () => {
    renderHtml(deckControls(KEYS));
    const tool = screen.getByRole("button", { name: "Unlock", hidden: true });
    expect(tool.querySelector("kbd")).toBeNull();
    const icons = Array.from(
      tool.querySelectorAll<HTMLElement>("[data-icon]"),
      (el) => el.dataset.icon,
    );
    expect(icons).toEqual(["unlock", "lock"]);
    expect(tool.querySelectorAll('svg[aria-hidden="true"]')).toHaveLength(2);
  });

  it("has no accessibility violations", async () => {
    const { host } = renderHtml(
      html`${deckControls(KEYS)}${deckDialogs(KEYS)}`,
    );
    await expectNoAxeViolations(host);
  });
});

describe("overviewItems", () => {
  it("links each slide with its minutes and escapes the title", () => {
    renderHtml(
      html`<ol>${overviewItems([
        { id: "a", title: "A <b>bold</b> claim", minutes: 2 },
        { id: "b", title: "No time", minutes: null },
      ])}</ol>`,
    );
    const first = screen.getByRole("link", { name: "A <b>bold</b> claim" });
    expect(first).toHaveAttribute("href", "#a");
    expect(screen.getAllByRole("listitem").map((li) => li.textContent)).toEqual(
      ["A <b>bold</b> claim 2 min", "No time"],
    );
  });
});
