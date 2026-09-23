import { describe, expect, it } from "vitest";
import { filingInGmt, filingStatus } from "./upstream-status";

describe("filingStatus", () => {
  // A merged PR is also `closed` on GitHub; merged is the more specific state.
  it.each`
    kind       | state       | draft    | reviewDecision         | mergedAt        | expected
    ${"pr"}    | ${"closed"} | ${false} | ${"APPROVED"}          | ${"2026-05-01"} | ${"Merged, not yet in a published release"}
    ${"pr"}    | ${"closed"} | ${false} | ${null}                | ${null}         | ${"Closed"}
    ${"issue"} | ${"closed"} | ${false} | ${null}                | ${null}         | ${"Closed"}
    ${"pr"}    | ${"open"}   | ${true}  | ${"APPROVED"}          | ${null}         | ${"Draft"}
    ${"pr"}    | ${"open"}   | ${false} | ${"APPROVED"}          | ${null}         | ${"Approved"}
    ${"pr"}    | ${"open"}   | ${false} | ${"CHANGES_REQUESTED"} | ${null}         | ${"Changes requested"}
    ${"pr"}    | ${"open"}   | ${false} | ${"REVIEW_REQUIRED"}   | ${null}         | ${"Open, awaiting review"}
    ${"pr"}    | ${"open"}   | ${false} | ${null}                | ${null}         | ${"Open, awaiting review"}
    ${"issue"} | ${"open"}   | ${false} | ${null}                | ${null}         | ${"Open"}
  `(
    "$kind state=$state draft=$draft review=$reviewDecision merged=$mergedAt is '$expected'",
    ({ kind, state, draft, reviewDecision, mergedAt, expected }) => {
      expect(
        filingStatus({ kind, state, draft, reviewDecision, mergedAt }),
      ).toBe(expected);
    },
  );
});

describe("filingInGmt", () => {
  it.each`
    kind       | gmtGuard       | gmtNote         | pairsWith                          | label                   | handled
    ${"issue"} | ${"someGuard"} | ${null}         | ${[]}                              | ${"Already handled"}    | ${true}
    ${"pr"}    | ${"someGuard"} | ${"also noted"} | ${[]}                              | ${"Already handled"}    | ${true}
    ${"issue"} | ${null}        | ${"n/a to GMT"} | ${[]}                              | ${"Doesn't affect GMT"} | ${true}
    ${"pr"}    | ${null}        | ${null}         | ${[]}                              | ${"Fix filed upstream"} | ${false}
    ${"issue"} | ${null}        | ${null}         | ${["tc39/proposal-temporal#3327"]} | ${"Fix filed upstream"} | ${false}
    ${"issue"} | ${null}        | ${null}         | ${[]}                              | ${"Reported upstream"}  | ${false}
  `(
    "$kind guard=$gmtGuard note=$gmtNote pairsWith=$pairsWith is '$label' (handled=$handled)",
    ({ kind, gmtGuard, gmtNote, pairsWith, label, handled }) => {
      expect(filingInGmt({ kind, gmtGuard, gmtNote, pairsWith })).toEqual({
        label,
        handled,
      });
    },
  );
});
