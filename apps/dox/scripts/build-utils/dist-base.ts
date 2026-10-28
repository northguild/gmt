/**
 * Scanners for the built site's `/gmt` base (CORE-86).
 *
 * Routes inside Dox are base-less; `/gmt` is added only where a URL leaves the code. The bug class
 * is "a root-absolute URL that reaches a reader without `/gmt`". Reading source finds the ones a
 * person thinks of; these scanners read the output, so they find the rest.
 *
 * Every scanner is pure: text in, failures out. None reads the file system.
 */

export interface BaseFailure {
  value: string;
  where: string;
}

const ORIGIN = "https://northguild.dev";
const BASE = "/gmt";
/** The header's NorthGuild link (#424); equal to `LANDING_URL` in `src/lib/site.ts`. */
export const LANDING = `${ORIGIN}/`;
const LEGACY_HOST = "gmt-dox.northguild.workers.dev";

/** `/gmt` or `/gmt/…`, and not a doubled `/gmt/gmt`. */
function underBase(pathname: string): boolean {
  if (pathname !== BASE && !pathname.startsWith(`${BASE}/`)) return false;
  return !(pathname === `${BASE}/gmt` || pathname.startsWith(`${BASE}/gmt/`));
}

/**
 * The reason a URL fails the rule, or `null` when it passes. Relative URLs, hashes, non-http
 * schemes and other hosts pass.
 */
