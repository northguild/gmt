/**
 * @vitest-environment jsdom
 *
 * `DOX-C3a`'s Definition of Done names one test as the story's most important:
 *
 * > **A deliberately induced hallucinated link renders as plain text, not a
 * > broken link.** Test this directly — stub a response containing
 * > `/reference/plain/calculate/notAReal` and confirm it degrades.
 *
 * `resolve-href.test.ts` covers the *decision* as a pure function against a
 * two-entry fixture. This covers the *rendering*: real Markdown, the real
 * Streamdown pipeline `MessageResponse` uses in production, the real 500-plus
 * entry route manifest, and an assertion about what actually reaches the DOM.
 * Everything between `resolveHref` and the reader was previously untested.
 */
/// <reference types="vitest/globals" />
import { render, screen } from "@testing-library/react";
import { referenceRoutes } from "~/generated/reference/route-manifest";
import { MessageResponse } from "../ai-elements/message";
import { createLinkComponents } from "./link-components";
import { installJsdomShims } from "~/test/jsdom-shims";

installJsdomShims();

const SITE = "https://gmt-dox.northguild.workers.dev";

/** A path with exactly the shape the model invents: a plausible namespace, a
 *  plausible verb, and a function that does not exist. */
const HALLUCINATED = "/reference/plain/calculate/notAReal";

/** A real entry, taken from the generated manifest rather than hardcoded, so
 *  this test cannot rot into asserting against a route that was renamed. */
const REAL = [...referenceRoutes].find((route) =>
  route.includes("/convert/"),
) as string;

function renderAnswer(markdown: string, extraRoutes: string[] = []) {
  const components = createLinkComponents({
    knownRoutes: new Set([...referenceRoutes, ...extraRoutes]),
    siteOrigin: SITE,
  });
  return render(
    <MessageResponse components={components}>{markdown}</MessageResponse>,
  );
}

describe("the rendered link-hardening path", () => {
  it("sanity-checks the fixtures against the real manifest", () => {
    expect(REAL).toBeTruthy();
    expect(referenceRoutes.has(HALLUCINATED)).toBe(false);
  });

  it("degrades a hallucinated reference path to plain text, not a link", () => {
    const { container } = renderAnswer(
      `Use [notAReal](${HALLUCINATED}) for that.`,
    );

    // The words survive — the reader still gets a readable sentence.
    expect(container.textContent).toContain("notAReal");
    // But nothing points at a page that would 404.
    expect(container.querySelector(`a[href="${HALLUCINATED}"]`)).toBeNull();
    expect(screen.queryByRole("link", { name: "notAReal" })).toBeNull();
  });

  it("still renders a real reference path as a working link", () => {
    renderAnswer(`See [convert](${REAL}).`);

    const link = screen.getByRole("link", { name: "convert" });
    expect(link.getAttribute("href")).toBe(REAL);
  });

  it("keeps both behaviours straight inside one answer", () => {
    const { container } = renderAnswer(
      `Real: [good](${REAL}). Invented: [bad](${HALLUCINATED}).`,
    );

    expect(screen.getByRole("link", { name: "good" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "bad" })).toBeNull();
    expect(container.textContent).toContain("bad");
  });

  it("promotes a route retrieved this session even though the manifest omits it", () => {
    // The manifest holds only /reference/*; a guide URL reaches the client
    // solely through the retrieval trace. See chat-types.ts.
    const guide = "/guides/concepts/dst-disambiguation/";
    expect(referenceRoutes.has(guide)).toBe(false);

    renderAnswer(`Read [the guide](${guide}).`, [guide]);
    expect(screen.getByRole("link", { name: "the guide" }).getAttribute("href")).toBe(
      guide,
    );
  });

  it("degrades an off-site link to an origin that is not allowlisted", () => {
    const { container } = renderAnswer(
      "Try [this tool](https://evil.example.com/gmt).",
    );

    expect(container.textContent).toContain("this tool");
    expect(screen.queryByRole("link", { name: "this tool" })).toBeNull();
  });
});
