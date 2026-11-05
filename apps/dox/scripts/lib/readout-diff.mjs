/**
 * The pure half of `readout-still.mjs`: how two snapshots of a widget's boxes are compared, and
 * how a drag's problems become findings. The script measures; this module decides, so each rule
 * has a unit test.
 *
 * A box is compared raw, never rounded: Firefox reports fractions, and a rounded compare flips
 * at ±1 px on a box that did not move while hiding a 0.8 px move that crosses a whole number.
 */

/** A box edge or size must differ by more than this to count as a change. */
const EPSILON = 0.5;

const changed = (a, b) => Math.abs(a - b) > EPSILON;
const fixed = (n) => n.toFixed(2);
const boxText = (box, keys) =>
  `{${keys.map((k) => `"${k}":${fixed(box[k])}`).join(",")}}`;

/** Cell widths that differ from the baseline by more than half a pixel. */
export function diffCells(base, now) {
  const problems = [];
  const later = new Map(now.map((c) => [c.key, c]));
  for (const a of base) {
    const b = later.get(a.key);
    if (b && changed(a.width, b.width)) {
      problems.push(
        `${a.name}: {"width":${a.width.toFixed(1)}} -> {"width":${b.width.toFixed(1)}}`,
      );
    }
  }
  return problems;
}

/** Whether `inner`'s box lies within `outer`'s, to within the compare tolerance. */
function lies(inner, outer) {
  return (
    inner.left >= outer.left - EPSILON &&
    inner.top >= outer.top - EPSILON &&
    inner.left + inner.width <= outer.left + outer.width + EPSILON &&
    inner.top + inner.height <= outer.top + outer.height + EPSILON
  );
}

const sameBox = (a, b) =>
  !changed(a.left, b.left) &&
  !changed(a.top, b.top) &&
  !changed(a.width, b.width) &&
  !changed(a.height, b.height);

/**
 * One step's changed elements as the problems worth reporting.
 *
 * A change in one place pushes everything below it, so most changed elements are a consequence.
 * A **resized** element (its width or height changed) is reported only when no other resized
 * element lies inside it, and its message folds in the resized elements around it and the
 * moved-only elements at or below its top. A moved-only element with no resized element above it
 * is reported on its own.
 *
 * @param {{ name: string, before: object, after: object, keys?: string[] }[]} changes
 */
export function explainStep(changes) {
  const items = changes.map((c, index) => ({
    ...c,
    index,
    keys: c.keys ?? ["left", "top", "width", "height"],
    resized:
      changed(c.before.width, c.after.width) ||
      changed(c.before.height, c.after.height),
  }));
  const resized = items.filter((c) => c.resized);
  // Two resized elements with the same box: the earlier one is the outer, so one is innermost.
  const inside = (inner, outer) =>
    inner !== outer &&
    lies(inner.after, outer.after) &&
    (!sameBox(inner.after, outer.after) || inner.index > outer.index);
  const leaves = resized.filter(
    (e) => !resized.some((other) => inside(other, e)),
  );
  const grew = new Map(
    leaves.map((e) => [e, resized.filter((o) => inside(e, o)).length]),
  );
  const below = new Map(leaves.map((e) => [e, 0]));
  const alone = [];
  for (const m of items.filter((c) => !c.resized)) {
    const owner = leaves
      .filter((e) => e.before.top <= m.before.top)
      .sort((a, b) => b.before.top - a.before.top)[0];
    if (owner) below.set(owner, below.get(owner) + 1);
    else alone.push(m);
  }
  const text = (e, notes = []) => {
    const note = notes.length ? `; ${notes.join(", ")}` : "";
    return `${e.name}: ${boxText(e.before, e.keys)} -> ${boxText(e.after, e.keys)}${note}`;
  };
  const out = [];
  for (const e of items) {
    if (e.resized && !leaves.includes(e)) continue;
    if (e.resized) {
      const notes = [];
      if (grew.get(e)) notes.push(`+${grew.get(e)} grew around it`);
      if (below.get(e)) notes.push(`+${below.get(e)} below moved`);
      out.push(text(e, notes));
    } else if (alone.includes(e)) {
      out.push(text(e));
    }
  }
  return out;
}

/** The elements whose compared edges or sizes differ, with the keys that were compared. */
function changedElements(base, now, isHandle, pressed) {
  const changes = [];
  base.forEach((a, i) => {
    const b = now[i];
    if (a.key !== b.key) return;
    // A pressed handle grows 8% (its `:active` scale): its own box is skipped
    // while the pointer is down. Everything else is still compared.
    if (a.kind === "control" && isHandle && pressed) return;
    const keys =
      (a.kind === "control" && isHandle) || a.kind === "rider"
        ? ["top", "width", "height"]
        : ["left", "top", "width", "height"];
    if (keys.some((k) => changed(a[k], b[k]))) {
      changes.push({ name: a.name, before: a, after: b, keys });
    }
  });
  return changes;
}

