import {
  defectBadge,
  gmtBadge,
  reviewBadge,
  roleBadge,
  stateBadge,
  stateNote,
  workBadge,
} from "./upstream-badges";
import type { UpstreamFiling } from "../data/upstream-filings";

describe("stateBadge", () => {
  it.each`
    kind       | state       | draft    | mergedAt        | text        | tone         | icon
    ${"issue"} | ${"open"}   | ${false} | ${null}         | ${"Open"}   | ${"spring"}  | ${"issue-opened"}
    ${"issue"} | ${"closed"} | ${false} | ${null}         | ${"Closed"} | ${"purple"}  | ${"issue-closed"}
    ${"pr"}    | ${"open"}   | ${false} | ${null}         | ${"Open"}   | ${"spring"}  | ${"git-pull-request"}
    ${"pr"}    | ${"open"}   | ${true}  | ${null}         | ${"Draft"}  | ${"neutral"} | ${"git-pull-request-draft"}
    ${"pr"}    | ${"closed"} | ${false} | ${"2026-05-01"} | ${"Merged"} | ${"purple"}  | ${"git-merge"}
    ${"pr"}    | ${"closed"} | ${false} | ${null}         | ${"Closed"} | ${"neutral"} | ${"git-pull-request-closed"}
  `(
    "$kind $state draft=$draft merged=$mergedAt is $text",
    ({ kind, state, draft, mergedAt, text, tone, icon }) => {
      expect(
        stateBadge({
          tracker: "github",
          kind,
          state,
          draft,
          mergedAt,
          reviewDecision: null,
        }),
      ).toEqual({
        text,
        tone,
        icon,
      });
    },
  );
});

describe("a listing that is an issue", () => {
  const issue = {
    tracker: "github",
    kind: "issue",
    state: "open",
    draft: false,
    mergedAt: null,
    reviewDecision: null,
  } as const;

  it("gets the issue state badge and no review chip", () => {
    expect(stateBadge(issue)).toEqual({
      text: "Open",
      tone: "spring",
      icon: "issue-opened",
    });
    expect(reviewBadge(issue)).toBeNull();
  });
});

describe("stateNote", () => {
  it("keeps what 'Merged' alone loses", () => {
    const github = (mergedAt: string | null) =>
      ({ tracker: "github", mergedAt }) as UpstreamFiling;
    expect(stateNote(github("2026-05-01"))).toBe(
      "Merged, not yet in a published release",
    );
    expect(stateNote(github(null))).toBeNull();
  });

  it("gives a Jira or Bugzilla filing the tracker's own words", () => {
    const jira = {
      tracker: "jira",
      status: "Done",
      resolution: "Fixed",
      fixVersions: ["79.1"],
    } as unknown as UpstreamFiling;
    expect(stateNote(jira)).toBe(
      "Status Done, resolution Fixed, fix version 79.1",
    );
    const open = {
      tracker: "bugzilla",
      status: "UNCONFIRMED",
      resolution: null,
    } as UpstreamFiling;
    expect(stateNote(open)).toBe("Status UNCONFIRMED");
  });

  it("has nothing to add for a Chromium filing", () => {
    expect(stateNote({ tracker: "chromium" } as UpstreamFiling)).toBeNull();
  });
});

describe("a filing on another tracker", () => {
  it("reads as an issue with no review chip", () => {
    for (const tracker of ["jira", "chromium", "bugzilla"] as const) {
      const f = { tracker, state: "closed", closedAt: "2026-11-20" } as const;
      expect(stateBadge(f)).toEqual({
        text: "Closed",
        tone: "purple",
        icon: "issue-closed",
      });
      expect(reviewBadge(f)).toBeNull();
    }
  });
});

