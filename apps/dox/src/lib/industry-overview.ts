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
  workforce: {
    about:
      "Workforce is people's working time, for any crew, shift or rota. It is counted in duty days that need not start at midnight, in rolling windows that slide across the log, and in rests that may be split in two. A working-time regime is a set of numbers, and the caller states every one of them. This layer reads a duty log against those numbers, and holds none of its own.",
    guideTitle: "Workforce: Hours of Work",
    solves: [
      {
        problem: "A duty day does not start at midnight.",
        answer:
          "An operator names the time its day starts and the zone it is read in. {{dutyDayFor}} returns the day an instant falls in, so a log is grouped by the operator's day and never by the calendar's.",
        see: [
          {
            label: "guide",
            href: "/guides/industries/workforce-hours-of-work/",
          },
          {
            label: "scenario",
            href: "/scenarios/duty-day-is-not-midnight/",
          },
        ],
      },
      {
        problem: "A sliding window is not a calendar day.",
        answer:
          "A rule that asks for a rest in any stretch of a given length looks at every such stretch, not at each day on its own. {{evaluateDutyLog}} checks every rule at one instant, and {{dutyTotals}} adds up the time spent in the statuses you name inside a window.",
        see: [
          {
            label: "guide",
            href: "/guides/industries/workforce-hours-of-work/",
          },
          {
            label: "scenario",
            href: "/scenarios/sliding-window-not-calendar-day/",
          },
          { label: "mistakes", href: "/mistakes/workforce/" },
        ],
      },
      {
        problem: "Two short rests may count as one, or may not.",
        answer:
          "A regime that lets a rest be split sets a floor for each part and for the two together. {{qualifyingRestPairs}} finds the pairs that meet all of the floors you state, so a pair that meets only two of them is not counted.",
        see: [
          {
            label: "scenario",
            href: "/scenarios/paired-rest-that-does-not-qualify/",
          },
          { label: "mistakes", href: "/mistakes/workforce/" },
        ],
      },
      {
        problem: "A log has to be checked before it is counted.",
        answer:
          "A log with overlapping entries, or an entry that ends before it starts, gives a total that looks right and is not. {{isValidDutyLog}} tells whether every function in this layer accepts the log.",
        see: [
          {
            label: "guide",
            href: "/guides/industries/workforce-hours-of-work/",
          },
          { label: "mistakes", href: "/mistakes/workforce/" },
        ],
      },
    ],
  },
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
          { label: "Demurrage Clock", href: "/tools/demurrage-clock/" },
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
            label: "EPCIS Event Reader",
            href: "/tools/epcis-event-reader/",
          },
          { label: "B/L Date Stamp", href: "/tools/bl-date-stamp/" },
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
          "{{multimodalETA}} chains the legs, and reports the time in transit and the time in dwell separately. It is built on {{scheduleDelivery}}, which comes from the Transport layer.",
        see: [
          {
            label: "guide",
            href: "/guides/industries/intermodal-bill-of-lading-and-eta/",
          },
          {
            label: "Transport guide",
            href: "/guides/industries/transport-legs-and-dwell/",
          },
          { label: "Journey Split", href: "/tools/journey-split/" },
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
          "Elapsed time is neither a difference between two wall clocks nor a count of the days something sat.",
        answer:
          "A leg that crosses a clock change lands at a different local time than the hours suggest. {{transitTime}} adds the duration to the departure, and {{etaAtZone}} shows the arrival in the reader's zone. Days are counted midnight to midnight where the thing sat, and {{dwellTime}} returns the elapsed time and the local calendar days together.",
        see: [
          {
            label: "guide",
            href: "/guides/industries/transport-legs-and-dwell/",
          },
          { label: "Dwell Ledger", href: "/tools/dwell-ledger/" },
          { label: "scenario", href: "/scenarios/transit-across-dst/" },
          { label: "scenario", href: "/scenarios/container-dwell-days/" },
          { label: "mistakes", href: "/mistakes/transport/" },
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
      {
        problem: "A crew's hours of work do not follow the calendar.",
        answer:
          "A driver's or an operator's day starts at the time the operator names, and a rest is counted across any stretch of the log. {{dutyDayFor}} returns the operator's day for an instant, and {{evaluateDutyLog}} checks a duty log against the limits you state. These come from the Workforce layer.",
        see: [
          {
            label: "guide",
            href: "/guides/industries/workforce-hours-of-work/",
          },
          { label: "scenario", href: "/scenarios/duty-day-is-not-midnight/" },
          {
            label: "scenario",
            href: "/scenarios/paired-rest-that-does-not-qualify/",
          },
        ],
      },
    ],
  },
  gnss: {
    about:
      "GNSS is satellite navigation time. Every system keeps its own continuous clock, counts weeks on a counter that wraps, and differs from UTC by a number of seconds that grew with every leap second. This layer reads those clocks and weeks for all six systems alike, without an offset kept by hand.",
    guideTitle: "GNSS: System Time and Week Rollover",
    solves: [
      {
        problem: "A receiver's week number repeats.",
        answer:
          "{{gnssWeekToUtc}} takes the counter and the rollover era by name, and {{utcToGnssWeek}} returns the week, the time of week and the era.",
        see: [
          {
            label: "guide",
            href: "/guides/industries/gnss-system-time-and-week-rollover/",
          },
          { label: "GNSS Week Decoder", href: "/tools/gnss-week-decoder/" },
          {
            label: "GNSS Rollover Checker",
            href: "/tools/gnss-rollover-checker/",
          },
          { label: "scenario", href: "/scenarios/gnss-week-that-wrapped/" },
        ],
      },
      {
        problem:
          "Satellite time is not UTC, and the gap grew with each leap second.",
        answer:
          "{{utcToGnss}} and {{gnssToUtc}} read each system's gap from the built-in leap-second table, for every system alike.",
        see: [
          {
            label: "Satellite Clock Converter",
            href: "/tools/satellite-clock-converter/",
          },
          { label: "scenario", href: "/scenarios/gnss-offset-hardcoded/" },
        ],
      },
      {
        problem:
          "A week in a RINEX navigation file is not the week a satellite sends.",
        answer:
          "{{rinexWeekToUtc}} and {{utcToRinexWeek}} read the continuous count.",
        see: [
          {
            label: "scenario",
            href: "/scenarios/rinex-week-read-as-broadcast/",
          },
          { label: "GNSS Week Decoder", href: "/tools/gnss-week-decoder/" },
        ],
      },
      {
        problem: "A logged second sixty may not be a real leap second.",
        answer:
          "{{isLeapSecond}} checks the table, and {{toTAI}} and {{fromTAI}} carry an inserted second through.",
        see: [
          {
            label: "scenario",
            href: "/scenarios/a-leap-second-that-never-happened/",
          },
          {
            label: "guide",
            href: "/guides/core-date-operations/leap-seconds-and-tai/",
          },
        ],
      },
    ],
  },
  maritime: {
    about:
      "Maritime is time at sea and in a ship's records. Ships and their shore systems take time from satellite receivers, carry it between instruments in standard sentences, and keep logs that outlive a receiver's week counter. This layer draws on the satellite clocks and the leap-second table, and adds no functions of its own.",
    guideTitle: "Maritime: GNSS Time and Week Rollover",
    solves: [
      {
        problem:
          "A receiver starts reporting dates a whole counter period early.",
        answer:
          "{{gnssWeekToUtc}} names the pass of the counter, so a week resolved against a build date can be checked against the pass it should be in.",
        see: [
          {
            label: "guide",
            href: "/guides/industries/maritime-gnss-time-and-week-rollover/",
          },
          {
            label: "GNSS Rollover Checker",
            href: "/tools/gnss-rollover-checker/",
          },
        ],
      },
      {
        problem: "A log mixes satellite time and UTC.",
        answer:
          "{{gnssToUtc}} turns a labelled satellite reading into UTC, for the system and the date it names.",
        see: [
          {
            label: "guide",
            href: "/guides/industries/gnss-system-time-and-week-rollover/",
          },
          {
            label: "Satellite Clock Converter",
            href: "/tools/satellite-clock-converter/",
          },
        ],
      },
      {
        problem: "A leap second turns up in a ship's record.",
        answer:
          "{{isLeapSecond}} tells whether a second sixty is a real one, whatever offset the record carries.",
        see: [
          {
            label: "guide",
            href: "/guides/core-date-operations/leap-seconds-and-tai/",
          },
          { label: "mistakes", href: "/mistakes/gnss/" },
        ],
      },
    ],
  },
};

/** The `{{name}}` tokens in a pain point's text, in order. */
export function overviewFunctionNames(text: string): string[] {
  return [...text.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]!);
}
