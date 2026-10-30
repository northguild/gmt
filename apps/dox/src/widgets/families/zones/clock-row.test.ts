// @vitest-environment jsdom
import { screen } from "@testing-library/dom";
import { expectNoAxeViolations } from "~/test/render-widget";
import { html } from "~/widgets/builders";
import { renderHtml } from "../../test-fixture";
import { clockRow } from "./clock-row";

describe("clockRow", () => {
  it("is an option named for its zone, and is selected only when asked", async () => {
    const r = renderHtml(
      html`<div role="listbox" aria-label="Zones"
        >${clockRow({ listId: "z", index: 0, zone: "Asia/Tokyo", selected: true })}${clockRow(
          {
            listId: "z",
            index: 1,
            zone: "Europe/London",
          },
        )}</div
      >`,
    );
    expect(screen.getByRole("option", { name: /Asia\/Tokyo/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      screen.getByRole("option", { name: /Europe\/London/ }),
    ).toHaveAttribute("aria-selected", "false");
    await expectNoAxeViolations(r.host);
  });

  it("escapes a zone name that carries markup", () => {
    renderHtml(
      html`<div role="listbox" aria-label="Zones"
        >${clockRow({ listId: "z", index: 0, zone: "<b>x</b>" })}</div
      >`,
    );
    expect(screen.getByText("<b>x</b>")).toBeInTheDocument();
  });
});
