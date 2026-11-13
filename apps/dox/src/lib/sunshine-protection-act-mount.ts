/**
 * The Sunshine Protection Act page's widget (CORE-90): a map of the US time zones as the tz data
 * has them today, and a second view of each state's adopted position on ending the clock changes,
 * with a panel of what the national proposal would do and the guidance cards below.
 *
 * Today's classes come from one `GET /gmt/api/sunshine-protection-act` answer, computed on the
 * Worker with the library, so every reader sees the same map. The Proposals view is data
 * (`data/sunshine-protection-act-proposals.ts`), dated and read in effects only. The page starts no
 * timers: "Next change" is worded from the instant the Worker answered.
 *
 * `renderSunshineProtectionActTemplate()` is pure markup, so the server writes every list, panel
 * and card and nothing grows when the answer arrives. The chat's copy leaves out the guidance
 * cards. The maps are drawn by `wireFeatureMap`; the Proposals map is fetched only when its view is
 * first shown. The map takes the full width of the page (`widgets/families/clockcheck/us-map.ts`).
 */
import {
  US_GUIDANCE,
  US_GUIDANCE_HEADING,
} from "../data/sunshine-protection-act-guidance";
import {
  NATIONAL,
  PROPOSALS_CHECKED,
  SOURCES_URL,
  STATES,
  STATE_CODES,
  ageWords,
  longDate,
  type StateRow,
} from "../data/sunshine-protection-act-proposals";
import { changeText, cityOf, signedOffset } from "./clock-change-common";
import { ask } from "./clock-change-mount";
import { COASTLINES, STATE_BOUNDARIES, TZ_BOUNDARIES } from "./data-credits";
import {
  MAP_WIDTH,
  wireFeatureMap,
  type FeatureMapConfig,
  type FeatureMapHandle,
} from "./feature-map";
import { GMT_MODULES } from "./gmt-modules";
import { withBase } from "./site";
import {
  geoUsComposite,
  US_LAYOUT_BOTTOM,
  type UsComposite,
} from "./us-projection";
import usZones from "./us-region-zones.json";
import stateNames from "./us-state-names.json";
import {
  WidgetLoadError,
  onceDestroy,
  showUnavailable,
  type MountFn,
} from "./widget-mount";
import { offsetWords } from "./zone-map";
import type {
  SunshineActZones,
  WatchZone,
} from "../../worker/sunshine-protection-act";
import {
  findWidget,
  html,
  idScope,
  setHtml,
  widget,
  type FoundWidget,
  type SafeHtml,
} from "~/widgets/builders";
import { infoCard } from "~/widgets/families/clockcheck/info-card";
import { keyPoints } from "~/widgets/families/clockcheck/key-points";
import { stack } from "~/widgets/families/clockcheck/stack";
import {
  usLegend,
  usStatus,
  usView,
  usViews,
  usRowParts,
  type UsListItem,
} from "~/widgets/families/clockcheck/us-map";
import { EMPTY, viewSwitch } from "~/widgets/families/clockcheck/zone-map";

const NAME = "sunshine-protection-act";

// ---------------------------------------------------------------------------
// The map's box
// ---------------------------------------------------------------------------

/**
 * The composite projection's layout is in units of the lower 48's scale `k`: the lower 48 are
 * 0.91 k wide, and the strip of insets and the band under it end `US_LAYOUT_BOTTOM` below their centre. `k` fits that
 * width into the drawing's 800 with an 8 px margin, so the box's height is the layout's own:
 * landscape, and reserved before the file arrives.
 */
const MARGIN = 8;
const SCALE = (MAP_WIDTH - 2 * MARGIN) / 0.91;
const TRANSLATE: [number, number] = [MAP_WIDTH / 2, MARGIN + 0.238 * SCALE];
export const MAP_HEIGHT = Math.round(
  MARGIN + US_LAYOUT_BOTTOM * SCALE + TRANSLATE[1] - MARGIN,
);

const projection = () => geoUsComposite().scale(SCALE).translate(TRANSLATE);

// ---------------------------------------------------------------------------
// Classes and words
// ---------------------------------------------------------------------------

