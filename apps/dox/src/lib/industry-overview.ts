/**
 * What an industry namespace's overview page says about the industry: a short
 * paragraph, and the problems its functions solve.
 *
 * Hand-kept text that `scripts/build-reference.ts` reads. A leaf module beside
 * `industry-tags.ts` (which `content.config.ts` imports and so must stay small):
 * it imports only that module's list of layers. `industry-overview.test.ts`
 * fails when a layer has no entry here, when a `{{name}}` token names a function
 * the corpus does not have in that layer, or when a link points at a page that
 * does not exist.
 *
 * Wording rules, from the owner: say what the problem is in plain words; name no
 * statute, regulator or section number (the library tracks no law); make no
 * claim about any other library; state no number that is not derived from data.
 * The test checks the last one by refusing a digit.
 *
 * Imports nothing generated.
 */

/** A link to a page that shows the problem in use. */
export interface OverviewLink {
  label: string;
  /** A site path with a trailing slash: `/tools/free-time-ledger/`. */
  href: string;
}

/** One problem a developer in the industry hits, and the functions that answer it. */
export interface PainPoint {
  /** One short sentence stating the problem, shown in bold. Names no function. */
  problem: string;
  /**
   * One or two short sentences that name the functions that answer it. `{{name}}` is
   * replaced by a link to the function's reference page, so the generator can refuse a name
   * that is not in the layer.
   */
  answer: string;
  /** Guides, tools, scenarios or mistakes pages that show it. */
  see: readonly OverviewLink[];
}

export interface IndustryOverview {
  /** What the industry is, in plain words. */
  about: string;
  /** Three to five problems. */
  solves: readonly PainPoint[];
  /** The title of the guide `industry-tags.ts` points the industry at. */
  guideTitle: string;
}

