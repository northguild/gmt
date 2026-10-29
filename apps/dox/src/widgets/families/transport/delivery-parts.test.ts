// @vitest-environment jsdom
import { screen, within } from "@testing-library/dom";
import type { EtaSummary, Itinerary } from "~/lib/delivery-scheduler";
import { expectNoAxeViolations } from "~/test/render-widget";
import { renderHtml } from "../../test-fixture";
import {
  deliveryLegend,
  etaHeadline,
  etaSummaryCard,
  itineraryList,
} from "./delivery-parts";

const OK: EtaSummary = {
  status: "ok",
  legCount: 2,
  etaLocal: "Fri 12 Apr 2024 · 17:30 Tokyo (+09:00)",
  etaIso: "2024-04-12T17:30:00+09:00[Asia/Tokyo]",
  doorToDoor: "14 d 1 h 30 min door to door",
  flags: ["DST ×2", "1 h offset-table error"],
};

const FAILED: EtaSummary = {
  status: "failed",
  legCount: 3,
  flags: [],
  failureLeg: 2,
  failureHeadline: "Missed connection",
};

describe("etaSummaryCard", () => {
  it("says the ETA, the time door to door, the leg count and each flag", async () => {
    const { host } = renderHtml(etaSummaryCard(OK));
    expect(host).toHaveTextContent("Fri 12 Apr 2024 · 17:30 Tokyo (+09:00)");
    expect(screen.getByRole("status", { name: "ETA" })).toHaveTextContent(
      "ETA 2024-04-12T17:30:00+09:00[Asia/Tokyo]",
    );
    expect(host).toHaveTextContent("14 d 1 h 30 min door to door");
    expect(host).toHaveTextContent("2 legs");
    const flags = within(screen.getByRole("list", { name: "Flags" }));
    expect(flags.getByText("DST ×2")).toBeInTheDocument();
    expect(flags.getByText("1 h offset-table error")).toBeInTheDocument();
    await expectNoAxeViolations(host);
  });

  it("names the leg that failed and says there is no ETA", async () => {
    const { host } = renderHtml(etaSummaryCard(FAILED));
    expect(host).toHaveTextContent("Leg 2: Missed connection");
    expect(screen.getByRole("status", { name: "ETA" })).toHaveTextContent(
      "No ETA — see the reason below.",
    );
    expect(
      screen.queryByRole("list", { name: "Flags" }),
    ).not.toBeInTheDocument();
    await expectNoAxeViolations(host);
  });

  it("keeps its box and says nothing for a bare form", async () => {
    const { host } = renderHtml(etaSummaryCard(null));
    expect(screen.getByRole("status", { name: "ETA" })).toBeEmptyDOMElement();
    await expectNoAxeViolations(host);
  });

  it("reads a single leg in the singular", () => {
    renderHtml(etaSummaryCard({ ...OK, legCount: 1 }));
    expect(screen.getByText("1 leg")).toBeInTheDocument();
  });
});

describe("etaHeadline", () => {
  it("is the local ETA when it resolved and the failure when it did not", () => {
    expect(etaHeadline(OK)).toBe("Fri 12 Apr 2024 · 17:30 Tokyo (+09:00)");
    expect(etaHeadline(FAILED)).toBe("Leg 2: Missed connection");
    expect(etaHeadline({ ...FAILED, failureLeg: undefined })).toBe(
      "Missed connection",
    );
  });
});

describe("deliveryLegend", () => {
  it("names the four marks", async () => {
    const { host } = renderHtml(deliveryLegend());
    const items = within(screen.getByRole("list", { name: "Legend" }));
    for (const text of [
      "departure / arrival",
      "handoff",
      "missed connection",
      "DST / Date Line note",
    ]) {
      expect(items.getByText(text)).toBeInTheDocument();
    }
    await expectNoAxeViolations(host);
  });
});

const ITINERARY: Itinerary = {
  summary: "Two legs",
  groups: [
    {
      date: "2024-03-29",
      heading: "Fri 29 Mar 2024",
      anomaly: "The Date Line: this day is a day later here.",
      events: [
        {
          kind: "departure",
          instant: "2024-03-29T10:00:00Z",
          zone: "Asia/Tokyo",
          city: "Tokyo",
          time: "19:00",
          offset: "+09:00",
          isoText: "2024-03-29T19:00:00+09:00[Asia/Tokyo]",
          legIndex: 0,
          mode: "truck",
        },
        {
          kind: "arrival",
          instant: "2024-03-29T20:00:00Z",
          zone: "Asia/Tokyo",
          city: "Tokyo",
          time: "05:00",
          offset: "+09:00",
          isoText: "2024-03-30T05:00:00+09:00[Asia/Tokyo]",
          legIndex: 0,
          isEta: true,
          offsetCheck: { agrees: false, badge: "1 h late", naiveTime: "04:00" },
        },
        {
          kind: "handoff",
          instant: "2024-03-29T21:00:00Z",
          zone: "Asia/Tokyo",
          city: "Tokyo",
          time: "06:00",
          offset: "+09:00",
          isoText: "2024-03-30T06:00:00+09:00[Asia/Tokyo]",
          legIndex: 0,
          dwell: "PT1H",
          tail: "missed",
          missedText: "Missed connection.",
        },
        {
          kind: "dst",
          instant: "2024-03-31T01:00:00Z",
          zone: "Europe/London",
          city: "London",
          time: "01:00",
          offset: "Z",
          isoText: "",
          note: "London clocks spring forward 01:00 → 02:00",
        },
      ],
    },
  ],
};

describe("itineraryList", () => {
  it("groups the events under their date and says each one in words", async () => {
    const { host } = renderHtml(itineraryList("Itinerary", ITINERARY));
    const days = screen.getByRole("list", { name: "Itinerary" });
    expect(
      within(days).getByRole("heading", { name: "Fri 29 Mar 2024" }),
    ).toBeInTheDocument();
    expect(host).toHaveTextContent("The Date Line");
    expect(host).toHaveTextContent("Leg 1, truck departs");
    expect(host).toHaveTextContent("Leg 1 arrives");
    expect(within(days).getByText("ETA")).toBeInTheDocument();
    expect(within(days).getByText("1 h late")).toBeInTheDocument();
    expect(host).toHaveTextContent("offset table: 04:00");
    expect(host).toHaveTextContent(
      "Ready after PT1H handling — Missed connection.",
    );
    expect(host).toHaveTextContent("London clocks spring forward");
    expect(host).toHaveTextContent("2024-03-29T19:00:00+09:00[Asia/Tokyo]");
    await expectNoAxeViolations(host);
  });

  it("is an empty list when there is no itinerary", () => {
    renderHtml(itineraryList("Itinerary", null));
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });
});
