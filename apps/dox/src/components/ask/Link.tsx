/**
 * The chat's link: an `<a>` whose `target` and `rel` come from `linkTarget`
 * (`lib/external-link`), so an external link opens in a new tab and nothing else does.
 * `isExternal` defaults from the `href`. Every other attribute passes through. The chat's components write this
 * rather than a bare `<a>`; `link-homes.test.ts` holds them to it.
 */
import type { AnchorHTMLAttributes } from "react";
import { linkTarget } from "~/lib/external-link";

export interface LinkProps extends Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  "href" | "target"
> {
  href: string;
  /** Opens in a new tab when true. Defaults from the `href`; set it on a site link whose page
   *  would lose what is on screen if left. */
  isExternal?: boolean;
}

export function Link({ href, rel, isExternal, children, ...attrs }: LinkProps) {
  const opens = linkTarget(href, rel, isExternal);
  return (
    <a href={href} {...attrs} target={opens.target} rel={opens.rel}>
      {children}
    </a>
  );
}
