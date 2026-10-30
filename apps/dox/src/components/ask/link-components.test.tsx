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
import { render, screen } from "@testing-library/react";
import { referenceRoutes } from "~/generated/reference/route-manifest";
import { MessageResponse } from "../ai-elements/message";
import { createLinkComponents } from "./link-components";
import { installJsdomShims } from "~/test/jsdom-shims";
import { expectNoAxeViolations } from "~/test/render-widget";

installJsdomShims();

const SITE = "https://northguild.dev";

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

  it("degrades a hallucinated reference path to plain text, not a link", async () => {
    const { container } = renderAnswer(
      `Use [notAReal](${HALLUCINATED}) for that.`,
    );

    // The words survive — the reader still gets a readable sentence.
    expect(screen.getByText(/notAReal/)).toBeInTheDocument();
    // But nothing points at a page that would 404.
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it("still renders a real reference path as a working link", async () => {
    const { container } = renderAnswer(`See [convert](${REAL}).`);

    expect(screen.getByRole("link", { name: "convert" })).toHaveAttribute(
      "href",
      `/gmt${REAL}`,
    );
    await expectNoAxeViolations(container);
  });

  it("keeps both behaviours straight inside one answer", async () => {
    const { container } = renderAnswer(
      `Real: [good](${REAL}). Invented: [bad](${HALLUCINATED}).`,
    );

    expect(screen.getByRole("link", { name: "good" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "bad" })).not.toBeInTheDocument();
    expect(screen.getByText(/Invented: bad/)).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it("promotes a route retrieved this session even though the manifest omits it", async () => {
    // The manifest holds only /reference/*; a guide URL reaches the client
    // solely through the retrieval trace. See chat-types.ts.
    const guide = "/guides/concepts/dst-disambiguation/";
    expect(referenceRoutes.has(guide)).toBe(false);

    const { container } = renderAnswer(`Read [the guide](${guide}).`, [guide]);
    expect(screen.getByRole("link", { name: "the guide" })).toHaveAttribute(
      "href",
      `/gmt${guide}`,
    );
    await expectNoAxeViolations(container);
  });

  it("opens an allowlisted off-site link in a new tab, and a site link in the same tab", async () => {
    const { container } = renderAnswer(
      `See [the source](https://github.com/northguild/gmt) and [convert](${REAL}).`,
    );

    const github = screen.getByRole("link", { name: "the source" });
    expect(github).toHaveAttribute("target", "_blank");
    expect(github).toHaveAttribute("rel", "noopener noreferrer");

    const site = screen.getByRole("link", { name: "convert" });
    expect(site).not.toHaveAttribute("target");
    expect(site).not.toHaveAttribute("rel");
    await expectNoAxeViolations(container);
  });

  it("degrades an off-site link to an origin that is not allowlisted", async () => {
    const { container } = renderAnswer(
      "Try [this tool](https://evil.example.com/gmt).",
    );

    expect(screen.getByText(/this tool/)).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    await expectNoAxeViolations(container);
  });
});
