import { describe, expect, it } from "vitest";
import { ogImageKey } from "./head-tags";
import { SITE_CARD_LINE, ogCards, ogImageAlt } from "./og-cards";

const cards = ogCards([
  { id: "index", data: { title: "GMT" } },
  {
    id: "guides/how-to/add-business-days",
    data: { title: "Add business days" },
  },
  {
    id: "reference/zoned/calculate/startOfZoned",
    data: { title: "startOfZoned()" },
  },
]);

const alt = (id: string) => ogImageAlt(cards[ogImageKey(id)]);

describe("ogImageAlt", () => {
  it("quotes the site line on the site card", () => {
    expect(alt("")).toBe(
      `GMT share card: "${SITE_CARD_LINE}" over the Earth seen from above the North Atlantic.`,
    );
  });

  it("quotes the title on a guide's card", () => {
    expect(alt("guides/how-to/add-business-days")).toBe(
      'Share card: "Add business days" over the Earth seen from above the North Atlantic.',
    );
  });

  it("names the namespace's card on a function page", () => {
    expect(alt("reference/zoned/calculate/startOfZoned")).toBe(
      'Share card: "API reference: zoned" over the Earth seen from above the North Atlantic.',
    );
  });

  it("stays under X's 420 characters on every card", () => {
    for (const card of Object.values(cards)) {
      expect(ogImageAlt(card).length).toBeLessThan(420);
    }
  });
});

describe("changelog cards", () => {
  const changelog = ogCards([
    { id: "changelog", data: { title: "Changelog" } },
    { id: "changelog/1-21", data: { title: "Changelog 1.21" } },
    { id: "changelog/lint-plugin", data: { title: "Changelog: lint-plugin" } },
    {
      id: "changelog/lint-plugin/1-0",
      data: { title: "Changelog lint-plugin 1.0" },
    },
  ]);

  it("gives each changelog page a card of its own, titled with the page", () => {
    expect(Object.keys(changelog).sort()).toEqual([
      "changelog",
      "changelog/1-21",
      "changelog/lint-plugin",
      "changelog/lint-plugin/1-0",
      "site",
    ]);
    expect(changelog["changelog/1-21"]).toEqual({
      kind: "page",
      title: "Changelog 1.21",
    });
  });
});
