/**
 * The stored shape of the zone-matrix record, and the full shape the runner and the pages work
 * with. `run.mjs` writes `apps/dox/src/data/zone-matrix.json` with `compactRecord`;
 * `apps/dox/src/data/zone-matrix.ts` and `run.mjs` read it back with `expandRecord`. Nothing is
 * lost in either direction: `expandRecord(compactRecord(full))` is `full`, bar the order of
 * object keys.
 *
 * The full shape has one cell per suite, Node major and zone, each repeating the Node version,
 * the tzdata, the date, the test count and the test ids. Measured on the committed record, 774
 * id listings named 50 distinct tests, and every cell repeated the Node and the date. The stored
 * shape holds each once:
 *
 * - `nodes`: the Node release and tzdata of each major, the same for every suite. A record with
 *   two releases of one major cannot be stored: run the matrix again on one release.
 * - `tagDefs`, `causeDefs`: each distinct tag and cause once.
 * - per suite, `ids`: the test ids it names; every list of ids holds indexes into it. `tags` and
 *   `causes` map an index to a def index, and the suite's `id@version` is the key of every entry,
 *   so it is written once.
 * - per suite and Node, `tests` and `ranOn` are what most of its cells share; a cell that differs
 *   carries its own. An empty list of ids is left out.
 */

/** The key a tag or cause is filed under: `<suite>@<version> | <test id>`. */
export const tagKey = (suite, id) => `${suite.id}@${suite.version} | ${id}`;

const byNode = (a, b) => Number(a) - Number(b);
const mode = (values) => {
  const counts = new Map();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
};

/** @param {object} full the record as the runner and the pages work with it */
export function compactRecord(full) {
  const nodes = {};
  const noteNode = (node, nodeVersion, tzdata) => {
    const seen = (nodes[node] ??= { nodeVersion, tzdata });
    if (seen.nodeVersion !== nodeVersion || seen.tzdata !== tzdata)
      throw new Error(
        `The record holds Node ${node} as ${seen.nodeVersion} (tzdata ${seen.tzdata}) and as ${nodeVersion} (tzdata ${tzdata}). Run every suite again on one release; the cache keeps the cells already run.`,
      );
  };
  const tagDefs = [];
  const causeDefs = [];
  const defIndex = (defs, def) => {
    const text = JSON.stringify(def);
    let i = defs.findIndex((d) => JSON.stringify(d) === text);
    if (i < 0) i = defs.push(def) - 1;
    return i;
  };

  const suites = full.suites.map((suite) => {
    const ids = [
      ...new Set([
        ...suite.reference.runs.flatMap((r) => [...r.failed, ...r.unstable]),
        ...suite.cells.flatMap((c) => [
          ...c.failed,
          ...c.alsoFailsAtReference,
          ...c.unstable,
        ]),
      ]),
    ].sort();
    const at = (list) => list.map((id) => ids.indexOf(id));
    const lists = (from) =>
      Object.fromEntries(
        Object.entries(from)
          .filter(([, list]) => list.length > 0)
          .map(([k, list]) => [k, at(list)]),
      );

    const keyed = (table, defs) => {
      const out = {};
      ids.forEach((id, i) => {
        const def = table[tagKey(suite, id)];
        if (def) out[i] = defIndex(defs, def);
      });
      return out;
    };

    const cells = {};
    for (const node of [...new Set(suite.cells.map((c) => c.node))].sort(
      byNode,
    )) {
      const group = suite.cells.filter((c) => c.node === node);
      for (const c of group) noteNode(node, c.nodeVersion, c.tzdata);
      const tests = mode(group.map((c) => c.tests));
      const ranOn = mode(group.map((c) => c.ranOn));
      const zones = {};
      for (const c of [...group].sort((a, b) => a.zone.localeCompare(b.zone))) {
        const {
          node: _node,
          nodeVersion: _version,
          tzdata: _tzdata,
          tz: _tz,
          zone,
          ranOn: cellDate,
          tests: cellTests,
          failed,
          alsoFailsAtReference,
          unstable,
          ...rest
        } = c;
        zones[zone] = {
          ...(cellTests === tests ? {} : { tests: cellTests }),
          ...(cellDate === ranOn ? {} : { ranOn: cellDate }),
          ...lists({ failed, alsoFailsAtReference, unstable }),
          ...rest,
        };
      }
      cells[node] = { tests, ranOn, zones };
    }
    for (const run of suite.reference.runs)
      noteNode(run.node, run.nodeVersion, run.tzdata);

    return {
      id: suite.id,
      name: suite.name,
      version: suite.version,
      repository: suite.repository,
      commit: suite.commit,
      command: suite.command,
      ownCommand: suite.ownCommand,
      ids,
      tags: keyed(full.tags, tagDefs),
      causes: keyed(full.causes, causeDefs),
      reference: {
        zone: suite.reference.zone,
        source: suite.reference.source,
        runs: suite.reference.runs.map(
          ({
            node,
            nodeVersion: _v,
            tzdata: _t,
            failed,
            unstable,
            ...rest
          }) => ({
            node,
            ...rest,
            ...lists({ failed, unstable }),
          }),
        ),
      },
      pins: suite.pins,
      cells,
    };
  });

  const keyedTotal = (table) => Object.keys(table).length;
  const stored = suites.reduce((n, s) => n + Object.keys(s.tags).length, 0);
  if (stored !== keyedTotal(full.tags))
    throw new Error("A tag names a test that no cell or reference run lists.");
  const storedCauses = suites.reduce(
    (n, s) => n + Object.keys(s.causes).length,
    0,
  );
  if (storedCauses !== keyedTotal(full.causes))
    throw new Error(
      "A cause names a test that no cell or reference run lists.",
    );

  return {
    matrix: full.matrix,
    nodes,
    tagDefs,
    causeDefs,
    untagged: full.untagged,
    uncaused: full.uncaused,
    suites,
  };
}