type TodayKind = "changes" | "standard-all-year" | "no-data";
type ProposalKind =
  | "standard-all-year"
  | "daylight-if-allowed"
  | "daylight-conditional"
  | "standard-proposed"
  | "no-position";

export const TODAY_WORDS: Readonly<Record<TodayKind, string>> = {
  changes: "Still changes clocks",
  "standard-all-year": "Never changes clocks",
  "no-data": "No data",
};

export const PROPOSAL_WORDS: Readonly<Record<ProposalKind, string>> = {
  "standard-all-year": "Already on standard time all year",
  "daylight-if-allowed": "Daylight time all year if federal law changes",
  "daylight-conditional":
    "Daylight time all year, only if the state's conditions are met",
  "standard-proposed": "Standard time all year proposed",
  "no-position": "No adopted position",
};

const TODAY_ORDER: readonly TodayKind[] = [
  "changes",
  "standard-all-year",
  "no-data",
];
const PROPOSAL_ORDER: readonly ProposalKind[] = [
  "daylight-if-allowed",
  "daylight-conditional",
  "standard-proposed",
  "standard-all-year",
  "no-position",
];

const NAMES = stateNames as Readonly<Record<string, string>>;
const rowOf = (postal: string): StateRow | undefined =>
  STATES.find((row) => row.postal === postal);

export function proposalKind(postal: string): ProposalKind {
  const row = rowOf(postal);
  if (row === undefined) return "no-position";
  if (row.kind === "territory") return "standard-all-year";
  if (row.position === "daylight-if-allowed")
    return row.condition === null
      ? "daylight-if-allowed"
      : "daylight-conditional";
  return row.position;
}

const todayKind = (row: WatchZone | undefined): TodayKind =>
  row === undefined
    ? "no-data"
    : row.observes
      ? "changes"
      : "standard-all-year";

/** The national card's dated line: the day the facts were checked, and how old that is. */
const nationalAge = (today: string | null): string => {
  const line =
    today === null
      ? longDate(PROPOSALS_CHECKED)
      : `${longDate(PROPOSALS_CHECKED)}, ${ageWords(today)}`;
  return `Last checked on ${line}${line.endsWith(".") ? "" : "."}`;
};

const TODAY_PLACEHOLDER = "Press a place to pin it.";
const PROPOSALS_PLACEHOLDER = "Press a state to pin it.";
const stateName = (postal: string): string => NAMES[postal] ?? postal;
/** The names too long for a label inside an inset's card. */
const SHORT_NAMES: Readonly<Record<string, string>> = { AS: "Am. Samoa" };

// ---------------------------------------------------------------------------
// Template
// ---------------------------------------------------------------------------

const countOf =
  <K extends string>(of: readonly K[]): ((kind: K) => number) =>
  (kind) =>
    of.filter((k) => k === kind).length;

const todayItems = (): UsListItem[] =>
  usZones.zones.map((zone) => ({
    id: zone,
    name: zone,
    kind: "no-data",
    words: TODAY_WORDS["no-data"],
  }));

const proposalItems = (): UsListItem[] =>
  [...STATE_CODES]
    .sort((a, b) => stateName(a).localeCompare(stateName(b), "en"))
    .map((postal) => {
      const kind = proposalKind(postal);
      return {
        id: postal,
        name: stateName(postal),
        kind,
        words: PROPOSAL_WORDS[kind],
      };
    });

export interface SunshineActTemplateOptions {
  /** Namespaces every id, so the chat's copy cannot collide with a page's. */
  idPrefix?: string;
  /** Draws the guidance cards below the views. The page does; the chat rail does not. */
  guidance?: boolean;
}

