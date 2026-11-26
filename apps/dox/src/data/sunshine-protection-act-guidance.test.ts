import { partsText } from "./clock-change-text";
import {
  US_GUIDANCE,
  US_GUIDANCE_HEADING,
} from "./sunshine-protection-act-guidance";
import { STATES } from "./sunshine-protection-act-proposals";

const text = (): string[] =>
  US_GUIDANCE.flatMap((card) => [
    card.heading,
    ...card.blocks.flatMap((block) =>
      block.kind === "p"
        ? [partsText(block.parts)]
        : block.items.map((item) => partsText(item)),
    ),
  ]);

describe("US_GUIDANCE", () => {
  it("has five cards under the page heading", () => {
    expect(US_GUIDANCE).toHaveLength(5);
    expect(US_GUIDANCE_HEADING).toBe("If the clocks stop changing");
  });

  it("names no law, bill or legislature", () => {
    for (const line of text()) {
      expect(line).not.toMatch(
        /\b(Congress|Senate|House|Act|bill|statute|section|exempt|compliant|legal)\b/i,
      );
    }
  });

  it("counts and names the states that wait on other states from the data", () => {
    expect(text()).toContain(
      "Seven states tie their switch to other states: Delaware, Oregon, Idaho, Utah, Wyoming, Montana and Colorado.",
    );
    const tied = STATES.filter(
      (row) => row.kind === "adopted" && "waitsOn" in row && row.waitsOn,
    );
    expect(tied).toHaveLength(7);
  });

  it("puts the international society before the US academy", () => {
    const health = text().filter((line) => /Society|Academy/.test(line));
    expect(health[0]).toMatch(/Biological Rhythms/);
  });
});
