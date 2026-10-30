// @vitest-environment jsdom
import { screen, within } from "@testing-library/dom";
import { expectNoAxeViolations } from "~/test/render-widget";
import { renderHtml } from "../test-fixture";
import { chartKey, chartSummary } from "./chart-key";

describe("chartKey", () => {
  it("is a list named Key whose items say what each swatch stands for", async () => {
    const { host } = renderHtml(
      chartKey([
        { kind: "own", words: "its own functions" },
        { kind: "shared", words: "a shared layer" },
      ]),
    );
    const key = screen.getByRole("list", { name: "Key" });
    expect(
      within(key)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["its own functions", "a shared layer"]);
    await expectNoAxeViolations(host);
  });

  it("escapes the words", () => {
    renderHtml(chartKey([{ kind: "own", words: "<b>x</b>" }]));
    expect(screen.getByText("<b>x</b>")).toBeInTheDocument();
  });
});

describe("chartSummary", () => {
  it("lists each line, still in the accessibility tree", async () => {
    const { host } = renderHtml(chartSummary(["One: 3 functions.", "Two: 4."]));
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("Two: 4.")).toBeInTheDocument();
    await expectNoAxeViolations(host);
  });
});
