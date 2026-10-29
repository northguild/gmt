// @vitest-environment jsdom
import { screen, within } from "@testing-library/dom";
import { HELP } from "~/data/canada-key-points";
import { expectNoAxeViolations } from "~/test/render-widget";
import { renderHtml } from "../../test-fixture";
import { helpCard } from "./help-card";

function draw() {
  return renderHtml(helpCard("canada", HELP));
}

describe("helpCard", () => {
  it("is a section named by its heading", () => {
    draw();
    const card = screen.getByRole("region", { name: "How gmt helps" });
    expect(within(card).getByRole("heading", { level: 4 })).toHaveTextContent(
      "How gmt helps",
    );
  });

  it("says what was verified, with a check that is drawn only", () => {
    draw();
    expect(screen.getByText(/Verified/)).toBeInTheDocument();
    expect(screen.getByText("✓")).toHaveAttribute("aria-hidden", "true");
  });

  it("draws each case as a tag, an input, an output and why", () => {
    draw();
    const cases = screen.getAllByRole("listitem");
    expect(cases).toHaveLength(HELP.cases.length);
    expect(cases[0]).toHaveTextContent("Saved with an offset");
    expect(
      within(cases[0]!).getByText(
        "2026-11-15T09:00:00-08:00[America/Vancouver]",
      ),
    ).toBeInTheDocument();
    expect(within(cases[0]!).getAllByText('""')[0]).toBeInTheDocument();
    expect(cases[1]).toHaveTextContent("Saved as UTC only");
    expect(cases[1]).toHaveTextContent("an hour late");
  });

  it("links each function name to its reference page", () => {
    draw();
    const link = screen.getByRole("link", { name: "classifyStoredZoned" });
    expect(link).toHaveAttribute(
      "href",
      expect.stringMatching(
        /\/reference\/zoned\/classify\/classifyStoredZoned\/$/,
      ),
    );
    expect(
      screen.getByRole("link", { name: "convertPlainDateTimeToZoned" }),
    ).toHaveAttribute(
      "href",
      expect.stringMatching(
        /\/reference\/zoned\/convert\/convertPlainDateTimeToZoned\/$/,
      ),
    );
  });

  it("leaves an absolute address as written and points the button at the saved-times section", () => {
    draw();
    expect(screen.getByRole("link", { name: "See the tests" })).toHaveAttribute(
      "href",
      "https://github.com/northguild/gmt/blob/main/packages/gmt/src/test/oh-canada.test.ts",
    );
    expect(
      screen.getByRole("link", { name: /Did your saved events move\?/ }),
    ).toHaveAttribute("href", "#canada-stored-title");
  });

  it("keeps one card's heading id apart from another's", () => {
    renderHtml(helpCard("a", HELP));
    renderHtml(helpCard("b", HELP));
    expect(
      screen.getAllByRole("region", { name: "How gmt helps" }),
    ).toHaveLength(2);
  });

  it("has no axe violations", async () => {
    const { host } = draw();
    await expectNoAxeViolations(host);
  });
});
