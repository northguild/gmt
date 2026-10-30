// @vitest-environment jsdom
import { screen } from "@testing-library/dom";
import { expectNoAxeViolations } from "~/test/render-widget";
import { renderHtml } from "../../test-fixture";
import { countdown, verdictBadge } from "./fuse-status";

describe("countdown", () => {
  const parts = { past: false, days: 4689, hours: 0, minutes: 5, seconds: 9 };

  it("says the time left in words and captions it", async () => {
    const { host } = renderHtml(
      countdown({
        parts,
        words: "4689 days 5 min 9 s",
        line: "until it reports an early date",
        none: "no result",
      }),
    );
    const figure = screen.getByRole("figure");
    expect(figure).toHaveTextContent(/^Time left/);
    expect(figure).toHaveTextContent("4689 days 5 min 9 s");
    expect(figure).toHaveTextContent("until it reports an early date");
    await expectNoAxeViolations(host);
  });

  it("captions a closed window Past by", () => {
    renderHtml(
      countdown({
        parts: { ...parts, past: true },
        words: "past by 137 days",
        line: "since it began reporting an early date",
        none: "no result",
      }),
    );
    expect(screen.getByRole("figure")).toHaveTextContent(/^Past by/);
  });

  it("says no result when there is no countdown", async () => {
    const { host } = renderHtml(
      countdown({ parts: null, words: "", line: "", none: "no result" }),
    );
    expect(screen.getByRole("figure")).toHaveTextContent("no result");
    await expectNoAxeViolations(host);
  });
});

describe("verdictBadge", () => {
  it.each([
    ["right", "Reports the right date"],
    ["early", "Reports a date 7168 days early"],
    ["late", "Reports a date 7168 days late"],
    ["none", "no result"],
  ] as const)("says %s in words", async (verdict, text) => {
    const { host } = renderHtml(verdictBadge({ verdict, text }));
    expect(screen.getByText(text)).toBeInTheDocument();
    await expectNoAxeViolations(host);
  });
});
