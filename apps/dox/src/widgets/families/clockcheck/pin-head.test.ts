// @vitest-environment jsdom
import { screen } from "@testing-library/dom";
import { expectNoAxeViolations } from "~/test/render-widget";
import { html } from "../../builders/html";
import { renderHtml } from "../../test-fixture";
import { pinHead } from "./pin-head";

const NAME = {
  label: "Zone",
  id: "p-zone",
  className: "page-name",
  gate: "pin-cell pin-zone",
  content: "Press a zone to pin it.",
};
const NOTE = {
  label: "Class",
  content: html`<span>Still changes clocks</span>`,
};

describe("pinHead", () => {
  it("names the place and its class for a screen reader, each with its value", () => {
    renderHtml(pinHead({ name: NAME, note: NOTE }));
    expect(screen.getAllByRole("term").map((t) => t.textContent)).toEqual([
      "Zone",
      "Class",
    ]);
    expect(
      screen.getAllByRole("definition").map((d) => d.textContent?.trim()),
    ).toEqual(["Press a zone to pin it.", "Still changes clocks"]);
  });

  it("adds a clock that a screen reader skips, and passes the checks with or without it", async () => {
    const bare = renderHtml(pinHead({ name: NAME, note: NOTE }));
    const clocked = renderHtml(
      pinHead({ clockId: "p-clock", name: NAME, note: NOTE }),
    );
    expect(clocked.host.textContent?.replace(/\s+/g, " ").trim()).toBe(
      bare.host.textContent?.replace(/\s+/g, " ").trim(),
    );
    await expectNoAxeViolations(bare.host);
    await expectNoAxeViolations(clocked.host);
  });
});
