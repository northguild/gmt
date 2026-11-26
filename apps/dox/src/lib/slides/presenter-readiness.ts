/**
 * The presenter's readiness list: runs the check (`readiness.ts`) on "Check again" and on the first
 * look, paints each row as it lands and reports how it finished. Only one check runs at a time; a
 * new one stops the last.
 */
import { html, setHtml } from "~/widgets/builders/html";
import { readinessList, readinessPending } from "~/widgets/builders/presenter";
import { loadDeckRuntime } from "~/slides/deck-runtime";
import { runReadiness } from "./readiness";
import { rowLabel, rowOrder, type ReadinessRow } from "./readiness-rows";
import type { AssetRow } from "./stage-data";
import type { DeckEnv } from "./sync";

export function mountPresenterReadiness(o: {
  doc: Document;
  signal: AbortSignal;
  slug: string;
  /** The deck page's address, read for its preloads. */
  deckUrl: string;
  /** The address of `/api/brains`. */
  brainsUrl: string;
  rows: HTMLElement;
  button: HTMLButtonElement;
  /** What the deck window last reported, or `null` while none has. */
  env: () => DeckEnv | null;
  /** The line the check says when it finishes. */
  report: (text: string) => void;
}): { run(): void } {
  const { signal, button } = o;
  let check: AbortController | null = null;
  const found = new Map<string, ReadinessRow>();
  /** The deck's own file lists, from its runtime; known before the first check starts. */
  let assetRows: readonly AssetRow[] = [];
  const runtimeLoaded = loadDeckRuntime(o.slug).then(
    (runtime) => {
      assetRows = runtime?.stage.assetRows ?? [];
    },
    () => {},
  );
  const paintRows = (): void => {
    const order = rowOrder(assetRows);
    const done = order
      .filter((id) => found.has(id))
      .map((id) => found.get(id) as ReadinessRow);
    const waiting = order
      .filter((id) => !found.has(id))
      .map((id) => rowLabel(id, assetRows));
    setHtml(o.rows, html`${readinessList(done)}${readinessPending(waiting)}`);
  };
  const run = (): void => {
    check?.abort();
    const current = new AbortController();
    check = current;
    found.clear();
    paintRows();
    button.disabled = true;
    const live = (): boolean => !current.signal.aborted && !signal.aborted;
    void runtimeLoaded.then(() => {
      if (!live()) return;
      return runReadiness({
        signal: AbortSignal.any([signal, current.signal]),
        assetRows,
        deckUrl: o.deckUrl,
        brainsUrl: o.brainsUrl,
        env: o.env(),
        fonts: ["1em Michroma"],
        fontSet: o.doc.fonts ?? null,
        modules: [
          { name: "unix/get", load: () => import("@northguild/gmt/unix/get") },
          {
            name: "zoned/get",
            load: () => import("@northguild/gmt/zoned/get"),
          },
          {
            name: "zoned/format",
            load: () => import("@northguild/gmt/zoned/format"),
          },
        ],
        onRow(row) {
          if (!live()) return;
          found.set(row.id, row);
          paintRows();
        },
      }).then((all) => {
        if (!live()) return;
        button.disabled = false;
        const failed = all.filter((r) => r.status === "failed").length;
        o.report(
          failed === 0
            ? "Readiness check finished: everything is ready"
            : `Readiness check finished: ${failed} ${failed === 1 ? "item" : "items"} failed`,
        );
      });
    });
  };
  button.addEventListener("click", run, { signal });
  signal.addEventListener("abort", () => check?.abort(), { once: true });
  return { run };
}
