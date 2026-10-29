// @vitest-environment jsdom
import { screen, within } from "@testing-library/dom";
import { expectNoAxeViolations } from "~/test/render-widget";
import { html } from "../../builders/html";
import { renderHtml } from "../../test-fixture";
import { punctHero, punctHeroStrip } from "./punct-hero";

describe("punctHero", () => {
  it("holds its caption, value and lines", () => {
    renderHtml(
      punctHero({
        caption: "on time",
        value: "4 of 6",
        lines: ["late tolerance 15 min", ""],
        samples: ["88 of 88"],
      }),
    );
    const figure = screen.getByRole("figure");
    expect(figure).toHaveTextContent("on time");
    expect(within(figure).getByText("4 of 6")).toBeInTheDocument();
    expect(
      within(figure).getByText("late tolerance 15 min"),
    ).toBeInTheDocument();
  });

  it("hides the plates from assistive technology as a strip", async () => {
    const { host } = renderHtml(
      punctHeroStrip(
        html`${punctHero({ caption: "on time", value: "1 of 2" })}`,
      ),
    );
    expect(screen.queryByRole("figure")).not.toBeInTheDocument();
    expect(screen.getByRole("figure", { hidden: true })).toHaveTextContent(
      "1 of 2",
    );
    await expectNoAxeViolations(host);
  });

  it("passes axe on a plain plate", async () => {
    const { host } = renderHtml(
      punctHero({ caption: "departure made", value: "10:05", series: 1 }),
    );
    await expectNoAxeViolations(host);
  });
});