/** Cells first, then the element count and order, then the changed boxes as `explainStep` reads them. */
function compare(allBase, allNow, isHandle, pressed, explain) {
  const problems = diffCells(
    allBase.filter((e) => e.kind === "cell"),
    allNow.filter((e) => e.kind === "cell"),
  );
  const base = allBase.filter((e) => e.kind !== "cell");
  const now = allNow.filter((e) => e.kind !== "cell");
  if (base.length !== now.length) {
    problems.push(`element count ${base.length} -> ${now.length}`);
    return problems;
  }
  for (let i = 0; i < base.length; i++) {
    if (base[i].key !== now[i].key) {
      problems.push(`element ${i}: ${base[i].name} -> ${now[i].name}`);
    }
  }
  problems.push(...explain(changedElements(base, now, isHandle, pressed)));
  return problems;
}

/** The differences between the baseline and a later snapshot, as strings. */
export function diffSnapshots(allBase, allNow, isHandle, pressed = false) {
  return compare(allBase, allNow, isHandle, pressed, explainStep);
}

/**
 * The page moved between the keyboard baseline and the pointer baseline, which the scroll that
 * puts the handle in view must not do. Every changed element is reported, as `scroll: ...`.
 */
export function scrollProblems(keyboardBase, pointerBase, isHandle) {
  return compare(keyboardBase, pointerBase, isHandle, false, (changes) =>
    changes.map(
      (c) =>
        `scroll: ${c.name}: ${boxText(c.before, c.keys)} -> ${boxText(c.after, c.keys)}`,
    ),
  );
}

const DRAG_STEP = /^drag (out|back) (\d+)\/\d+: /;

/**
 * One problem as `{ key, target, step, message }`. A problem reads `<step>: <element>: {..} -> {..}`.
 * The key is the element, so a drag that moves it on every step is one finding; the drag step
 * (`drag out 3/20`) is not part of it, or 40 steps would be 40 findings.
 */
export function dragKey(problem) {
  let rest = problem;
  let step = null;
  const drag = DRAG_STEP.exec(rest);
  if (drag) {
    step = { way: drag[1], n: Number(drag[2]) };
    rest = rest.slice(drag[0].length);
  } else if (rest.startsWith("scroll: ")) {
    step = { way: "scroll", n: 0 };
    rest = rest.slice("scroll: ".length);
  }
  const body = rest.split(": {")[0];
  const at = body.lastIndexOf("): ");
  const element = at === -1 ? body : body.slice(at + 3);
  const keyboard = at === -1 ? null : body.slice(0, at + 1);
  return {
    key: element,
    target: element.replace(/^[a-z]+:/, ""),
    step,
    keyboard,
    message: problem,
  };
}

/**
 * A drag's problems as findings: one per element, with the steps that moved it. A stuck value
 * (`never moved`, `exposes no value`) is a finding of its own, on the widget.
 *
 * @returns {{ key: string, target: string | null, rule: string, message: string }[]}
 */
export function groupDragProblems(problems) {
  const groups = new Map();
  const found = [];
  for (const p of problems) {
    if (/never moved|exposes no value/.test(p)) {
      found.push({
        key: dragKey(p).key,
        target: null,
        rule: "value-not-moved",
        message: p,
      });
      continue;
    }
    const d = dragKey(p);
    if (!groups.has(d.key)) {
      const group = {
        key: d.key,
        target: d.target,
        rule: "readout-moved",
        keyboard: null,
        scroll: null,
        ranges: {},
        index: found.length,
      };
      groups.set(d.key, group);
      found.push(group);
    }
    const group = groups.get(d.key);
    if (d.step?.way === "scroll") group.scroll ??= p.replace(/^scroll: /, "");
    else if (d.step) {
      const range = (group.ranges[d.step.way] ??= [d.step.n, d.step.n]);
      range[0] = Math.min(range[0], d.step.n);
      range[1] = Math.max(range[1], d.step.n);
    } else group.keyboard ??= d.keyboard;
  }
  return found.map((g) => {
    if (g.rule === "value-not-moved") return g;
    const where = [];
    if (g.keyboard) where.push(g.keyboard);
    const ways = ["out", "back"].filter((w) => g.ranges[w]);
    if (ways.length) {
      where.push(
        `drag ${ways.map((w) => `${w} ${g.ranges[w][0]}–${g.ranges[w][1]}`).join(", ")}`,
      );
    }
    const message = g.scroll
      ? `scroll moved ${g.scroll}`
      : `${g.key} moved at ${where.join("; ")}`;
    return { key: g.key, target: g.target, rule: g.rule, message };
  });
}
