import {
  compareVersions,
  workaroundState,
} from "../../../../scripts/lib/workaround-state.mjs";
import { WORKAROUNDS } from "../../../../scripts/lib/workarounds.mjs";

/**
 * The state of a workaround group on the installed polyfill (CORE-81).
 *
 * Expected values come from SemVer 2.0.0 (§2 validity, §10 build metadata, §11 precedence), not
 * from running the function.
 */
describe("compareVersions", () => {
  it.each`
    a                           | b                           | expected | clause
    ${"0.5.1"}                  | ${"0.5.1"}                  | ${0}     | ${"§11 equal"}
    ${"0.5.2"}                  | ${"0.5.1"}                  | ${1}     | ${"§11.2 patch"}
    ${"0.5.1"}                  | ${"0.5.2"}                  | ${-1}    | ${"§11.2 patch, reversed"}
    ${"0.10.0"}                 | ${"0.9.0"}                  | ${1}     | ${"§11.2 numeric, not lexical"}
    ${"1.0.0"}                  | ${"0.99.99"}                | ${1}     | ${"§11.2 major first"}
    ${"0.5.1-rc.1"}             | ${"0.5.1"}                  | ${-1}    | ${"§11.3 pre-release precedes release"}
    ${"0.5.1"}                  | ${"0.5.1-rc.1"}             | ${1}     | ${"§11.3 reversed"}
    ${"0.5.2-beta.1"}           | ${"0.5.1"}                  | ${1}     | ${"§11.2 before §11.3"}
    ${"0.5.1+build.7"}          | ${"0.5.1"}                  | ${0}     | ${"§10 build metadata ignored"}
    ${"0.5.1+a"}                | ${"0.5.1+b"}                | ${0}     | ${"§10 build metadata ignored on both"}
    ${"1.0.0-Beta"}             | ${"1.0.0-alpha"}            | ${-1}    | ${"§11.4.3 ASCII order: uppercase before lowercase"}
    ${"1.0.0-alpha+001"}        | ${"1.0.0-alpha"}            | ${0}     | ${"§10 build metadata ignored after a pre-release"}
    ${"1.0.0-rc.1"}             | ${"1.0.0-rc.1"}             | ${0}     | ${"§11.4 two equal pre-releases"}
    ${"9007199254740993.0.0"}   | ${"9007199254740992.0.0"}   | ${1}     | ${"§11.2 numeric above 2^53"}
    ${"1.0.0-9007199254740993"} | ${"1.0.0-9007199254740992"} | ${1}     | ${"§11.4.1 numeric identifier above 2^53"}
  `("$a vs $b is $expected ($clause)", ({ a, b, expected }) => {
    expect(compareVersions(a, b)).toBe(expected);
  });

  // SemVer 2.0.0 §11.4's own example chain.
  const chain = [
    "1.0.0-alpha",
    "1.0.0-alpha.1",
    "1.0.0-alpha.beta",
    "1.0.0-beta",
    "1.0.0-beta.2",
    "1.0.0-beta.11",
    "1.0.0-rc.1",
    "1.0.0",
  ];
  const pairs = chain.slice(1).map((later, i) => [chain[i], later]);

  it.each(pairs.map(([lower, higher]) => ({ lower, higher })))(
    "$lower precedes $higher (§11.4)",
    ({ lower, higher }) => {
      expect(compareVersions(lower, higher)).toBe(-1);
      expect(compareVersions(higher, lower)).toBe(1);
    },
  );

  it.each`
    a               | why
    ${"unknown"}    | ${"not a version"}
    ${"0.5"}        | ${"two parts"}
    ${"01.0.0"}     | ${"§2 leading zero in major"}
    ${"1.02.0"}     | ${"§2 leading zero in minor"}
    ${"1.0.0-01"}   | ${"§9 leading zero in a numeric pre-release identifier"}
    ${""}           | ${"empty"}
    ${"v0.5.1"}     | ${"§2 no v prefix"}
    ${"1.0.0-"}     | ${"§9 empty pre-release"}
    ${"1.0.0-a..b"} | ${"§9 empty pre-release identifier"}
    ${"1.0.0+"}     | ${"§10 empty build metadata"}
  `("$a is not a version ($why): null on either side", ({ a }) => {
    expect(compareVersions(a, "0.5.1")).toBeNull();
    expect(compareVersions("0.5.1", a)).toBeNull();
  });
});

