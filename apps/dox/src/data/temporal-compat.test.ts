import { WORKAROUNDS } from "../../../../scripts/lib/workarounds.mjs";
import {
  COMPAT_STATES,
  compatGroups,
  groupLabel,
  groupSummary,
  groupsMissingDescription,
  groupsStillNeeded,
  probeTotals,
  shortRef,
  stateLine,
  toCompatGroup,
  type CompatGroup,
} from "./temporal-compat";
import { TRACKED_REPOS } from "./upstream-filings";

/**
 * The canary snapshot the `/upstream/` page reads.
 *
 * `pnpm compat:snapshot` writes it from the same probes `pnpm compat` runs, and
 * `temporal-compat.mjs snapshot --check` (wired into `validate`) fails when the committed copy has
 * drifted. These tests cover the shape the page depends on, and that every group the canary knows
 * about is present — a group silently missing would understate how much GMT still works around.
 */
describe("temporal compat snapshot", () => {
  it("has a row for every workaround group in the canary script", () => {
    const declared = WORKAROUNDS.map((w) => w.defects.join(" + "));

    expect(declared.length).toBeGreaterThan(0);
    expect(compatGroups.map(groupLabel).sort()).toEqual(declared.sort());
  });

  it("counts probes that cannot exceed their group's total", () => {
    for (const group of compatGroups) {
      const label = groupLabel(group);
      expect(group.probes, label).toBeGreaterThan(0);
      expect(group.failing, label).toBeGreaterThanOrEqual(0);
      expect(group.failing, label).toBeLessThanOrEqual(group.probes);
    }
  });

  it("derives its totals from the rows", () => {
    expect(probeTotals.probes).toBe(
      compatGroups.reduce((n, g) => n + g.probes, 0),
    );
    expect(probeTotals.failing).toBe(
      compatGroups.reduce((n, g) => n + g.failing, 0),
    );
    expect(groupsStillNeeded).toBe(
      compatGroups.filter((g) => g.state === "still-needed").length,
    );
    expect(groupsStillNeeded).toBeLessThanOrEqual(compatGroups.length);
  });

  it("has a plain-language line for every group", () => {
    // The fallback is the canary's own wording, which names files and defect numbers because it is
    // written for whoever removes a workaround. A group without its own line would ship that to
    // readers without anyone noticing.
    expect(groupsMissingDescription).toEqual([]);
  });

  it("gives every group a label and a readable summary", () => {
    for (const group of compatGroups) {
      expect(groupLabel(group)).toMatch(/^[A-Za-z0-9.]+( \+ [A-Za-z0-9.]+)*$/);
      // The title reads "D1 — what goes wrong"; the summary is the half a reader needs.
      expect(groupSummary(group).length).toBeGreaterThan(10);
      expect(groupSummary(group)).not.toContain("—");
      expect(group.trigger.length).toBeGreaterThan(10);
    }
  });

  it("records a state per row, drawn from COMPAT_STATES", () => {
    for (const group of compatGroups) {
      expect(COMPAT_STATES, groupLabel(group)).toContain(group.state);
    }
  });

  it("never marks a row with a failing probe as anything but still-needed", () => {
    // An invariant the canary guarantees, not a second derivation of the state.
    for (const group of compatGroups.filter((g) => g.failing >= 1)) {
      expect(group.state, groupLabel(group)).toBe("still-needed");
    }
  });

  describe("toCompatGroup", () => {
    const row = {
      defects: ["X1"],
      title: "X1 — a made-up defect",
      trigger: "a made-up upstream fix lands",
      probes: 3,
      failing: 0,
      state: "removable",
    };

    it("keeps a well-formed row's values unchanged", () => {
      expect(toCompatGroup(row)).toEqual(row);
    });

    it("throws on an unknown state, naming the group and the value", () => {
      expect(() => toCompatGroup({ ...row, state: "retired" })).toThrow(
        'group X1 has unknown state "retired"',
      );
    });

    it("keeps an out-of-scope row with its engines", () => {
      const scoped = { ...row, state: "out-of-scope", engines: ["firefox"] };
      expect(toCompatGroup(scoped)).toEqual(scoped);
    });

    it("throws on an out-of-scope row with no engines", () => {
      expect(() => toCompatGroup({ ...row, state: "out-of-scope" })).toThrow(
        /group X1 has state "out-of-scope" but no engines/,
      );
    });
  });

  describe("stateLine", () => {
    const group = (state: CompatGroup["state"]): CompatGroup => ({
      defects: ["X1"],
      title: "X1 — a made-up defect",
      trigger: "a made-up upstream fix lands",
      probes: 4,
      failing: state === "still-needed" ? 3 : 0,
      state,
      ...(state === "out-of-scope" ? { engines: ["firefox"] } : {}),
    });

    it.each`
      state             | badge                  | count
      ${"still-needed"} | ${"✓ Yes"}             | ${"3 of 4 checks fail"}
      ${"removable"}    | ${"No"}                | ${"4 of 4 checks pass"}
      ${"out-of-scope"} | ${"✓ Yes, on Firefox"} | ${"4 of 4 checks pass on Node, which does not show this defect"}
    `(
      "gives $state the badge '$badge' and '$count'",
      ({ state, badge, count }) => {
        expect(stateLine(group(state))).toEqual({ badge, count });
      },
    );

    it("names each engine in an out-of-scope row's scope as the page prints it", () => {
      expect(
        stateLine({ ...group("out-of-scope"), engines: ["webkit"] }).badge,
      ).toBe("✓ Yes, on WebKit");
      expect(
        stateLine({ ...group("out-of-scope"), engines: ["firefox", "webkit"] })
          .badge,
      ).toBe("✓ Yes, on Firefox and WebKit");
      expect(
        stateLine({ ...group("out-of-scope"), engines: ["chromium"] }).badge,
      ).toBe("✓ Yes, on Chromium");
    });

    it("chooses by state alone, not by the probe counts", () => {
      expect(stateLine({ ...group("removable"), failing: 2 }).badge).toBe("No");
      expect(stateLine({ ...group("still-needed"), failing: 0 }).badge).toBe(
        "✓ Yes",
      );
    });
  });

  describe("shortRef", () => {
    it.each`
      repo                                | number  | label
      ${"tc39/proposal-temporal"}         | ${3292} | ${"tc39 #3292"}
      ${"js-temporal/temporal-polyfill"}  | ${369}  | ${"polyfill #369"}
      ${"fullcalendar/temporal-polyfill"} | ${126}  | ${"fullcalendar #126"}
      ${"whatwg/html"}                    | ${12}   | ${"whatwg/html #12"}
    `("labels $repo#$number as '$label'", ({ repo, number, label }) => {
      expect(shortRef(repo, number)).toBe(label);
    });

    it.each(TRACKED_REPOS)(
      "gives tracked repository %s a short label",
      (repo) => {
        expect(shortRef(repo, 1)).not.toBe(`${repo} #1`);
      },
    );
  });
});
