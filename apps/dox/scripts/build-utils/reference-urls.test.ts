import { describe, expect, it } from "vitest";
import {
  functionUrl,
  indexRoutes,
  legacyTypeUrl,
  typePageSlug,
  typePageUrl,
  typeRoute,
  typeUrl,
} from "./reference-urls";
import type { TypeUsage } from "./type-usage";

const usage: TypeUsage = {
  types: new Map([
    [
      "Interval",
      {
        name: "Interval",
        usedBy: ["plain/interval/a", "plain/interval/b"],
        input: true,
        placement: { kind: "page" },
      },
    ],
    [
      "Dwell",
      {
        name: "Dwell",
        usedBy: ["transport/calculate/dwellTime"],
        input: false,
        placement: {
          kind: "inline",
          owner: "transport/calculate/dwellTime",
          anchor: "dwell",
        },
      },
    ],
  ]),
  direct: new Map(),
  reach: new Map(),
  orphans: [],
};

describe("reference URLs", () => {
  it("puts a shared type flat under /reference/types, with no module level", () => {
    expect(typePageUrl("Interval")).toBe("/reference/types/Interval");
    expect(typePageSlug("Interval")).toBe("reference/types/Interval");
    expect(typeUrl(usage, "Interval")).toBe("/reference/types/Interval");
    expect(typeRoute(usage, "Interval")).toBe("/reference/types/Interval");
  });

  it("links a single-use type to its anchor on its function's page", () => {
    expect(functionUrl("transport/calculate/dwellTime")).toBe(
      "/reference/transport/calculate/dwellTime",
    );
    expect(typeUrl(usage, "Dwell")).toBe(
      "/reference/transport/calculate/dwellTime#dwell",
    );
    // The route that serves it carries no fragment.
    expect(typeRoute(usage, "Dwell")).toBe(
      "/reference/transport/calculate/dwellTime",
    );
  });

  it("links a type on the page the link is written on by its bare anchor", () => {
    expect(typeUrl(usage, "Dwell", "transport/calculate/dwellTime")).toBe(
      "#dwell",
    );
    expect(typeUrl(usage, "Dwell", "transport/calculate/transitTime")).toBe(
      "/reference/transport/calculate/dwellTime#dwell",
    );
    expect(typeUrl(usage, "Interval", "plain/interval/a")).toBe(
      "/reference/types/Interval",
    );
  });

  it("returns undefined for a name that is not a public type", () => {
    expect(typeUrl(usage, "Temporal")).toBeUndefined();
    expect(typeRoute(usage, "Temporal")).toBeUndefined();
  });

  it("derives a type's old URL from its source path", () => {
    expect(legacyTypeUrl("transport", "calculate", "Dwell")).toBe(
      "/reference/transport/calculate/Dwell",
    );
    expect(
      legacyTypeUrl("types", "business-calendar", "BusinessCalendar"),
    ).toBe("/reference/types/business-calendar/BusinessCalendar");
  });

  it("derives the index routes as every proper prefix of a page route, each once, sorted", () => {
    expect(
      indexRoutes([
        "/reference/plain/calculate/addDate",
        "/reference/plain/calculate/addTime",
        "/reference/plain/format/formatDate",
        "/reference/types/Interval",
      ]),
    ).toEqual([
      "/reference",
      "/reference/plain",
      "/reference/plain/calculate",
      "/reference/plain/format",
      "/reference/types",
    ]);
    expect(indexRoutes([])).toEqual([]);
  });
});
