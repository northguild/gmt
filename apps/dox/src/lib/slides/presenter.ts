/**
 * The presenter view's DOM side: the second window on the laptop while the deck runs on the
 * projector. It shows the current slide and its builds, the next slide, the notes, the time since
 * the talk started against the plan, the pace, the local time, the demo's source and the readiness
 * check.
 *
 * The deck window is the one source of truth (`sync.ts`). The presenter never changes its own
 * state while a deck window answers: a key, button or overview link posts a `step`, and the next
 * `state` it hears is what it renders. With no deck window it works as a notes reader and steps
 * through its own copy of the state machine (`deck.ts`).
 *
 * Content: the slides are rendered on the page as a hidden source (`[data-presenter-source]`,
 * from `Deck.astro`); this mount copies the current slide and its notes out of it, without ids.
 *
 * Time: gmt, loaded by dynamic import after first paint (`getUnixNow` for elapsed time,
 * `getZonedNow` and `formatZonedDateTime` for the local time). The tick is one `setTimeout`
 * chained to the next whole second; it stops while the page is hidden and resyncs on return.
 * Elapsed time starts on the first step past the title or on Start.
 *
 * Seconds are never announced. The pace readout announces when it crosses between behind and not
 * behind; the demo readout announces when it switches to `Recorded`.
 */
import { overviewItems } from "~/widgets/builders/deck-controls";
import { html, setHtml } from "~/widgets/builders/html";
import {
  PRESENTER_INITIAL,
  readinessList,
  readinessPending,
} from "~/widgets/builders/presenter";
import { defineElements } from "~/widgets/define";
import type { GmtReadout } from "~/widgets/primitives/readout/readout";
import { loadDeckRuntime } from "~/slides/deck-runtime";
import { createDeck, type DeckSlide } from "./deck";
import { mountKeys } from "./keys";
import type { AssetRow } from "./stage-data";
import {
  elapsedMs,
  formatClock,
  formatPace,
  msToNextSecond,
  pace as paceOf,
  paceTone,
  plannedMsAt,
  type PaceSide,
} from "./pace";
import {
  rowLabel,
  rowOrder,
  runReadiness,
  type ReadinessRow,
} from "./readiness";
import {
  openSync,
  type DeckEnv,
  type DemoState,
  type StepAction,
} from "./sync";

/** The deck's language, for the local time. */
const LOCALE = "en-GB";
/** How long the presenter waits for a deck window to answer `hello` before it says none is open. */
export const DECK_GRACE_MS = 600;

/** gmt's clock, as the presenter uses it. */
interface Clock {
  now(): number;
  localTime(): string;
}

async function loadClock(): Promise<Clock | null> {
  try {
    const [unix, zoned, format] = await Promise.all([
      import("@northguild/gmt/unix/get"),
      import("@northguild/gmt/zoned/get"),
      import("@northguild/gmt/zoned/format"),
    ]);
    const zone = zoned.getSystemTimeZone();
    return {
      now: () => unix.getUnixNow(),
      localTime: () =>
        format.formatZonedDateTime(
          zoned.getZonedNow(zone, { smallestUnit: "minute" }),
          LOCALE,
          { hour: "2-digit", minute: "2-digit" },
        ),
    };
  } catch {
    return null;
  }
}

interface Part {
  el: HTMLElement;
  id: string;
  title: string;
  minutes: number | null;
  spare: boolean;
  builds: HTMLElement[];
  buildCount: number;
}

function readParts(source: HTMLElement): Part[] {
  return Array.from(source.querySelectorAll<HTMLElement>("[data-slide]")).map(
    (el, i) => {
      const minutes = Number(el.dataset["minutes"]);
      const builds = Array.from(
        el.querySelectorAll<HTMLElement>("[data-build]"),
      );
      return {
        el,
        id: el.id || String(i),
        title: el.querySelector("h2")?.textContent?.trim() || el.id,
        minutes:
          Number.isFinite(minutes) && el.dataset["minutes"] ? minutes : null,
        spare: el.hasAttribute("data-spare"),
        builds,
        buildCount: builds.reduce(
          (max, b) => Math.max(max, Number(b.dataset["build"]) || 1),
          0,
        ),
      };
    },
  );
}

