// @vitest-environment jsdom
import { screen } from "@testing-library/dom";
import { expectNoAxeViolations } from "~/test/render-widget";
import { renderHtml } from "../../test-fixture";
import { heldText } from "./held-text";

describe("heldText", () => {
  it("announces the live text", () => {
    renderHtml(
      heldText({
        text: "no fifth Friday",
        state: "sentinel",
        sizers: ["a", "bb"],
        live: true,
      }),
    );
    const live = screen.getByRole("status");
    expect(live).toHaveTextContent("no fifth Friday");
  });

  it("reads as a named note when it is not live, apart from its hidden twins", () => {
    renderHtml(
      heldText({
        text: "same",
        state: "note",
        sizers: ["same", "other"],
        label: "Year note",
      }),
    );
    expect(screen.getByRole("note", { name: "Year note" })).toHaveTextContent(
      "same",
    );
    expect(screen.getAllByText("same")).toHaveLength(2);
  });

  it("reserves every text it can say, hidden from a reader", () => {
    renderHtml(
      heldText({ text: "", state: "ok", sizers: ["one", "one", "two words"] }),
    );
    expect(screen.getAllByText("one")).toHaveLength(1);
    expect(screen.getByText("two words")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  it("has no axe violations", async () => {
    const { host } = renderHtml(
      heldText({ text: "x", state: "note", sizers: ["x"], live: true }),
    );
    await expectNoAxeViolations(host);
  });
});
