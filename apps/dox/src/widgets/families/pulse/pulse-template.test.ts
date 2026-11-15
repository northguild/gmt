/**
 * @vitest-environment jsdom
 */
import { screen, within } from "@testing-library/dom";
import { describe, expect, it } from "vitest";
import { expectNoAxeViolations } from "~/test/render-widget";
import { renderHtml } from "../../test-fixture";
import { areas, cards } from "~/data/pulse";
import {
  renderAreas,
  renderBeats,
  renderCard,
  renderLife,
  renderRead,
  renderSummary,
} from "./pulse-template";

describe("pulse page", () => {
  it("shows every card, under its area", async () => {
    const f = renderHtml(renderAreas());
    for (const a of areas) {
      expect(
        screen.getByRole("heading", { level: 2, name: a.heading }),
      ).toBeInTheDocument();
    }
    for (const c of cards) {
      expect(
        screen.getByRole("heading", { level: 3, name: c.name }),
      ).toBeInTheDocument();
    }
    await expectNoAxeViolations(f.host);
  });

  it("names the four readouts", async () => {
    const f = renderHtml(renderSummary());
    for (const t of [
      "Checks running",
      "On a schedule",
      "Workarounds still needed",
      "Upstream filings open",
    ]) {
      expect(screen.getByText(t)).toBeInTheDocument();
    }
    await expectNoAxeViolations(f.host);
  });

  it("links a scheduled card to its runs on GitHub", () => {
    const card = cards.find((c) => c.crons.length > 0)!;
    renderHtml(renderCard(card));
    const link = screen.getByRole("link", { name: /All runs on GitHub/ });
    expect(link).toHaveAttribute("href", expect.stringContaining(card.file));
  });

  it("says the result in words on the strip, or NO SIGNAL when no history was read", async () => {
    const card = cards.find((c) => c.crons.length > 0)!;
    const f = renderHtml(renderBeats(card, "t"));
    expect(
      screen.queryAllByRole("img").length > 0 ||
        screen.queryByText(/NO SIGNAL/) !== null,
    ).toBe(true);
    await expectNoAxeViolations(f.host);
  });

  it("marks the current step of a check's life by its word", () => {
    renderHtml(
      renderLife({ kind: "condition", until: "a fix ships", waitsOn: [] }),
    );
    const list = screen.getByRole("list", { name: /on its way out/ });
    const current = within(list)
      .getAllByRole("listitem")
      .find((li) => li.getAttribute("aria-current") === "step");
    expect(current).toHaveTextContent("Watching");
  });

  it("says a permanent check stays", () => {
    renderHtml(renderLife({ kind: "permanent", why: "It guards the site." }));
    expect(screen.getByText("Stays")).toBeInTheDocument();
    expect(screen.getByText(/It guards the site/)).toBeInTheDocument();
  });

  it("says whether the run history was read", () => {
    renderHtml(renderRead());
    expect(screen.getByText(/Run history/)).toBeInTheDocument();
  });
});