function judgeUrl(raw: string): string | null {
  const url = raw.trim();
  if (url === "" || url.startsWith("#")) return null;
  if (url.includes(LEGACY_HOST)) return "names the old host";
  if (url.startsWith("//")) return null; // protocol-relative: another host
  if (url.startsWith("/")) {
    const pathname = url.split(/[?#]/)[0];
    return underBase(pathname) ? null : "root-absolute without /gmt";
  }
  if (url === ORIGIN || url.startsWith(`${ORIGIN}/`)) {
    const pathname = url.slice(ORIGIN.length).split(/[?#]/)[0] || "/";
    return underBase(pathname) ? null : "northguild.dev URL outside /gmt";
  }
  return null;
}

function check(
  values: Iterable<string>,
  where: string,
  out: BaseFailure[],
): void {
  for (const value of values) {
    const why = judgeUrl(value);
    if (why !== null) out.push({ value, where: `${where} (${why})` });
  }
}

function dedupe(list: BaseFailure[]): BaseFailure[] {
  const seen = new Set<string>();
  return list.filter((f) => {
    const key = `${f.value}\u0000${f.where}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Every `url(…)` argument in a block of CSS, quoted or not. */
function cssUrls(css: string): string[] {
  const found: string[] = [];
  for (const m of css.matchAll(
    /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)"']*?))\s*\)/gi,
  ))
    found.push((m[1] ?? m[2] ?? m[3] ?? "").trim());
  return found;
}

/** Every `@import "x"` and `@import url(x)` target. */
function cssImports(css: string): string[] {
  const found: string[] = [];
  for (const m of css.matchAll(
    /@import\s+(?:url\()?\s*(?:"([^"]*)"|'([^']*)')/gi,
  ))
    found.push(m[1] ?? m[2] ?? "");
  return found;
}

/** The candidate URLs of a `srcset`: the first token of each comma-separated candidate. */
function srcsetUrls(srcset: string): string[] {
  return srcset
    .split(",")
    .map((c) => c.trim().split(/\s+/)[0])
    .filter(Boolean);
}

const URL_ATTRS = new Set(["href", "src", "poster", "action"]);

export function badUrlsInHtml(html: string): BaseFailure[] {
  const out: BaseFailure[] = [];

  // Every start tag, then every attribute in it. The tag pattern steps over quoted strings so a
  // `>` inside an attribute value does not end the tag.
  for (const tag of html.matchAll(
    /<([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g,
  )) {
    const tagName = tag[1].toLowerCase();
    const props = new Map<string, string>();
    for (const a of tag[2].matchAll(
      /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g,
    ))
      props.set(a[1].toLowerCase(), a[2] ?? a[3] ?? a[4] ?? "");

    const metaKey = (
      props.get("property") ??
      props.get("name") ??
      ""
    ).toLowerCase();
    for (const [name, value] of props) {
      const where = `<${tagName}> ${name}`;
      // The one exception to the rule below: an anchor to the landing page itself.
      if (tagName === "a" && name === "href" && value === LANDING) continue;
      if (URL_ATTRS.has(name)) check([value], where, out);
      else if (name === "srcset" || name === "imagesrcset")
        check(srcsetUrls(value), where, out);
      else if (
        name === "content" &&
        tagName === "meta" &&
        /^(og|twitter):/.test(metaKey)
      )
        check([value], `<meta ${metaKey}>`, out);
      else if (name.startsWith("data-") && /(href|src|url)$/.test(name))
        check([value], where, out);
      else if (name === "style") check(cssUrls(value), where, out);
      else if (value.includes(LEGACY_HOST))
        out.push({ value, where: `${where} (names the old host)` });
    }
  }

  for (const block of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
    check(cssUrls(block[1]), "<style> url()", out);
    check(cssImports(block[1]), "<style> @import", out);
  }
  return dedupe(out);
}

export function badUrlsInCss(css: string): BaseFailure[] {
  const out: BaseFailure[] = [];
  check(cssUrls(css), "url()", out);
  check(cssImports(css), "@import", out);
  return dedupe(out);
}

/** Fenced code may hold anything a code sample holds. */
function withoutFences(md: string): string {
  return md.replace(/^(```|~~~)[^\n]*\n[\s\S]*?^\1[ \t]*$/gm, "");
}

export function badLinksInMarkdown(md: string): BaseFailure[] {
  const out: BaseFailure[] = [];
  const prose = withoutFences(md);

  // Inline links and images: `](target)`, `](target "title")`, `](<target>)`.
  for (const m of prose.matchAll(/\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g))
    check([m[1]], "markdown link", out);
  // Reference definitions: `[id]: target`.
  for (const m of prose.matchAll(
    /^[ \t]{0,3}\[[^\]]+\]:[ \t]*<?(\S+?)>?(?:[ \t]+.*)?$/gm,
  ))
    check([m[1]], "markdown reference", out);
  // Raw HTML left in the page.
  for (const m of prose.matchAll(
    /\b(?:href|src)\s*=\s*(?:"([^"]*)"|'([^']*)')/g,
  ))
    check([m[1] ?? m[2] ?? ""], "raw href/src", out);
  // Bare northguild.dev URLs.
  for (const m of prose.matchAll(
    /https:\/\/northguild\.dev(?:\/[^\s)<>"'\]`]*)?/g,
  )) {
    const why = judgeUrl(m[0]);
    if (why !== null) out.push({ value: m[0], where: `bare URL (${why})` });
  }
  if (prose.includes(LEGACY_HOST))
    out.push({ value: LEGACY_HOST, where: "names the old host" });
  return dedupe(out);
}

export function badRedirectRules(text: string): BaseFailure[] {
  const out: BaseFailure[] = [];
  for (const line of text.split("\n")) {
    const rule = line.trim();
    if (rule === "" || rule.startsWith("#")) continue;
    const fields = rule.split(/\s+/);
    if (fields.length !== 3) {
      out.push({ value: rule, where: "redirect rule (needs three fields)" });
      continue;
    }
    if (!fields[0].startsWith(`${BASE}/`))
      out.push({ value: rule, where: "redirect rule (source outside /gmt/)" });
    if (!fields[1].startsWith(`${BASE}/`))
      out.push({ value: rule, where: "redirect rule (target outside /gmt/)" });
  }
  return out;
}

export function badSitemapLocs(xml: string): BaseFailure[] {
  const out: BaseFailure[] = [];
  for (const m of xml.matchAll(/<loc>\s*([^<]*?)\s*<\/loc>/g))
    if (!m[1].startsWith(`${ORIGIN}${BASE}/`))
      out.push({ value: m[1], where: "sitemap <loc>" });
  return out;
}

/**
 * The names the base helper (`withBase`) goes by in each bundled file.
 *
 * The minifier renames it: it is `r` where it is defined, exported as `i`, and imported as `a` or
 * `n` elsewhere. So the helper is found by its body, whose `withBase expects …` message survives
 * minification, and followed through the `import{i as a}from"./site.<hash>.js"` lines. A call
 * through any other function name is not the helper and is not exempt.
 *
 * `files` maps a bundle file name (`site.DDZq-i5k.js`) to its text. The result has an entry for
 * every file that names the helper, local or imported.
 */
export function baseHelperNames(
  files: Readonly<Record<string, string>>,
): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  const add = (file: string, name: string) => {
    (result[file] ??= []).push(name);
  };
  const exported = new Map<string, Set<string>>();
  const defRe =
    /function\s+([\w$]+)\(([\w$]+)\)\{if\(!\2\.startsWith\([`"']\/[`"']\)\|\|\2\.startsWith\([`"']\/\/[`"']\)\)throw[^;]*?withBase expects/;
  for (const [file, text] of Object.entries(files)) {
    const local = text.match(defRe)?.[1];
    if (local === undefined) continue;
    add(file, local);
    const names = new Set<string>();
    for (const block of text.matchAll(/export\s*\{([^}]*)\}/g))
      for (const spec of block[1].split(",")) {
        const m = spec.trim().match(/^([\w$]+)(?:\s+as\s+([\w$]+))?$/);
        if (m !== null && m[1] === local) names.add(m[2] ?? m[1]);
      }
    exported.set(file.replace(/\.js$/, ""), names);
  }
  for (const [file, text] of Object.entries(files))
    for (const imp of text.matchAll(
      /import\s*\{([^}]*)\}\s*from\s*[`"']\.\/([^`"']+?)(?:\.js)?[`"']/g,
    )) {
      const names = exported.get(imp[2]);
      if (names === undefined) continue;
      for (const spec of imp[1].split(",")) {
        const m = spec.trim().match(/^([\w$]+)(?:\s+as\s+([\w$]+))?$/);
        if (m !== null && names.has(m[1])) add(file, m[2] ?? m[1]);
      }
    }
  return result;
}

/**
 * Whether the text before a literal shows the literal is not a request path as it stands.
 *
 * Narrow on purpose. A quoted string starting `/api/` or `/<publicName>` fails unless one of these
 * holds, and each is an exact shape, not a class of calls:
 *
 * - it is the argument of the base helper (`helpers`, see `baseHelperNames`);
 * - it is the tail of `"/gmt"+…` or `"/gmt".replace(/\/$/,"")+…` (Starlight's Pagefind
 *   `bundlePath`), whose head is the base itself;
 * - it is a vendor default no caller reads as a URL, matched by shape and exact value. The ai-sdk
 *   transport's `{api:e="/api/chat"}` is overridden by Dox's `api: withBase("/api/chat")`;
 *   Pagefind UI's `{base_path:o="/pagefind/"}` and `catch{x="/pagefind/"}` fallbacks are
 *   overridden by the `bundlePath` above. Dox source never writes these destructuring defaults
 *   (`dist-base.test.ts` checks), so the shape matches only the vendor code.
 */
function isGuarded(
  before: string,
  value: string,
  helpers: readonly string[],
): boolean {
  if (
    /(["'`])\/gmt\1(?:\.replace\(\/\\\/\$\/,(["'`])\2\))?\s*\+\s*$/.test(before)
  )
    return true;
  if (value === "/api/chat" && /\{api:[\w$]+=$/.test(before)) return true;
  if (value === "/pagefind/" && /(?:\{base_path:|catch\{)[\w$]+=$/.test(before))
    return true;
  return helpers.some((h) =>
    new RegExp(`(?<![\\w$.])${h.replace(/\$/g, "\\$")}\\($`).test(before),
  );
}

/**
 * Quoted strings in bundled JS that start like a request to the site root.
 *
 * `publicNames` are the non-page top-level entries of the built site (files, and directories with
 * no `index.html`). A string starting `/<name>` for one of them asks for a public file and needs
 * the base. Page routes are left out on purpose: the route manifest and permalink tables hold
 * base-less routes by design. `/api/` is always checked. `helpers` are this file's names for the
 * base helper (`baseHelperNames`); see `isGuarded` for the only exemptions.
 */
export function badJsLiterals(
  js: string,
  publicNames: readonly string[],
  helpers: readonly string[] = [],
): BaseFailure[] {
  const out: BaseFailure[] = [];
  const escaped = publicNames.map((n) =>
    n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  );
  // A name must end at a boundary: `/fonts` is a hit for "/fonts/x.woff2" but not for "/fontsy".
  const alternatives = ["api/", ...escaped.map((n) => `${n}(?![\\w-])`)];
  const re = new RegExp(
    `(["'\`])(/(?:${alternatives.join("|")})[^"'\`\\n]*)`,
    "g",
  );
  for (const m of js.matchAll(re)) {
    const before = js.slice(Math.max(0, m.index - 60), m.index);
    if (!isGuarded(before, m[2], helpers))
      out.push({ value: m[2], where: "JS string literal" });
  }
  if (js.includes(LEGACY_HOST))
    out.push({ value: LEGACY_HOST, where: "names the old host" });
  return dedupe(out);
}
