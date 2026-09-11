/**
 * The page a reader asked from.
 *
 * `/dox` is a page of its own, so `window.location` always says `/dox/`. What
 * retrieval wants is the page before it: a question asked after reading
 * `/reference/zoned/...` should lean toward `zoned` (see
 * `worker/namespace-from-page.ts`). The site navigates with full page loads and
 * the header's "Ask Dox" link is same-origin, so `document.referrer` carries
 * that page's URL.
 *
 * Only a same-origin referrer is used: another site's URL says nothing about
 * this corpus, and its path is not ours to send upstream. `/dox` itself — a
 * reload, or a conversation started there — has no page to lean toward.
 */
import { MAX_PAGE_CONTEXT_LENGTH } from "./chat-sanitize";

export function pageContextFromReferrer(
  referrer: string,
  origin: string,
): string | undefined {
  if (!referrer) return undefined;

  let url: URL;
  try {
    url = new URL(referrer);
  } catch {
    return undefined;
  }

  if (url.origin !== origin) return undefined;
  if (/^\/dox(\/|$)/.test(url.pathname)) return undefined;
  // The Worker rejects a longer one outright; sending nothing costs only the
  // bias, sending it would cost the answer.
  if (url.pathname.length > MAX_PAGE_CONTEXT_LENGTH) return undefined;

  return url.pathname;
}
