import { workaroundState } from "../../../../scripts/lib/workaround-state.mjs";

/**
 * The state of a workaround group on the engine a run is on. A failing probe is evidence on any
 * engine; passing probes prove the defect gone only on an engine in the group's scope.
 */
describe("workaroundState", () => {
  it.each`
    group                        | state             | branch
    ${{ probes: 2, failing: 1 }} | ${"still-needed"} | ${"a failing probe"}
    ${{ probes: 0, failing: 0 }} | ${"still-needed"} | ${"no probes cannot be judged removable"}
    ${{ probes: 2, failing: 0 }} | ${"removable"}    | ${"all pass"}
  `("$branch: is $state", ({ group, state }) => {
    expect(workaroundState(group)).toEqual({ state });
  });

  it.each`
    group                                              | engine       | state             | branch
    ${{ probes: 1, failing: 0, engines: ["firefox"] }} | ${"v8"}      | ${"out-of-scope"} | ${"all pass on an engine outside the scope"}
    ${{ probes: 1, failing: 0, engines: ["firefox"] }} | ${undefined} | ${"out-of-scope"} | ${"the default engine is v8"}
    ${{ probes: 1, failing: 0, engines: ["firefox"] }} | ${"firefox"} | ${"removable"}    | ${"all pass on an engine in the scope"}
    ${{ probes: 1, failing: 1, engines: ["firefox"] }} | ${"v8"}      | ${"still-needed"} | ${"a failing probe is evidence on any engine"}
    ${{ probes: 0, failing: 0, engines: ["firefox"] }} | ${"v8"}      | ${"still-needed"} | ${"no probes cannot be judged"}
    ${{ probes: 1, failing: 0 }}                       | ${"v8"}      | ${"removable"}    | ${"no engine scope"}
  `("$branch: engine $engine is $state", ({ group, engine, state }) => {
    expect(workaroundState(group, engine)).toEqual({ state });
  });
});
