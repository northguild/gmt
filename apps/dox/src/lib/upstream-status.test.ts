import { countLabel, countNoun, listingStatus } from "./upstream-status";

describe("listingStatus", () => {
  it.each`
    kind       | state       | draft    | reviewDecision         | mergedAt        | expected
    ${"pr"}    | ${"open"}   | ${true}  | ${"APPROVED"}          | ${null}         | ${"Draft"}
    ${"pr"}    | ${"open"}   | ${false} | ${null}                | ${null}         | ${"Open, awaiting review"}
    ${"pr"}    | ${"open"}   | ${false} | ${"REVIEW_REQUIRED"}   | ${null}         | ${"Open, awaiting review"}
    ${"pr"}    | ${"open"}   | ${false} | ${"CHANGES_REQUESTED"} | ${null}         | ${"Changes requested"}
    ${"pr"}    | ${"open"}   | ${false} | ${"APPROVED"}          | ${null}         | ${"Approved"}
    ${"pr"}    | ${"closed"} | ${false} | ${"APPROVED"}          | ${"2026-11-05"} | ${"Merged"}
    ${"pr"}    | ${"closed"} | ${false} | ${null}                | ${null}         | ${"Closed without merging"}
    ${"issue"} | ${"open"}   | ${false} | ${null}                | ${null}         | ${"Open"}
    ${"issue"} | ${"closed"} | ${false} | ${null}                | ${null}         | ${"Closed"}
  `(
    "$kind state=$state draft=$draft review=$reviewDecision merged=$mergedAt is '$expected'",
    ({ kind, state, draft, reviewDecision, mergedAt, expected }) => {
      expect(
        listingStatus({ kind, state, draft, reviewDecision, mergedAt }),
      ).toBe(expected);
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
