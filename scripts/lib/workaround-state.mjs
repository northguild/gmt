/**
 * The state of a workaround group on the installed runtime.
 *
 * Pure, Node built-ins only, no I/O. `scripts/temporal-compat.mjs` runs its command on import, so
 * the decision lives here where a test can import it.
 */

/**
 * A workaround group's state on the installed runtime.
 * A group that names `engines` is a defect only those engines have (for example Firefox's
 * SpiderMonkey). Its probes passing on any other engine proves nothing about the defect, so on
 * such a runtime it is `out-of-scope`: never removable, never counted removable. A failing probe
 * still wins, because a failure is evidence on any engine.
 * @param {{ probes: number, failing: number, engines?: readonly string[] }} group
 * @param {string} [engine]  the JavaScript engine this run is on: "v8" for Node (the default)
 * @returns {{ state: "still-needed" | "removable" | "out-of-scope" }}
 */
export function workaroundState(group, engine = "v8") {
  if (group.probes === 0 || group.failing > 0) {
    return { state: "still-needed" };
  }
  if (group.engines && !group.engines.includes(engine)) {
    return { state: "out-of-scope" };
  }
  return { state: "removable" };
}

/**
 * One snapshot row: a workaround group, its probe counts and its state on the installed runtime.
 * Lives beside `workaroundState` because `temporal-compat.mjs` runs its command on import, so a
 * test cannot import it; this keeps the row testable without the CLI.
 * @param {{ defects: string[], title: string, trigger: string, engines?: string[] }} workaround
 * @param {{ probes: number, failing: number }} counts
 * @param {string} [engine]  the engine this run is on (see `workaroundState`)
 * @returns {{ defects: string[], title: string, trigger: string, probes: number, failing: number,
 *             state: "still-needed" | "removable" | "out-of-scope", engines?: string[] }}
 */
export function snapshotRow(workaround, counts, engine = "v8") {
  const { state } = workaroundState(
    { ...counts, engines: workaround.engines },
    engine,
  );
  return {
    defects: workaround.defects,
    title: workaround.title,
    trigger: workaround.trigger,
    probes: counts.probes,
    failing: counts.failing,
    state,
    ...(workaround.engines ? { engines: [...workaround.engines] } : {}),
  };
}
