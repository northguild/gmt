/** The captured landing pages of the ice wall, from `scripts/capture-wall.ts`. */
import entries from "./wall.json";

export interface WallPage {
  id: string;
  /** The library's name, which the pane's caption shows. */
  name: string;
  /** The page's own `<title>`, read to screen readers with the name. */
  title: string;
  url: string;
  /** An ISO instant, from gmt. */
  capturedAt: string;
  /** Under `public/`, with no leading slash. */
  image: string;
  /** Whether the page's mark is a clock. */
  clock: boolean;
  /** Set when the image is a stand-in and not a capture. */
  placeholder?: boolean;
}

export const WALL_PAGES: readonly WallPage[] = entries;
