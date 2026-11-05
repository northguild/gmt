import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(
  join(import.meta.dirname, "../widgets/tools/timetable-reader.module.css"),
  "utf8",
);

function rule(selector: string): string {
  const m = new RegExp(
    `(?:^|\\n)${selector.replace(".", "\\.")} \\{([^}]*)\\}`,
  ).exec(css);
  if (m === null) throw new Error(`no ${selector} rule`);
  return m[1] ?? "";
}

describe("timetable-reader time cells", () => {
  it("lets the full zoned value wrap so the four time columns fit a narrow table", () => {
    const body = rule(".timeFull");
    expect(body).toContain("white-space: normal");
    expect(body).toContain("overflow-wrap: anywhere");
  });
});
