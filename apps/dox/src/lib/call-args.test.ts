import { callArgs } from "./call-args";

describe("callArgs", () => {
  it("prints a pairs array and a tolerance as the JSDoc does", () => {
    const [html, plain] = callArgs([
      [
        {
          actual: "2024-06-14T09:15:00+01:00[Europe/London]",
          planned: "2024-06-14T09:00:00+01:00[Europe/London]",
        },
      ],
      { early: undefined, late: "PT15M" },
    ]);
    expect(plain).toBe(
      '[{ planned: "2024-06-14T09:00:00+01:00[Europe/London]", actual: "2024-06-14T09:15:00+01:00[Europe/London]" }], { late: "PT15M" }',
    );
    const text = html.replace(/<[^>]+>/g, "").replaceAll("&quot;", '"');
    expect(text).toBe(plain.replace(/&/g, "&amp;"));
  });

  it("breaks the call after the opening parenthesis and after each comma", () => {
    const [html] = callArgs([
      "2024-06-15T06:12:00Z",
      { minimumConnection: "PT10M" },
    ]);
    expect(html.startsWith("<wbr />")).toBe(true);
    expect(html).toContain(", <wbr />");
  });

  it("lets an instant in a string break after its T", () => {
    const [html] = callArgs(["2024-06-15T06:12:00Z"]);
    expect(html.match(/<wbr \/>/g)).toHaveLength(2);
  });

  it("prints no arguments as nothing", () => {
    expect(callArgs([])).toEqual(["", ""]);
  });
});
