import {
  defectBadge,
  gmtBadge,
  reviewBadge,
  roleBadge,
  stateBadge,
  stateNote,
  workBadge,
} from "./upstream-badges";

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
      expect(stateBadge({ kind, state, draft, mergedAt })).toEqual({
        text,
        tone,
        icon,
      });
    },
  );
});

describe("stateNote", () => {
  it("keeps what 'Merged' alone loses", () => {
    expect(stateNote({ mergedAt: "2026-05-01" })).toBe(
      "Merged, not yet in a published release",
    );
    expect(stateNote({ mergedAt: null })).toBeNull();
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
      expect(reviewBadge({ kind, state, draft, reviewDecision })?.text).toBe(
        text,
      );
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
    kind       | gmtGuard | gmtNote         | pairsWith                          | text                    | tone
    ${"issue"} | ${"D11"} | ${null}         | ${[]}                              | ${"Guarded · D11"}      | ${"purple"}
    ${"issue"} | ${null}  | ${"n/a to GMT"} | ${[]}                              | ${"Not affected"}       | ${"spring"}
    ${"pr"}    | ${null}  | ${null}         | ${[]}                              | ${"Fix filed upstream"} | ${"neutral"}
    ${"issue"} | ${null}  | ${null}         | ${["tc39/proposal-temporal#3327"]} | ${"Fix filed upstream"} | ${"neutral"}
    ${"issue"} | ${null}  | ${null}         | ${[]}                              | ${"Reported upstream"}  | ${"neutral"}
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
