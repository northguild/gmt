// @vitest-environment jsdom
import { screen } from "@testing-library/dom";
import { expectNoAxeViolations } from "~/test/render-widget";
import { renderHtml } from "../../test-fixture";
import { signalPlates, SIGNAL_TEXT } from "./signal-plates";

const plate = (value: string | null) => ({
  caption: "Gregorian Easter",
  value,
  line: "Gregorian computus",
  series: 1 as const,
  samples: ["-271821-04-19"],
});

describe("signalPlates", () => {
  it("reads a placed date with its caption and line", () => {
    renderHtml(signalPlates([plate("2024-03-31")]));
    expect(screen.getByText("Gregorian Easter")).toBeInTheDocument();
    expect(screen.getByText("2024-03-31")).toBeInTheDocument();
    expect(screen.getByText("Gregorian computus")).toBeInTheDocument();
  });

  it("reads NO SIGNAL in the plate when the library placed nothing, and drops the line", () => {
    renderHtml(signalPlates([plate(null)]));
    expect(screen.getAllByText(SIGNAL_TEXT).length).toBeGreaterThan(0);
    expect(screen.queryByText("Gregorian computus")).not.toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { host } = renderHtml(
      signalPlates([plate("2024-03-31"), plate(null)]),
    );
    await expectNoAxeViolations(host);
  });
});
