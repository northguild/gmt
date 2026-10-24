import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";

import { workaroundState } from "../../../../scripts/lib/workaround-state.mjs";
import {
  COMPAT_STATES,
  compatGroups,
  groupLabel,
  groupSummary,
  groupsMissingDescription,
  groupsStillNeeded,
  probeTotals,
  reasonParts,
  shortRef,
  stateLine,
  toCompatGroup,
  type CompatGroup,
} from "./temporal-compat";

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
    const script = readFileSync(
      resolve(import.meta.dirname, "../../../../scripts/temporal-compat.mjs"),
      "utf8",
    );
    const declared = [...script.matchAll(/^\s*defects: \[([^\]]+)\],$/gm)].map(
      (m) =>
        m[1]
          .split(",")
          .map((id) => id.trim().replace(/^["']|["']$/g, ""))
          .join(" + "),
    );

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

  it("gives every guard row a complete guard", () => {
    for (const group of compatGroups.filter((g) => g.state === "guard")) {
      const label = groupLabel(group);
      expect(group.guard, label).toBeDefined();
      expect(group.guard!.package.length, label).toBeGreaterThan(0);
      expect(group.guard!.through.length, label).toBeGreaterThan(0);
      expect(group.guard!.reason.length, label).toBeGreaterThan(0);
    }
  });

  it("words every guard reason without the canary's term 'probe'", () => {
    // The page prints the reason as written and never says "probe", so a reader would meet a word
    // the rest of the page does not use.
    for (const group of compatGroups.filter((g) => g.guard)) {
      expect(group.guard!.reason, groupLabel(group)).not.toMatch(
        /\bprobes?\b/i,
      );
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
    const guard = { package: "pkg", through: "1.2.3", reason: "Because." };

    it("keeps a well-formed row's values unchanged", () => {
      expect(toCompatGroup(row)).toEqual(row);
      expect(toCompatGroup({ ...row, state: "guard", guard })).toEqual({
        ...row,
        state: "guard",
        guard,
      });
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

    it("throws on a guard row with no guard", () => {
      expect(() => toCompatGroup({ ...row, state: "guard" })).toThrow(
        /group X1 has state "guard" but no complete guard/,
      );
    });

    it.each(["package", "through", "reason"] as const)(
      "throws on a guard row whose %s is empty",
      (field) => {
        expect(() =>
          toCompatGroup({
            ...row,
            state: "guard",
            guard: { ...guard, [field]: "" },
          }),
        ).toThrow(/no complete guard/);
      },
    );
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
      ${"guard"}        | ${"Kept on purpose"}   | ${"4 of 4 checks pass"}
      ${"out-of-scope"} | ${"✓ Yes, on Firefox"} | ${"4 of 4 checks pass on Node, which does not have this defect"}
    `(
      "gives $state the badge '$badge' and '$count'",
      ({ state, badge, count }) => {
        expect(stateLine(group(state))).toEqual({ badge, count });
      },
    );

    it("chooses by state alone, not by the probe counts", () => {
      expect(stateLine({ ...group("guard"), failing: 2 }).badge).toBe(
        "Kept on purpose",
      );
      expect(stateLine({ ...group("still-needed"), failing: 0 }).badge).toBe(
        "✓ Yes",
      );
    });
  });

  describe("shortRef", () => {
    it.each`
      repo                               | number  | label
      ${"tc39/proposal-temporal"}        | ${3292} | ${"tc39 #3292"}
      ${"js-temporal/temporal-polyfill"} | ${369}  | ${"polyfill #369"}
      ${"whatwg/html"}                   | ${12}   | ${"whatwg/html #12"}
    `("labels $repo#$number as '$label'", ({ repo, number, label }) => {
      expect(shortRef(repo, number)).toBe(label);
    });
  });

  describe("reasonParts", () => {
    it("turns an owner/repo#number reference into a short link", () => {
      expect(
        reasonParts(
          "Older than the change that exposes this bug (tc39/proposal-temporal#3292), so it passes.",
        ),
      ).toEqual([
        { text: "Older than the change that exposes this bug (" },
        {
          text: "tc39 #3292",
          href: "https://github.com/tc39/proposal-temporal/issues/3292",
        },
        { text: "), so it passes." },
      ]);
    });

    const hrefs = (parts: ReturnType<typeof reasonParts>) =>
      parts.flatMap((p) => ("href" in p ? [p.href] : []));
    const TC39 = "tc39/proposal-temporal";
    const POLYFILL = "js-temporal/temporal-polyfill";

    it("links every reference and keeps text between them", () => {
      expect(
        reasonParts(`${TC39}#1 and ${POLYFILL}#2`).map((p) =>
          "href" in p ? p.href : p.text,
        ),
      ).toEqual([
        `https://github.com/${TC39}/issues/1`,
        " and ",
        `https://github.com/${POLYFILL}/issues/2`,
      ]);
    });

    it("links a reference at the end of a sentence and one in parentheses", () => {
      expect(hrefs(reasonParts(`Tracked in ${TC39}#3292.`))).toEqual([
        `https://github.com/${TC39}/issues/3292`,
      ]);
      expect(reasonParts(`Tracked in ${TC39}#3292.`).at(-1)).toEqual({
        text: ".",
      });
      expect(hrefs(reasonParts(`(${TC39}#7)`))).toEqual([
        `https://github.com/${TC39}/issues/7`,
      ]);
    });

    it("links only the repositories the site knows, so `and/or#1` stays text", () => {
      expect(reasonParts("pass and/or#1 here")).toEqual([
        { text: "pass and/or#1 here" },
      ]);
      expect(reasonParts("a/b#1")).toEqual([{ text: "a/b#1" }]);
    });

    it("does not link a reference that is part of a URL or a longer name", () => {
      for (const text of [
        `https://github.com/${TC39}/issues/3292#3`,
        `https://github.com/${TC39}#3`,
        `x-${TC39}#3`,
        `${TC39}#3abc`,
      ]) {
        expect(reasonParts(text), text).toEqual([{ text }]);
      }
    });

    it("links nothing when no repository is known", () => {
      expect(reasonParts(`${TC39}#1`, [])).toEqual([{ text: `${TC39}#1` }]);
    });

    it("matches a repository name with dots when the site knows it", () => {
      expect(
        hrefs(reasonParts("fixed in a.b/c.d#1 and not axb/cxd#2", ["a.b/c.d"])),
      ).toEqual(["https://github.com/a.b/c.d/issues/1"]);
    });

    it("leaves a reason with no reference as one text part", () => {
      expect(reasonParts("No upstream change yet.")).toEqual([
        { text: "No upstream change yet." },
      ]);
    });

    it("does not link a bare #number or an owner/repo with no number", () => {
      expect(reasonParts(`see #12 in ${TC39}`)).toEqual([
        { text: `see #12 in ${TC39}` },
      ]);
    });

    it("joins back to the reason it was given", () => {
      for (const g of compatGroups) {
        if (!g.guard) continue;
        const joined = reasonParts(g.guard.reason)
          .map((p) =>
            "href" in p
              ? p.href.replace(
                  /^https:\/\/github\.com\/(.+)\/issues\/(\d+)$/,
                  "$1#$2",
                )
              : p.text,
          )
          .join("");
        expect(joined).toBe(g.guard.reason);
      }
    });
  });

  describe("guards", () => {
    const script = readFileSync(
      resolve(import.meta.dirname, "../../../../scripts/temporal-compat.mjs"),
      "utf8",
    );
    // The WORKAROUNDS block, cut at each `defects:` line: one chunk per group.
    const start = script.indexOf("const WORKAROUNDS = [");
    const block = script.slice(start, script.indexOf("\n];", start));
    const chunks = block.split(/^\s*defects: /m).slice(1);
    const declared = chunks
      .map((chunk) => ({
        label: [.../^\[([^\]]+)\]/.exec(chunk)![1].matchAll(/"([^"]+)"/g)]
          .map((m) => m[1])
          .join(" + "),
        through: /guard: \{[\s\S]*?through: "([^"]+)"/.exec(chunk)?.[1],
      }))
      .filter((g) => g.through !== undefined);

    it("carries a guard on exactly the rows whose script entry declares one, with the same through", () => {
      const recorded = compatGroups
        .filter((g) => g.guard !== undefined)
        .map((g) => ({ label: groupLabel(g), through: g.guard!.through }));
      expect(recorded.sort((a, b) => a.label.localeCompare(b.label))).toEqual(
        declared.sort((a, b) => a.label.localeCompare(b.label)),
      );
      expect(declared.length).toBeGreaterThan(0);
    });

    it("records each guard with its package, through and reason, in that order", () => {
      for (const group of compatGroups.filter((g) => g.guard)) {
        expect(Object.keys(group.guard!), groupLabel(group)).toEqual([
          "package",
          "through",
          "reason",
        ]);
        expect(group.guard!.reason.length).toBeGreaterThan(10);
      }
    });

    it("gives each guarded row the state workaroundState derives from the installed polyfill", () => {
      // Derived, not a pinned "D10 is a guard": a reviewed lockfile bump moves the answer, and
      // `snapshot --check` already forces the regeneration.
      const manifest = createRequire(
        join(import.meta.dirname, "../../../../packages/gmt/package.json"),
      ).resolve("@js-temporal/polyfill");
      let installed = "unknown";
      for (
        let dir = dirname(manifest);
        dir !== dirname(dir);
        dir = dirname(dir)
      ) {
        try {
          const { name, version } = JSON.parse(
            readFileSync(join(dir, "package.json"), "utf8"),
          );
          if (name === "@js-temporal/polyfill") {
            installed = version;
            break;
          }
        } catch {
          // no manifest at this level: keep walking up
        }
      }
      for (const group of compatGroups.filter((g) => g.guard)) {
        expect(group.state, groupLabel(group)).toBe(
          workaroundState(group, installed).state,
        );
      }
    });
  });
});
