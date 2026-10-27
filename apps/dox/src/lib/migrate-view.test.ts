import { VERDICT_LABEL } from "../data/behaviour-matrix";
import { matrixView } from "./migrate-view";

describe("matrixView", () => {
  const rows = matrixView().flatMap((c) => c.rows);

  it("gives every row at least one result line", () => {
    for (const row of rows) expect(row.returns.length).toBeGreaterThan(0);
  });

  it("puts each host of a row that varies with the host on its own line", () => {
    const varies = rows.filter((row) => row.verdict === VERDICT_LABEL.varies);
    expect(varies.length).toBeGreaterThan(0);
    for (const row of varies) {
      expect(row.returns.length).toBeGreaterThan(1);
      for (const line of row.returns) expect(line).toMatch(/^[\w/+-]+ host: /);
    }
  });
});
