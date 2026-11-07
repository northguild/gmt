// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { screen } from "@testing-library/dom";
import { expectNoAxeViolations } from "~/test/render-widget";
import { renderHtml } from "../test-fixture";
import { badge } from "./badge";

describe("badge", () => {
  it("shows its text and takes no focus", () => {
    renderHtml(badge({ text: "Cut-off 17:00", tone: "cyan" }));
    expect(screen.getByText("Cut-off 17:00")).toBeVisible();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("breaks at its spaces only when asked to", () => {
    const css = readFileSync(
      join(import.meta.dirname, "badge.module.css"),
      "utf8",
    );
    expect(css).toMatch(/\[data-wrap="true"\]\s*\{[^}]*white-space:\s*normal/);
    renderHtml(
      badge({
        text: "Occurs twice: the earlier instant",
        tone: "purple",
        wrap: true,
      }),
    );
    expect(screen.getByText("Occurs twice: the earlier instant")).toBeVisible();
  });

  it("draws an icon without adding to the word", async () => {
    const a = renderHtml(
      badge({ text: "Merged", tone: "purple", icon: "git-merge", fill: true }),
    );
    const word = screen.getByText("Merged");
    expect(word).toBeVisible();
    // The icon is decorative: the chip's accessible text is its word alone.
    expect(word).toHaveTextContent(/^Merged$/);
    await expectNoAxeViolations(a.host);
  });

  it("escapes its text", () => {
    renderHtml(badge({ text: "<b>x</b>", tone: "neutral" }));
    expect(screen.getByText("<b>x</b>")).toBeInTheDocument();
  });

  it("has no axe violations in any tone, dim or not", async () => {
    const tones = ["neutral", "cyan", "spring", "purple", "danger"] as const;
    for (const tone of tones) {
      const a = renderHtml(badge({ text: tone, tone }));
      const b = renderHtml(badge({ text: `${tone} dim`, tone, dim: true }));
      await expectNoAxeViolations(a.host);
      await expectNoAxeViolations(b.host);
    }
  });
});
