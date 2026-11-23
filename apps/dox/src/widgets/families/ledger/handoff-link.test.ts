// @vitest-environment jsdom
import { screen } from "@testing-library/dom";
import { expectNoAxeViolations } from "~/test/render-widget";
import { html } from "../../builders/html";
import { renderHtml } from "../../test-fixture";
import { handoffLink, handoffRow } from "./handoff-link";

describe("handoffLink", () => {
  it("is a named link to the other tool when it has a target", async () => {
    const { host } = renderHtml(
      html`${handoffLink({ id: "h", label: "Count the days", href: "/tools/x/?w=1" })}`,
    );
    const link = screen.getByRole("link", { name: "Count the days" });
    expect(link).toHaveAttribute("href", "/tools/x/?w=1");
    await expectNoAxeViolations(host);
  });

  it("loses its link role and says why when it has no target", async () => {
    const { host } = renderHtml(
      html`${handoffLink({ id: "h", label: "Count the days", describedBy: "why" })}<p id="why">No clock to count.</p>`,
    );
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("Count the days")).toHaveAccessibleDescription(
      "No clock to count.",
    );
    await expectNoAxeViolations(host);
  });
});

describe("handoffRow", () => {
  it("describes its link with the hint beside it", async () => {
    const { host } = renderHtml(
      html`${handoffRow({ id: "h", label: "Check it" })}`,
    );
    // Nothing to send: the link has no target, and the mount writes its reason beside it.
    expect(screen.getByText("Check it")).toBeInTheDocument();
    expect(screen.getByText("Check it")).toHaveAttribute(
      "aria-describedby",
      "h-hint",
    );
    await expectNoAxeViolations(host);
  });
});
