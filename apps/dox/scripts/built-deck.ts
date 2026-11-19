/**
 * A deck's slides as the site built them (`dist/gmt/slides/<slug>/index.html`). The repo renders no
 * `.astro` in Vitest, so the built HTML is the test surface for every deck: `slides-built.test.ts`
 * holds the rules all decks keep, and a deck's own `built.test.ts` its outline.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface BuiltSlide {
  id: string;
  /** `null` on a spare, which has no `data-minutes`. */
  minutes: number | null;
  spare: boolean;
  /** The slide's markup, from its opening tag to the next slide's. */
  html: string;
}

/** The deck page's slides, in order, read from the built site at `dist`. */
export function builtSlides(dist: string, slug: string): BuiltSlide[] {
  const page = readFileSync(
    join(dist, "gmt", "slides", slug, "index.html"),
    "utf8",
  );
  // A slide holds `<section>` panels of its own, so a slide runs from its opening tag to the next
  // slide's (the last one to the end of the deck's slides).
  const starts = [...page.matchAll(/<section\b([^>]*\bdata-slide\b[^>]*)>/g)];
  return starts.map((match, i) => {
    const attrs = match[1] ?? "";
    const end = starts[i + 1]?.index ?? page.length;
    const minutes = /data-minutes="([^"]*)"/.exec(attrs)?.[1];
    return {
      id: /\bid="([^"]*)"/.exec(attrs)?.[1] ?? "",
      minutes: minutes === undefined ? null : Number(minutes),
      spare: /\bdata-spare\b/.test(attrs),
      html: page.slice((match.index ?? 0) + match[0].length, end),
    };
  });
}

/** The slide with `id`; a missing one fails the test that asked. */
export function builtSlide(
  slides: readonly BuiltSlide[],
  id: string,
): BuiltSlide {
  const slide = slides.find((s) => s.id === id);
  if (!slide) throw new Error(`the built deck has no slide "${id}"`);
  return slide;
}
