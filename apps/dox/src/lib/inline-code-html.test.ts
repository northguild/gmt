import { inlineCodeHtml } from "./inline-code-html";

describe("inlineCodeHtml", () => {
  it("sets each backtick span in <code> and escapes everything else", () => {
    expect(inlineCodeHtml("runs `npm test` on <Node> & more")).toBe(
      "runs <code>npm test</code> on &lt;Node&gt; &amp; more",
    );
    expect(inlineCodeHtml('`a < b` and "quoted"')).toBe(
      "<code>a &lt; b</code> and &quot;quoted&quot;",
    );
  });

  it("leaves an unpaired backtick as text instead of opening a span", () => {
    expect(inlineCodeHtml("`m` is a minute; a lone ` stays")).toBe(
      "<code>m</code> is a minute; a lone ` stays",
    );
  });
});
