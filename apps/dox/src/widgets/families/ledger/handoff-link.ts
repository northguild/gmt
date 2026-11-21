/**
 * handoffLink: an anchor that looks like the kit's button and goes to another tool. The kit
 * `button` is a `<button>`, which cannot navigate. With no `href` the link is disabled: it
 * keeps its place, drops its link role and says `aria-disabled`, and the hint beside it says why.
 */
import type { SafeHtml } from "../../builders/html";
import { link } from "../../builders/link";
import styles from "./handoff-link.module.css";

interface HandoffLinkOptions {
  id: string;
  label: string;
  href?: string | undefined;
  describedBy?: string | undefined;
}

export function handoffLink(o: HandoffLinkOptions): SafeHtml {
  return link({
    href: o.href,
    class: styles.link,
    id: o.id,
    describedBy: o.describedBy,
    body: o.label,
  });
}
