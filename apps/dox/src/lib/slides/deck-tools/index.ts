/**
 * The deck's own WebMCP tools: three read-only tools an agent in the reader's browser can call to
 * read the slides on screen and the upstream filings they cite.
 *
 * A deck has no Dox chat tool and no docs entry, so `definePageTool` does not fit. The tools are
 * built here as `ModelContextToolInit` under the same rules as a tool page's: the names match the
 * page-tool pattern and stay within 48 characters, the descriptions stay within 1,000 characters and
 * hold no backtick, `*` or `#`, each tool is `readOnlyHint`, each input schema is closed with
 * `additionalProperties: false`, and an error resolves as `{ ok: false, ... }` and never rejects.
 *
 * They read the deck from the DOM when they run (the heading, text, builds and filing links of a
 * slide's section), so nothing re-parses the deck's source. Speaker notes are not part of a slide's
 * text: they are for the presenter.
 */
import { filingKey, filings } from "~/data/upstream-filings";
import type {
  ModelContextToolInit,
  PageToolResult,
} from "~/lib/webmcp/model-context";

/** The most text `read_deck_slide` returns for one slide. */
export const SLIDE_TEXT_LIMIT = 6000;

export const DECK_TOOL_NAMES = [
  "list_deck_slides",
  "read_deck_slide",
  "read_upstream_filing",
] as const;

interface SlideSummary {
  n: number;
  id: string;
  title: string;
  place: string | null;
  /** `null` for a spare slide: one the plan gives no minutes. */
  minutes: number | null;
}

const clean = (text: string): string => text.replace(/\s+/gu, " ").trim();

function slideElements(root: ParentNode): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>("[data-slide]")];
}

function titleOf(slide: Element): string {
  return clean(slide.querySelector(".gmt-slide-title")?.textContent ?? "");
}

function summaryOf(slide: HTMLElement, index: number): SlideSummary {
  const minutes = Number(slide.dataset["minutes"]);
  return {
    n: index + 1,
    id: slide.id,
    title: titleOf(slide),
    place: slide.dataset["place"] ?? null,
    minutes: Number.isFinite(minutes) && minutes > 0 ? minutes : null,
  };
}

/** The text a slide's audience reads: its body without the speaker notes or the title. */
function bodyText(slide: HTMLElement): string {
  const copy = slide.cloneNode(true) as HTMLElement;
  for (const el of copy.querySelectorAll("[data-notes], .gmt-slide-title")) {
    el.remove();
  }
  return clean(copy.textContent ?? "").slice(0, SLIDE_TEXT_LIMIT);
}

/** The filing keys a slide's cards cite, read from the cards' links to the tracker. */
function filingKeysIn(root: ParentNode): Map<string, string[]> {
  const byUrl = new Map(filings.map((f) => [f.url, filingKey(f)]));
  const bySlide = new Map<string, string[]>();
  for (const slide of slideElements(root)) {
    const keys: string[] = [];
    for (const link of slide.querySelectorAll<HTMLAnchorElement>(
      "a.gmt-filing-ref",
    )) {
      const key =
        byUrl.get(link.href) ?? byUrl.get(link.getAttribute("href") ?? "");
      if (key !== undefined && !keys.includes(key)) keys.push(key);
    }
    bySlide.set(slide.id, keys);
  }
  return bySlide;
}

const invalid = (
  tool: string,
  path: string,
  message: string,
): PageToolResult<never> => ({
  ok: false,
  tool,
  error: "invalid-input",
  issues: [{ path, message }],
});

/** The input's own keys when it is a plain object with only `allowed` keys, else the problem. */
function readInput(
  tool: string,
  input: unknown,
  allowed: readonly string[],
): { value: Record<string, unknown> } | { failure: PageToolResult<never> } {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { failure: invalid(tool, "", "The input must be an object.") };
  }
  const value = input as Record<string, unknown>;
  const extra = Object.keys(value).find((key) => !allowed.includes(key));
  if (extra !== undefined) {
    return {
      failure: invalid(tool, extra, `The input has no key named ${extra}.`),
    };
  }
  return { value };
}