export function renderSunshineProtectionActTemplate({
  idPrefix = "sunshine",
  guidance = false,
}: SunshineActTemplateOptions = {}): SafeHtml {
  const today = `${idPrefix}-today`;
  const proposals = `${idPrefix}-proposals`;
  const proposalCount = countOf(STATE_CODES.map(proposalKind));
  const caption =
    "Insets are not to scale. Midway and Wake are listed but not drawn, and neither are the Northern Mariana Islands north of Saipan.";
  return widget(
    {
      name: NAME,
      label: "US clock changes",
      scope: idPrefix,
    },
    stack(
      html`${viewSwitch({
        id: `${idPrefix}-view`,
        legend: "Show",
        options: [
          { value: "today", label: "Today", checked: true },
          { value: "proposals", label: "Proposals" },
        ],
      })}${usStatus(`${idPrefix}-status`)}${usViews([
        {
          id: `${idPrefix}-today-view`,
          hidden: false,
          body: usView({
            scope: today,
            mapTitle: "US time zones today",
            pickTitle: "Pick a time zone",
            hint: "Each zone is in one class. Press a zone to pin its offset and its last and next change.",
            listLabel: "US time zones, scrollable list",
            items: todayItems(),
            mapHeight: MAP_HEIGHT,
            legend: usLegend(today, [
              ...TODAY_ORDER.map((kind) => ({
                kind,
                text: TODAY_WORDS[kind],
                count: null,
              })),
              {
                kind: "navajo",
                text: "Navajo Nation, in Arizona: still changes clocks",
                count: null,
                uncounted: true,
              },
            ]),
            caption,
            pin: {
              nameLabel: "Place",
              placeholder: TODAY_PLACEHOLDER,
              startKind: "no-data",
              fields: [
                { key: "offset", label: "Offset now", size: "row" },
                { key: "last", label: "Last change", size: "wide" },
                { key: "next", label: "Next change", size: "wide" },
              ],
            },
          }),
        },
        {
          id: `${idPrefix}-proposals-view`,
          hidden: true,
          body: html`${usView({
            scope: proposals,
            mapTitle: "US states and what they have adopted",
            pickTitle: "Pick a state",
            hint: "Each state is in one class. Press a state to pin its position and what it depends on.",
            listLabel: "US states and territories, scrollable list",
            items: proposalItems(),
            mapHeight: MAP_HEIGHT,
            legend: usLegend(proposals, [
              ...PROPOSAL_ORDER.map((kind) => ({
                kind,
                text: PROPOSAL_WORDS[kind],
                count: proposalCount(kind),
              })),
              {
                kind: "navajo",
                text: "Navajo Nation, in Arizona: keeps daylight time",
                count: null,
                uncounted: true,
              },
            ]),
            caption,
            pin: {
              nameLabel: "State",
              placeholder: PROPOSALS_PLACEHOLDER,
              startKind: "no-position",
              fields: [
                { key: "position", label: "Position", size: "wide" },
                { key: "since", label: "Adopted", size: "row" },
                { key: "asof", label: "As of", size: "long" },
                { key: "condition", label: "Condition", size: "long" },
                { key: "note", label: "Note", size: "long" },
              ],
            },
          })}`,
        },
      ])}${infoCard({
        idPrefix,
        name: "national",
        title: "What the national proposal would do",
        lines: NATIONAL.effects,
        after: html`<p id="${idPrefix}-national-age">${nationalAge(null)}</p>
                <p>
                  <a href="${SOURCES_URL}" rel="noopener noreferrer">Sources</a>
                </p>`,
        gate: "national",
      })}${guidance ? keyPoints(idPrefix, US_GUIDANCE, US_GUIDANCE_HEADING) : ""}`,
    ),
  );
}

