// @vitest-environment jsdom
import { screen, within } from "@testing-library/dom";
import { expectNoAxeViolations } from "~/test/render-widget";
import { renderHtml } from "../test-fixture";
import { html } from "./html";
import {
  PRESENTER_INITIAL,
  presenterShell,
  readinessList,
  readinessPending,
} from "./presenter";

describe("presenterShell", () => {
  it("names every panel and every control", () => {
    renderHtml(presenterShell());
    for (const name of [
      "Current slide",
      "Next slide",
      "Speaker notes",
      "Clock",
      "Ready to present?",
    ])
      expect(screen.getByRole("heading", { name })).toBeInTheDocument();
    for (const name of [
      "Previous",
      "Next",
      "Blank",
      "Start",
      "Reset",
      "Overview",
      "Keys",
      "Check again",
    ])
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
  });

  it("starts with the first readings, not an empty box", () => {
    renderHtml(presenterShell());
    expect(screen.getByLabelText("Elapsed")).toHaveTextContent(
      PRESENTER_INITIAL.elapsed,
    );
    expect(screen.getByLabelText("Pace")).toHaveTextContent("Not started");
    expect(screen.getByLabelText("Demo")).toHaveTextContent("No demo");
  });

  it("has no accessibility violations, with rows in the list", async () => {
    const fixture = renderHtml(html`${presenterShell()}`);
    await expectNoAxeViolations(fixture.host);
  });
});

describe("readiness rows", () => {
  it("says each result in words", () => {
    renderHtml(
      html`<ul>${readinessList([
        { id: "wall", label: "Wall", status: "ok", text: "Ready: 4 panes" },
        {
          id: "chat",
          label: "Chat",
          status: "failed",
          text: "Failed: no answer",
        },
      ])}</ul>`,
    );
    const rows = screen.getAllByRole("listitem");
    expect(
      within(rows[0] as HTMLElement).getByText("Ready: 4 panes"),
    ).toBeInTheDocument();
    expect(
      within(rows[1] as HTMLElement).getByText("Failed: no answer"),
    ).toBeInTheDocument();
  });

  it("shows a row that has not answered as checking", () => {
    renderHtml(html`<ul>${readinessPending(["Wall", "Chat"])}</ul>`);
    expect(screen.getAllByText("Checking")).toHaveLength(2);
  });
});
