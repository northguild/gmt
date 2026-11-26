/**
 * The cell-content check `table-fit.mjs` runs: no piece of a table cell reaches outside its cell.
 *
 * A table that scrolls is allowed to, but a cell whose text spills across the next cell, or is cut
 * by the cell's own clip, is read wrong whether or not the table scrolls. `measureCells` runs in the
 * page. It opens every `<details>` and tab panel, then for each cell of each `main table` that is
 * drawn it reports the cell when its own scroll box is larger than its client box (more than 1 px),
 * or when any element or text inside it reaches more than 1.5 px past the cell's edges. A cell
 * that is visually hidden, or sits in a visually hidden row or header (a box of 2 px or less, which
 * a stacked layout keeps for assistive technology), is not drawn and is skipped. So is anything
 * inside a visually hidden descendant of the cell (a box of 2 px or less that also clips: not
 * `overflow: visible`, a `clip-path`, or a `clip`, as `.gmt-sr-only` does), because a text range
 * ignores clipping and would report a label nothing paints.
 *
 * It is a plain function with no closure, so Playwright can serialise it: `page.evaluate(measureCells)`.
 */
export function measureCells() {
  for (const d of document.querySelectorAll("details")) d.open = true;
  for (const p of document.querySelectorAll("[role=tabpanel][hidden]")) {
    p.removeAttribute("hidden");
  }
  const found = [];
  /** A box of 2 px or less in either dimension that clips what it holds: nothing in it is drawn. */
  const clipsAway = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width > 2 && r.height > 2) return false;
    const cs = getComputedStyle(el);
    return (
      cs.overflowX !== "visible" ||
      cs.overflowY !== "visible" ||
      (cs.clipPath !== "none" && cs.clipPath !== "") ||
      (cs.clip !== "auto" && cs.clip !== "")
    );
  };
  for (const table of document.querySelectorAll("main table")) {
    for (const cell of table.querySelectorAll("th, td")) {
      const box = cell.getBoundingClientRect();
      if (box.width === 0) continue;
      let hidden = false;
      for (let el = cell; el && el !== table; el = el.parentElement) {
        const r = el.getBoundingClientRect();
        if (r.width <= 2 || r.height <= 2) {
          hidden = true;
          break;
        }
      }
      if (hidden) continue;
      const reasons = [];
      if (cell.scrollWidth - cell.clientWidth > 1) {
        reasons.push(
          `its content is ${cell.scrollWidth}px wide in a ${cell.clientWidth}px cell`,
        );
      }
      if (cell.scrollHeight - cell.clientHeight > 1) {
        reasons.push(
          `its content is ${cell.scrollHeight}px tall in a ${cell.clientHeight}px cell`,
        );
      }
      const walker = document.createTreeWalker(cell, NodeFilter.SHOW_ALL);
      let worst = 0;
      let what = "";
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        let r;
        let away = false;
        for (
          let el = node.nodeType === 1 ? node : node.parentElement;
          el && el !== cell;
          el = el.parentElement
        ) {
          if (clipsAway(el)) {
            away = true;
            break;
          }
        }
        if (away) continue;
        if (node.nodeType === 1) {
          if (getComputedStyle(node).display === "none") continue;
          r = node.getBoundingClientRect();
        } else if (node.nodeType === 3 && node.textContent.trim()) {
          const range = document.createRange();
          range.selectNodeContents(node);
          r = range.getBoundingClientRect();
        } else continue;
        if (r.width === 0 && r.height === 0) continue;
        const past = Math.max(
          r.right - box.right,
          box.left - r.left,
          r.bottom - box.bottom,
          box.top - r.top,
        );
        if (past > worst) {
          worst = past;
          what =
            node.nodeType === 1
              ? node.tagName.toLowerCase()
              : `"${node.textContent.trim().slice(0, 40)}"`;
        }
      }
      if (worst > 1.5) {
        reasons.push(`${what} reaches ${Math.round(worst)}px past the cell`);
      }
      if (reasons.length > 0) {
        found.push({
          cell: cell.textContent.trim().slice(0, 40),
          headers: [...table.querySelectorAll("th")]
            .slice(0, 3)
            .map((th) => th.textContent.trim()),
          reasons,
        });
      }
    }
  }
  return found;
}