/** The chat's markup: the page's views, with ids namespaced by `idPrefix` and no guidance cards. */
export function renderSunshineProtectionActWidgetTemplate(
  idPrefix: string,
): SafeHtml {
  return renderSunshineProtectionActTemplate({ idPrefix });
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

export type SunshineActView = "today" | "proposals";

/** The view a link or a tool call opens, and the place it pins. */
export type SunshineActSeed =
  | { kind: "today"; zone?: string }
  | { kind: "proposals"; state?: string };

export interface SunshineActDeps {
  /** The fetch for the Worker and the boundary files. Tests pass a fake. */
  fetch: typeof fetch;
  /** The map section's width in px. Defaults to a layout measure. */
  measure?: () => number;
  /** Today's date, `YYYY-MM-DD`. Defaults to the library's `getToday`, loaded after first paint. */
  today: () => Promise<string>;
}

export interface SunshineActHandle {
  /** Shows a view. Each view keeps its own pin. No focus moves. */
  setView(kind: SunshineActView): void;
  /** Pins a place in the current view, or clears the pin with `null`; false for an id not listed. */
  pin(id: string | null): boolean;
  /** The view and pin as a seed, for a permalink. */
  state(): SunshineActSeed;
  /** Resolves once the Worker has answered, the date is read and the shown map has settled. */
  ready: Promise<void>;
  destroy(): void;
}

const loadToday = async (): Promise<string> => {
  const module = await GMT_MODULES["plain/get"]!();
  return (module as { getToday: () => string }).getToday();
};

export async function mountSunshineProtectionAct(
  el: HTMLElement,
  signal: AbortSignal,
  seed?: SunshineActSeed,
  deps: Partial<SunshineActDeps> = {},
): Promise<SunshineActHandle> {
  const own = new AbortController();
  if (signal.aborted) own.abort();
  else signal.addEventListener("abort", () => own.abort(), { once: true });
  const life = own.signal;

  const w = findWidget(el, NAME);
  const idPrefix = w.el.dataset["scope"] ?? "sunshine";
  const fetchFn = deps.fetch ?? fetch;

  const scoped = (view: SunshineActView): FoundWidget => {
    const id = idScope(`${idPrefix}-${view}`);
    return {
      el: w.el,
      id,
      part: <T extends Element = HTMLElement>(local: string): T => {
        const found = w.el.querySelector<T>(`[id="${CSS.escape(id(local))}"]`);
        if (found === null)
          throw new Error(`no ${local} part in the ${NAME} widget`);
        return found;
      },
    };
  };
  const todayW = scoped("today");
  const proposalsW = scoped("proposals");
  const status = w.part(`status`);
  const sections = {
    today: w.part(`today-view`),
    proposals: w.part(`proposals-view`),
  };
  const switchEl = w.part<HTMLFieldSetElement>("view");

  let view: SunshineActView = "today";
  let rows = new Map<string, WatchZone>();
  let answerNow = "";
  let todayDate: string | null = null;

  const text = (view_: FoundWidget, local: string, value: string): void => {
    view_.part(local).textContent = value;
  };

  // --- the Today pin ------------------------------------------------------
  function fillTodayPin(id: string | null): void {
    const row = id === null ? undefined : rows.get(id);
    const kind = id === null ? "no-data" : todayKind(row);
    const name = todayW.part("pin-name");
    if (id === null) name.textContent = TODAY_PLACEHOLDER;
    else setHtml(name, html`${cityOf(id)} <code>${id}</code>`);
    todayW.part("pin-swatch").dataset["kind"] = kind;
    text(todayW, "pin-class", id === null ? EMPTY : TODAY_WORDS[kind]);
    const year = Number(answerNow.slice(0, 4));
    text(
      todayW,
      "pin-offset",
      row === undefined ? EMPTY : offsetWords(row.offset),
    );
    text(
      todayW,
      "pin-last",
      row === undefined
        ? EMPTY
        : changeText(row.last, `${year - 1} or ${year}`),
    );
    text(
      todayW,
      "pin-next",
      row === undefined
        ? EMPTY
        : changeText(row.next, `${year} or ${year + 1}`),
    );
    text(
      todayW,
      "pin-announce",
      id === null ? "" : `${cityOf(id)}: ${TODAY_WORDS[kind]}`,
    );
  }

  // --- the Proposals pin --------------------------------------------------
  function fillProposalsPin(id: string | null): void {
    const row = id === null ? undefined : rowOf(id);
    const kind = id === null ? "no-position" : proposalKind(id);
    text(
      proposalsW,
      "pin-name",
      id === null ? PROPOSALS_PLACEHOLDER : stateName(id),
    );
    proposalsW.part("pin-swatch").dataset["kind"] = kind;
    text(proposalsW, "pin-class", id === null ? EMPTY : PROPOSAL_WORDS[kind]);
    text(
      proposalsW,
      "pin-position",
      id === null ? EMPTY : PROPOSAL_WORDS[kind],
    );
    text(
      proposalsW,
      "pin-since",
      row?.kind === "adopted"
        ? `${row.measure === "law" ? "Law" : "Resolution"}, ${row.year}`
        : EMPTY,
    );
    text(
      proposalsW,
      "pin-asof",
      id === null
        ? EMPTY
        : todayDate === null
          ? longDate(PROPOSALS_CHECKED)
          : `${longDate(PROPOSALS_CHECKED)}, ${ageWords(todayDate)}`,
    );
    text(
      proposalsW,
      "pin-condition",
      id === null
        ? EMPTY
        : row !== undefined && "condition" in row && row.condition !== null
          ? row.condition
          : row === undefined
            ? EMPTY
            : "None stated",
    );
    text(
      proposalsW,
      "pin-note",
      row !== undefined && "note" in row && row.note !== null
        ? row.note
        : EMPTY,
    );
    text(
      proposalsW,
      "pin-announce",
      id === null ? "" : `${stateName(id)}: ${PROPOSAL_WORDS[kind]}`,
    );
  }

  const pins: Record<SunshineActView, string | null> = {
    today: null,
    proposals: null,
  };
  // --- the maps -----------------------------------------------------------
  // Each inset's frame pins its first place when pressed, so a small inset is easy to hit.
  const insetPlaces: Record<
    "today" | "proposals",
    Record<string, readonly string[]>
  > = {
    today: {
      alaska: [
        "America/Anchorage",
        "America/Juneau",
        "America/Sitka",
        "America/Metlakatla",
        "America/Yakutat",
        "America/Nome",
        "America/Adak",
      ],
      hawaii: ["Pacific/Honolulu"],
      puertoRico: ["America/Puerto_Rico", "America/St_Thomas"],
      marianas: ["Pacific/Guam", "Pacific/Saipan"],
      samoa: ["Pacific/Pago_Pago"],
    },
    proposals: {
      alaska: ["AK"],
      hawaii: ["HI"],
      puertoRico: ["PR", "VI"],
      marianas: ["GU", "MP"],
      samoa: ["AS"],
    },
  };
  const framesOf = (view: "today" | "proposals") => (p: unknown) =>
    Object.entries((p as UsComposite).frames())
      .filter(([name]) => name !== "lower48")
      .map(([name, box]) => ({
        box,
        ids: insetPlaces[view][name] ?? [],
      }));
  // A label sits in the band along the top of its card, the same on every card.
  const labelAtFor =
    (view: "today" | "proposals") => (p: unknown, id: string) => {
      const points = (p as UsComposite).labelPoints();
      const part = Object.keys(insetPlaces[view]).find(
        (name) => insetPlaces[view][name]![0] === id,
      );
      return part === undefined ? null : points[part as keyof typeof points];
    };
  const common = {
    height: MAP_HEIGHT,
    projection,
    creditsCorner: "corner" as const,
    toggle: true,
    keyboard: "shapes" as const,
    markerMinPx: 10,
  };

  const todayConfig: FeatureMapConfig = {
    ...common,
    idPrefix: `${idPrefix}-today`,
    frames: framesOf("today"),
    labelAt: labelAtFor("today"),
    boundariesUrl: withBase("/timezone-boundaries-us.json"),
    featureKey: "tzid",
    classOf: (id) => todayKind(rows.get(id)),
    nameOf: (id) => cityOf(id),
    // The same two lines as Canada's labels: the city, and under it the UTC offset now. The offset
    // is empty until the Worker answers, so the label keeps its size.
    labelOf: (id) => ({
      city: cityOf(id),
      offset: rows.has(id) ? signedOffset(rows.get(id)!.offset) : "",
    }),
    shapeLabel: (id) =>
      `${cityOf(id)}, ${TODAY_WORDS[todayKind(rows.get(id))]}`,
    onPin: (id) => {
      pins.today = id;
      fillTodayPin(id);
    },
    mapLabel:
      "Map of the US time zones, in classes. Use the arrow keys to move between zones.",
    labelled: [
      "America/New_York",
      "America/Chicago",
      "America/Denver",
      "America/Phoenix",
      "America/Los_Angeles",
      "America/Anchorage",
      "Pacific/Honolulu",
      "America/Puerto_Rico",
      "Pacific/Guam",
      "Pacific/Pago_Pago",
    ],
    anchors: usZones.coords as unknown as Readonly<
      Record<string, readonly [number, number]>
    >,
    credits: [TZ_BOUNDARIES, COASTLINES],
  };

  const proposalsConfig: FeatureMapConfig = {
    ...common,
    idPrefix: `${idPrefix}-proposals`,
    frames: framesOf("proposals"),
    labelAt: labelAtFor("proposals"),
    boundariesUrl: withBase("/state-boundaries-us.json"),
    overlayUrl: withBase("/timezone-boundaries-us.json"),
    // The Navajo Nation keeps daylight time: the Denver zone, clipped to Arizona, in gold.
    hatch: { feature: "America/Denver", within: "AZ" },
    featureKey: "postal",
    classOf: (id) => proposalKind(id),
    nameOf: stateName,
    // A label is one line of capitals and must fit its inset's card, so American Samoa is short.
    labelOf: (id) => ({
      city: SHORT_NAMES[id] ?? stateName(id),
      offset: undefined,
    }),
    shapeLabel: (id) => `${stateName(id)}, ${PROPOSAL_WORDS[proposalKind(id)]}`,
    onPin: (id) => {
      pins.proposals = id;
      fillProposalsPin(id);
    },
    mapLabel:
      "Map of the US states, in classes of what each has adopted. Use the arrow keys to move between states.",
    labelled: ["AK", "HI", "PR", "GU", "AS"],
    anchors: {},
    markers: {
      DC: [-77.03, 38.9],
      RI: [-71.5, 41.7],
      DE: [-75.5, 39.0],
      VI: [-64.9, 18.34],
      MP: [145.75, 15.2],
      GU: [144.75, 13.45],
      AS: [-170.7, -14.3],
    },
    credits: [STATE_BOUNDARIES, TZ_BOUNDARIES, COASTLINES],
  };

  const mapDeps = { fetch: fetchFn, measure: deps.measure };
  const maps: Record<SunshineActView, FeatureMapHandle | null> = {
    today: wireFeatureMap(todayW, usZones.zones, life, mapDeps, todayConfig),
    proposals: null,
  };
  function ensureProposals(): FeatureMapHandle {
    maps.proposals ??= wireFeatureMap(
      proposalsW,
      STATE_CODES,
      life,
      mapDeps,
      proposalsConfig,
    );
    return maps.proposals;
  }

  // --- the Worker's answer, drawn into Today --------------------------------
  function restyleToday(): void {
    const frame = todayW.part("map");
    for (const shape of frame.querySelectorAll<SVGElement>(
      "path[data-feature-id], circle[data-feature-id]",
    )) {
      const id = shape.dataset["featureId"] ?? "";
      const kind = todayKind(rows.get(id));
      shape.dataset["kind"] = kind;
      shape.setAttribute("aria-label", `${cityOf(id)}, ${TODAY_WORDS[kind]}`);
    }
    usZones.zones.forEach((zone, index) => {
      const kind = todayKind(rows.get(zone));
      const parts = usRowParts(index);
      todayW.part(parts.swatch).dataset["kind"] = kind;
      text(todayW, parts.kind, TODAY_WORDS[kind]);
    });
    const counts = new Map<TodayKind, number>();
    for (const zone of usZones.zones) {
      const kind = todayKind(rows.get(zone));
      counts.set(kind, (counts.get(kind) ?? 0) + 1);
    }
    for (const kind of TODAY_ORDER)
      text(todayW, `legend-${kind}`, String(counts.get(kind) ?? 0));
    // A class no zone is in has no row, as on Canada's page.
    const none = todayW.part("legend-no-data").closest("li");
    if (none) none.hidden = (counts.get("no-data") ?? 0) === 0;
    for (const label of todayW
      .part("map")
      .querySelectorAll<HTMLElement>("[data-label-for]")) {
      const row = rows.get(label.dataset["labelFor"] ?? "");
      const line = label.children[1];
      if (row !== undefined && line)
        line.textContent = signedOffset(row.offset);
    }
    fillTodayPin(pins.today);
  }

  const answered = (async () => {
    status.textContent = "Checking…";
    const answer = await ask<SunshineActZones>(
      withBase("/api/sunshine-protection-act"),
      fetchFn,
      life,
    );
    if (life.aborted) return;
    if (answer.kind === "ok") {
      status.textContent = "";
      answerNow = answer.check.now;
      rows = new Map(answer.check.zones.map((row) => [row.zone, row]));
      w.el.dataset["state"] = "ready";
      restyleToday();
    } else if (answer.kind === "rate-limited") {
      w.el.dataset["state"] = "error";
      status.textContent =
        answer.seconds === null
          ? "Too many checks. Try again shortly."
          : `Try again in ${answer.seconds} s`;
    } else {
      w.el.dataset["state"] = "error";
      status.textContent = "The check could not finish.";
    }
  })();

  // The date is read off the first paint's path; the pin's "As of" line follows it.
  const dated = (deps.today ?? loadToday)().then(
    (day) => {
      if (life.aborted) return;
      todayDate = day;
      fillProposalsPin(pins.proposals);
      w.part("national-age").textContent = nationalAge(day);
    },
    () => {},
  );

  // --- the view switch -----------------------------------------------------
  function setView(next: SunshineActView): void {
    view = next;
    sections.today.hidden = next !== "today";
    sections.proposals.hidden = next !== "proposals";
    for (const input of switchEl.querySelectorAll<HTMLInputElement>(
      "input[type=radio]",
    )) {
      input.checked = input.value === next;
    }
    if (next === "proposals") ensureProposals();
  }
  switchEl.addEventListener(
    "change",
    (event) => {
      const value = (event.target as HTMLInputElement).value;
      if (value === "today" || value === "proposals") setView(value);
    },
    { signal: life },
  );

  function pin(id: string | null): boolean {
    const map = view === "today" ? maps.today : ensureProposals();
    return map?.pin(id, { user: false }) ?? false;
  }

  // --- the seed ------------------------------------------------------------
  fillTodayPin(null);
  fillProposalsPin(null);
  if (seed !== undefined) {
    setView(seed.kind);
    const id = seed.kind === "today" ? seed.zone : seed.state;
    if (id !== undefined) pin(id);
  }

  const ready = Promise.all([
    answered,
    dated,
    maps.today?.ready,
    maps.proposals?.ready,
  ]).then(() => {});

  return {
    setView,
    pin,
    state: () => {
      const id = maps[view]?.pinned() ?? null;
      if (view === "today")
        return id === null ? { kind: "today" } : { kind: "today", zone: id };
      return id === null
        ? { kind: "proposals" }
        : { kind: "proposals", state: id };
    },
    ready,
    destroy: () => own.abort(),
  };
}

// ---------------------------------------------------------------------------
// The chat widget
// ---------------------------------------------------------------------------

/** What the chat tool passes: the view to open and the place to pin. */
export interface SunshineActArgs {
  view: SunshineActSeed;
}

/**
 * Mounts the widget in the chat rail. The library's `getToday` is loaded first, so a failed load
 * rejects with `WidgetLoadError`, which the host turns into its retry state. The Worker's answer
 * is not awaited: the handle returns at once, and the status line carries a slow or failed Worker.
 */
export const mountSunshineProtectionActWidget: MountFn<
  SunshineActArgs
> = async (root, args, signal) => {
  let day: string;
  try {
    day = await loadToday();
  } catch (cause) {
    throw new WidgetLoadError(cause);
  }
  const controller = new AbortController();
  const stop = () => controller.abort();
  if (signal.aborted) controller.abort();
  else signal.addEventListener("abort", stop, { once: true });
  let handle: SunshineActHandle | null = null;
  mountSunshineProtectionAct(root, controller.signal, args.view, {
    today: async () => day,
  }).then(
    (mounted) => {
      handle = mounted;
    },
    (error) => {
      if (!controller.signal.aborted) showUnavailable(root, error);
    },
  );
  return onceDestroy(
    () => {
      signal.removeEventListener("abort", stop);
      controller.abort();
      handle?.destroy();
    },
    () => {
      const seed = (handle as SunshineActHandle | null)?.state();
      return seed === undefined ? null : { view: seed };
    },
  );
};
