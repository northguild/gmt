import { readdirSync, readFileSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import { DIVIDER_ATTR } from "../src/lib/lean-sidebar";
import { corpus } from "../src/generated/reference/corpus";
import { referenceSidebar } from "../src/generated/reference/sidebar";
import { distDirOrSkip } from "./dist-dir";

/**
 * What the lean sidebar leaves a reader and a crawler, read off the built pages
 * (`src/lib/lean-sidebar.ts`). Every namespace stays reachable from every page; a page under
 * `reference/<ns>/` holds its own namespace's tree and only the Overview of every other; the page
 * is marked current once; and the pages either side of the "By industry" divider link each other.
 *
 * Needs a build; returns early without one and throws under `DOX_DIST_REQUIRED`.
 */

/** Every `index.html` under `dir`. */
function pagesUnder(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) found.push(...pagesUnder(full));
    else if (entry.name === "index.html") found.push(full);
  }
  return found;
}

/** The `<div id="starlight__sidebar">` element, start tag to the matching end tag. */
function sidebarOf(html: string): string | null {
  const start = html.indexOf('<div id="starlight__sidebar"');
  if (start === -1) return null;
  const tags = /<(\/?)div\b[^>]*>/g;
  tags.lastIndex = start;
  let depth = 0;
  for (let m = tags.exec(html); m; m = tags.exec(html)) {
    depth += m[1] ? -1 : 1;
    if (depth === 0) return html.slice(start, tags.lastIndex);
  }
  throw new Error("unbalanced sidebar element");
}

/** Each `<a>` of a fragment: its `href` and whether it carries `aria-current="page"`. */
function anchorsOf(html: string): Array<{ href: string; current: boolean }> {
  return [...html.matchAll(/<a\b([^>]*)>/g)].flatMap((m) => {
    const href = /\bhref="([^"]*)"/.exec(m[1]!)?.[1];
    return href === undefined
      ? []
      : [{ href, current: /\baria-current="page"/.test(m[1]!) }];
  });
}

type Item = {
  slug?: string;
  attrs?: Record<string, unknown>;
  items?: Item[];
};

/** The slugs of a generated tree in reading order; a divider is `null`. */
function slugsOf(items: readonly Item[]): Array<string | null> {
  return items.flatMap((item): Array<string | null> => {
    if (item.items) return slugsOf(item.items);
    if (item.attrs?.[DIVIDER_ATTR] !== undefined) return [null];
    return item.slug ? [item.slug] : [];
  });
}

const href = (slug: string) => `/gmt/${slug}/`;
const namespaces = [...new Set(corpus.map((e) => e.namespace))].sort();
const generated = referenceSidebar as unknown as Item[];
const NAMESPACE_GROUPS = generated.filter((g) => g.items);

/** The generated slugs of one namespace's group, its Overview first. */
function namespaceSlugs(ns: string): string[] {
  const group = NAMESPACE_GROUPS.find(
    (g) => slugsOf([g])[0] === `reference/${ns}`,
  );
  if (!group) throw new Error(`no group for ${ns}`);
  return slugsOf([group]).filter((s): s is string => s !== null);
}

/** Built pages with a sidebar, as `{ route, html, sidebar }`; `route` is the path under `gmt/`. */
function sidebarPages(root: string) {
  const gmt = resolve(root, "gmt");
  return pagesUnder(gmt).flatMap((file) => {
    const html = readFileSync(file, "utf8");
    const sidebar = sidebarOf(html);
    if (sidebar === null) return [];
    const route = relative(gmt, file).split(sep).slice(0, -1).join("/");
    return [{ route, html, sidebar }];
  });
}

