// @vitest-environment jsdom
import { screen, within } from "@testing-library/dom";
import { describe, expect, it } from "vitest";
import { canadaTense } from "~/lib/clock-change-tense.fixture";
import { expectNoAxeViolations } from "~/test/render-widget";
import type { KeyCard } from "~/data/clock-change-text";
import { renderHtml } from "../../test-fixture";
import { keyPoints } from "./key-points";

const CARDS: KeyCard[] = [
  {
    heading: "What is happening",
    blocks: [
      {
        kind: "p",
        parts: ["Plain ", { code: "code" }, " and ", { strong: "bold" }],
      },
      { kind: "ol", items: [["First step"], ["Second step"]] },
    ],
  },
  {
    id: "x-linked",
    heading: "Second card",
    blocks: [{ kind: "p", parts: ["Words."] }],
  },
];

describe("keyPoints", () => {
  it("is a region named Key points, with a heading for each card", () => {
    const fixture = renderHtml(keyPoints("x", CARDS, canadaTense));
    const region = screen.getByRole("region", { name: "Key points" });
    expect(
      within(region)
        .getAllByRole("heading", { level: 3 })
        .map((h) => h.textContent),
    ).toEqual(["What is happening", "Second card"]);
    expect(fixture.host).toBeVisible();
  });

  it("writes paragraphs and a numbered list", () => {
    renderHtml(keyPoints("x", CARDS, canadaTense));
    expect(screen.getByText(/Plain/)).toHaveTextContent("Plain code and bold");
    const items = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(items.map((i) => i.textContent)).toEqual([
      "First step",
      "Second step",
    ]);
  });

  it("has no accessibility violations", async () => {
    const fixture = renderHtml(keyPoints("x", CARDS, canadaTense));
    await expectNoAxeViolations(fixture.host);
  });
});
