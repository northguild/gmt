import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  badJsLiterals,
  badLinksInMarkdown,
  badRedirectRules,
  badSitemapLocs,
  badUrlsInCss,
  badUrlsInHtml,
  baseHelperNames,
  LANDING,
} from "./dist-base";
import { LANDING_URL } from "../../src/lib/site";

const values = (found: Array<{ value: string }>) => found.map((f) => f.value);

describe("badUrlsInHtml", () => {
  it("passes a page whose every URL is under the base, relative, or elsewhere", () => {
    const html = `<!doctype html><html><head>
      <link rel="icon" href="/gmt/favicon.svg">
      <link rel="stylesheet" href="/gmt/_astro/a.css">
      <meta property="og:image" content="https://northguild.dev/gmt/og.png">
      <meta name="description" content="/install/ is text here">
      <style>@font-face{src:url(/gmt/fonts/m.woff2)}</style></head><body>
      <a href="/gmt/">home</a> <a href="/gmt">bare</a> <a href="./x">rel</a> <a href="#top">hash</a>
      <a href="mailto:a@b.c">m</a> <a href="https://example.com/install/">ext</a>
      <img src="data:image/png;base64,AAAA" srcset="/gmt/a.png 1x, /gmt/b.png 2x">
      <a data-handoff-href="/gmt/tools/x/">x</a>
      <div style="background:url('/gmt/a.png')"></div></body></html>`;
    expect(badUrlsInHtml(html)).toEqual([]);
  });

  it("passes the header's anchor to the landing page", () => {
    expect(badUrlsInHtml('<a href="https://northguild.dev/">x</a>')).toEqual(
      [],
    );
  });

  it("keeps the landing exception to that one anchor", () => {
    for (const html of [
      '<a href="https://northguild.dev">x</a>',
      '<a href="https://northguild.dev/about">x</a>',
      '<a href="/">x</a>',
      '<link href="https://northguild.dev/">',
      '<meta property="og:url" content="https://northguild.dev/">',
    ])
      expect(badUrlsInHtml(html), html).not.toEqual([]);
    expect(
      badLinksInMarkdown("See https://northguild.dev/ for more."),
    ).not.toEqual([]);
    expect(
      badSitemapLocs(
        "<urlset><url><loc>https://northguild.dev/</loc></url></urlset>",
      ),
    ).not.toEqual([]);
  });

  it("LANDING equals LANDING_URL in site.ts", () => {
    expect(LANDING).toBe(LANDING_URL);
  });

  it("flags a root-absolute href", () => {
    expect(values(badUrlsInHtml('<a href="/install/">x</a>'))).toEqual([
      "/install/",
    ]);
  });

  it("flags a root-absolute src", () => {
    expect(values(badUrlsInHtml('<img src="/favicon.svg">'))).toEqual([
      "/favicon.svg",
    ]);
  });

  it("flags only the bad candidate of a srcset", () => {
    expect(
      values(badUrlsInHtml('<img srcset="/a.png 1x, /gmt/b.png 2x">')),
    ).toEqual(["/a.png"]);
  });

  it("flags a poster and passes one under the base", () => {
    expect(values(badUrlsInHtml('<video poster="/p.png"></video>'))).toEqual([
      "/p.png",
    ]);
    expect(badUrlsInHtml('<video poster="/gmt/p.png"></video>')).toEqual([]);
  });

  it("flags an unprefixed source srcset candidate and passes prefixed ones", () => {
    expect(
      values(badUrlsInHtml('<source srcset="/a.webp 1x, /b.webp 2x">')),
    ).toEqual(["/a.webp", "/b.webp"]);
    expect(
      badUrlsInHtml('<img srcset="/gmt/a.png 1x, /gmt/b.png 2x">'),
    ).toEqual([]);
  });

  it("flags a doubled base", () => {
    expect(values(badUrlsInHtml('<a href="/gmt/gmt/x/">x</a>'))).toEqual([
      "/gmt/gmt/x/",
    ]);
  });

  it("flags a northguild.dev URL outside the base in a social meta", () => {
    expect(
      values(
        badUrlsInHtml(
          '<meta property="og:url" content="https://northguild.dev/x">',
        ),
      ),
    ).toEqual(["https://northguild.dev/x"]);
  });

  it("flags a url() in a style block and a style attribute", () => {
    expect(
      values(
        badUrlsInHtml(
          "<style>a{background:url(/fonts/m.woff2)}</style><i style=\"background:url('/img/a.png')\"></i>",
        ),
      ),
    ).toEqual(["/img/a.png", "/fonts/m.woff2"]);
  });

  it("flags a data-*-href attribute", () => {
    expect(
      values(badUrlsInHtml('<a data-open-href="/tools/x/">x</a>')),
    ).toEqual(["/tools/x/"]);
  });

  it("flags the old host anywhere in an attribute", () => {
    expect(
      badUrlsInHtml('<a href="https://gmt-dox.northguild.workers.dev/x">x</a>'),
    ).toHaveLength(1);
  });

  it("is not fooled by a > inside an attribute value", () => {
    expect(
      values(badUrlsInHtml('<a title="a > b" href="/install/">x</a>')),
    ).toEqual(["/install/"]);
  });
});

