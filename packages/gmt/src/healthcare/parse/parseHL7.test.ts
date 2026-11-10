import { resolveLocal } from "../../instant/convert";
import { hl7DtmRows, hl7NullRows, hl7TsRows } from "../../test/hl7ParseRows";
import { NON_STRINGS } from "../../test/nonStrings";
import { parseHL7 } from "./parseHL7";

describe("parseHL7", () => {
  it.each(hl7DtmRows)(
    "reads the DTM '$input' as what 2.A.22 says it states",
    ({ input, expected }) => {
      expect(parseHL7(input)).toStrictEqual(expected);
    },
  );

  it.each(hl7TsRows)(
    "reads the TS '$input' with its degree of precision lowering only (2.A.77.2)",
    ({ input, expected }) => {
      expect(parseHL7(input)).toStrictEqual(expected);
    },
  );

  it("reads '\"\"' as the null value (ch. 2 §2.5.3)", () => {
    expect(parseHL7('""')).toStrictEqual({ kind: "null" });
  });

  it("gives a local value no instant member", () => {
    const result = parseHL7("20240615103000");
    expect(result).not.toBeNull();
    expect(result !== null && "instant" in result).toBe(false);
  });

  it.each(hl7NullRows.map((input) => ({ input })))(
    "returns null for the string '$input'",
    ({ input }) => {
      expect(parseHL7(input)).toBeNull();
    },
  );

  it.each(NON_STRINGS.map(([label, make]) => ({ label, make })))(
    "returns null without throwing for $label",
    ({ make }) => {
      expect(parseHL7(make() as string)).toBeNull();
    },
  );

  it("returns a fresh object each call", () => {
    expect(parseHL7("202406")).not.toBe(parseHL7("202406"));
  });

  it("makes the caller supply the sender's zone: Helsinki 10:30 is 07:30Z, not 10:30Z", () => {
    const result = parseHL7("20240615103000");
    if (result?.kind !== "local") {
      throw new Error("expected a local value");
    }
    const resolved = resolveLocal(result.local, "Europe/Helsinki");
    expect(resolved).toBe("2024-06-15T07:30:00Z");
    expect(resolved).not.toBe("2024-06-15T10:30:00Z");
  });
});
