// @vitest-environment jsdom
import { screen } from "@testing-library/dom";
import { html } from "../../builders/html";
import { renderHtml } from "../../test-fixture";
import { callOutput } from "../gnss/call-output";
import { paintOutput } from "./paint-output";

describe("paintOutput", () => {
  const empty = html`<div>${callOutput({ label: "Returned", state: "empty", lines: [] })}</div>`;

  it("writes the result into the output without replacing it", () => {
    const { host } = renderHtml(empty);
    const output = screen.getByRole("status", { name: "Returned" });
    paintOutput(host, {
      label: "Returned",
      state: "live",
      lines: [{ text: "PT50M", lost: false }],
    });
    expect(screen.getByRole("status", { name: "Returned" })).toBe(output);
    expect(output).toHaveTextContent("PT50M");
  });

  it("says NO SIGNAL in words for a sentinel", () => {
    const { host } = renderHtml(empty);
    paintOutput(host, {
      label: "Returned",
      state: "sentinel",
      lines: [{ text: "", lost: true }],
    });
    expect(screen.getByRole("status", { name: "Returned" })).toHaveTextContent(
      "NO SIGNAL",
    );
  });
});
