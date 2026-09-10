/**
 * DOX-C3a (#139) — link hardening, layer 2 and the authority.
 *
 * The rule this exists to enforce: **a link the model emits either resolves or
 * is not a link.** A hallucinated citation must degrade to plain text, never to
 * a 404 — a broken link makes the docs look wrong when they're right.
 *
 * `rehype-harden` runs as layer 1 (defense in depth at the origin level), but
 * it can only *rewrite* an unknown link to a default origin. Degrading to plain
 * text is something only the `components.a` override can do, which is why this
 * function is the authority rather than the plugin.
 *
 * Pure and DOM-free on purpose — no React, no `window` — so the whole outcome
 * matrix is unit-testable in isolation.
 */

export type ResolvedHref =
  /** Render a real anchor pointing at `href`. */
  | { kind: "link"; href: string }
  /** Render the link text as plain prose — the target isn't known to exist. */
  | { kind: "text" }
  /** Render nothing at all — the href is unparseable or actively unsafe. */
  | { kind: "drop" };

export interface ResolveHrefOptions {
  /** Paths known to exist: the generated reference manifest, unioned with the
   * URLs actually retrieved this session (see `RetrievalTraceData.chunkUrls`
   * for why the manifest alone isn't sufficient). Compared by pathname, so
   * entries may be stored with or without a fragment. */
  knownRoutes: ReadonlySet<string>;
  /** This site's own origin, e.g. `https://gmt-dox.northguild.workers.dev`. */
  siteOrigin: string;
  /** External origins allowed to render as real links. Empty by default —
   * nothing external is trusted unless it's named here. */
  allowedExternalOrigins?: readonly string[];
}

/** Protocols allowed to survive as links. Everything else — `javascript:`,
 * `data:`, `vbscript:`, `file:` — is dropped outright rather than degraded,
 * since none of them are a plausible citation and all of them are a liability. */
const SAFE_PROTOCOLS = new Set(["https:", "http:", "mailto:"]);

/** Trailing slashes are a formatting detail, not an identity one: the manifest
 * stores `/reference/zoned/convert/x` while Starlight serves `/reference/zoned/convert/x/`.
 * Both must match. The site root is the one path that keeps its slash. */
function normalizePathname(pathname: string): string {
  if (pathname === "/") return "/";
  return pathname.replace(/\/+$/, "");
}

function isKnownRoute(
  pathname: string,
  knownRoutes: ReadonlySet<string>,
): boolean {
  const normalized = normalizePathname(pathname);
  if (knownRoutes.has(normalized)) return true;
  // Tolerate manifest/chunk entries stored with a trailing slash or a fragment.
  for (const route of knownRoutes) {
    const routePath = normalizePathname(route.split("#")[0].split("?")[0]);
    if (routePath === normalized) return true;
  }
  return false;
}

export function resolveHref(
  raw: string,
  options: ResolveHrefOptions,
): ResolvedHref {
  const { knownRoutes, siteOrigin, allowedExternalOrigins = [] } = options;

  const href = raw.trim();
  if (href === "") return { kind: "drop" };

  // A bare fragment is the shape a GitHub anchor or a SKILL.md heading takes
  // once the model strips the origin. There's no page to resolve it against,
  // so it degrades rather than pointing somewhere arbitrary.
  if (href.startsWith("#")) return { kind: "text" };

  let url: URL;
  try {
    url = new URL(href, siteOrigin);
  } catch {
    return { kind: "drop" };
  }

  if (!SAFE_PROTOCOLS.has(url.protocol)) return { kind: "drop" };

  // `mailto:` has no meaningful origin to check — the protocol allowlist above
  // is the whole check.
  if (url.protocol === "mailto:") return { kind: "link", href };

  if (url.origin === siteOrigin) {
    // Own origin, whether the model wrote it as a relative path or a full
    // production URL. Either way it's re-checked as a path, and the origin is
    // stripped so the rendered link stays relative.
    if (!isKnownRoute(url.pathname, knownRoutes)) return { kind: "text" };
    return { kind: "link", href: `${url.pathname}${url.search}${url.hash}` };
  }

  if (allowedExternalOrigins.includes(url.origin)) {
    return { kind: "link", href: url.href };
  }

  // A real-looking external URL we don't vouch for: show the text, don't
  // sanction it with a link.
  return { kind: "text" };
}
