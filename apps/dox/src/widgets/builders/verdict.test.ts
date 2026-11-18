// @vitest-environment jsdom
import { screen } from "@testing-library/dom";
import { expectNoAxeViolations } from "~/test/render-widget";
import { renderHtml } from "../test-fixture";
import { paintVerdict, verdict } from "./verdict";

describe("verdict", () => {
  it("reads its title and its detail together", () => {
    renderHtml(
      verdict({
        tone: "bad",
        title: "Misses the cut-off",
        detail: "by 12 min",
      }),
    );
    expect(screen.getByText("Misses the cut-off")).toBeVisible();
    expect(screen.getByText("by 12 min")).toBeVisible();
  });

  it("is plain text, with no role of its own to announce", () => {
    renderHtml(
      verdict({ tone: "good", title: "On time", detail: "5 min spare" }),
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("has no axe violations in any tone", async () => {
    for (const tone of ["neutral", "good", "bad"] as const) {
      const r = renderHtml(verdict({ tone, title: tone, detail: "detail" }));
      await expectNoAxeViolations(r.host);
    }
  });
});

describe("paintVerdict", () => {
  it("writes the title and detail into the same paragraph", () => {
    renderHtml(
      verdict({ tone: "good", title: "On time", detail: "It lands first." }),
    );
    const p = screen.getByRole("paragraph");
    paintVerdict(p, { tone: "bad", title: "Late", detail: "It lands after." });
    expect(screen.getByRole("paragraph")).toBe(p);
    expect(p).toHaveTextContent("Late It lands after.");
    expect(screen.queryByText("On time")).not.toBeInTheDocument();
  });
});
