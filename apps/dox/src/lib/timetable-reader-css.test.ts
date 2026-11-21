import { readFileSync } from "node:fs";
import { join } from "node:path";

const css = readFileSync(
  join(import.meta.dirname, "../widgets/tools/timetable-reader.module.css"),
  "utf8",
);

function rule(selector: string): string {
  const m = new RegExp(
    `(?:^|\\n)${selector.replaceAll(".", "\\.")} \\{([^}]*)\\}`,
  ).exec(css);
  if (m === null) throw new Error(`no ${selector} rule`);
  return m[1] ?? "";
}

describe("timetable-reader time cells", () => {
  it("breaks the full zoned value only at the pieces zonedValue sets, so a hyphen or colon never splits it", () => {
    const body = rule(".timeFull");
    expect(body).not.toContain("white-space: nowrap");
    expect(body).toContain("overflow-wrap: normal");
  });

  it("wraps the NO SIGNAL chip at its space inside a hold cell, so it never overflows the value column", () => {
    const body = rule(".cellHold .lost");
    expect(body).toContain("white-space: normal");
    expect(body).toContain("max-inline-size: 100%");
  });
});
