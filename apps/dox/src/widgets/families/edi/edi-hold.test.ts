// @vitest-environment jsdom
import { screen, within } from "@testing-library/dom";
import { expectNoAxeViolations } from "~/test/render-widget";
import { html } from "../../builders/html";
import { renderHtml } from "../../test-fixture";
import { hold, holdText } from "./edi-hold";

describe("holdText", () => {
  it("names its live sentence and leaves the reserved ones out of it", async () => {
    const { host } = renderHtml(
      holdText({
        id: "t-split",
        role: "note",
        label: "Split",
        text: "Read as a bare value.",
        samples: [
          "Read as a bare value.",
          "A much longer sentence the box also holds.",
        ],
      }),
    );
    const note = screen.getByRole("note", { name: "Split" });
    expect(note).toHaveTextContent("Read as a bare value.");
    expect(note).not.toHaveTextContent("much longer");
    await expectNoAxeViolations(host);
  });

  it("holds its box when the text is empty", async () => {
    const { host } = renderHtml(
      holdText({
        id: "t-empty",
        role: "status",
        label: "Verdict",
        text: "",
        samples: ["Something that can show."],
      }),
    );
    expect(
      screen.getByRole("status", { name: "Verdict" }),
    ).toBeEmptyDOMElement();
    await expectNoAxeViolations(host);
  });

  it("escapes what it is given", () => {
    renderHtml(
      holdText({
        id: "t-esc",
        role: "note",
        label: "Escaped",
        text: "<b>x</b>",
        samples: [],
      }),
    );
    expect(screen.getByRole("note", { name: "Escaped" })).toHaveTextContent(
      "<b>x</b>",
    );
  });
});

describe("hold", () => {
  it("writes the live element with no role when its content names itself", () => {
    renderHtml(
      hold({
        id: "h-1",
        content: html`<p>Live</p>`,
        ghosts: [html`<p>Ghost</p>`],
      }),
    );
    expect(screen.getByText("Live")).toBeInTheDocument();
    expect(within(document.body).queryByRole("note")).not.toBeInTheDocument();
  });
});
