/**
 * The zone list's soundness, from what a browser measured (`listSnapshot` in hero-space-check.mjs):
 * the clock list is virtual (`zone-clock-list.ts`), so a fault shows as rows that overlap, a hole
 * where a row should be mounted, or an active option off screen. Plain functions, tested in
 * `zone-list-rows.test.ts`.
 */

/** The row gap the virtualizer lays between rows (`ROW_GAP` in `zone-clock-list.ts`). */
export const ROW_GAP = 4;
const r1 = (n) => Math.round(n * 10) / 10;

/** What is wrong with the rows now showing: overlaps, holes, an unfilled viewport. Empty when sound. */
export function listProblems(snap) {
  const problems = [];
  const { rows, panel } = snap;
  if (rows.length === 0 && snap.count > 0) return ["no row is mounted"];
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1];
    const b = rows[i];
    if (b.index !== a.index + 1) {
      problems.push(
        `rows ${a.index} and ${b.index} are mounted with a row missing between`,
      );
      continue;
    }
    const gap = b.top - a.bottom;
    if (gap < -0.5)
      problems.push(`rows ${a.index} and ${b.index} overlap by ${r1(-gap)} px`);
    if (gap > ROW_GAP + 1.5)
      problems.push(
        `a ${r1(gap)} px gap between rows ${a.index} and ${b.index}`,
      );
  }
  const shown = rows.filter(
    (row) => row.bottom > panel.top && row.top < panel.bottom,
  );
  if (shown.length === 0) {
    problems.push("no row is inside the list's box");
  } else {
    // The box's edge may sit in the gap between two rows, so an edge shortfall up to one gap is
    // fine; a hole is a row that should show and is not mounted. Past the first or the last row
    // the shortfall is the list's own padding, with no row there to mount.
    const edge = ROW_GAP + 1;
    if (
      snap.scrollTop > 1 &&
      shown[0].index > 0 &&
      shown[0].top > panel.top + edge
    )
      problems.push(
        `the list starts ${r1(shown[0].top - panel.top)} px below its top with rows above it`,
      );
    if (
      snap.scrollTop < snap.max - 1 &&
      shown.at(-1).index < snap.count - 1 &&
      shown.at(-1).bottom < panel.bottom - edge
    )
      problems.push(
        `the list ends ${r1(panel.bottom - shown.at(-1).bottom)} px above its bottom with rows below it`,
      );
  }
  return problems;
}

/** The option the list says is active, when it is mounted and inside the list's box. */
export function activeProblem(snap) {
  const row = snap.rows.find((r) => r.id === snap.active);
  if (!row) return `the active option ${snap.active} is not a mounted row`;
  if (row.top < snap.panel.top - 1.5 || row.bottom > snap.panel.bottom + 1.5)
    return `the active row ${row.index} (${r1(row.top)} to ${r1(row.bottom)}) is outside the list ${r1(snap.panel.top)} to ${r1(snap.panel.bottom)}`;
  return null;
}
