/**
 * @vitest-environment jsdom
 */
import { screen, within } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { expectNoAxeViolations } from "~/test/render-widget";
import { field } from "../../builders";
import { html } from "../../builders/html";
import { renderHtml } from "../../test-fixture";
import {
  CELL_NO_SIGNAL,
  NOT_CALLED_TEXT,
  SAME_DURATION_TEXT,
  DIFFERENT_DURATION_TEXT,
  boundedTextInput,
  factList,
  notCalled,
  resultCell,
  roundTripCell,
  tryButtons,
  unitStrip,
  writtenCell,
} from "./bench-parts";

describe("boundedTextInput", () => {
  it("is a named text box that stops at its cap", async () => {
    const { host } = renderHtml(
      field({
        id: "t",
        label: "Duration string",
        control: ({ id }) => boundedTextInput({ id, value: "2h 30m", max: 8 }),
      }),
    );
    const box = within(host).getByRole("textbox", { name: "Duration string" });
    expect(box).toHaveValue("2h 30m");
    expect(box).toHaveAttribute("maxlength", "8");
    const user = userEvent.setup();
    await user.type(box, "12345");
    expect((box as HTMLInputElement).value).toHaveLength(8);
    await expectNoAxeViolations(host);
  });
});

describe("tryButtons", () => {
  it("is a named group of buttons that each carry their string", async () => {
    const { host } = renderHtml(
      tryButtons({ label: "Try", values: ["1.5h", "PT90M"] }),
    );
    const group = within(host).getByRole("group", { name: "Try" });
    const buttons = within(group).getAllByRole("button");
    expect(buttons.map((b) => (b as HTMLButtonElement).value)).toEqual([
      "1.5h",
      "PT90M",
    ]);
    expect(buttons[0]).toHaveAccessibleName("1.5h");
    await expectNoAxeViolations(host);
  });
});

describe("unitStrip", () => {
  const cells = [
    { field: "hours", symbol: "h", value: 2, lit: true, title: "hours = 2" },
    {
      field: "minutes",
      symbol: "m",
      value: 0,
      lit: false,
      title: "minutes = 0",
    },
    {
      field: "nanoseconds",
      symbol: null,
      value: null,
      lit: false,
      title: "none",
    },
  ];

  it("lists each field with its value, and says so for a unit with no spelling", async () => {
    const { host } = renderHtml(
      unitStrip({ label: "Duration fields", noSpelling: "no spelling", cells }),
    );
    const list = within(host).getByRole("list", { name: "Duration fields" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("h2hours");
    expect(items[2]).toHaveTextContent("no spelling–nanoseconds");
    await expectNoAxeViolations(host);
  });
});

describe("factList and cells", () => {
  it("pairs each term with its value", async () => {
    const { host } = renderHtml(
      factList([
        { label: "Compact form", value: resultCell("2h 30m") },
        { label: "Round trip", value: roundTripCell(true) },
        { label: "In words", value: notCalled() },
      ]),
    );
    const terms = within(host).getAllByRole("term");
    expect(terms.map((t) => t.textContent)).toEqual([
      "Compact form",
      "Round trip",
      "In words",
    ]);
    const details = within(host).getAllByRole("definition");
    expect(details[0]).toHaveTextContent("2h 30m");
    expect(details[1]).toHaveTextContent(SAME_DURATION_TEXT);
    expect(details[2]).toHaveTextContent(NOT_CALLED_TEXT);
    await expectNoAxeViolations(host);
  });

  it("shows the sentinel for an empty or null result, never a blank", () => {
    for (const value of ["", null]) {
      const { host } = renderHtml(resultCell(value));
      expect(host).toHaveTextContent(CELL_NO_SIGNAL);
    }
  });

  it("says a different duration in words, apart from the sentinel", () => {
    const { host } = renderHtml(roundTripCell(false));
    expect(host).toHaveTextContent(DIFFERENT_DURATION_TEXT);
    expect(host).not.toHaveTextContent(CELL_NO_SIGNAL);
  });

  it("writes a written string with its note as markup", () => {
    const { host } = renderHtml(writtenCell("1m", "a <code>minute</code>"));
    expect(within(host).getByText("minute")).toBeInTheDocument();
    expect(host).toHaveTextContent("1m");
  });

  it("escapes a written string", () => {
    const { host } = renderHtml(html`${writtenCell("<b>")}`);
    expect(host).toHaveTextContent("<b>");
    expect(screen.queryByRole("strong")).not.toBeInTheDocument();
  });
});
