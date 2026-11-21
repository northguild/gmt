/** The credit for the wall's captured landing pages, in the site's data-credits form. */
import { formatUtc } from "@northguild/gmt/utc/format";
import type { DataCredit } from "~/lib/data-credits";
import { WALL_PAGES, type WallPage } from "./wall";

const day = (iso: string): string =>
  formatUtc(iso, "en-GB", { dateStyle: "long", timeZone: "UTC" }) ||
  iso.slice(0, 10);

/**
 * The pages' own addresses and the day each was captured. A capture shows a page as it stood, and
 * its mark belongs to its owner; the credit names where it came from and when.
 */
export function wallCredit(
  pages: readonly WallPage[] = WALL_PAGES,
): DataCredit {
  const parts: DataCredit["parts"][number][] = ["Landing pages as captured: "];
  pages.forEach((page, i) => {
    if (i > 0) parts.push(", ");
    parts.push(
      { text: new URL(page.url).host, href: page.url },
      ` (${day(page.capturedAt)})`,
    );
  });
  parts.push(". Each mark belongs to its owner.");
  return { label: "Wall captures", parts };
}