/** @param {object} stored the JSON file */
export function expandRecord(stored) {
  const tags = {};
  const causes = {};
  const suites = stored.suites.map((s) => {
    const idsOf = (list = []) => list.map((i) => s.ids[i]);
    const suite = {
      id: s.id,
      name: s.name,
      version: s.version,
      repository: s.repository,
      commit: s.commit,
      command: s.command,
      ownCommand: s.ownCommand,
      reference: {
        zone: s.reference.zone,
        source: s.reference.source,
        runs: s.reference.runs.map(({ node, failed, unstable, ...rest }) => ({
          node,
          ...stored.nodes[node],
          ...rest,
          failed: idsOf(failed),
          unstable: idsOf(unstable),
        })),
      },
      pins: s.pins,
      cells: [],
    };
    for (const node of Object.keys(s.cells).sort(byNode)) {
      const group = s.cells[node];
      for (const zone of Object.keys(group.zones).sort((a, b) =>
        a.localeCompare(b),
      )) {
        const { failed, alsoFailsAtReference, unstable, ...rest } =
          group.zones[zone];
        suite.cells.push({
          node,
          ...stored.nodes[node],
          tz: zone,
          zone,
          ranOn: group.ranOn,
          tests: group.tests,
          ...rest,
          failed: idsOf(failed),
          alsoFailsAtReference: idsOf(alsoFailsAtReference),
          unstable: idsOf(unstable),
        });
      }
    }
    for (const [i, def] of Object.entries(s.tags))
      tags[tagKey(s, s.ids[i])] = stored.tagDefs[def];
    for (const [i, def] of Object.entries(s.causes))
      causes[tagKey(s, s.ids[i])] = stored.causeDefs[def];
    return suite;
  });
  return {
    matrix: stored.matrix,
    tags,
    untagged: stored.untagged,
    causes,
    uncaused: stored.uncaused,
    suites,
  };
}
