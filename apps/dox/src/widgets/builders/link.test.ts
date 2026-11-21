// @vitest-environment jsdom
import { expectNoAxeViolations } from "~/test/render-widget";
import { renderHtml } from "../test-fixture";
import { html } from "./html";
import { link } from "./link";

describe("link", () => {
  it("opens an external link in a new tab, with the caller's rel kept", () => {
    expect(
      link({
        href: "https://github.com/northguild/gmt",
        body: "gmt",
        rel: "me",
      }).value,
    ).toBe(
      '<a href="https://github.com/northguild/gmt" target="_blank" rel="me noopener noreferrer">gmt</a>',
    );
  });

  it("keeps a site link in the same tab and escapes its text", () => {
    expect(
      link({
        href: "/gmt/tools/dst-inspector/",
        body: "DST <Inspector>",
        class: "x",
      }).value,
    ).toBe(
      '<a class="x" href="/gmt/tools/dst-inspector/">DST &lt;Inspector&gt;</a>',
    );
  });

  it("takes markup as its body, and with no href is a link that is not ready", () => {
    expect(
      link({ body: html`<code>f</code>`, id: "go", describedBy: "why" }).value,
    ).toBe(
      '<a id="go" aria-disabled="true" aria-describedby="why"><code>f</code></a>',
    );
  });

  it("opens a site link in a new tab when isExternal says so", () => {
    expect(
      link({ href: "/gmt/tools/", body: "Tools", isExternal: true }).value,
    ).toBe(
      '<a href="/gmt/tools/" target="_blank" rel="noopener noreferrer">Tools</a>',
    );
  });

  it("has no axe violations, external, site and not-ready alike", async () => {
    const fx = renderHtml(
      html`<p>
        ${link({ href: "https://github.com/northguild/gmt", body: "gmt" })}
        ${link({ href: "/gmt/tools/", body: "Tools" })}
        ${link({ body: "Planner", id: "go" })}
      </p>`,
    );
    await expectNoAxeViolations(fx.host);
  });
});
