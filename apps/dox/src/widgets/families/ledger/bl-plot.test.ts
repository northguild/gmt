// @vitest-environment jsdom
import { screen, within } from "@testing-library/dom";
import { expectNoAxeViolations } from "~/test/render-widget";
import { idScope } from "../../builders/ids";
import { renderHtml } from "../../test-fixture";
import { blPlot } from "./bl-plot";

const plot = () => renderHtml(blPlot({ id: idScope("t"), lanes: 5 }));

describe("blPlot", () => {
  it("is a list of five calendars, each with its own list of local days", () => {
    plot();
    const calendars = screen.getByRole("list", {
      name: "Calendars, one lane each",
    });
    const lanes = within(calendars).getAllByRole("listitem");
    expect(lanes).toHaveLength(5);
    expect(screen.getAllByRole("list", { name: "Local days" })).toHaveLength(5);
  });

  it("numbers every lane but the first, in words the reader can see", () => {
    plot();
    for (const n of ["1", "2", "3", "4"]) {
      expect(screen.getByText(n)).toBeInTheDocument();
    }
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { host } = plot();
    await expectNoAxeViolations(host);
  });
});
