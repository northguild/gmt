import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  exportEntries,
  measureSyntaxFloor,
  syntaxFloor,
} from "../../../scripts/syntax-floor.mjs";

/**
 * The syntax floor is the lowest ECMA-262 edition whose grammar parses every
 * file a consumer loads. Each row is the edition a syntax first appears in (ES2016 `**`, ES2017
 * async functions, ES2018 object rest, ES2019 optional catch binding, ES2020 `?.`, `??` and
 * BigInt, ES2021 logical assignment, ES2022 static blocks and private fields), written from
 * ECMA-262, never read back from the parser.
 */

describe("syntaxFloor", () => {
  it.each`
    source                              | expected
    ${"let a = 1;"}                     | ${2015}
    ${"a ** 2;"}                        | ${2016}
    ${"async function f() { await 1 }"} | ${2017}
    ${"const { a, ...r } = o;"}         | ${2018}
    ${"try {} catch {}"}                | ${2019}
    ${"a?.b ?? c; 1n;"}                 | ${2020}
    ${"a ??= 1;"}                       | ${2021}
    ${"class A { static { } #x; }"}     | ${2022}
  `("$source needs edition $expected", ({ source, expected }) => {
    expect(syntaxFloor([source])).toBe(expected);
  });

  it("is the highest floor of the sources: 2018 and 2021 give 2021", () => {
    expect(syntaxFloor(["const { a, ...r } = o;", "a ??= 1;"])).toBe(2021);
  });

  it("throws, naming the source index, when no edition parses a source", () => {
    expect(() => syntaxFloor(["let a = 1;", "a b"])).toThrow(/source 1/);
  });
});

describe("the real entries", () => {
  it("measure a floor from 2015 up, over every exports entry of packages/gmt", async () => {
    const manifest = JSON.parse(
      readFileSync(
        resolve(
          fileURLToPath(import.meta.url),
          "../../../../packages/gmt/package.json",
        ),
        "utf8",
      ),
    );
    const result = await measureSyntaxFloor();
    expect(result.entries).toBe(Object.keys(manifest.exports).length);
    expect(exportEntries()).toHaveLength(result.entries);
    expect(result.edition).toBeGreaterThanOrEqual(2015);
    expect(Number.isInteger(result.edition)).toBe(true);
  }, 120_000);
});