export const INDUSTRY_OVERVIEWS: Readonly<Record<string, IndustryOverview>> = {
  intermodal: {
    about:
      "Intermodal moves a container between ship, rail and truck. Each hand-off has its own clock, its own tariff and its own paperwork. This layer covers the free time a container gets and the charges after it, the dates on billing deadlines and bills of lading, an ETA across several modes, and the timestamps inside EDI messages and EPCIS events.",
    guideTitle: "Intermodal: Free Time and Demurrage",
    solves: [
      {
        problem:
          "Free time ends on a different day depending on how it is counted.",
        answer:
          "Which day counts as day one, which zone the days are counted in, and which event starts the clock all change the answer. {{freeTimeExpiry}}, {{chargeableDays}} and {{demurrageClock}} take each of those as a term you state, and count local days at the terminal.",
        see: [
          {
            label: "guide",
            href: "/guides/industries/intermodal-free-time-and-demurrage/",
          },
          { label: "Free Time Ledger", href: "/tools/free-time-ledger/" },
          { label: "mistakes", href: "/mistakes/intermodal/" },
        ],
      },
      {
        problem:
          "An invoice, a dispute and a resolution each have a last date.",
        answer:
          "Counting from the wrong date, or with a window fixed in code, moves all three. {{billingTimeline}} lays out the chain from the date you name and the windows you pass.",
        see: [
          {
            label: "guide",
            href: "/guides/industries/intermodal-billing-deadlines/",
          },
          { label: "Billing Deadlines", href: "/tools/billing-deadlines/" },
        ],
      },
      {
        problem: "Some EDI timestamps state their offset and some do not.",
        answer:
          "Reading one that states none as UTC moves the event. {{classifyEdifactDtmFormat}} tells which kind a code is. {{parseEdifactDateTime}} and {{parseEdifactOffsetDateTime}} read each kind as what it states, and {{x12TimeCodeZone}} reads a zone name such as ET without turning it into an offset.",
        see: [
          {
            label: "guide",
            href: "/guides/industries/intermodal-edi-timestamps/",
          },
          { label: "DTM Decoder", href: "/tools/dtm-decoder/" },
          { label: "X12 Time Reader", href: "/tools/x12-time-reader/" },
        ],
      },
      {
        problem:
          "An event time kept without its offset can never show its local time again.",
        answer:
          "{{parseEpcisEvent}} and {{formatEpcisEvent}} keep the instant and the offset together. {{bolTimestamp}} dates a bill of lading on the local clock where the event took place.",
        see: [
          {
            label: "guide",
            href: "/guides/industries/intermodal-bill-of-lading-and-eta/",
          },
          {
            label: "scenario",
            href: "/scenarios/the-epcis-offset-nobody-kept/",
          },
        ],
      },
      {
        problem:
          "An ETA that adds up only the travel times leaves out the wait for the next sailing.",
        answer:
          "{{multimodalETA}} chains the legs, and reports the time in transit and the time in dwell separately.",
        see: [
          {
            label: "guide",
            href: "/guides/industries/intermodal-bill-of-lading-and-eta/",
          },
          {
            label: "scenario",
            href: "/scenarios/eta-that-forgot-the-sailing/",
          },
        ],
      },
    ],
  },
  transport: {
    about:
      "Transport is the part of moving goods or people that road, rail, sea and air share: a leg with a departure and an arrival, time spent waiting at a stop, a cut-off before a departure, a schedule, and how late counts as late. This layer works the same for every mode, and every time it handles is an exact instant shown in the zone where it is read.",
    guideTitle: "Transport: Legs and Dwell",
    solves: [
      {
        problem:
          "A leg's running time is elapsed time, not a difference between two wall clocks.",
        answer:
          "A leg that crosses a clock change lands at a different local time than the hours suggest. {{transitTime}} adds the duration to the departure, and {{etaAtZone}} shows the arrival in the reader's zone.",
        see: [
          {
            label: "guide",
            href: "/guides/industries/transport-legs-and-dwell/",
          },
          { label: "scenario", href: "/scenarios/transit-across-dst/" },
          { label: "mistakes", href: "/mistakes/transport/" },
        ],
      },
      {
        problem:
          "Elapsed hours divided by the length of a day is not the days something sat.",
        answer:
          "Days are counted midnight to midnight where it sat. {{dwellTime}} returns the elapsed time and the local calendar days together.",
        see: [
          {
            label: "guide",
            href: "/guides/industries/transport-legs-and-dwell/",
          },
          { label: "Dwell Ledger", href: "/tools/dwell-ledger/" },
          { label: "scenario", href: "/scenarios/container-dwell-days/" },
        ],
      },
      {
        problem:
          "A move with several legs needs each hand-off in the zone where it happens.",
        answer:
          "{{scheduleDelivery}} chains the legs into one ETA. {{crossingTime}} times a crossing on the clock of the place that administers it, and {{nextDeparture}} finds the first departure a connection can still make.",
        see: [
          {
            label: "guide",
            href: "/guides/industries/transport-multi-leg-scheduling/",
          },
          { label: "Delivery Scheduler", href: "/tools/delivery-scheduler/" },
          { label: "Departure Board", href: "/tools/departure-board/" },
        ],
      },
      {
        problem:
          "A cut-off is enforced on the clock of the place that enforces it.",
        answer:
          "It is stated as a time before an event. {{cutoffAt}} finds one, {{cutoffSchedule}} finds the whole stack for a sailing, and {{isPastCutoff}} and {{timeToCutoff}} test a time against it.",
        see: [
          {
            label: "guide",
            href: "/guides/industries/transport-legs-and-dwell/",
          },
          { label: "Cut-off Stack", href: "/tools/cutoff-stack/" },
          { label: "Cut-off Ruler", href: "/tools/cutoff-ruler/" },
        ],
      },
      {
        problem: "On time means nothing until you state how much slack counts.",
        answer:
          "An estimate shown as if it were an actual hides a slip. {{classifyPunctuality}}, {{scheduleDeviation}} and {{punctualityRate}} take the tolerance from you, and {{bestAvailable}} says which class of timestamp it picked.",
        see: [
          {
            label: "guide",
            href: "/guides/industries/transport-punctuality-and-timestamps/",
          },
          { label: "Punctuality Board", href: "/tools/punctuality-board/" },
          { label: "scenario", href: "/scenarios/estimate-shown-as-actual/" },
        ],
      },
    ],
  },
};

/** The `{{name}}` tokens in a pain point's text, in order. */
export function overviewFunctionNames(text: string): string[] {
  return [...text.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]!);
}
