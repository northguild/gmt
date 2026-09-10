import GithubSlugger from "github-slugger";
import type { GuideSource } from "./guide-sources";
import type { RetrievalChunk } from "./types";

// A line starting with exactly "## " — guides in this repo use `##` for every
// section heading and never `#` (the frontmatter `title` is the implicit H1)
// or `###`+ at the top level (verified 2026-09-09 across all 24 guide files).
const HEADING_RE = /^##[ \t]+(.+)$/gm;

/**
 * DOX-C1 (#137) — one chunk per guide, per top-level heading, each carrying
 * its own URL (the guide's route, `#`-fragmented to the heading's slug).
 * Pure function over already-read file content — see `guide-sources.ts` for
 * the fs-touching half.
 */
export function buildGuideChunks(sources: GuideSource[]): RetrievalChunk[] {
  const chunks: RetrievalChunk[] = [];

  for (const source of sources) {
    const namespace = source.route.split("/").filter(Boolean)[1] ?? "guides";
    const slugger = new GithubSlugger();

    const headings = [...source.body.matchAll(HEADING_RE)];

    // Everything before the first heading — the guide's own intro prose,
    // filed under the page's own URL with no fragment.
    const introEnd = headings[0]?.index ?? source.body.length;
    const intro = source.body.slice(0, introEnd).trim();
    if (intro.length > 0) {
      chunks.push({
        id: `${source.route}#`,
        kind: "guide",
        url: source.route,
        namespace,
        title: source.title,
        text: `${source.title}\n\n${intro}`,
      });
    }

    for (let i = 0; i < headings.length; i++) {
      const heading = headings[i];
      const headingText = heading[1].trim();
      const sectionStart = heading.index! + heading[0].length;
      const sectionEnd = headings[i + 1]?.index ?? source.body.length;
      const body = source.body.slice(sectionStart, sectionEnd).trim();
      const slug = slugger.slug(headingText);
      chunks.push({
        id: `${source.route}#${slug}`,
        kind: "guide",
        url: `${source.route}#${slug}`,
        namespace,
        title: `${source.title} › ${headingText}`,
        text: `${headingText}\n\n${body}`,
      });
    }
  }

  return chunks;
}
