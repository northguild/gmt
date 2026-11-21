/**
 * Turns the runs of the probe into the record. Pure: no process, file or clock in here.
 *
 * `runs[node][library][zone]` is what `child.mjs` printed for that process:
 * `{ broken: { caseId: wrongText }, unsupported: { caseId: reason } }`.
 *
 * Per library and experiment:
 * - `wrong`: cases broken under at least one machine zone (a thrown error counts).
 * - `wrongEverywhere`: of those, the ones broken under every machine zone.
 * - `wrongSomeZones`: the rest: the answer depends on the zone of the machine.
 * - `unsupported`: cases the library has no way to say (not a break, not in `wrong`).
 * The headline counts are the newest Node's. `nodeCounts` has every Node's `wrong`, and
 * `nodesAgree` says whether every Node broke the same cases.
 */

export function summarise({ cases, libraries, runs, nodes, zones }) {
  const headline = nodes[nodes.length - 1];
  const experiments = cases.experiments.map((e) => {
    const perLibrary = libraries.map((lib) => {
      const sets = {};
      for (const node of nodes)
        sets[node] = brokenSets(e, runs[node][lib.id], zones);
      const main = sets[headline];
      const everywhere = e.cases.filter(
        (c) => main.zonesOf[c.id]?.length === zones.length,
      ).length;
      const wrong = e.cases.filter((c) => main.zonesOf[c.id]?.length).length;
      const unsupported = e.cases.filter((c) =>
        main.unsupported.has(c.id),
      ).length;
      const nodesAgree = nodes.every((n) => sameSets(sets[n], main, e));
      return {
        library: lib.id,
        total: e.cases.length,
        wrong,
        wrongEverywhere: everywhere,
        wrongSomeZones: wrong - everywhere,
        unsupported,
        example: exampleOf(e, main, zones, runs[headline][lib.id]),
        nodeCounts: Object.fromEntries(
          nodes.map((n) => [
            n,
            e.cases.filter((c) => sets[n].zonesOf[c.id]?.length).length,
          ]),
        ),
        nodesAgree,
      };
    });
    return {
      id: e.id,
      number: e.number,
      title: e.title,
      question: e.question,
      fed: e.fed,
      cases: e.cases.length,
      perLibrary,
    };
  });
  return experiments;
}

function brokenSets(e, byZone, zones) {
  const zonesOf = {};
  const unsupported = new Set();
  for (const zone of zones) {
    const cell = byZone[zone];
    for (const c of e.cases) {
      if (c.id in cell.broken) (zonesOf[c.id] ??= []).push(zone);
      if (c.id in cell.unsupported) unsupported.add(c.id);
    }
  }
  return { zonesOf, unsupported };
}

function sameSets(a, b, e) {
  return e.cases.every(
    (c) => (a.zonesOf[c.id] ?? []).join() === (b.zonesOf[c.id] ?? []).join(),
  );
}

/** The first case broken in every zone, else the first broken in some: the input, both answers, where. */
function exampleOf(e, sets, zones, byZone) {
  const broken = e.cases.filter((c) => sets.zonesOf[c.id]?.length);
  const pick =
    broken.find((c) => sets.zonesOf[c.id].length === zones.length) ?? broken[0];
  if (!pick) return null;
  const where = sets.zonesOf[pick.id];
  return {
    input: pick.input,
    answer: byZone[where[0]].broken[pick.id],
    expected: pick.expected,
    zones: where.length === zones.length ? "every" : where,
  };
}
