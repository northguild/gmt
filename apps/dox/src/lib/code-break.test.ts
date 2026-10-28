import { codeBreakHast, codeBreakHtml, codeBreakPieces } from "./code-break";

describe("codeBreakPieces", () => {
  it("keeps a date whole", () => {
    expect(codeBreakPieces("2024-03-10")).toEqual(["2024-03-10"]);
  });

  it("splits an import line at its spaces", () => {
    expect(
      codeBreakPieces('import { addZoned } from "@northguild/gmt/zoned"'),
    ).toEqual([
      "import",
      "{",
      "addZoned",
      "}",
      "from",
      '"@northguild/',
      "gmt/",
      'zoned"',
    ]);
  });

  it("breaks a zoned string after the slash", () => {
    expect(codeBreakPieces("2024-03-10T12:00[Europe/Berlin]")).toEqual([
      "2024-03-10T12:00[Europe/",
      "Berlin]",
    ]);
  });

  it("does not break at a doubled slash", () => {
    expect(codeBreakPieces("https://example.com")).toEqual([
      "https://example.com",
    ]);
  });

  it("does not break a slash between spaces", () => {
    expect(codeBreakPieces("a / b")).toEqual(["a", "/", "b"]);
    expect(codeBreakHtml("a / b")).not.toContain("<wbr>");
  });

  it("does not break a slash before a digit", () => {
    expect(codeBreakPieces("1/2")).toEqual(["1/2"]);
  });

  it("breaks a date pattern after each slash", () => {
    expect(codeBreakPieces("dd/MM/yyyy")).toEqual(["dd/", "MM/", "yyyy"]);
  });

  it("keeps a run of spaces as text between pieces", () => {
    expect(codeBreakPieces("a  b")).toEqual(["a", "b"]);
    expect(codeBreakHtml("a  b")).toBe(
      '<span class="gmt-cw">a</span>  <span class="gmt-cw">b</span>',
    );
  });

  it("returns nothing for an empty string", () => {
    expect(codeBreakPieces("")).toEqual([]);
  });
});

describe("codeBreakHtml", () => {
  it("returns one piece unchanged, escaped, with no span", () => {
    expect(codeBreakHtml("2024-03-10")).toBe("2024-03-10");
    expect(codeBreakHtml("<a>")).toBe("&lt;a&gt;");
    expect(codeBreakHtml("")).toBe("");
  });

  it("joins slash pieces with a wbr", () => {
    expect(codeBreakHtml("Europe/Berlin")).toBe(
      '<span class="gmt-cw">Europe/</span><wbr><span class="gmt-cw">Berlin</span>',
    );
  });

  it("escapes each piece", () => {
    expect(codeBreakHtml("a<b c")).toBe(
      '<span class="gmt-cw">a&lt;b</span> <span class="gmt-cw">c</span>',
    );
  });
});

describe("codeBreakHast", () => {
  it("returns one piece as a text node", () => {
    expect(codeBreakHast("2024-03-10")).toEqual([
      { type: "text", value: "2024-03-10" },
    ]);
    expect(codeBreakHast("")).toEqual([{ type: "text", value: "" }]);
  });

  it("matches the HTML form", () => {
    const nodes = codeBreakHast("Europe/Berlin now");
    expect(nodes.map((n) => (n.type === "text" ? n.value : n.tagName))).toEqual(
      ["span", "wbr", "span", " ", "span"],
    );
  });
});
