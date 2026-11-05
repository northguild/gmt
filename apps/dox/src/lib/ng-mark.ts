import source from "~/assets/northguild-mark.svg?raw";

/**
 * The NorthGuild mark as markup. The drawing is `assets/northguild-mark.svg`, the same shape the
 * northguild.dev header draws. Its two gradients carry ids, so each copy on a page takes its own
 * suffix and two marks never share one.
 */

/** The `<svg>` element's attributes in the asset, and everything inside it. */
const parts = /^\s*<svg\b([^>]*)>([\s\S]*)<\/svg>\s*$/.exec(source);
if (!parts)
  throw new Error("northguild-mark.svg is not a single <svg> element");

/** The asset's `viewBox`. */
export const MARK_VIEW_BOX = /viewBox="([^"]+)"/.exec(parts[1]!)?.[1] ?? "";

/** The ids the asset declares. */
const IDS = [...parts[2]!.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]!);

/** The mark's inner markup with every gradient id suffixed by `instance`. */
export function markInner(instance: number): string {
  let inner = parts![2]!;
  for (const id of IDS) {
    inner = inner
      .replaceAll(`id="${id}"`, `id="${id}-${instance}"`)
      .replaceAll(`url(#${id})`, `url(#${id}-${instance})`);
  }
  return inner;
}

const counts = new WeakMap<object, number>();

/** The next suffix for a mark on the page that `owner` (its request) renders. */
export function nextMarkInstance(owner: object): number {
  const next = (counts.get(owner) ?? 0) + 1;
  counts.set(owner, next);
  return next;
}