describe("badUrlsInCss", () => {
  it("passes urls under the base, data URIs and relative paths", () => {
    expect(
      badUrlsInCss(
        '@font-face{src:url("/gmt/_astro/m.woff2")} a{background:url(data:image/png;base64,AA)} b{background:url(../x.png)}',
      ),
    ).toEqual([]);
  });

  it("flags unquoted, quoted and @import targets", () => {
    expect(
      values(
        badUrlsInCss(
          'a{src:url(/fonts/m.woff2)} b{src:url("/x.png")} @import "/y.css";',
        ),
      ),
    ).toEqual(["/fonts/m.woff2", "/x.png", "/y.css"]);
  });
});

describe("badLinksInMarkdown", () => {
  it("passes links under the base", () => {
    expect(
      badLinksInMarkdown(
        "[a](/gmt/reference/) ![b](/gmt/x.png) [c](https://northguild.dev/gmt/install/)\n\n[ref]: /gmt/guides/\n\nSee https://northguild.dev/gmt/llms.txt.",
      ),
    ).toEqual([]);
  });

  it("flags an inline link outside a fence", () => {
    expect(values(badLinksInMarkdown("See [ref](/reference/) now."))).toEqual([
      "/reference/",
    ]);
  });

  it("ignores the same link inside a fence", () => {
    expect(badLinksInMarkdown("```md\n[ref](/reference/)\n```\n")).toEqual([]);
  });

  it("flags angle-bracket link targets and passes prefixed ones", () => {
    expect(
      values(
        badLinksInMarkdown('[t](</x/>) ![i](</i.png> "t")\n\n[r]: </y/>\n'),
      ),
    ).toEqual(["/x/", "/i.png", "/y/"]);
    expect(badLinksInMarkdown("[t](</gmt/x/>)\n\n[r]: </gmt/y/>\n")).toEqual(
      [],
    );
  });

  it("flags a reference definition, a raw href and a bare URL", () => {
    expect(
      values(
        badLinksInMarkdown(
          '[r]: /guides/\n\n<a href="/tools/">t</a>\n\nhttps://northguild.dev/install/',
        ),
      ),
    ).toEqual(["/guides/", "/tools/", "https://northguild.dev/install/"]);
  });
});

describe("badRedirectRules", () => {
  it("passes comments, blanks and rules wholly under the base", () => {
    expect(badRedirectRules("# note\n\n/gmt/old/ /gmt/new/ 301\n")).toEqual([]);
  });

  it("flags a base-less target", () => {
    expect(badRedirectRules("/gmt/old/ /new/ 301")).toHaveLength(1);
  });

  it("flags a base-less source and a malformed line", () => {
    expect(
      badRedirectRules("/old/ /gmt/new/ 301\n/gmt/a/ /gmt/b/"),
    ).toHaveLength(2);
  });
});

describe("badSitemapLocs", () => {
  it("passes locs under the base and flags the rest", () => {
    const xml =
      "<urlset><url><loc>https://northguild.dev/gmt/a/</loc></url><url><loc>https://northguild.dev/b/</loc></url></urlset>";
    expect(values(badSitemapLocs(xml))).toEqual(["https://northguild.dev/b/"]);
  });
});

