import {
  headerWithoutRedesign,
  pageMarkup,
  tablesOf,
  withoutAssetHashes,
  withoutGitDates,
  withoutStyles,
} from "./html-diff-page.mjs";

const before =
  '<header class="header astro-zgw62g3h"><div class="header astro-nen7h5rs">' +
  '<a href="https://northguild.dev/" class="gmt-ng-link gmt-sonar-focus astro-nen7h5rs" title="NorthGuild home"><span class="sr-only astro-nen7h5rs">NorthGuild home</span><svg></svg></a>' +
  '<span class="gmt-ng-divider astro-nen7h5rs" aria-hidden="true"></span>' +
  '<a href="/gmt/" class="site-title sl-flex astro-nen7h5rs" translate="no"><span class="gmt-title-long astro-nen7h5rs">Give Me Temporal</span></a>' +
  '<search role="search"><input name="q"></search></div></header>';
const after =
  '<header class="header astro-zgw62g3h"><div class="header gmt-theme-dark astro-abcd1234">' +
  '<a href="https://northguild.dev/" class="gmt-ng-link gmt-sonar-focus astro-abcd1234" aria-label="NorthGuild home"><svg></svg><span class="gmt-ng-wordmark astro-abcd1234">NorthGuild</span></a>' +
  '<span class="gmt-app-title astro-abcd1234"><a href="/gmt/" class="site-title sl-flex astro-abcd1234" translate="no"><span>gmt</span></a><span class="gmt-app-version astro-abcd1234" translate="no">v1.21.0</span></span>' +
  '<search role="search"><input name="q"></search></div></header>';

describe("pageMarkup", () => {
  it("treats the intended header redesign as no change", () => {
    expect(pageMarkup(after)).toBe(pageMarkup(before));
  });

  it("still sees a change to anything else in the header", () => {
    const searchGone = after.replace(
      '<search role="search"><input name="q"></search>',
      "",
    );
    expect(pageMarkup(searchGone)).not.toBe(pageMarkup(before));
    const renamed = after.replace('name="q"', 'name="s"');
    expect(pageMarkup(renamed)).not.toBe(pageMarkup(before));
  });

  it("still sees a change outside the header", () => {
    const body = "<main><p>One</p></main>";
    expect(pageMarkup(`${after}${body}`)).not.toBe(
      pageMarkup(`${before}<main><p>Two</p></main>`),
    );
  });

  it("ignores inlined CSS text, so a difference is reported in markup", () => {
    expect(withoutStyles("<style>a{b:c}</style><p>x</p>")).toBe("<p>x</p>");
    expect(withoutStyles("<style data-x>a{}</style><p>x</p>")).toBe("<p>x</p>");
  });

  it("ignores minified inline script bodies but not external scripts or JSON", () => {
    expect(withoutStyles("<script>let e=1;</script>")).toBe(
      "<script></script>",
    );
    expect(withoutStyles('<script src="/a.js"></script>')).toBe(
      '<script src="/a.js"></script>',
    );
    expect(
      withoutStyles('<script type="application/ld+json">{"a":1}</script>'),
    ).toBe('<script type="application/ld+json">{"a":1}</script>');
  });

  it("drops the head's arrival script, which every page carries", () => {
    expect(
      withoutStyles(
        '<script>(function(){addEventListener("pagereveal",function(){})})();</script><p>x</p><script>let e=1;</script>',
      ),
    ).toBe("<p>x</p><script></script>");
  });
});

describe("headerWithoutRedesign", () => {
  it("leaves the parts the redesign did not touch", () => {
    expect(headerWithoutRedesign(after)).toContain('<search role="search">');
    expect(headerWithoutRedesign(after)).not.toContain("gmt-app-version");
  });
});

describe("content-hashed asset names", () => {
  const tag = (hash: string) =>
    `<script type="module" src="/gmt/_astro/Head.astro_astro_type_script_index_0_lang.${hash}.js"></script>`;

  it("are the same page whatever the hash", () => {
    expect(pageMarkup(tag("Cx9_aB-1"))).toBe(pageMarkup(tag("qW3ErTy2")));
    expect(pageMarkup(tag("0vx5m"))).toBe(pageMarkup(tag("a1b2c")));
  });

  it("are masked in a stylesheet link, an import and a JSON string alike", () => {
    expect(
      withoutAssetHashes('<link href="/gmt/_astro/page.BcD3fG7h.css">'),
    ).toBe('<link href="/gmt/_astro/page.<hash>.css">');
    expect(withoutAssetHashes('import("/gmt/_astro/define.Zx81_qWe.js")')).toBe(
      'import("/gmt/_astro/define.<hash>.js")',
    );
    expect(withoutAssetHashes('{"u":"/gmt/_astro/ec.0vx5m.js"}')).toBe(
      '{"u":"/gmt/_astro/ec.<hash>.js"}',
    );
  });

  it("still sees a page that loads a different script", () => {
    expect(
      withoutAssetHashes('<script src="/gmt/_astro/page.BcD3fG7h.js">'),
    ).not.toBe(
      withoutAssetHashes('<script src="/gmt/_astro/dox.BcD3fG7h.js">'),
    );
  });
});

describe("dates read from git history", () => {
  const page = (modified: string, shown: string) =>
    `<script type="application/ld+json">{"url":"u","dateModified":"${modified}"}</script>` +
    `<footer>Last updated: <time datetime="${modified}">${shown}</time></footer>`;

  it("are the same page whatever the date", () => {
    expect(pageMarkup(page("2026-10-28T22:14:00Z", "Oct 28, 2026"))).toBe(
      pageMarkup(page("2026-11-05T08:00:00Z", "Nov 5, 2026")),
    );
  });

  it("still sees a page that gains or loses its date", () => {
    const without = page("2026-10-28T22:14:00Z", "x").replace(
      ',"dateModified":"2026-10-28T22:14:00Z"',
      "",
    );
    expect(pageMarkup(without)).not.toBe(
      pageMarkup(page("2026-10-28T22:14:00Z", "x")),
    );
    expect(withoutGitDates('<time datetime="d">t</time>')).toBe(
      '<time datetime="<date>"><date></time>',
    );
  });
});

describe("tablesOf", () => {
  it("returns the tables and nothing around them", () => {
    const html =
      '<header>menu</header><div class="box"><table><tr><td data-col="A">1</td></tr></table></div>';
    expect(tablesOf(html)).toBe(
      '<table><tr><td data-col="A">1</td></tr></table>',
    );
    expect(tablesOf("<p>none</p>")).toBe("");
  });
});