describe("reviewBadge", () => {
  it.each`
    kind       | state       | draft    | reviewDecision         | text
    ${"pr"}    | ${"open"}   | ${false} | ${"APPROVED"}          | ${"Approved"}
    ${"pr"}    | ${"closed"} | ${false} | ${"APPROVED"}          | ${"Approved"}
    ${"pr"}    | ${"open"}   | ${false} | ${"CHANGES_REQUESTED"} | ${"Changes requested"}
    ${"pr"}    | ${"open"}   | ${false} | ${"REVIEW_REQUIRED"}   | ${"Review required"}
    ${"pr"}    | ${"closed"} | ${false} | ${"REVIEW_REQUIRED"}   | ${undefined}
    ${"pr"}    | ${"open"}   | ${false} | ${null}                | ${"Awaiting review"}
    ${"pr"}    | ${"open"}   | ${true}  | ${null}                | ${undefined}
    ${"pr"}    | ${"closed"} | ${false} | ${null}                | ${undefined}
    ${"issue"} | ${"open"}   | ${false} | ${null}                | ${undefined}
  `(
    "$kind $state draft=$draft $reviewDecision shows $text",
    ({ kind, state, draft, reviewDecision, text }) => {
      expect(
        reviewBadge({
          tracker: "github",
          kind,
          state,
          draft,
          mergedAt: null,
          reviewDecision,
        })?.text,
      ).toBe(text);
    },
  );
});

describe("workBadge and roleBadge", () => {
  it("names the kind of work, and only when there is one", () => {
    expect(workBadge("port")?.text).toBe("Port");
    expect(workBadge("release")?.text).toBe("Release request");
    expect(workBadge(null)).toBeNull();
  });

  it("marks a filing someone else opened", () => {
    expect(roleBadge({ role: "contributor" })?.text).toBe("Theirs");
    expect(roleBadge({ role: "author" })).toBeNull();
    expect(roleBadge({})).toBeNull();
  });
});

describe("gmtBadge", () => {
  it.each`
    kind       | gmtGuard        | gmtNote         | pairsWith                          | text                    | tone
    ${"issue"} | ${"D11"}        | ${null}         | ${[]}                              | ${"Guarded · D11"}      | ${"purple"}
    ${"issue"} | ${["D1", "D6"]} | ${null}         | ${[]}                              | ${"Guarded · D1 + D6"}  | ${"purple"}
    ${"issue"} | ${null}         | ${"n/a to GMT"} | ${[]}                              | ${"Not affected"}       | ${"spring"}
    ${"pr"}    | ${null}         | ${null}         | ${[]}                              | ${"Fix filed upstream"} | ${"neutral"}
    ${"issue"} | ${null}         | ${null}         | ${["tc39/proposal-temporal#3327"]} | ${"Fix filed upstream"} | ${"neutral"}
    ${"issue"} | ${null}         | ${null}         | ${[]}                              | ${"Reported upstream"}  | ${"neutral"}
  `(
    "$kind guard=$gmtGuard note=$gmtNote is $text",
    ({ kind, gmtGuard, gmtNote, pairsWith, text, tone }) => {
      const badge = gmtBadge({ kind, gmtGuard, gmtNote, pairsWith });
      expect(badge.text).toBe(text);
      expect(badge.tone).toBe(tone);
    },
  );
});

describe("defectBadge", () => {
  const group = (state: string, engines?: string[]) =>
    ({ state, probes: 4, failing: 2, engines, defects: [] }) as never;

  it.each`
    state             | engines        | text                 | tone         | icon
    ${"still-needed"} | ${undefined}   | ${"Yes"}             | ${"neutral"} | ${"check"}
    ${"removable"}    | ${undefined}   | ${"No"}              | ${"spring"}  | ${undefined}
    ${"guard"}        | ${undefined}   | ${"Kept on purpose"} | ${"purple"}  | ${undefined}
    ${"out-of-scope"} | ${["firefox"]} | ${"Yes, on Firefox"} | ${"spring"}  | ${"check"}
  `("$state reads $text", ({ state, engines, text, tone, icon }) => {
    const badge = defectBadge(group(state, engines));
    expect(badge.text).toBe(text);
    expect(badge.tone).toBe(tone);
    expect(badge.icon).toBe(icon);
  });
});