/** A JSON Schema `enum`, left out while there is nothing to list (an empty `enum` is invalid). */
const enumOf = (values: readonly string[]): { enum?: string[] } =>
  values.length === 0 ? {} : { enum: [...values] };

/** The three tools, reading the deck in `root`. */
export function createDeckTools(
  root: ParentNode = document,
): ModelContextToolInit[] {
  const slides = (): HTMLElement[] => slideElements(root);
  const slug =
    root.querySelector<HTMLElement>("[data-deck-root]")?.dataset["deckSlug"] ??
    "";
  const filingsBySlide = filingKeysIn(root);
  const filingKeys = [...new Set([...filingsBySlide.values()].flat())].sort();

  const list: ModelContextToolInit = {
    name: "list_deck_slides",
    title: "List the deck's slides",
    description:
      "Lists the slides of the talk deck open in this tab, in order. Each slide has its number, id, title, the place the planet view shows and its planned minutes, which is null for a spare slide. Read-only: it changes nothing. Pass an id from this list to read_deck_slide.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    async execute(input) {
      const read = readInput("list_deck_slides", input, []);
      if ("failure" in read) return read.failure;
      return {
        ok: true,
        tool: "list_deck_slides",
        input,
        result: { deck: slug, slides: slides().map(summaryOf) },
        notes: [],
      };
    },
  };

  const readSlide: ModelContextToolInit = {
    name: "read_deck_slide",
    title: "Read one slide",
    description:
      "Reads one slide of the talk deck open in this tab: its title, the text the audience reads, how many builds it reveals one step at a time, and the keys of the upstream filings its cards cite. Speaker notes are left out. Read-only. Pass the id of a slide from list_deck_slides; pass a filing key to read_upstream_filing.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          ...enumOf(slides().map((slide) => slide.id)),
          description: "The id of a slide, from list_deck_slides.",
        },
      },
      required: ["id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    async execute(input) {
      const read = readInput("read_deck_slide", input, ["id"]);
      if ("failure" in read) return read.failure;
      const id = read.value["id"];
      const found = slides().find((slide) => slide.id === id);
      if (typeof id !== "string" || !found) {
        return invalid(
          "read_deck_slide",
          "id",
          "No slide has this id. Use an id from list_deck_slides.",
        );
      }
      return {
        ok: true,
        tool: "read_deck_slide",
        input,
        result: {
          id: found.id,
          title: titleOf(found),
          text: bodyText(found),
          builds: found.querySelectorAll("[data-build]").length,
          filings: filingsBySlide.get(found.id) ?? [],
        },
        notes: [],
      };
    },
  };

  const readFiling: ModelContextToolInit = {
    name: "read_upstream_filing",
    title: "Read an upstream filing",
    description:
      "Reads the record of one upstream filing that the talk deck cites: the issue or pull request GMT reported to a Temporal polyfill, a runtime or a standards body. It gives the tracker, title, link, state, a one-sentence summary and how GMT guards against the defect. Read-only. Pass a filing key from read_deck_slide.",
    inputSchema: {
      type: "object",
      properties: {
        key: {
          type: "string",
          ...enumOf(filingKeys),
          description: "A filing key, such as one listed by read_deck_slide.",
        },
      },
      required: ["key"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    async execute(input) {
      const read = readInput("read_upstream_filing", input, ["key"]);
      if ("failure" in read) return read.failure;
      const key = read.value["key"];
      const found =
        typeof key === "string" && filingKeys.includes(key)
          ? filings.find((f) => filingKey(f) === key)
          : undefined;
      if (!found) {
        return invalid(
          "read_upstream_filing",
          "key",
          "The deck cites no filing with this key. Use a key from read_deck_slide.",
        );
      }
      return {
        ok: true,
        tool: "read_upstream_filing",
        input,
        result: found,
        notes: [],
      };
    },
  };

  return [list, readSlide, readFiling];
}

/** What `offerPageTools` loads: the tools for the deck in the open document. */
const tools: ModelContextToolInit[] =
  typeof document === "undefined" ? [] : createDeckTools(document);
export default tools;
