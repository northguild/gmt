/// <reference types="vitest/globals" />
import { resolveHref } from "./resolve-href";

const SITE = "https://gmt-dox.northguild.workers.dev";

const OPTIONS = {
  knownRoutes: new Set([
    "/reference/zoned/convert/convertZonedToZoned",
    "/guides/conversion/converting-types/#zoned-to-utc-and-back",
  ]),
  siteOrigin: SITE,
  allowedExternalOrigins: ["https://github.com"],
};

describe("resolveHref", () => {
  it("renders a relative path that is in the manifest as a real link", () => {
    expect(
      resolveHref("/reference/zoned/convert/convertZonedToZoned", OPTIONS),
    ).toEqual({
      kind: "link",
      href: "/reference/zoned/convert/convertZonedToZoned",
    });
  });

  it("tolerates a trailing slash — Starlight serves them, the manifest omits them", () => {
    expect(
      resolveHref("/reference/zoned/convert/convertZonedToZoned/", OPTIONS),
    ).toEqual({
      kind: "link",
      href: "/reference/zoned/convert/convertZonedToZoned/",
    });
  });

  it("strips our own origin off a full production URL and re-checks it as a path", () => {
    expect(
      resolveHref(
        `${SITE}/reference/zoned/convert/convertZonedToZoned`,
        OPTIONS,
      ),
    ).toEqual({
      kind: "link",
      href: "/reference/zoned/convert/convertZonedToZoned",
    });
  });

  it("degrades a relative path that is NOT in the manifest to plain text", () => {
    // The story's most important case: a hallucinated reference page.
    expect(resolveHref("/reference/plain/calculate/notAReal", OPTIONS)).toEqual(
      {
        kind: "text",
      },
    );
  });

  it("degrades a hallucinated path even on our own full origin", () => {
    expect(
      resolveHref(`${SITE}/reference/plain/calculate/notAReal`, OPTIONS),
    ).toEqual({ kind: "text" });
  });

  it("keeps a guide link whose page was retrieved, fragment included", () => {
    const result = resolveHref(
      "/guides/conversion/converting-types/#zoned-to-utc-and-back",
      OPTIONS,
    );
    expect(result).toEqual({
      kind: "link",
      href: "/guides/conversion/converting-types/#zoned-to-utc-and-back",
    });
  });

  it("accepts a known guide page even when the model omits the fragment", () => {
    expect(
      resolveHref("/guides/conversion/converting-types/", OPTIONS),
    ).toEqual({
      kind: "link",
      href: "/guides/conversion/converting-types/",
    });
  });

  it("degrades a bare fragment — a GitHub anchor or SKILL.md heading", () => {
    expect(resolveHref("#core-rules", OPTIONS)).toEqual({ kind: "text" });
  });

  it("links an allowlisted external origin", () => {
    expect(resolveHref("https://github.com/northguild/gmt", OPTIONS)).toEqual({
      kind: "link",
      href: "https://github.com/northguild/gmt",
    });
  });

  it("degrades an external origin that is not allowlisted", () => {
    expect(resolveHref("https://example.com/whatever", OPTIONS)).toEqual({
      kind: "text",
    });
  });

  it("drops javascript: outright", () => {
    expect(resolveHref("javascript:alert(1)", OPTIONS)).toEqual({
      kind: "drop",
    });
  });

  it("drops data: outright", () => {
    expect(
      resolveHref("data:text/html,<script>alert(1)</script>", OPTIONS),
    ).toEqual({ kind: "drop" });
  });

  it("drops other unsafe protocols", () => {
    expect(resolveHref("vbscript:msgbox(1)", OPTIONS)).toEqual({
      kind: "drop",
    });
    expect(resolveHref("file:///etc/passwd", OPTIONS)).toEqual({
      kind: "drop",
    });
  });

  it("drops an empty or whitespace-only href", () => {
    expect(resolveHref("", OPTIONS)).toEqual({ kind: "drop" });
    expect(resolveHref("   ", OPTIONS)).toEqual({ kind: "drop" });
  });

  it("allows mailto: on protocol alone — it has no origin to check", () => {
    expect(resolveHref("mailto:hi@example.com", OPTIONS)).toEqual({
      kind: "link",
      href: "mailto:hi@example.com",
    });
  });

  it("degrades everything when nothing has been retrieved yet", () => {
    const empty = { ...OPTIONS, knownRoutes: new Set<string>() };
    expect(
      resolveHref("/reference/zoned/convert/convertZonedToZoned", empty),
    ).toEqual({ kind: "text" });
  });
});
