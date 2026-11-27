import { describe, expect, it } from "vitest";
import { parsePhotometry, sbdbUrl } from "./jpl-sbdb";

describe("parsePhotometry", () => {
  it("reads H and G from an SBDB reply (Vesta: 3.25, 0.32)", () => {
    expect(
      parsePhotometry({
        phys_par: [
          { name: "H", value: "3.25" },
          { name: "G", value: "0.32" },
          { name: "diameter", value: "522.77" },
        ],
      }),
    ).toEqual({ H: 3.25, G: 0.32 });
  });

  it("is null when G is missing, and for a reply with no physical parameters", () => {
    expect(
      parsePhotometry({ phys_par: [{ name: "H", value: "9" }] }),
    ).toBeNull();
    expect(parsePhotometry({})).toBeNull();
  });

  it("asks for the physical parameters of one body", () => {
    expect(sbdbUrl("Vesta")).toBe(
      "https://ssd-api.jpl.nasa.gov/sbdb.api?sstr=Vesta&phys-par=1",
    );
  });
});
