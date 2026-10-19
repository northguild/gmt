import { describe, expect, it } from "vitest";
import {
  badJsLiterals,
  badLinksInMarkdown,
  badRedirectRules,
  badSitemapLocs,
  badUrlsInCss,
  badUrlsInHtml,
} from "./dist-base";

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

  it("passes a literal handed to the base helper, a concatenation tail and a vendor default", () => {
    expect(
      badJsLiterals(
        "new Ap({api:a(`/api/chat`)});b=`/gmt`+`/pagefind/`;let{base_path:o=`/pagefind/`}=n;try{}catch{x=`/pagefind/`}",
        ["pagefind"],
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
