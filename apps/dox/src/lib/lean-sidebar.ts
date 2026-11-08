/**
 * The lean sidebar: every namespace stays reachable from every page, and only the current
 * namespace's reference tree is written out.
 *
 * The full API Reference holds about 900 function links. Rendered on every page it is most of the
 * HTML (264 KB of 433 KB) and sits ahead of `<main>`, so a crawler that cuts a long page, or an
 * HTML-to-text reader with a context limit, reads navigation before content. `leanSidebar` keeps
 * the current namespace's group whole and reduces each other namespace to a collapsed group holding
 * its Overview link.
 *
 * Starlight computes `pagination` from the full sidebar before route middleware runs, so trimming
 * leaves prev/next right. The one exception is the "By industry" divider: it is a link entry in
 * Starlight's data, so prev/next can land on it. `skipDividers` moves them off it, and runs on the
 * full tree before the trim.
 *
 * Both functions are pure: they return new values and never mutate their input.
 */
import type { StarlightRouteData } from "@astrojs/starlight/route-data";
import { SITE_BASE } from "~/lib/site";

type SidebarEntry = StarlightRouteData["sidebar"][number];
type Pagination = StarlightRouteData["pagination"];
type SidebarLink = Extract<SidebarEntry, { type: "link" }>;
type SidebarGroup = Extract<SidebarEntry, { type: "group" }>;

/** The API Reference index, which is also the first link of the API Reference group. */
const REFERENCE_HREF = `${SITE_BASE}/reference/`;

/** The attribute that marks a link entry as a divider (see `buildSidebar`). */
export const DIVIDER_ATTR = "data-gmt-divider";

function isDivider(entry: SidebarEntry): boolean {
  return entry.type === "link" && entry.attrs[DIVIDER_ATTR] !== undefined;
}

/** The first link in a tree, depth first. */
function firstLink(entries: readonly SidebarEntry[]): SidebarLink | undefined {
  for (const entry of entries) {
    if (entry.type === "link") return entry;
    const found = firstLink(entry.entries);
    if (found) return found;
  }
  return undefined;
}

/** Every link in a tree in reading order, dividers included. */
function allLinks(entries: readonly SidebarEntry[]): SidebarLink[] {
  return entries.flatMap((entry) =>
    entry.type === "group" ? allLinks(entry.entries) : [entry],
  );
}

/** The namespace a route id belongs to: `reference/<ns>/…` gives `<ns>`, anything else gives none. */
function currentNamespace(routeId: string): string | undefined {
  const [first, namespace] = routeId.split("/");
  return first === "reference" && namespace ? namespace : undefined;
}

/** The namespace of a reference group, read from its Overview link (`/gmt/reference/<ns>/`). */
function groupNamespace(group: SidebarGroup): string | undefined {
  const overview = firstLink(group.entries);
  if (!overview?.href.startsWith(REFERENCE_HREF)) return undefined;
  return overview.href.slice(REFERENCE_HREF.length).split("/")[0] || undefined;
}

/** The API Reference group: the top-level group whose first link is the reference index. */
function isReferenceGroup(entry: SidebarEntry): entry is SidebarGroup {
  return (
    entry.type === "group" && firstLink(entry.entries)?.href === REFERENCE_HREF
  );
}

/**
 * Keeps the current namespace's reference tree and reduces every other namespace to a collapsed
 * group of its Overview link. The reference group is found by its first link, never by its label.
 */
export function leanSidebar(
  sidebar: SidebarEntry[],
  routeId: string,
): SidebarEntry[] {
  const current = currentNamespace(routeId);
  return sidebar.map((entry): SidebarEntry => {
    if (!isReferenceGroup(entry)) return entry;
    return {
      ...entry,
      entries: entry.entries.map((child): SidebarEntry => {
        if (child.type !== "group" || isDivider(child)) return child;
        const namespace = groupNamespace(child);
        if (namespace === undefined || namespace === current) return child;
        const overview = child.entries[0];
        return {
          ...child,
          collapsed: true,
          entries: overview ? [overview] : [],
        };
      }),
    };
  });
}

/**
 * Moves prev/next off a divider onto the neighbouring real page. `sidebar` must be the full tree,
 * so call it before `leanSidebar`.
 */
export function skipDividers(
  sidebar: SidebarEntry[],
  pagination: Pagination,
): Pagination {
  const all = allLinks(sidebar);
  const real = all.filter((link) => !isDivider(link));
  const at = real.findIndex((link) => link.isCurrent);
  const onDivider = (href: string | undefined) =>
    href !== undefined &&
    all.some((link) => isDivider(link) && link.href === href);
  return {
    prev: onDivider(pagination.prev?.href)
      ? at > 0
        ? real[at - 1]
        : undefined
      : pagination.prev,
    next: onDivider(pagination.next?.href)
      ? at >= 0
        ? real[at + 1]
        : undefined
      : pagination.next,
  };
}
