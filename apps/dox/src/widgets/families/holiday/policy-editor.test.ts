// @vitest-environment jsdom
import { screen } from "@testing-library/dom";
import { expectNoAxeViolations } from "~/test/render-widget";
import { renderHtml } from "../../test-fixture";
import { policyEditor } from "./policy-editor";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

describe("policyEditor", () => {
  it("offers one named select for each weekday, open unless folded", () => {
    renderHtml(policyEditor({ id: "p", label: "Observance", policy: {} }));
    for (const day of WEEKDAYS) {
      expect(screen.getByRole("combobox", { name: day })).toHaveValue("");
    }
    expect(screen.getByRole("group", { name: "Observance" })).toHaveAttribute(
      "open",
    );
  });

  it("is closed when folded", () => {
    renderHtml(
      policyEditor({ id: "p", label: "Observance", policy: {}, folded: true }),
    );
    expect(
      screen.getByRole("group", { name: "Observance" }),
    ).not.toHaveAttribute("open");
  });

  it("selects a policy's shift and says it in the summary", () => {
    renderHtml(
      policyEditor({
        id: "p",
        label: "Observance",
        policy: { 6: { previous: 5 }, 7: { next: 1 } },
      }),
    );
    expect(screen.getByRole("combobox", { name: "Sat" })).toHaveValue("<5");
    expect(screen.getByRole("combobox", { name: "Sun" })).toHaveValue(">1");
    expect(screen.getByText("Sat → Fri, Sun → Mon")).toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { host } = renderHtml(
      policyEditor({ id: "p", label: "Observance", policy: {} }),
    );
    await expectNoAxeViolations(host);
  });
});
