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

const CREDITS = [
  {
    label: "Earth imagery",
    parts: [
      "NASA Blue Marble, ",
      { text: "Visible Earth", href: "https://visibleearth.nasa.gov/" },
    ],
  },
  { label: "Night sky", parts: ["HYG star catalogue"] },
];

/** The popover the info button opens: a popover has no role, so its `popovertarget` is the way in. */
function menuOf(info: HTMLElement): HTMLElement {
  const id = info.getAttribute("popovertarget") ?? "";
  // oxlint-disable-next-line testing-library/no-node-access -- a popover has no role to query; the button's popovertarget names it
  const menu = document.getElementById(id);
  if (menu === null) throw new Error(`no popover #${id}`);
  return menu;
}

describe("deckControls", () => {
  it("names the pager and the info button, which holds the five tools", () => {
    renderHtml(deckControls(KEYS, CREDITS));
    for (const name of ["Previous", "Next", "Slide options"])
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    const info = screen.getByRole("button", { name: "Slide options" });
    const menu = menuOf(info);
    expect(menu).toHaveAttribute("popover");
    for (const name of ["Overview", "Keys", "Blank", "Fullscreen", "Unlock"])
      expect(
        within(menu).getByRole("button", { name, hidden: true }),
      ).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("lists the credits it is given in the info menu, after the tools", () => {
    renderHtml(deckControls(KEYS, CREDITS));
    const menu = menuOf(screen.getByRole("button", { name: "Slide options" }));
    const credits = within(menu).getByRole("region", {
      name: "Credits",
      hidden: true,
    });
    const terms = within(credits).getAllByRole("term", { hidden: true });
    expect(terms.map((t) => t.textContent)).toEqual([
      "Earth imagery",
      "Night sky",
    ]);
    expect(
      within(credits).getByRole("link", {
        name: "Visible Earth",
        hidden: true,
      }),
    ).toHaveAttribute("href", "https://visibleearth.nasa.gov/");
    const unlock = within(menu).getByRole("button", {
      name: "Unlock",
      hidden: true,
    });
    expect(
      unlock.compareDocumentPosition(credits) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      within(menu).queryByRole("button", {
        name: "Data credits",
        hidden: true,
      }),
    ).not.toBeInTheDocument();
  });

  it("gives each tool the first key the key table has for it, and none when it has none", () => {
    renderHtml(deckControls(KEYS, CREDITS));
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
    renderHtml(html`${deckControls(KEYS, CREDITS)}${deckDialogs(KEYS)}`);
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
    // A password field has no role: it is found by its label. It shows dots, not the phrase,
    // because the phrase is typed on the projected screen.
    const phrase = screen.getByLabelText("Secret phrase");
    expect(phrase).toHaveAttribute("type", "password");
    expect(phrase).toHaveAttribute("autocomplete", "off");
    expect(phrase).toHaveAttribute("spellcheck", "false");
    // The add-on: the button comes straight after the field, in reading order.
    const go = screen.getByRole("button", {
      name: "Unlock",
      hidden: true,
    });
    expect(
      phrase.compareDocumentPosition(go) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByRole("alert", { hidden: true })).toBeEmptyDOMElement();
  });

  it("keeps a second, hidden list for the spare slides under its own heading", () => {
    renderHtml(deckDialogs(KEYS));
    // Hidden, the heading has no accessible name yet: find it by its text.
    const heading = screen.getByText("Spare slides, for questions");
    expect(heading).not.toBeVisible();
    // The talk's slides and the spares are two lists.
    expect(screen.getAllByRole("list", { hidden: true })).toHaveLength(2);
  });

  it("gives the Unlock tool no key, and keeps its padlocks out of its name", () => {
    renderHtml(deckControls(KEYS, CREDITS));
    const tool = screen.getByRole("button", { name: "Unlock", hidden: true });
    expect(tool).not.toHaveAttribute("aria-keyshortcuts");
    expect(tool).toHaveAccessibleName("Unlock");
  });

  it("has no accessibility violations", async () => {
    const { host } = renderHtml(
      html`${deckControls(KEYS, CREDITS)}${deckDialogs(KEYS)}`,
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
