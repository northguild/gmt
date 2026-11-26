/**
 * Unique meta descriptions for the reference pages.
 *
 * A function's meta description is the summary line of its TSDoc, and sibling functions that work
 * on different kinds of value (`isBeforeUtc`, `isBeforeZoned`, `isBeforeUnix`) share one. Google
 * builds a snippet from the meta description only when the page has one of its own, so a page in a
 * group of equal descriptions gets a short qualifier that names what it works on.
 *
 * Pure: page descriptions in, the changed descriptions out. A page whose description is unique is
 * not in the result. Only the page's `description` frontmatter (meta, `og:description`, JSON-LD)
 * takes the qualifier; the lead text on the page does not.
 */

/** One reference page whose description is checked. */
export interface DescribedPage {
  /** A key that is unique among the pages: `namespace/module/name`. */
  id: string;
  /** The plain-text summary, as the page's frontmatter holds it. */
  description: string;
  /** The page's namespace. */
  namespace: string;
  /**
   * What the first value the function reads is, in words that complete "for ...": `UTC date-time
   * strings`. Undefined when the function does not say (see `valueKind`).
   */
  kind?: string;
}

/**
 * The value kind a function name states, by its marker word, or undefined when it has none. The
 * names are the house's own: `Date`, `DateTime` and `Time` are the plain (no time zone) values,
 * `Utc` is a UTC date-time string, `Zoned` an IANA-zoned date-time string and `Unix` an epoch.
 * The first parameter of all of them is a bare `string` (or `number`) in the signature, so the
 * name is the one place the kind is written.
 */
export function valueKind(name: string): string | undefined {
  const words: string[] = name.match(/[A-Z][a-z0-9]*|[a-z0-9]+/g) ?? [];
  const has = (word: string) => words.includes(word);
  const last = words[words.length - 1];
  if (has("Zoned")) return "zoned date-time strings";
  if (has("Utc")) return "UTC date-time strings";
  if (has("Unix")) return "Unix epoch values";
  if (last === "Time" && words[words.length - 2] === "Date") {
    return "plain date-time strings";
  }
  if (last === "Date") return "plain date strings";
  if (last === "Time") return "plain time strings";
  return undefined;
}

/** The description with `, <qualifier>.` in place of its final full stop. */
function qualified(description: string, qualifier: string): string {
  const stem = description.trim().replace(/[.\s]+$/, "");
  return `${stem}, ${qualifier}.`;
}

/**
 * The descriptions to change so that no two pages share one.
 *
 * For each group of pages with the same description, the qualifier is the value kind when every
 * page of the group states a different one (`, for UTC date-time strings.`), else the namespace
 * (`, in the utc namespace.`). Both are tried in that order and the first to make the group
 * unique wins. The result holds the changed pages only, by id. The input is not changed.
 *
 * @throws When a group stays equal under both, or a qualified description equals another page's.
 */
export function uniqueDescriptions(
  pages: readonly DescribedPage[],
): Map<string, string> {
  const groups = new Map<string, DescribedPage[]>();
  for (const page of pages) {
    const group = groups.get(page.description) ?? [];
    group.push(page);
    groups.set(page.description, group);
  }

  const changed = new Map<string, string>();
  for (const [description, group] of groups) {
    if (group.length < 2) continue;
    const attempts: Array<(p: DescribedPage) => string | undefined> = [
      (p) => (p.kind === undefined ? undefined : `for ${p.kind}`),
      (p) => `in the ${p.namespace} namespace`,
    ];
    let result: string[] | undefined;
    for (const qualifier of attempts) {
      const parts = group.map(qualifier);
      if (
        parts.every((part) => part !== undefined) &&
        new Set(parts).size === group.length
      ) {
        result = group.map((p, i) => qualified(p.description, parts[i]!));
        break;
      }
    }
    if (!result) {
      throw new Error(
        `[reference] ${group.length} pages share the description "${description}" and neither their value kinds nor their namespaces tell them apart: ${group.map((p) => p.id).join(", ")}. Give one of them a summary of its own in its TSDoc.`,
      );
    }
    group.forEach((p, i) => changed.set(p.id, result![i]));
  }

  // A qualified line must not land on a line another page already has.
  const taken = new Map<string, string>();
  for (const page of pages) {
    taken.set(changed.get(page.id) ?? page.description, page.id);
  }
  if (taken.size !== pages.length) {
    throw new Error(
      `[reference] a qualified description equals the description of another page. Give one of the pages a summary of its own in its TSDoc.`,
    );
  }
  return changed;
}
