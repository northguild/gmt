/**
 * link: the widgets' `<a>`, with its `target` and `rel` from `linkTarget` (`lib/external-link`), so
 * an external link opens in a new tab and nothing else does. With no `href` it is a link that is
 * not ready: it keeps its place, has no link role and says `aria-disabled`
 * (https://www.w3.org/WAI/ARIA/apg/patterns/link/). Every builder and mount that writes a link
 * calls this rather than writing `<a>` itself; `link-homes.test.ts` holds them to it.
 */
import { linkTarget } from "~/lib/external-link";
import { html, type HtmlValue, type SafeHtml } from "./html";

export interface LinkOptions {
  /** Omit for a link that is not ready yet. */
  href?: string | undefined;
  /** The link's content: text, or markup from `html`. */
  body: HtmlValue;
  class?: string | undefined;
  id?: string | undefined;
  rel?: string | undefined;
  /** Opens in a new tab when true. Defaults from the `href`: an absolute or `//` URL. */
  isExternal?: boolean | undefined;
  describedBy?: string | undefined;
  /** Further attributes, written as they stand: `html`, never user text. */
  attrs?: SafeHtml | undefined;
}

export function link(o: LinkOptions): SafeHtml {
  const opens = linkTarget(o.href, o.rel, o.isExternal);
  return html`<a${o.class === undefined ? "" : html` class="${o.class}"`}${o.id === undefined ? "" : html` id="${o.id}"`}${
    o.href === undefined ? html` aria-disabled="true"` : html` href="${o.href}"`
  }${opens.target === undefined ? "" : html` target="${opens.target}"`}${
    opens.rel === undefined ? "" : html` rel="${opens.rel}"`
  }${o.describedBy === undefined ? "" : html` aria-describedby="${o.describedBy}"`}${
    o.attrs === undefined ? "" : html` ${o.attrs}`
  }>${o.body}</a>`;
}
