/**
 * The built pages that hold a widget.
 *
 * `listWidgetPages(distRoot)` returns the site path (`/tools/dst-inspector/`, no `/gmt` prefix) of
 * every built page whose HTML has an element with a `data-widget` attribute, sorted
 * (`listBuiltPages`). A `data-widget` inside a script, a style or a comment is text, not an element,
 * and does not count.
 */
import { listBuiltPages } from "./built-pages.mjs";

/** An opening tag that carries a `data-widget` attribute. */
const WIDGET_TAG = /<[a-z][^>]*\sdata-widget=/i;
/** Script and style bodies and comments: text, never markup. */
const NOT_MARKUP = /<(script|style)\b[\s\S]*?<\/\1>|<!--[\s\S]*?-->/gi;

export const listWidgetPages = (distRoot) =>
  listBuiltPages(distRoot, (html) =>
    WIDGET_TAG.test(html.replace(NOT_MARKUP, "")),
  );
