import { describe, expect, it } from "vitest";
import { compareReleases } from "../../../../scripts/lib/release-order.mjs";
import { pickSwapVersion } from "../../../../scripts/swap-version.mjs";

describe("pickSwapVersion", () => {
  it.each`
    requested  | newest      | pinned     | version     | skip     | note
    ${""}      | ${"1.0.9"}  | ${"1.0.8"} | ${"1.0.9"}  | ${false} | ${"a newer release is the candidate"}
    ${""}      | ${"1.0.8"}  | ${"1.0.8"} | ${"1.0.8"}  | ${true}  | ${"the pin is already the newest release"}
    ${""}      | ${"1.0.7"}  | ${"1.0.8"} | ${"1.0.7"}  | ${true}  | ${"npm's newest release is older than the pin"}
    ${""}      | ${"1.0.10"} | ${"1.0.9"} | ${"1.0.10"} | ${false} | ${"each part is compared as a number"}
    ${""}      | ${"1.0.9"}  | ${null}    | ${"1.0.9"}  | ${false} | ${"no pin to compare with"}
    ${"1.0.7"} | ${"1.0.8"}  | ${"1.0.8"} | ${"1.0.7"}  | ${false} | ${"a version given by hand always runs, even one older than the pin"}
    ${"1.0.8"} | ${"1.0.8"}  | ${"1.0.8"} | ${"1.0.8"}  | ${false} | ${"a version given by hand equal to the pin still runs"}
  `(
    'requested "$requested", newest "$newest", pinned "$pinned" gives version "$version" and skip $skip ($note)',
    ({ requested, newest, pinned, version, skip }) => {
      expect(pickSwapVersion({ requested, newest, pinned })).toEqual({
        version,
        skip,
      });
    },
  );

  it.each`
    requested   | newest      | pinned
    ${"1.0"}    | ${"1.0.9"}  | ${"1.0.8"}
    ${""}       | ${"latest"} | ${"1.0.8"}
    ${""}       | ${""}       | ${"1.0.8"}
    ${"v1.0.9"} | ${"1.0.9"}  | ${"1.0.8"}
  `(
    'requested "$requested" and newest "$newest" is not an x.y.z version and throws',
    ({ requested, newest, pinned }) => {
      expect(() => pickSwapVersion({ requested, newest, pinned })).toThrow(
        /not a x\.y\.z version/,
      );
    },
  );
});

describe("compareReleases", () => {
  it.each`
    a           | b           | result
    ${"1.0.7"}  | ${"1.0.8"}  | ${-1}
    ${"1.0.8"}  | ${"1.0.8"}  | ${0}
    ${"1.0.10"} | ${"1.0.9"}  | ${1}
    ${"1.10.0"} | ${"1.9.9"}  | ${1}
    ${"2.0.0"}  | ${"10.0.0"} | ${-1}
  `("$a against $b is $result", ({ a, b, result }) => {
    expect(compareReleases(a, b)).toBe(result);
  });

  it("throws on a version that is not x.y.z", () => {
    expect(() => compareReleases("1.0", "1.0.8")).toThrow(
      /not a x\.y\.z version: 1\.0/,
    );
  });
});
