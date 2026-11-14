/**
 * @vitest-environment jsdom
 *
 * The Sunshine Protection Act page states effects only: no legislature, department, bill or
 * statute. This scans every string a reader sees (the data, the rendered markup, the chat tool's
 * text and the MDX body) for the banned words, whole words, any case. The owner's page-scoped
 * exceptions are stripped first, and nothing else: the frontmatter title and sidebar label, and
 * the one sentence that names the proposals. File and identifier names are not scanned. A
 * scientific society's name is allowed, so "Society" and "Academy" are not on the list.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { setHtml, type SafeHtml } from "~/widgets/builders";
import { CHAT_STARTERS } from "../lib/chat-constants";
import { DOX_TOOL_DOCS } from "../lib/dox-tools";
import {
  renderSunshineProtectionActTemplate,
  renderSunshineProtectionActWidgetTemplate,
} from "../lib/sunshine-protection-act-mount";
import { partsText } from "./clock-change-text";
import { US_GUIDANCE } from "./sunshine-protection-act-guidance";
import { NATIONAL, STATES } from "./sunshine-protection-act-proposals";

const BANNED =
  /\b(congress|senate|house|act|bills?|statute|section|exempt|compliant|legal|federal transport department|department of transportation|H\.R\.|U\.S\.C)\b/i;

const NAMING_SENTENCE =
  "Proposals under this name have been put forward in several sessions; this page describes what they would change, not any one text.";

/** The text a person or a screen reader gets from markup: text nodes and the labelling attributes. */
function visibleText(markup: SafeHtml): string[] {
  const host = document.createElement("div");
  setHtml(host, markup);
  const out: string[] = [];
  const walk = (node: Node): void => {
    if (node.nodeType === Node.TEXT_NODE) out.push(node.textContent ?? "");
    if (node instanceof Element)
      for (const name of ["aria-label", "title", "placeholder", "alt"]) {
        const value = node.getAttribute(name);
        if (value) out.push(value);
      }
    node.childNodes.forEach(walk);
  };
  walk(host);
  return out.map((line) => line.trim()).filter(Boolean);
}

function mdxText(): string[] {
  const source = readFileSync(
    resolve(__dirname, "../content/docs/check/us-sunshine-protection-act.mdx"),
    "utf8",
  );
  const [, frontmatter = "", body = ""] =
    source.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/) ?? [];
  return [
    ...frontmatter
      .split("\n")
      .filter((line) => !/^\s*(title|label):/.test(line)),
    ...body.split("\n").filter((line) => !line.startsWith("import ")),
  ]
    .join("\n")
    .replace(NAMING_SENTENCE, "")
    .split("\n");
}

const guidanceText = (): string[] =>
  US_GUIDANCE.flatMap((card) => [
    card.heading,
    ...card.blocks.flatMap((block) =>
      block.kind === "p"
        ? [partsText(block.parts)]
        : block.items.map((item) => partsText(item)),
    ),
  ]);

const rowText = (): string[] =>
  STATES.flatMap((row) => [
    ...("condition" in row && row.condition ? [row.condition] : []),
    ...("note" in row && row.note ? [row.note] : []),
  ]);

const toolDoc = (): string[] => {
  const doc = DOX_TOOL_DOCS.find(
    (entry) => entry.name === "showUsSunshineProtectionAct",
  );
  return doc ? [doc.purpose, doc.when, doc.args] : [];
};

const starterText = (): string[] =>
  CHAT_STARTERS.filter(
    (starter) => starter.widget === "showUsSunshineProtectionAct",
  ).map((starter) => starter.text);

const sources: Record<string, () => string[]> = {
  US_GUIDANCE: guidanceText,
  NATIONAL: () => [...NATIONAL.effects],
  "STATES text": rowText,
  "the page template": () =>
    visibleText(renderSunshineProtectionActTemplate({ guidance: true })),
  "the chat widget template": () =>
    visibleText(renderSunshineProtectionActWidgetTemplate("chat")),
  "the tool doc": toolDoc,
  "the starter": starterText,
  "the MDX body": mdxText,
};

describe("the Sunshine Protection Act wording", () => {
  for (const [name, lines] of Object.entries(sources)) {
    it(`names no law, bill or legislature in ${name}`, () => {
      for (const line of lines()) expect(line).not.toMatch(BANNED);
    });
  }

  it("finds the text it scans", () => {
    for (const lines of Object.values(sources))
      expect(lines().length).toBeGreaterThan(0);
  });
});
