/**
 * The built pages that hold a table.
 *
 * `listTablePages(distRoot)` returns the site path (`/compare/behaviour/`, no `/gmt` prefix) of
 * every built page whose HTML has a `<table`, sorted (`listBuiltPages`).
 */
import { listBuiltPages } from "./built-pages.mjs";

export const listTablePages = (distRoot) =>
  listBuiltPages(distRoot, (html) => html.includes("<table"));
