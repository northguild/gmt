// @vitest-environment jsdom
import { screen } from "@testing-library/dom";
import { html } from "../../builders/html";
import { renderHtml } from "../../test-fixture";
import { storedNote } from "./stored-note";

describe("storedNote", () => {
  it("shows its text, and a built piece inside it", () => {
    renderHtml(storedNote(html`Use <code>process.versions.tz</code> here.`));
    expect(screen.getByText(/Use/)).toBeInTheDocument();
    expect(screen.getByText("process.versions.tz")).toBeInTheDocument();
  });

  it("escapes text it is given", () => {
    renderHtml(storedNote("<b>x</b>"));
    expect(screen.getByText("<b>x</b>")).toBeInTheDocument();
    expect(screen.queryByText("x")).not.toBeInTheDocument();
  });
});