/** A copy of `part`'s slide with no ids, notes, wall figures or scripts: safe beside the source. */
function slideCopy(part: Part): HTMLElement {
  const copy = part.el.cloneNode(true) as HTMLElement;
  for (const gone of copy.querySelectorAll(
    "[data-notes], [data-wall-figures], script, link",
  ))
    gone.remove();
  for (const el of [
    copy,
    ...copy.querySelectorAll<HTMLElement>("[id], [aria-labelledby]"),
  ]) {
    el.removeAttribute("id");
    el.removeAttribute("aria-labelledby");
  }
  return copy;
}

/** The speaker notes as nodes: the notes' own heading is dropped, the page has one. */
function notesCopy(part: Part): Node[] {
  const notes = part.el.querySelector<HTMLElement>("[data-notes]");
  if (!notes) return [];
  const copy = notes.cloneNode(true) as HTMLElement;
  copy.querySelector("h3")?.remove();
  for (const el of copy.querySelectorAll("[id]")) el.removeAttribute("id");
  return Array.from(copy.childNodes);
}

export interface PresenterHandle {
  /** The slide shown and how many builds, wherever they came from. */
  readonly state: { slide: number; build: number };
  /** Whether a deck window is answering. */
  readonly connected: boolean;
  destroy(): void;
}

const find = <T extends Element>(
  root: ParentNode,
  selector: string,
): T | null => root.querySelector<T>(selector);

