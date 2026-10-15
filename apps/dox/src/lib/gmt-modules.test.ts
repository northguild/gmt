/**
 * `GMT_MODULES` keys match the module subpaths of `@northguild/gmt`'s
 * exports map. A playground imports at module granularity: a namespace barrel
 * would load every module of its namespace. The one exception is a namespace
 * with no module subpaths (`regex`), whose barrel is its narrowest import.
 *
 * No import is called, so this needs no built `dist`.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { GMT_MODULES } from "./gmt-modules";

const GMT_PACKAGE = path.resolve(
  import.meta.dirname,
  "../../../../packages/gmt/package.json",
);
const subpaths = Object.keys(
  (
    JSON.parse(readFileSync(GMT_PACKAGE, "utf8")) as {
      exports: Record<string, unknown>;
    }
  ).exports,
);
const keys = Object.keys(GMT_MODULES);

describe("GMT_MODULES", () => {
  it("names only subpaths the exports map declares", () => {
    expect(keys.filter((key) => !subpaths.includes(`./${key}`))).toEqual([]);
  });

  it("names a module subpath, or a namespace that has none", () => {
    const barrels = keys.filter(
      (key) =>
        key.split("/").length !== 2 &&
        subpaths.some((sub) => sub.startsWith(`./${key}/`)),
    );
    expect(barrels).toEqual([]);
  });

  it("has an entry for every module subpath in the exports map", () => {
    const modules = subpaths
      .filter((sub) => sub.split("/").length === 3)
      .map((sub) => sub.slice(2));
    expect(modules.filter((mod) => !keys.includes(mod))).toEqual([]);
  });
});
