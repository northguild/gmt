// @vitest-environment jsdom
import { screen, within } from "@testing-library/dom";
import { expectNoAxeViolations } from "~/test/render-widget";
import { renderHtml } from "../../test-fixture";
import { removeLabel, zoneTile } from "./zone-tile";

const tile = (yours: boolean) =>
  zoneTile({
    id: (local) => `t-${local}`,
    zone: "Asia/Tokyo",
    name: "Tokyo",
    yours,
  });

describe("zoneTile", () => {
  it("is an article named by the zone, with a remove button that names the full id", () => {
    renderHtml(tile(false));
    const article = screen.getByRole("article", { name: "Tokyo" });
    expect(
      within(article).getByRole("button", { name: "Remove Asia/Tokyo" }),
    ).toBeVisible();
    expect(
      within(article).queryByText("Your time zone"),
    ).not.toBeInTheDocument();
  });

  it("says when it is the reader's own zone, in the text and in the button's name", () => {
    renderHtml(tile(true));
    const article = screen.getByRole("article", { name: "Tokyo" });
    expect(within(article).getByText("Your time zone")).toBeVisible();
    expect(
      within(article).getByRole("button", {
        name: "Remove Asia/Tokyo (your time zone)",
      }),
    ).toBeVisible();
  });

  it("words the remove label from the zone and ownership", () => {
    expect(removeLabel("Asia/Tokyo", false)).toBe("Remove Asia/Tokyo");
    expect(removeLabel("Asia/Tokyo", true)).toBe(
      "Remove Asia/Tokyo (your time zone)",
    );
  });

  it("has no axe violations", async () => {
    const fx = renderHtml(tile(true));
    await expectNoAxeViolations(fx.host);
  });
});
