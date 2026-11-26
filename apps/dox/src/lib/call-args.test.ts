import { cellCallArgs, frameCallArgs } from "./call-args";

const PAIRS = [
  [
    {
      actual: "2024-06-14T09:15:00+01:00[Europe/London]",
      planned: "2024-06-14T09:00:00+01:00[Europe/London]",
    },
  ],
  { early: undefined, late: "PT15M" },
];
const PLAIN =
  '[{ planned: "2024-06-14T09:00:00+01:00[Europe/London]", actual: "2024-06-14T09:15:00+01:00[Europe/London]" }], { late: "PT15M" }';
const text = (html: string) =>
  html.replace(/<[^>]+>/g, "").replaceAll("&quot;", '"');

describe("frameCallArgs", () => {
  it("prints a pairs array and a tolerance as the JSDoc does", () => {
    const [html, plain] = frameCallArgs(PAIRS);
    expect(plain).toBe(PLAIN);
    expect(text(html)).toBe(plain);
  });

  it("has no break point, because a code frame scrolls and Chromium breaks at a wbr under pre", () => {
    const [html] = frameCallArgs([
      "2024-06-15T06:12:00Z",
      { minimumConnection: "PT10M" },
    ]);
    expect(html).not.toContain("<wbr");
  });

  it("prints no arguments as nothing", () => {
    expect(frameCallArgs([])).toEqual(["", ""]);
  });
});

describe("cellCallArgs", () => {
  it("prints the same text as the frame form", () => {
    const [html, plain] = cellCallArgs(PAIRS);
    expect(plain).toBe(PLAIN);
    expect(text(html)).toBe(plain);
  });

  it("breaks the call after the opening parenthesis and after each comma", () => {
    const [html] = cellCallArgs([
      "2024-06-15T06:12:00Z",
      { minimumConnection: "PT10M" },
    ]);
    expect(html.startsWith("<wbr />")).toBe(true);
    expect(html).toContain(", <wbr />");
  });

  it("lets an instant in a string break after its T", () => {
    const [html] = cellCallArgs(["2024-06-15T06:12:00Z"]);
    expect(html.match(/<wbr \/>/g)).toHaveLength(2);
  });

  it("lets a hyphenated ID break after each hyphen and keeps its text", () => {
    const id = "017F22E2-79B0-7CC3-98C4-DC0C0C07398F";
    const [html, plain] = cellCallArgs([id]);
    expect(text(html)).toBe(`"${id}"`);
    expect(plain).toBe(`"${id}"`);
    // The leading seam, then one after each of the four hyphens.
    expect(html.match(/<wbr \/>/g)).toHaveLength(5);
    expect(html).toContain("017F22E2-<wbr />79B0-<wbr />");
  });

  it("prints no arguments as nothing", () => {
    expect(cellCallArgs([])).toEqual(["", ""]);
  });
});