describe("workaroundState", () => {
  const guard = {
    package: "@js-temporal/polyfill",
    through: "0.5.1",
    reason: "reason text",
  };

  it.each`
    group                               | installed       | state             | lapsed   | branch
    ${{ probes: 2, failing: 1 }}        | ${"0.5.1"}      | ${"still-needed"} | ${false} | ${"a failing probe"}
    ${{ probes: 0, failing: 0 }}        | ${"0.5.1"}      | ${"still-needed"} | ${false} | ${"no probes cannot be judged removable"}
    ${{ probes: 2, failing: 1, guard }} | ${"0.5.2"}      | ${"still-needed"} | ${false} | ${"a failing probe beats the guard"}
    ${{ probes: 0, failing: 0, guard }} | ${"0.5.1"}      | ${"still-needed"} | ${false} | ${"no probes beats the guard"}
    ${{ probes: 2, failing: 0 }}        | ${"0.5.1"}      | ${"removable"}    | ${false} | ${"all pass, no guard"}
    ${{ probes: 2, failing: 0, guard }} | ${"0.5.1"}      | ${"guard"}        | ${false} | ${"installed equals through"}
    ${{ probes: 2, failing: 0, guard }} | ${"0.5.0"}      | ${"guard"}        | ${false} | ${"installed before through"}
    ${{ probes: 2, failing: 0, guard }} | ${"0.5.1-rc.1"} | ${"guard"}        | ${false} | ${"pre-release precedes through (§11.3)"}
    ${{ probes: 2, failing: 0, guard }} | ${"0.5.2"}      | ${"removable"}    | ${true}  | ${"installed past through"}
    ${{ probes: 2, failing: 0, guard }} | ${"0.6.0"}      | ${"removable"}    | ${true}  | ${"installed past through, minor"}
  `(
    "$branch: installed $installed is $state, lapsed $lapsed",
    ({ group, installed, state, lapsed }) => {
      expect(workaroundState(group, installed)).toEqual({
        state,
        guardLapsed: lapsed,
      });
    },
  );

  it.each`
    group                                              | engine       | state             | branch
    ${{ probes: 1, failing: 0, engines: ["firefox"] }} | ${"v8"}      | ${"out-of-scope"} | ${"all pass on an engine outside the scope"}
    ${{ probes: 1, failing: 0, engines: ["firefox"] }} | ${undefined} | ${"out-of-scope"} | ${"the default engine is v8"}
    ${{ probes: 1, failing: 0, engines: ["firefox"] }} | ${"firefox"} | ${"removable"}    | ${"all pass on an engine in the scope"}
    ${{ probes: 1, failing: 1, engines: ["firefox"] }} | ${"v8"}      | ${"still-needed"} | ${"a failing probe is evidence on any engine"}
    ${{ probes: 0, failing: 0, engines: ["firefox"] }} | ${"v8"}      | ${"still-needed"} | ${"no probes cannot be judged"}
    ${{ probes: 1, failing: 0 }}                       | ${"v8"}      | ${"removable"}    | ${"no engine scope"}
  `("$branch: engine $engine is $state", ({ group, engine, state }) => {
    expect(workaroundState(group, "0.5.1", engine)).toEqual({
      state,
      guardLapsed: false,
    });
  });

  it("throws when a guarded group's installed version cannot be compared", () => {
    expect(() =>
      workaroundState({ probes: 2, failing: 0, guard }, "unknown"),
    ).toThrow("cannot compare @js-temporal/polyfill unknown with guard 0.5.1");
  });

  it("does not throw for an unreadable version when the group has no guard", () => {
    expect(workaroundState({ probes: 2, failing: 0 }, "unknown")).toEqual({
      state: "removable",
      guardLapsed: false,
    });
  });

  it("does not throw for an unreadable version when a probe fails", () => {
    expect(
      workaroundState({ probes: 2, failing: 1, guard }, "unknown"),
    ).toEqual({ state: "still-needed", guardLapsed: false });
  });
});

describe("the guards declared in scripts/lib/workarounds.mjs", () => {
  it("declares a guard on D10 and on no other group", () => {
    const guarded = WORKAROUNDS.filter((w) => w.guard).map((w) => w.defects);
    expect(guarded).toEqual([["D10"]]);
  });

  it("holds D10's guard through @js-temporal/polyfill 0.5.1", () => {
    const d10 = WORKAROUNDS.find((w) => w.defects.join() === "D10")!;
    expect(d10.guard).toMatchObject({
      package: "@js-temporal/polyfill",
      through: "0.5.1",
    });
  });
});
