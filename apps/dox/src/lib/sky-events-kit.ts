/**
 * The loader and the popover list of the sky's events (`sky-events.ts` holds their words). The
 * data (`src/assets/sky-events.json`) and the gmt functions that format it are lazy chunks, asked
 * for on the first `pointerenter`, `focus` or `toggle` of the info button or of the Look at button
 * (`askEvents`), never at first paint; `eventsKit` is the loaded kit, or null until it has
 * arrived. The list is drawn on each open, and while open one timer runs to the next moment a row
 * changes (a spell's start or end) and draws again; closing or the sky's end clears it.
 */
import { html, setHtml, type SafeHtml } from "~/widgets/builders";
import styles from "~/widgets/tools/sky-events.module.css";
import {
  nextEdge,
  readerLocale,
  skyEventRows,
  type EventRow,
  type EventsKit,
} from "./sky-events";
import { loadClock } from "./space-sky";

let kit: EventsKit | null = null;
let asked: Promise<EventsKit | null> | undefined;

/** The kit once `askEvents` has resolved, else null. */
export const eventsKit = (): EventsKit | null => kit;

/** Loads the data and the formatters once; a failure answers null and lets the next ask try again. */
export function askEvents(): Promise<EventsKit | null> {
  return (asked ??= Promise.all([
    import("../assets/sky-events.json?raw"),
    import("@northguild/gmt/unix/format"),
    import("@northguild/gmt/unix/compare"),
    import("@northguild/gmt/unix/convert"),
    loadClock(),
  ]).then(
    ([data, format, compare, convert, clock]) =>
      (kit = {
        data: JSON.parse(data.default),
        lib: {
          formatUnix: format.formatUnix,
          areUnixEqualBy: compare.areUnixEqualBy,
          convertUnixToUtc: convert.convertUnixToUtc,
        },
        zone: {
          locale: readerLocale(globalThis.navigator?.languages ?? []),
          timeZone: clock.getSystemTimeZone(),
        },
      }),
    () => {
      asked = undefined;
      return null;
    },
  ));
}

/** `setTimeout` keeps a delay in 31 bits; a longer wait comes round again and waits on. */
const LONGEST_WAIT = 2 ** 31 - 1;

const row = (kit: EventsKit, { name, segments }: EventRow): SafeHtml =>
  html`<li><strong>${name}</strong> · ${segments.map((segment) =>
    typeof segment === "string"
      ? segment
      : html`<time datetime="${kit.lib.convertUnixToUtc(segment.ms)}">${segment.text}</time>`,
  )}</li>`;

/** What the landing hands the info popover (`dataCredits`' `label` and `lead`): its name, and an empty, hidden place for the list. */
export const skyEventsInfo = (): { label: string; lead: SafeHtml } => ({
  label: "About this sky",
  lead: html`<div class="${styles.events}" data-sky-events hidden></div>`,
});

/**
 * Keeps the list that `skyEventsInfo` put under `root`: asks for the data when the info button is
 * reached, draws the rows on each open, and redraws at the next edge while open.
 */
export function mountSkyEvents(root: ParentNode, signal: AbortSignal): void {
  const found = root.querySelector<HTMLElement>("[data-sky-events]");
  if (!found) return;
  const list: HTMLElement = found;
  const panel = list.closest<HTMLElement>("[popover]");
  const button =
    panel && list.ownerDocument.querySelector(`[popovertarget="${panel.id}"]`);
  if (!panel || !button) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let open = false;

  const stop = (): void => clearTimeout(timer);
  async function draw(): Promise<void> {
    stop();
    const [loaded, clock] = await Promise.all([askEvents(), loadClock()]);
    if (!loaded || !open || signal.aborted) return;
    stop();
    const now = clock.getUnixNow();
    const { rows, note } = skyEventRows(loaded, now);
    setHtml(
      list,
      html`<h2 class="${styles.title}">Coming up in the sky</h2>${rows.length ? html`<ul class="${styles.rows}">${rows.map((r) => row(loaded, r))}</ul>` : ""}<p class="${styles.note}">${note}</p>`,
    );
    list.hidden = false;
    const edge = nextEdge(loaded.data, now);
    if (edge !== null)
      timer = setTimeout(() => void draw(), Math.min(edge - now, LONGEST_WAIT));
  }

  const ask = (): void => void askEvents();
  for (const type of ["pointerenter", "focus"])
    button.addEventListener(type, ask, { signal });
  panel.addEventListener(
    "toggle",
    (event) => {
      open = (event as ToggleEvent).newState === "open";
      if (open) void draw();
      else stop();
    },
    { signal },
  );
  signal.addEventListener("abort", stop, { once: true });
}
