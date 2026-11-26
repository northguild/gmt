import {
  astroFile,
  classTokens,
  moduleClasses,
  pruneInlineStyles,
  pruneStylesheetLinks,
  referencedScripts,
  scriptFiles,
  searchText,
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
    expect(usesStylesheet(classes, new Set([g("x__b")]), searchText(""))).toBe(
      true,
    );
  });
  it("matches a class literal in a script", () => {
    expect(
      usesStylesheet(
        classes,
        new Set(),
        searchText(`e.className="${g("x__a")}"`),
      ),
    ).toBe(true);
  });
  it("is false when neither shows the widget", () => {
    expect(
      usesStylesheet(classes, new Set(["other"]), searchText("var a=1")),
    ).toBe(false);
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
    const out = pruneStylesheetLinks(html, sheets, searchText(""));
    expect(out.removed).toEqual(["globe.A.css"]);
    expect(out.html).toBe(`<head>${global}</head><body></body>`);
  });

  it("keeps the sheet of a widget the page shows", () => {
    const html = `${link("globe.A.css")}<div class="${g("globe__stage")}"></div>`;
    expect(pruneStylesheetLinks(html, sheets, searchText("")).removed).toEqual(
      [],
    );
  });

  it("keeps a sheet whose class a loaded script names", () => {
    const html = link("readout.B.css");
    expect(
      pruneStylesheetLinks(
        html,
        sheets,
        searchText(`x="${g("readout__value")}"`),
      ).removed,
    ).toEqual([]);
  });

  it("leaves a page with an Astro island untouched", () => {
    const html = `${link("globe.A.css")}<astro-island></astro-island>`;
    expect(pruneStylesheetLinks(html, sheets, searchText(""))).toEqual({
      html,
      removed: [],
    });
  });

  it("keeps a print sheet and a sheet it does not know", () => {
    const html = `<link rel="stylesheet" href="/gmt/_astro/print.D.css" media="print">${link("new.E.css")}`;
    expect(pruneStylesheetLinks(html, sheets, searchText("")).removed).toEqual(
      [],
    );
  });
});

describe("pruneInlineStyles", () => {
  const block = (name: string) => `<style>.${g(name)}{color:red}</style>`;
  const scoped = "<style>.why:where(.astro-x){display:flex}</style>";

  it("removes an unused widget block and keeps every other block", () => {
    const html = `<head>${block("face__root")}${scoped}</head><body></body>`;
    expect(pruneInlineStyles(html, searchText(""))).toEqual({
      html: `<head>${scoped}</head><body></body>`,
      removed: 1,
    });
  });

  it("keeps the block of a widget the page shows", () => {
    const html = `${block("face__root")}<div class="${g("face__root")}"></div>`;
    expect(pruneInlineStyles(html, searchText("")).removed).toBe(0);
  });

  it("keeps a block whose class a script the page can load names", () => {
    expect(
      pruneInlineStyles(
        block("face__root"),
        searchText(`x="${g("face__root")}"`),
      ).removed,
    ).toBe(0);
  });

  it("leaves a page with an Astro island untouched", () => {
    const html = `${block("face__root")}<astro-island></astro-island>`;
    expect(pruneInlineStyles(html, searchText(""))).toEqual({
      html,
      removed: 0,
    });
  });
});

describe("referencedScripts", () => {
  it("names static, dynamic and preloaded scripts, in a page or a chunk", () => {
    const page =
      '<script type="module" src="/gmt/_astro/page.X.js"></script><script type="module">import("/gmt/_astro/lazy.Z.js")</script>';
    expect(referencedScripts(page).sort()).toEqual(["lazy.Z.js", "page.X.js"]);
    const chunk =
      'import{a}from"./b.Y.js";m.f=["_astro/pre.P.js"];import(`./lazy.Z.js`)';
    expect(referencedScripts(chunk).sort()).toEqual([
      "b.Y.js",
      "lazy.Z.js",
      "pre.P.js",
    ]);
  });

  it("ignores a script on another origin", () => {
    expect(
      referencedScripts('"https://static.example.com/beacon.min.js"'),
    ).toEqual([]);
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

describe("searchText", () => {
  it("finds a name anywhere in the text, and gives the same answer every time", () => {
    const has = searchText(`a="${g("x__a")}"`);
    expect(has(g("x__a"))).toBe(true);
    expect(has(g("x__a"))).toBe(true);
    expect(has(g("x__b"))).toBe(false);
    expect(has(g("x__b"))).toBe(false);
  });

  it("keeps the substring rule: a class that is a prefix of a script literal is used", () => {
    const has = searchText(`a="${g("x__a-b")}"`);
    expect(usesStylesheet(new Set([g("x__a")]), new Set(), has)).toBe(true);
  });

  it("gives two pages that share one script set the same result", () => {
    const sheets = new Map([["x.css", new Set([g("x__a")])]]);
    const shared = searchText(`a="${g("x__a-b")}"`);
    const first = pruneStylesheetLinks(link("x.css"), sheets, shared);
    const second = pruneStylesheetLinks(link("x.css"), sheets, shared);
    expect(first).toEqual(second);
    expect(first.removed).toEqual([]);
    const none = searchText("var a=1");
    expect(pruneStylesheetLinks(link("x.css"), sheets, none).removed).toEqual([
      "x.css",
    ]);
    expect(pruneStylesheetLinks(link("x.css"), sheets, none).removed).toEqual([
      "x.css",
    ]);
  });
});
