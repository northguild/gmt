/**
 * @vitest-environment jsdom
 *
 * The deck's WebMCP tools: they follow the page-tool rules (name, description, read-only, closed
 * schema), read the deck's slides from the document, and answer a bad call with an error result.
 */
import { filingKey, filings } from "~/data/upstream-filings";
import { createDeckTools, DECK_TOOL_NAMES } from "./index";

const FORBIDDEN = /\b(drag|click|slider|drawn|widget|shown|page)s?\b/i;
const filing = filings[0]!;

function deck(): HTMLElement {
  const root = document.createElement("div");
  // The deck's own markup, read by the tools; the house classes are what they look for.
  // oxlint-disable-next-line dox-test/no-markup-read, dox-test/no-house-class
  root.innerHTML = `<article data-deck-root data-deck-slug="test-deck">
    <section id="one" data-slide data-minutes="2" data-place="Europe/Helsinki">
      <h2 class="gmt-slide-title">First slide</h2>
      <p>Words the audience reads.</p>
      <p data-notes>Only the presenter sees this.</p>
      <div data-build="1"><a class="gmt-filing-ref" href="${filing.url}">filing</a></div>
    </section>
    <section id="spare" data-slide data-minutes="0">
      <h2 class="gmt-slide-title">Spare slide</h2>
    </section>
  </article>`;
  return root;
}

const tools = () => createDeckTools(deck());
const named = (name: string) => tools().find((t) => t.name === name)!;

describe("the deck's tools follow the page-tool rules", () => {
  it("offers the three named tools", () => {
    expect(tools().map((t) => t.name)).toEqual([...DECK_TOOL_NAMES]);
  });

  it.each(DECK_TOOL_NAMES)("%s is well formed", (name) => {
    const tool = named(name);
    expect(tool.name).toMatch(
      /^(compute|convert|decode|read|check|compare|list|find|schedule|resolve|build|measure)_[a-z0-9_]+$/u,
    );
    expect(tool.name.length).toBeLessThanOrEqual(48);
    expect(tool.description.length).toBeLessThanOrEqual(1000);
    expect(tool.description).not.toMatch(FORBIDDEN);
    expect(tool.description).not.toMatch(/[`*#]/u);
    expect(tool.annotations?.readOnlyHint).toBe(true);
    expect(tool.inputSchema).toMatchObject({
      type: "object",
      additionalProperties: false,
    });
  });
});

describe("list_deck_slides", () => {
  it("lists the slides, with null minutes for a spare one", async () => {
    const result = await named("list_deck_slides").execute({}, {} as never);
    expect(result).toMatchObject({
      ok: true,
      result: {
        deck: "test-deck",
        slides: [
          {
            n: 1,
            id: "one",
            title: "First slide",
            place: "Europe/Helsinki",
            minutes: 2,
          },
          {
            n: 2,
            id: "spare",
            title: "Spare slide",
            place: null,
            minutes: null,
          },
        ],
      },
    });
  });

  it("refuses a key it does not take, and resolves", async () => {
    const result = await named("list_deck_slides").execute(
      { extra: 1 },
      {} as never,
    );
    expect(result).toMatchObject({ ok: false, error: "invalid-input" });
  });
});

describe("read_deck_slide", () => {
  it("returns the audience's text without the speaker notes", async () => {
    const result = (await named("read_deck_slide").execute(
      { id: "one" },
      {} as never,
    )) as {
      result: { text: string; builds: number; filings: string[] };
    };
    expect(result.result.text).toContain("Words the audience reads.");
    expect(result.result.text).not.toContain("presenter");
    expect(result.result.builds).toBe(1);
    expect(result.result.filings).toEqual([filingKey(filing)]);
  });

  it("limits the id to the slides' ids", () => {
    const schema = named("read_deck_slide").inputSchema as {
      properties: { id: { enum: string[] } };
    };
    expect(schema.properties.id.enum).toEqual(["one", "spare"]);
  });

  it.each([{ id: "nope" }, {}, { id: 3 }, "x", null])(
    "resolves an error for %j",
    async (input) => {
      const result = await named("read_deck_slide").execute(
        input as never,
        {} as never,
      );
      expect(result).toMatchObject({ ok: false, error: "invalid-input" });
    },
  );
});

describe("read_upstream_filing", () => {
  it("returns the filing a slide cites", async () => {
    const result = await named("read_upstream_filing").execute(
      { key: filingKey(filing) },
      {} as never,
    );
    expect(result).toMatchObject({ ok: true, result: { url: filing.url } });
  });

  it("refuses an unknown key", async () => {
    const result = await named("read_upstream_filing").execute(
      { key: "unknown" },
      {} as never,
    );
    expect(result).toMatchObject({ ok: false, error: "invalid-input" });
  });
});
