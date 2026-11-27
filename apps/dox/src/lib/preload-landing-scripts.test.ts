import { preloadStaticImports } from "./preload-landing-scripts";

const files: Record<string, string> = {
  "entry.A.js": 'import{a}from"./mid.B.js";import"./side.C.js";',
  "mid.B.js":
    'import{b}from"./leaf.D.js";export const a=import("./lazy.E.js");',
  "side.C.js": 'import{b}from"./leaf.D.js";',
  "leaf.D.js": "export const b=1;",
  "lazy.E.js": "export {};",
};
const read = (file: string): string => files[file] ?? "";

const page = (body: string): string =>
  `<html><head><title>t</title></head><body>${body}<script type="module" src="/gmt/_astro/entry.A.js"></script></body></html>`;

describe("preloadStaticImports", () => {
  it("lists every static import of the entry scripts once, deepest included, and leaves out the entry and the dynamic imports", () => {
    const html = preloadStaticImports(page("<div data-hero-sky></div>"), read);
    const list = /var h=(\[[^\]]*\]);/.exec(html)?.[1] ?? "[]";
    expect(JSON.parse(list)).toEqual([
      "/gmt/_astro/leaf.D.js",
      "/gmt/_astro/mid.B.js",
      "/gmt/_astro/side.C.js",
    ]);
    expect(html.indexOf("modulepreload")).toBeLessThan(html.indexOf("</head>"));
    expect(html).toContain('"paint"');
  });

  it("changes nothing on a page that is not the landing", () => {
    const html = page("<main>docs</main>");
    expect(preloadStaticImports(html, read)).toBe(html);
  });

  it("changes nothing where an entry has no imports", () => {
    const html = page("<div data-hero-sky></div>");
    expect(preloadStaticImports(html, () => "")).toBe(html);
  });
});