describe("badJsLiterals", () => {
  const names = ["fonts", "timezone-boundaries.json", "llms.txt"];

  it("passes base-ful strings and page routes", () => {
    expect(
      badJsLiterals(
        'f("/gmt/api/chat");g("/tools/dst-inspector/");h("/gmt/timezone-boundaries.json");`${b}/api/x`',
        names,
      ),
    ).toEqual([]);
  });

  it("passes a literal handed to the base helper, a /gmt concatenation tail and a vendor default", () => {
    expect(
      badJsLiterals(
        "new Ap({api:a(`/api/chat`)});b=`/gmt`.replace(/\\/$/,``)+`/pagefind/`;let{base_path:o=`/pagefind/`}=n;try{}catch{x=`/pagefind/`}class k{constructor({api:e=`/api/chat`}){}}",
        ["pagefind"],
        ["a"],
      ),
    ).toEqual([]);
  });

  it("still flags a literal handed to fetch or new URL", () => {
    expect(
      values(
        badJsLiterals('fetch("/api/chat");new URL("/fonts/a.woff2",l)', names),
      ),
    ).toEqual(["/api/chat", "/fonts/a.woff2"]);
  });

  it.each([
    'q("/api/chat")',
    'load("/timezone-boundaries.json")',
    'location.origin+"/api/chat"',
    '{url:u="/api/chat"}',
    'a("/api/chat")', // a call is exempt only by the helper's own name
    '{api:x="/fonts/a.woff2"}', // a vendor-default shape is exempt only for the vendor's value
    '{api:x="/api/brains"}',
    '{base_path:o="/fonts/"}',
    'catch{x="/api/chat"}',
  ])("flags %s", (code) => {
    expect(badJsLiterals(code, names)).toHaveLength(1);
  });

  it("flags a call through an alias that is not this file's base helper", () => {
    expect(badJsLiterals('q("/api/chat")', names, ["a"])).toHaveLength(1);
    expect(badJsLiterals('a("/api/chat")', names, ["a"])).toEqual([]);
  });

  it("flags /api/ and a public file", () => {
    expect(
      values(
        badJsLiterals(
          'fetch("/api/chat");fetch("/timezone-boundaries.json")',
          names,
        ),
      ),
    ).toEqual(["/api/chat", "/timezone-boundaries.json"]);
  });

  it("matches a public name only at a boundary", () => {
    expect(badJsLiterals('fetch("/fontsy/a")', names)).toEqual([]);
    expect(values(badJsLiterals('fetch("/fonts/a.woff2")', names))).toEqual([
      "/fonts/a.woff2",
    ]);
  });
});

describe("baseHelperNames", () => {
  // The shape the minifier gives site.ts: `r` defined, exported as `i`, imported as `a`.
  const site =
    "var t=`/gmt`;function n(e){return e===`/gmt`||e.startsWith(`/gmt/`)}function r(e){if(!e.startsWith(`/`)||e.startsWith(`//`))throw TypeError(`withBase expects a root-absolute path`);return n(e)?e:`${t}${e}`}export{r as i,n};";

  it("finds the helper where it is defined and where it is imported", () => {
    const files = {
      "site.X.js": site,
      "page.Y.js": "import{i as a}from`./site.X.js`;a(`/api/chat`);",
      "other.Z.js": 'import{n as m}from"./site.X.js";m("/x");',
      "plain.W.js": "q(`/api/chat`)",
    };
    expect(baseHelperNames(files)).toEqual({
      "site.X.js": ["r"],
      "page.Y.js": ["a"],
    });
  });

  it("makes the real minified shape pass end to end", () => {
    const page =
      "import{i as a}from`./site.X.js`;new Ap({api:a(`/api/chat`)});";
    const helpers = baseHelperNames({ "site.X.js": site, "page.Y.js": page });
    expect(badJsLiterals(page, [], helpers["page.Y.js"])).toEqual([]);
  });
});

describe("the vendor-default exemption", () => {
  // `isGuarded` exempts `{api:x="/api/chat"}`, `{base_path:x="/pagefind/"}` and
  // `catch{x="/pagefind/"}` as vendor code. That holds only while Dox source never writes the shape.
  it("matches no destructuring default in Dox source", () => {
    const src = join(import.meta.dirname, "../../src");
    const hits = readdirSync(src, { recursive: true, encoding: "utf8" })
      .filter((f) => /\.(?:ts|tsx|astro|mjs|js)$/.test(f))
      .filter((f) =>
        /\b(?:api|base_path)\s*=\s*["'`]\//.test(
          readFileSync(join(src, f), "utf8"),
        ),
      );
    expect(hits).toEqual([]);
  });
});