describe("the built lean sidebar", () => {
  it("links every namespace index from every page that has a sidebar", () => {
    const root = distDirOrSkip();
    if (root === null) return;
    const pages = sidebarPages(root);
    expect(pages.length).toBeGreaterThan(1000);
    const problems: string[] = [];
    for (const { route, sidebar } of pages) {
      const links = new Set(anchorsOf(sidebar).map((a) => a.href));
      for (const ns of namespaces)
        if (!links.has(`/gmt/reference/${ns}/`))
          problems.push(`${route}: ${ns}`);
    }
    expect(problems.slice(0, 20)).toEqual([]);
  });

  it("holds only the Overview of every other namespace on a reference page", () => {
    const root = distDirOrSkip();
    if (root === null) return;
    const problems: string[] = [];
    for (const { route, sidebar } of sidebarPages(root)) {
      const own = /^reference\/([^/]+)/.exec(route)?.[1];
      if (!own) continue;
      for (const { href: h } of anchorsOf(sidebar)) {
        const m = /^\/gmt\/reference\/([^/]+)\/(.+)$/.exec(h);
        if (m && m[1] !== own) problems.push(`${route}: ${h}`);
      }
    }
    expect(problems.slice(0, 20)).toEqual([]);
  });

  it("keeps every page of the current namespace that the full tree held", () => {
    const root = distDirOrSkip();
    if (root === null) return;
    const wanted = new Map(
      namespaces.map((ns) => [ns, namespaceSlugs(ns).map(href)]),
    );
    const problems: string[] = [];
    for (const { route, sidebar } of sidebarPages(root)) {
      const own = /^reference\/([^/]+)/.exec(route)?.[1];
      if (!own || !wanted.has(own)) continue;
      const links = new Set(anchorsOf(sidebar).map((a) => a.href));
      const missing = wanted.get(own)!.filter((h) => !links.has(h));
      if (missing.length)
        problems.push(`${route}: ${missing[0]} (+${missing.length - 1})`);
    }
    expect(problems.slice(0, 20)).toEqual([]);
  });

  it("marks the page itself current, once", () => {
    const root = distDirOrSkip();
    if (root === null) return;
    const problems: string[] = [];
    for (const { route, sidebar } of sidebarPages(root)) {
      const current = anchorsOf(sidebar).filter((a) => a.current);
      const self = route === "" ? "/gmt/" : `/gmt/${route}/`;
      // A page may not be in the sidebar (Tools and checks are not), but never twice or elsewhere.
      if (current.length > 1 || current.some((a) => a.href !== self))
        problems.push(`${route}: ${current.map((a) => a.href).join(" ")}`);
    }
    expect(problems.slice(0, 20)).toEqual([]);
  });

  it("marks every page the reference tree links as current in its own sidebar", () => {
    const root = distDirOrSkip();
    if (root === null) return;
    // A module folder (`reference/zoned/calculate/`) is a group label, not a link.
    const linked = new Set(
      slugsOf(generated).filter((s): s is string => s !== null),
    );
    const problems: string[] = [];
    for (const { route, sidebar } of sidebarPages(root)) {
      if (!linked.has(route)) continue;
      const current = anchorsOf(sidebar).filter((a) => a.current);
      if (current.length !== 1 || current[0]!.href !== `/gmt/${route}/`)
        problems.push(route);
    }
    expect(problems.slice(0, 20)).toEqual([]);
  });

  it("links the pages either side of the By industry divider to each other", () => {
    const root = distDirOrSkip();
    if (root === null) return;
    const slugs = slugsOf(generated);
    const at = slugs.indexOf(null);
    expect(at).toBeGreaterThan(0);
    const before = slugs[at - 1]!;
    const after = slugs[at + 1]!;
    const footer = (slug: string) => {
      const html = readFileSync(
        resolve(root, "gmt", slug, "index.html"),
        "utf8",
      );
      const start = html.indexOf('class="pagination-links');
      return anchorsOf(html.slice(start, html.indexOf("</div>", start)));
    };
    expect(footer(before).map((a) => a.href)).toContain(href(after));
    expect(footer(after).map((a) => a.href)).toContain(href(before));
  });
});
