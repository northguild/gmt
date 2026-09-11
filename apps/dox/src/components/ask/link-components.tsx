/**
 * The Markdown link renderer for Dox's answers — the enforcement point for
 * `DOX-C`'s binding rule that **a link the model emits either resolves or is
 * not a link, never a 404.**
 *
 * `resolveHref` decides; this module is the React half that acts on the
 * decision, and it lives in its own file for one reason: while it was an inline
 * `useMemo` inside `DoxChat`, the only thing a test could reach was
 * `resolveHref` itself. That left the story's self-declared most important
 * behaviour — a hallucinated path *rendering* as plain text — asserted only by
 * inference from a pure function, with the Markdown → Streamdown → `components.a`
 * chain between it and the reader untested. See `link-components.test.tsx`.
 */
import type { ReactNode } from "react";
import { resolveHref } from "./resolve-href";

/** Origins a model-emitted link may point at off-site. GitHub is where the
 *  package, its issues and its source actually live; everything else degrades. */
export const ALLOWED_EXTERNAL_ORIGINS = ["https://github.com"];

export function createLinkComponents({
  knownRoutes,
  siteOrigin,
  allowedExternalOrigins = ALLOWED_EXTERNAL_ORIGINS,
}: {
  knownRoutes: ReadonlySet<string>;
  /**
   * Defaults to `window.location.origin`, read **lazily, inside the renderer**.
   *
   * This must never be read while building the components object. `/dox` is
   * server-rendered before it hydrates (`client:load`), so this factory runs
   * under Node, where there is no `window` — hoisting the lookup up here is
   * exactly the regression that broke the build once already. Inside `a` it is
   * safe by construction: a link only renders once there are messages, and
   * there are never messages during SSR.
   *
   * Tests pass an explicit origin so they need no DOM globals for this.
   */
  siteOrigin?: string;
  allowedExternalOrigins?: readonly string[];
}) {
  return {
    a: ({
      href,
      children,
      ...props
    }: {
      href?: string;
      children?: ReactNode;
    }) => {
      const resolved = resolveHref(href ?? "", {
        knownRoutes,
        siteOrigin: siteOrigin ?? window.location.origin,
        allowedExternalOrigins,
      });
      if (resolved.kind === "link") {
        return (
          <a href={resolved.href} {...props}>
            {children}
          </a>
        );
      }
      // A hallucinated link degrades to its own text — never a 404.
      if (resolved.kind === "text") return <>{children}</>;
      return null;
    },
  };
}
