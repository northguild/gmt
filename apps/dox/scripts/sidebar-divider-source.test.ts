/**
 * The sidebar divider, read from `SidebarSublist.astro` and `astro.config.mjs`.
 *
 * Starlight renders the sidebar at build time, so these checks read the source and the
 * built-page gates own the rendered result.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

describe("the sidebar divider", () => {
  const read = (file: string) =>
    readFileSync(
      path.resolve(import.meta.dirname, "..", "src", "components", file),
      "utf8",
    );

  it("is text that names the list after it, not a link, a group or a stop", () => {
    const sublist = read("SidebarSublist.astro");
    const divider = sublist.slice(
      sublist.indexOf("sections.map(({ divider, entries }) => ("),
    );
    const row = divider.slice(0, divider.indexOf("))\n\t}"));
    expect(row).toMatch(
      /<span id=\{dividerId\(divider\)\} class="gmt-sidebar-divider">/,
    );
    expect(row).toMatch(/labelledby=\{dividerId\(divider\)\}/);
    expect(row).not.toMatch(/<a\b|<details|<summary|tabindex|<button/);
    expect(sublist).toMatch(/aria-labelledby=\{labelledby\}/);
  });

  it("draws every divider in a list, each with its own id", () => {
    const sublist = read("SidebarSublist.astro");
    expect(sublist).toMatch(
      /sections\.push\(\{ divider: entry, entries: \[\] \}\)/,
    );
    expect(sublist).toMatch(/const dividerId = \(divider: LinkEntry\) =>/);
  });

  it("shows an industry divider's icon as decoration only", () => {
    const sublist = read("SidebarSublist.astro");
    const start = sublist.indexOf('class="gmt-sidebar-divider-icon"');
    expect(start).toBeGreaterThan(0);
    const icon = sublist.slice(
      sublist.lastIndexOf("<svg", start),
      sublist.indexOf("/>", start),
    );
    expect(icon).toMatch(/aria-hidden="true"/);
    expect(icon).toMatch(/focusable="false"/);
    expect(icon).toMatch(
      /set:html=\{industryIcon\(divider\.attrs\['data-gmt-industry'\]\)\}/,
    );
  });

  it("shows a hub link's icon as decoration only, through the attribute that is not the group-icon rule's", () => {
    const sublist = read("SidebarSublist.astro");
    const start = sublist.indexOf('class="gmt-sidebar-link-icon"');
    expect(start).toBeGreaterThan(0);
    const icon = sublist.slice(
      sublist.lastIndexOf("<svg", start),
      sublist.indexOf("/>", start),
    );
    expect(icon).toMatch(/aria-hidden="true"/);
    expect(icon).toMatch(/focusable="false"/);
    expect(icon).toMatch(
      /set:html=\{industryIcon\(entry\.attrs\['data-gmt-industry-link'\]\)\}/,
    );
    // The group-icon rule keys on `data-gmt-industry`; a hub link must not carry that one.
    expect(icon).not.toMatch(/data-gmt-industry['"\]]/);
  });

  it("is registered as the one Sidebar override", () => {
    const config = readFileSync(
      path.resolve(import.meta.dirname, "..", "astro.config.mjs"),
      "utf8",
    );
    expect(config).toMatch(/Sidebar: "\.\/src\/components\/Sidebar\.astro"/);
  });
});
