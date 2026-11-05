/**
 * Pure helpers for how `html-diff.mjs` compares a whole page.
 *
 * A page is compared as markup: the inlined `<style>` text and inline script bodies are dropped, because the order a
 * bundler writes the widget sheets in says nothing about the markup and used to be where the
 * first difference landed. The site header is compared too, minus the parts the header redesign
 * changed on purpose, so a change to anything else in it (search, theme select, social links, the
 * mobile menu) still fails.
 */

const HEADER = /<header\b[^>]*>[\s\S]*?<\/header>/;

/**
 * The page without its inlined CSS text and its inline script bodies. Both are minified by the
 * bundler, whose output differs between builds of the same source (`let e=…;e&&…` against `…?.…`),
 * so they are not markup. A script with a `src` or a JSON type keeps its tag and its body.
 *
 * The head's arrival script (it listens for `pagereveal`, see src/lib/arrival.ts) is dropped whole:
 * every page carries it and the baseline it is compared with predates it, so it would show as
 * one added tag on every page. Its body is tested in src/lib/arrival.test.ts.
 */
export function withoutStyles(html) {
  return html
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/g, "")
    .replace(
      /<script\b(?![^>]*\bsrc=)[^>]*>(?:(?!<\/script>)[\s\S])*?\bpagereveal\b[\s\S]*?<\/script>/g,
      "",
    )
    .replace(
      /<script\b(?![^>]*(?:\bsrc=|type="application\/(?:ld\+)?json"))([^>]*)>[\s\S]*?<\/script>/g,
      "<script$1></script>",
    );
}

/**
 * The header with the intended redesign removed from it: the NorthGuild mark link, its divider and
 * wordmark, the title block (the site-title link and the version), the `gmt-theme-dark` class, and
 * and nothing else. What remains is what must not move.
 */
export function headerWithoutRedesign(header) {
  return header
    .replace(/<a\b[^>]*\bgmt-ng-link\b[^>]*>[\s\S]*?<\/a>/g, "")
    .replace(/<span\b[^>]*\bgmt-ng-divider\b[^>]*>\s*<\/span>/g, "")
    .replace(/<span\b[^>]*\bgmt-ng-wordmark\b[^>]*>[\s\S]*?<\/span>/g, "")
    .replace(/<a\b[^>]*\bsite-title\b[^>]*>[\s\S]*?<\/a>/g, "")
    .replace(
      /<span\b[^>]*\bgmt-app-title\b[^>]*>\s*(<span\b[^>]*\bgmt-app-version\b[^>]*>[^<]*<\/span>)?\s*<\/span>/g,
      "",
    )
    .replace(/\sgmt-theme-dark\b/g, "");
}

/**
 * Astro's scope classes (`astro-` and eight characters) hash a component's own source, so any edit
 * to a component renames them on every page that uses it, with no change to the markup. The
 * sidebar's persisted-state hash is a digest of the sidebar's contents, which differ whenever a
 * page is added; the contents themselves are still compared.
 */
export function withoutScopeHashes(html) {
  return html
    .replace(/\bastro-[a-z0-9]{8}\b/g, "astro-scope")
    .replace(
      /(<sl-sidebar-state-persist\b[^>]*\bdata-hash=")[^"]*"/g,
      '$1sidebar-hash"',
    );
}

/**
 * Names a bundler writes with a content hash, such as `/_astro/Head.astro_astro_type_script_index_0_lang.Cx9_aB-1.js`.
 * Any edit to a module renames every chunk that imports it, so the hash segment (five to twelve
 * characters of its own, between the base name and the extension) is masked wherever a `/_astro/`
 * path appears, in an attribute, an import specifier or a JSON string. The base name is kept, so
 * swapping a page to a different script still shows.
 */
export function withoutAssetHashes(html) {
  return html.replace(
    /(\/_astro\/[^"'\s<>)]*?)\.[A-Za-z0-9_-]{5,12}\.(js|mjs|css|json|wasm|svg|png|jpe?g|webp|avif|gif|woff2?|ttf)(?![A-Za-z0-9_-])/g,
    "$1.<hash>.$2",
  );
}

/**
 * The dates Starlight reads from git history: `dateModified` in the page's JSON-LD and the
 * "Last updated" `<time>` in the footer. The value is the page source's last commit time, so it
 * moves whenever the page's own file is edited, and a tree without history has none. It is data,
 * never markup, so the value is masked and the element stays: a page that gains or loses its
 * date is still a difference.
 */
export function withoutGitDates(html) {
  return html
    .replace(/("dateModified":")[^"]*"/g, '$1<date>"')
    .replace(
      /(<time\b[^>]*\bdatetime=")[^"]*("[^>]*>)[^<]*(<\/time>)/g,
      "$1<date>$2<date>$3",
    );
}

/** The page as the page comparison sees it, given whitespace-normalised markup. */
export function pageMarkup(html) {
  return withoutGitDates(
    withoutAssetHashes(withoutScopeHashes(withoutStyles(html))),
  ).replace(HEADER, (header) => headerWithoutRedesign(header));
}

/**
 * The page's tables, in order, as one string. A page with no widget is compared by these: they
 * carry the cell labels the table plugin writes, which is what that comparison guards. The box
 * around a table, the header and the menu are compared as page markup instead, and a difference
 * there is a page change to review.
 */
export function tablesOf(html) {
  return (html.match(/<table\b[\s\S]*?<\/table>/g) ?? []).join("\n");
}
