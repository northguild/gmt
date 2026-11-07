import { countLabel, countNoun, listingStatus } from "./upstream-status";

describe("listingStatus", () => {
  it.each`
    state       | draft    | reviewDecision         | mergedAt        | expected
    ${"open"}   | ${true}  | ${"APPROVED"}          | ${null}         | ${"Draft"}
    ${"open"}   | ${false} | ${null}                | ${null}         | ${"Open, awaiting review"}
    ${"open"}   | ${false} | ${"REVIEW_REQUIRED"}   | ${null}         | ${"Open, awaiting review"}
    ${"open"}   | ${false} | ${"CHANGES_REQUESTED"} | ${null}         | ${"Changes requested"}
    ${"open"}   | ${false} | ${"APPROVED"}          | ${null}         | ${"Approved"}
    ${"closed"} | ${false} | ${"APPROVED"}          | ${"2026-11-05"} | ${"Merged"}
    ${"closed"} | ${false} | ${null}                | ${null}         | ${"Closed without merging"}
  `(
    "state=$state draft=$draft review=$reviewDecision merged=$mergedAt is '$expected'",
    ({ state, draft, reviewDecision, mergedAt, expected }) => {
      expect(listingStatus({ state, draft, reviewDecision, mergedAt })).toBe(
        expected,
      );
    },
  );
});

describe("countLabel", () => {
  it.each([
    [0, "0 maintainer replies"],
    [1, "1 maintainer reply"],
    [3, "3 maintainer replies"],
  ])("names the noun for %i", (n, expected) => {
    expect(countLabel(n, "maintainer reply", "maintainer replies")).toBe(
      expected,
    );
    expect(
      `${n} ${countNoun(n, "maintainer reply", "maintainer replies")}`,
    ).toBe(expected);
  });
});
