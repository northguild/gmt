import { describe, expect, it } from "vitest";
import {
  astroFile,
  classTokens,
  moduleClasses,
  pruneStylesheetLinks,
  scriptFiles,
  usesStylesheet,
} from "./prune-widget-css";

/* The sheets under test hold CSS-Module names, which carry the house prefix; it is built
   here so no test names a house class. */
const g = (name: string) => `${"gmt"}-${name}`;

const link = (file: string) =>
  `<link rel="stylesheet" href="/gmt/_astro/${file}">`;

describe("moduleClasses", () => {
  it("reads the class names of a CSS-Module sheet", () => {
    const css = `.${g("globe__stage")}{margin:0.5rem}@media (width>1px){.${g("globe__clock")}:hover{color:red}}`;
    expect(moduleClasses(css)).toEqual(
      new Set([g("globe__stage"), g("globe__clock")]),
    );
  });

  it("returns null for a sheet with any other class", () => {
    expect(
      moduleClasses(`.${g("a__b")}{color:red}.a11y{color:blue}`),
    ).toBeNull();
  });

  it("returns null for a sheet with no class selector", () => {
    expect(moduleClasses("body{margin:0}")).toBeNull();
  });
});

describe("classTokens", () => {
  it("splits every class attribute", () => {
    expect(classTokens('<div class="a  b"><i class="c"></i></div>')).toEqual(
      new Set(["a", "b", "c"]),
    );
  });
});

describe("usesStylesheet", () => {
  const classes = new Set([g("x__a"), g("x__b")]);
  it("matches a class in the markup", () => {
    expect(usesStylesheet(classes, new Set([g("x__b")]), "")).toBe(true);
  });
  it("matches a class literal in a script", () => {
    expect(
      usesStylesheet(classes, new Set(), `e.className="${g("x__a")}"`),
    ).toBe(true);
  });
  it("is false when neither shows the widget", () => {
    expect(usesStylesheet(classes, new Set(["other"]), "var a=1")).toBe(false);
  });
});

describe("pruneStylesheetLinks", () => {
  const sheets = new Map([
    ["globe.A.css", new Set([g("globe__stage")])],
    ["readout.B.css", new Set([g("readout__value")])],
  ]);
  const global = link("dox.C.css");

  it("removes an unused widget sheet and keeps global sheets", () => {
    const html = `<head>${link("globe.A.css")}${global}</head><body></body>`;
    const out = pruneStylesheetLinks(html, sheets, "");
    expect(out.removed).toEqual(["globe.A.css"]);
    expect(out.html).toBe(`<head>${global}</head><body></body>`);
  });

  it("keeps the sheet of a widget the page shows", () => {
    const html = `${link("globe.A.css")}<div class="${g("globe__stage")}"></div>`;
    expect(pruneStylesheetLinks(html, sheets, "").removed).toEqual([]);
  });

  it("keeps a sheet whose class a loaded script names", () => {
    const html = link("readout.B.css");
    expect(
      pruneStylesheetLinks(html, sheets, `x="${g("readout__value")}"`).removed,
    ).toEqual([]);
  });

  it("leaves a page with an Astro island untouched", () => {
    const html = `${link("globe.A.css")}<astro-island></astro-island>`;
    expect(pruneStylesheetLinks(html, sheets, "")).toEqual({
      html,
      removed: [],
    });
  });

  it("keeps a print sheet and a sheet it does not know", () => {
    const html = `<link rel="stylesheet" href="/gmt/_astro/print.D.css" media="print">${link("new.E.css")}`;
    expect(pruneStylesheetLinks(html, sheets, "").removed).toEqual([]);
  });
});

describe("scriptFiles and astroFile", () => {
  it("collects src and static imports, not dynamic ones", () => {
    const html =
      '<script type="module" src="/gmt/_astro/page.X.js"></script><script type="module">import"/gmt/_astro/b.Y.js";import("/gmt/_astro/lazy.Z.js")</script>';
    expect(scriptFiles(html).sort()).toEqual(["b.Y.js", "page.X.js"]);
  });
  it("ignores external URLs", () => {
    expect(astroFile("https://static.example.com/beacon.min.js")).toBeNull();
  });
});