/** Wires the presenter view under `root`. Returns `null` when the page lacks the parts. */
export function mountPresenter(
  root: HTMLElement,
  o: {
    signal: AbortSignal;
    slug: string;
    /** The deck page's address, read for its preloads. */
    deckUrl: string;
    /** The address of `/api/brains`. */
    brainsUrl: string;
  },
): PresenterHandle | null {
  defineElements();
  const doc = root.ownerDocument;
  const win = doc.defaultView;
  const source = find<HTMLElement>(doc, "[data-presenter-source]");
  const stage = find<HTMLElement>(root, "[data-pv-stage]");
  const position = find<HTMLElement>(root, "[data-pv-position]");
  const nextTitle = find<HTMLElement>(root, "[data-pv-next-title]");
  const nextBuild = find<HTMLElement>(root, "[data-pv-next-build]");
  const notes = find<HTMLElement>(root, "[data-pv-notes]");
  const plan = find<HTMLElement>(root, "[data-pv-plan]");
  const status = find<HTMLElement>(root, "[data-pv-status]");
  const rows = find<HTMLElement>(root, "[data-pv-readiness]");
  const readoutOf = (key: string): GmtReadout | null =>
    root.querySelector<GmtReadout>(`[data-pv-cell="${key}"] gmt-readout`);
  const elapsedOut = readoutOf("elapsed");
  const paceOut = readoutOf("pace");
  const timeOut = readoutOf("time");
  const demoOut = readoutOf("demo");
  const paceCell = find<HTMLElement>(root, '[data-pv-cell="pace"]');
  const startButton = find<HTMLButtonElement>(root, "#pv-start");
  const resetButton = find<HTMLButtonElement>(root, "#pv-reset");
  const checkButton = find<HTMLButtonElement>(root, "#pv-check");
  const parts = source ? readParts(source) : [];
  if (
    !win ||
    !stage ||
    !position ||
    !nextTitle ||
    !nextBuild ||
    !notes ||
    !plan ||
    !status ||
    !rows ||
    !elapsedOut ||
    !paceOut ||
    !timeOut ||
    !demoOut ||
    !paceCell ||
    !startButton ||
    !resetButton ||
    !checkButton ||
    parts.length < 2 ||
    o.signal.aborted
  )
    return null;

  const own = new AbortController();
  const signal = AbortSignal.any([o.signal, own.signal]);
  const slides: DeckSlide[] = parts.map((p) => ({
    id: p.id,
    builds: p.buildCount,
    spare: p.spare,
  }));
  const local = createDeck(slides);
  const planSlides = parts.map((p) => ({ minutes: p.minutes }));

  // What the deck window last said, or nothing yet.
  let connected = false;
  let remote = { slide: 0, build: 0 };
  let blanked = false;
  let demo: DemoState = null;
  let env: DeckEnv | null = null;
  let shownSlide = -1;

  const current = (): { slide: number; build: number } =>
    connected ? remote : local.state;

  // The line the page speaks has two parts, so a readiness result does not wipe out the news
  // about the deck window, and the other way round.
  let note = "";
  let checkNote = "";
  const speak = (): void => {
    status.textContent = [note, checkNote].filter(Boolean).join(". ");
  };
  const say = (text: string): void => {
    note = text;
    speak();
  };

  // ---- Time ----
  let clock: Clock | null = null;
  let startMs: number | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastSide: PaceSide | null = null;

  const paint = (): void => {
    plan.textContent = `Plan at the start of this slide: ${formatClock(plannedMsAt(planSlides, current().slide))}`;
    if (!clock) return;
    const now = clock.now();
    timeOut.value = clock.localTime() || PRESENTER_INITIAL.time;
    if (startMs === null) {
      elapsedOut.value = PRESENTER_INITIAL.elapsed;
      paceOut.value = PRESENTER_INITIAL.pace;
      paceCell.dataset["tone"] = "spring";
      lastSide = null;
      return;
    }
    const elapsed = elapsedMs(startMs, now);
    elapsedOut.value = formatClock(elapsed);
    const p = paceOf(plannedMsAt(planSlides, current().slide), elapsed);
    paceOut.value = formatPace(p);
    paceCell.dataset["tone"] = paceTone(p);
    // Announce only when the pace crosses between behind and not behind.
    if (lastSide !== null && (lastSide === "behind") !== (p.side === "behind"))
      paceOut.announce();
    lastSide = p.side;
  };

  const tick = (): void => {
    timer = undefined;
    paint();
    if (clock && !doc.hidden)
      timer = setTimeout(tick, msToNextSecond(clock.now()));
  };
  const restart = (): void => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    if (clock && !doc.hidden) tick();
  };
  doc.addEventListener("visibilitychange", restart, { signal });

  const start = (): void => {
    if (startMs !== null || !clock) return;
    startMs = clock.now();
    startButton.disabled = true;
    restart();
  };

  // ---- The page ----
  const render = (): void => {
    const { slide, build } = current();
    const part = parts[slide];
    if (!part) return;
    if (slide !== shownSlide) {
      shownSlide = slide;
      stage.replaceChildren(slideCopy(part));
      notes.replaceChildren(...notesCopy(part));
      if (!notes.hasChildNodes())
        notes.textContent = "No notes for this slide.";
      const after = parts[slide + 1];
      if (after) {
        nextTitle.textContent = after.title;
        const first = after.builds[0]?.textContent?.replace(/\s+/g, " ").trim();
        nextBuild.textContent = first || "No builds on that slide.";
      } else {
        nextTitle.textContent = "End of the deck";
        nextBuild.textContent = "";
      }
    }
    const copies = Array.from(
      stage.querySelectorAll<HTMLElement>("[data-build]"),
    );
    copies.forEach((el, i) => {
      const reached = (Number(part.builds[i]?.dataset["build"]) || 1) <= build;
      el.dataset["reached"] = String(reached);
      el.inert = !reached;
    });
    position.textContent =
      `Slide ${slide + 1} of ${parts.length}: ${part.title}` +
      (part.buildCount > 0 ? `, build ${build} of ${part.buildCount}` : "") +
      (blanked ? ", screen blanked" : "");
    if (slide > 0 || build > 0) start();
    paint();
  };

  const showDemo = (next: DemoState): void => {
    const before = demo?.source;
    demo = next;
    if (!next) demoOut.setEmpty(PRESENTER_INITIAL.demo);
    else
      demoOut.value =
        next.source === "live"
          ? "Live"
          : next.source === "recorded"
            ? "Recorded"
            : "Waiting";
    if (next?.source === "recorded" && before !== "recorded")
      demoOut.announce();
  };

  // The clock loads after first paint; until then the readouts hold their first values.
  void loadClock().then((loaded) => {
    if (signal.aborted) return;
    clock = loaded;
    if (!clock) {
      say("The clock could not load: reload this page");
      return;
    }
    // A talk that began before the clock loaded starts now.
    if (current().slide > 0 || current().build > 0) start();
    restart();
  });

  // ---- Sync ----
  const link = openSync(o.slug, {
    signal,
    onMessage(message) {
      if (message.type === "state") {
        const first = !connected;
        connected = true;
        remote = { slide: message.slide, build: message.build };
        blanked = message.blanked;
        env = message.env;
        showDemo(message.demo);
        if (first) say("Deck window connected");
        render();
      } else if (message.type === "bye" && connected) {
        connected = false;
        // Carry on from where the deck stopped.
        local.goTo(remote.slide, remote.build);
        say("Deck window closed: stepping here only");
        render();
      }
    },
  });
  if (!link)
    say("This browser cannot reach the deck window: stepping here only");

  const stepLocally: Record<StepAction, (n?: number) => boolean> = {
    next: () => local.next(),
    prev: () => local.prev(),
    nextSlide: () => local.nextSlide(),
    prevSlide: () => local.prevSlide(),
    first: () => local.first(),
    last: () => local.last(),
    goTo: (n) => local.goTo((n ?? 1) - 1),
    blank: () => {
      blanked = !blanked;
      return true;
    },
    home: () => false,
  };

  const step = (action: StepAction, n?: number): void => {
    if (connected && link) {
      link.post(
        n === undefined
          ? { type: "step", action }
          : { type: "step", action, n },
      );
      return;
    }
    if (stepLocally[action](n)) render();
  };

  // ---- Readiness ----
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
    setHtml(rows, html`${readinessList(done)}${readinessPending(waiting)}`);
  };
  const runCheck = (): void => {
    check?.abort();
    const run = new AbortController();
    check = run;
    found.clear();
    paintRows();
    checkButton.disabled = true;
    const live = (): boolean => !run.signal.aborted && !signal.aborted;
    void runtimeLoaded.then(() => {
      if (!live()) return;
      return runReadiness({
        signal: AbortSignal.any([signal, run.signal]),
        assetRows,
        deckUrl: o.deckUrl,
        brainsUrl: o.brainsUrl,
        env,
        fonts: ["1em Michroma"],
        fontSet: doc.fonts ?? null,
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
        checkButton.disabled = false;
        const failed = all.filter((r) => r.status === "failed").length;
        checkNote =
          failed === 0
            ? "Readiness check finished: everything is ready"
            : `Readiness check finished: ${failed} ${failed === 1 ? "item" : "items"} failed`;
        speak();
      });
    });
  };
  checkButton.addEventListener("click", runCheck, { signal });

  // The deck gets a moment to answer `hello`; then the presenter says whether one did.
  const grace = setTimeout(() => {
    if (!connected) say("Deck window not open: stepping here only");
    runCheck();
  }, DECK_GRACE_MS);
  signal.addEventListener("abort", () => clearTimeout(grace), { once: true });
  link?.post({ type: "hello" });

  // ---- Buttons ----
  const click = (selector: string, fn: () => void): void =>
    root.querySelector(selector)?.addEventListener("click", fn, { signal });
  click("#pv-prev", () => step("prev"));
  click("#pv-next", () => step("next"));
  click("#pv-blank", () => step("blank"));
  startButton.addEventListener("click", start, { signal });

  // Reset takes two presses; leaving the button gives the first one back.
  let confirming = false;
  const disarm = (): void => {
    confirming = false;
    resetButton.textContent = "Reset";
  };
  resetButton.addEventListener(
    "click",
    () => {
      if (!confirming) {
        confirming = true;
        resetButton.textContent = "Confirm reset";
        say("Press Confirm reset to start the timer again from zero");
        return;
      }
      disarm();
      startMs = null;
      lastSide = null;
      startButton.disabled = false;
      say("Timer reset: it starts on the next step or on Start");
      paint();
    },
    { signal },
  );
  resetButton.addEventListener("blur", disarm, { signal });

  // ---- Dialogs: the overview and the keys, the same two the deck has ----
  const dialogOf = (name: string): HTMLDialogElement | null =>
    doc.querySelector<HTMLDialogElement>(`dialog[data-deck-dialog="${name}"]`);
  const overview = dialogOf("overview");
  const help = dialogOf("help");
  const list =
    overview?.querySelector<HTMLElement>("[data-deck-overview]") ?? null;
  const spareSection = overview?.querySelector<HTMLElement>(
    "[data-deck-overview-spares]",
  );
  const spareList = overview?.querySelector<HTMLElement>(
    "[data-deck-overview-spare]",
  );
  const items = (spare: boolean) =>
    overviewItems(
      parts
        .filter((p) => p.spare === spare)
        .map((p) => ({ id: p.id, title: p.title, minutes: p.minutes })),
    );
  if (list) setHtml(list, items(false));
  const hasSpares = parts.some((p) => p.spare);
  if (spareList) {
    setHtml(spareList, items(true));
    spareList.hidden = !hasSpares;
  }
  if (spareSection) spareSection.hidden = !hasSpares;
  let opener: HTMLElement | null = null;
  const open = (d: HTMLDialogElement | null): void => {
    if (!d || d.open) return;
    opener =
      doc.activeElement instanceof HTMLElement ? doc.activeElement : null;
    d.showModal();
    if (d === overview) {
      const links = Array.from(
        d.querySelectorAll<HTMLAnchorElement>("a[data-deck-goto]"),
      );
      links.forEach((a, i) => {
        if (i === current().slide) a.setAttribute("aria-current", "true");
        else a.removeAttribute("aria-current");
      });
      links[current().slide]?.focus();
    }
  };
  for (const d of [overview, help]) {
    d?.addEventListener(
      "close",
      () => {
        if (opener?.isConnected) opener.focus();
        opener = null;
      },
      { signal },
    );
    d?.querySelector<HTMLElement>('[id$="-close"]')?.addEventListener(
      "click",
      () => d.close(),
      { signal },
    );
  }
  list?.addEventListener(
    "click",
    (event) => {
      const a = (event.target as Element).closest<HTMLAnchorElement>(
        "a[data-deck-goto]",
      );
      if (!a) return;
      event.preventDefault();
      overview?.close();
      const index = slides.findIndex((s) => s.id === a.dataset["deckGoto"]);
      if (index >= 0) step("goTo", index + 1);
    },
    { signal },
  );
  click("#pv-overview", () => open(overview));
  click("#pv-help", () => open(help));

  // ---- Keys: the deck's table, sending steps; a clicker works in either window ----
  const deckOnly = (): void => say("That is for the deck window");
  mountKeys(doc, {
    signal,
    actions: {
      step: (delta) => step(delta === 1 ? "next" : "prev"),
      slide: (delta) => step(delta === 1 ? "nextSlide" : "prevSlide"),
      first: () => step("first"),
      last: () => step("last"),
      goTo: (n) => step("goTo", n),
      overview: () => open(overview),
      help: () => open(help),
      blank: () => step("blank"),
      fullscreen: deckOnly,
      present: deckOnly,
      presenter: () => say("This is the presenter view"),
      fly: () => {},
      home: () => step("home"),
    },
  });

  render();

  signal.addEventListener(
    "abort",
    () => {
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
      check?.abort();
      for (const d of [overview, help]) if (d?.open) d.close();
    },
    { once: true },
  );

  return {
    get state() {
      const { slide, build } = current();
      return { slide, build };
    },
    get connected() {
      return connected;
    },
    destroy: () => own.abort(),
  };
}
