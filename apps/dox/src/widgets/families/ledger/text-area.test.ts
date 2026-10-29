// @vitest-environment jsdom
import { screen } from "@testing-library/dom";
import { html } from "../../builders/html";
import { expectNoAxeViolations } from "~/test/render-widget";
import { renderHtml } from "../../test-fixture";
import { textArea } from "./text-area";

describe("textArea", () => {
  it("is a native textarea holding its value", () => {
    renderHtml(
      html`<label for="t">Holidays</label>${textArea({ id: "t", value: "2024-06-17" })}`,
    );
    expect(screen.getByRole("textbox", { name: "Holidays" })).toHaveValue(
      "2024-06-17",
    );
  });

  it("escapes its value", () => {
    renderHtml(
      html`<label for="t">Holidays</label>${textArea({ id: "t", value: "</textarea><b>x" })}`,
    );
    expect(screen.getByRole("textbox", { name: "Holidays" })).toHaveValue(
      "</textarea><b>x",
    );
  });

  it("is described by the element it names", async () => {
    const { host } = renderHtml(
      html`<label for="t">Holidays</label>${textArea({ id: "t", describedBy: "h" })}<p id="h">One per line</p>`,
    );
    expect(screen.getByRole("textbox")).toHaveAccessibleDescription(
      "One per line",
    );
    await expectNoAxeViolations(host);
  });
});
