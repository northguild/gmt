// @vitest-environment jsdom
import { screen, within } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { expectNoAxeViolations } from "~/test/render-widget";
import { renderHtml } from "../../test-fixture";
import { zoneMapPanel } from "./zone-map-panel";

const zones = [{ id: "Asia/Tokyo" }, { id: "Europe/London" }];

function render() {
  return renderHtml(zoneMapPanel({ zones, label: "Time zones", id: "panel" }));
}

describe("zoneMapPanel", () => {
  it("is a group of one button per zone, each named by its zone", async () => {
    const r = render();
    const group = screen.getByRole("group", { name: "Time zones" });
    const buttons = within(group).getAllByRole("button");
    expect(buttons).toHaveLength(2);
    expect(
      within(group).getByRole("button", { name: /Asia\/Tokyo/ }),
    ).toBeInTheDocument();
    expect(
      within(group).getByRole("button", { name: /Europe\/London/ }),
    ).toBeInTheDocument();
    await expectNoAxeViolations(r.host);
  });

  it("starts with every button unpressed and reaches each with Tab", async () => {
    const user = userEvent.setup();
    const r = render();
    for (const button of screen.getAllByRole("button")) {
      expect(button).not.toBePressed();
    }
    await user.tab();
    expect(screen.getByRole("button", { name: /Asia\/Tokyo/ })).toHaveFocus();
    await user.tab();
    expect(
      screen.getByRole("button", { name: /Europe\/London/ }),
    ).toHaveFocus();
    await expectNoAxeViolations(r.host);
  });

  it("escapes a zone name that carries markup", () => {
    renderHtml(
      zoneMapPanel({ zones: [{ id: "<b>x</b>" }], label: "Zones", id: "p" }),
    );
    expect(screen.getByText("<b>x</b>")).toBeInTheDocument();
  });
});
