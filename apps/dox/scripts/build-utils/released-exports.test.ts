import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  baselineKey,
  insertAfterFrontmatter,
  isUnreleased,
  parseExportNames,
  releasedBaseline,
  unreleasedNote,
} from "./released-exports";

describe("parseExportNames", () => {
  it("reads every declaration kind and skips re-exports", () => {
    const names = parseExportNames(
      [
        "export function dwellTime(",
        "export async function load() {",
        "export const isoDate = /x/;",
        "export interface Dwell {",
        "export type RollConvention =",
        "export declare class Thing {}",
        "export enum Kind {",
        'export * from "./dwellTime";',
        'export { transitTime } from "./transitTime";',
        "export function dwellTime(",
      ].join("\n"),
    );
    expect([...names].sort()).toEqual(
      [
        "Dwell",
        "Kind",
        "RollConvention",
        "Thing",
        "dwellTime",
        "isoDate",
        "load",
      ].sort(),
    );
  });
});

describe("insertAfterFrontmatter", () => {
  it("puts the block between the frontmatter and the body", () => {
    const mdx = '---\ntitle: "x"\n---\n\n## Signature\n';
    expect(insertAfterFrontmatter(mdx, "NOTE")).toBe(
      '---\ntitle: "x"\n---\n\nNOTE\n\n## Signature\n',
    );
  });
});

describe("unreleasedNote", () => {
  it("names the published version the page is missing from", () => {
    expect(unreleasedNote("1.16.0")).toBe(
      ":::caution[Unreleased]\n" +
        "Not in `@northguild/gmt` 1.16.0 on npm yet. It is on `main` and ships in the next release.\n" +
        ":::",
    );
  });
});

/* A throwaway repository with the same layout, so the tag handling is tested
   against real git rather than a mock of it. */
describe("releasedBaseline", () => {
  let repo = "";
  const git = (...args: string[]) =>
    execFileSync(
      "git",
      [
        "-c",
        "user.name=t",
        "-c",
        "user.email=t@t",
        "-c",
        "commit.gpgsign=false",
        "-c",
        "tag.gpgsign=false",
        ...args,
      ],
      { cwd: repo, stdio: "pipe" },
    );
  const write = (rel: string, text: string) => {
    mkdirSync(join(repo, rel, ".."), { recursive: true });
    writeFileSync(join(repo, rel), text);
  };
  const commit = (message: string) => {
    git("add", "-A");
    git("commit", "-q", "-m", message);
  };

  afterEach(() => {
    if (repo) rmSync(repo, { recursive: true, force: true });
  });

  function setUp() {
    repo = mkdtempSync(join(tmpdir(), "released-exports-"));
    git("init", "-q");
    write("packages/gmt/src/a/addDays.ts", "export function addDays() {}\n");
    write(
      "packages/gmt/src/a/addDays.test.ts",
      "export function onlyInTests() {}\n",
    );
    commit("one");
    git("tag", "@northguild/gmt@1.9.0");
    write(
      "packages/gmt/src/b/floorToZone.ts",
      "export function floorToZone() {}\n",
    );
    commit("two");
    git("tag", "@northguild/gmt@1.10.0");
    git("tag", "@northguild/gmt@1.11.0-beta.0");
    write(
      "packages/gmt/src/t/dwellTime.ts",
      "export function dwellTime() {}\n",
    );
    commit("three, unpublished");
  }

  it("uses the newest stable tag by version, not by text", () => {
    setUp();
    const b = releasedBaseline(repo);
    // 1.10.0 beats 1.9.0, and the prerelease is not a release.
    expect(baselineKey(b)).toBe("@northguild/gmt@1.10.0");
    expect(isUnreleased(b, "addDays")).toBe(false);
    expect(isUnreleased(b, "floorToZone")).toBe(false);
    expect(isUnreleased(b, "dwellTime")).toBe(true);
    // Names only a test file declares were never public.
    expect(isUnreleased(b, "onlyInTests")).toBe(true);
  });

  it("stops badging once the release is tagged, which is the production state", () => {
    setUp();
    expect(isUnreleased(releasedBaseline(repo), "dwellTime")).toBe(true);
    git("tag", "@northguild/gmt@1.11.0");
    const b = releasedBaseline(repo);
    expect(baselineKey(b)).toBe("@northguild/gmt@1.11.0");
    expect(isUnreleased(b, "dwellTime")).toBe(false);
  });

  it("badges nothing without tags", () => {
    repo = mkdtempSync(join(tmpdir(), "released-exports-"));
    git("init", "-q");
    write(
      "packages/gmt/src/t/dwellTime.ts",
      "export function dwellTime() {}\n",
    );
    commit("only");
    const b = releasedBaseline(repo);
    expect(baselineKey(b)).toBe("none:no-tags");
    expect(isUnreleased(b, "dwellTime")).toBe(false);
  });
});
