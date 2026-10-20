/**
 * The `_redirects` file: a 301 from the old URL of every public type, of every renamed
 * function and of every moved page, to where it is documented now.
 *
 * A type's page used to sit beside its source file, at `/reference/<ns>/<mod>/<Name>`. A
 * shared type is now at `/reference/types/<Name>`, and a single-use type is a heading on its
 * function's page. The old URL is a pure function of the source path, so the map is derived
 * on every generation and no list of old URLs is kept. A renamed function cannot be derived,
 * so `renamed-functions.ts` keeps a short hand-written list of them, and `moved-pages.ts`
 * keeps the pages that moved and have no function behind them.
 *
 * Pure: types, renames and the usage graph in, the file's text out. The format is Cloudflare's
 * `_redirects` for Workers static assets: one `source destination status` rule per line. A
 * source with and without its trailing slash are separate rules, so both are written, and so
 * is the page's `.md` twin. Static rules are matched exactly, case included.
 */

import type { MovedPage } from "./moved-pages";
import type { RenamedFunction } from "./renamed-functions";
import { functionUrl, legacyTypeUrl, typePageUrl } from "./reference-urls";
import type { TypeUsage } from "./type-usage";

/** A public type, with the namespace and module its source path gives it. */
export interface RedirectedType {
  name: string;
  namespace: string;
  module: string;
}

/** Cloudflare's limits for static redirect rules. */
const MAX_RULES = 2000;
const MAX_RULE_LENGTH = 1000;

const STATUS = 301;

/**
 * The text of `_redirects`.
 *
 * Throws, rather than write a file Cloudflare would reject or a rule that would misdirect:
 * a rule whose source is its own target, two rules with one source, a source that is a page
 * of the site (the redirect would hide the page), a rule over 1,000 characters, or more than
 * 2,000 rules. A rename also throws when its target is not a live function page, so a typo
 * or a second rename fails here instead of redirecting to a 404. A moved page throws when its
 * `to` is not one of `routes` (the site's pages and routes, with no trailing slash) or when its
 * `from` still is one, which would hide the page the redirect is meant to replace.
 *
 * Every check runs on the base-less routes. `base` (the site's `/gmt`) is put in front of both
 * sides of each emitted line, after the checks, because the assets sit under it
 * (`dist/gmt/…`) and the rule is matched against the full request path. The 1,000-character
 * limit is checked on the emitted line.
 */
export function buildRedirects(
  types: readonly RedirectedType[],
  usage: TypeUsage,
  renames: readonly RenamedFunction[] = [],
  moved: readonly MovedPage[] = [],
  routes: ReadonlySet<string> = new Set(),
  base = "",
): string {
  const rules: Array<{ source: string; target: string }> = [];
  for (const type of types) {
    const node = usage.types.get(type.name);
    if (!node) continue;
    const old = legacyTypeUrl(type.namespace, type.module, type.name);

    let page: string;
    let markdown: string;
    if (node.placement.kind === "page") {
      const url = typePageUrl(type.name);
      // Already where it always was: nothing to redirect.
      if (url === old) continue;
      page = `${url}/`;
      markdown = `${url}.md`;
    } else {
      const owner = functionUrl(node.placement.owner);
      page = `${owner}/#${node.placement.anchor}`;
      // The `.md` twin is one file with no anchors of its own.
      markdown = `${owner}.md`;
    }
    rules.push(
      { source: old, target: page },
      { source: `${old}/`, target: page },
      { source: `${old}.md`, target: markdown },
    );
  }
  const problems: string[] = [];
  for (const { from, to } of renames) {
    const old = functionUrl(from);
    const url = functionUrl(to);
    if (!usage.reach.has(to)) {
      problems.push(
        `${old} is renamed to ${url}, which is not a function page`,
      );
    }
    // The same three rules a type gets: bare, trailing slash and the `.md` twin.
    rules.push(
      { source: old, target: `${url}/` },
      { source: `${old}/`, target: `${url}/` },
      { source: `${old}.md`, target: `${url}.md` },
    );
  }
  for (const { from, to } of moved) {
    if (!routes.has(to)) {
      problems.push(`${from} moved to ${to}, which is not a page or route`);
    }
    if (routes.has(from)) {
      problems.push(`${from} is a page of the site`);
    }
    rules.push(
      { source: from, target: `${to}/` },
      { source: `${from}/`, target: `${to}/` },
      { source: `${from}.md`, target: `${to}.md` },
    );
  }
  rules.sort((a, b) => a.source.localeCompare(b.source));

  // The pages the graph knows: each function's, each shared type's, and their `.md` twins.
  const live = new Set<string>();
  for (const key of usage.reach.keys()) live.add(functionUrl(key));
  for (const node of usage.types.values()) {
    if (node.placement.kind === "page") live.add(typePageUrl(node.name));
  }

  const seen = new Set<string>();
  for (const { source, target } of rules) {
    const line = `${base}${source} ${base}${target} ${STATUS}`;
    if (source === target) problems.push(`${source} redirects to itself`);
    if (seen.has(source)) problems.push(`${source} has two rules`);
    seen.add(source);
    const route = source.replace(/\.md$/, "").replace(/\/$/, "");
    if (live.has(route)) problems.push(`${source} is a page of the site`);
    if (line.length > MAX_RULE_LENGTH) {
      problems.push(`${source} is over ${MAX_RULE_LENGTH} characters`);
    }
  }
  if (rules.length > MAX_RULES) {
    problems.push(
      `${rules.length} rules is over Cloudflare's limit of ${MAX_RULES}`,
    );
  }
  if (problems.length > 0) {
    throw new Error(
      `[reference] cannot write _redirects: ${problems.join("; ")}.`,
    );
  }

  return [
    "# GENERATED FILE — do not edit by hand.",
    "# Produced by apps/dox/scripts/build-reference.ts (`pnpm dox:generate`).",
    "# The old URL of every public type, renamed function and moved page, redirected to where it is documented now.",
    ...rules.map((r) => `${base}${r.source} ${base}${r.target} ${STATUS}`),
    "",
  ].join("\n");
}
