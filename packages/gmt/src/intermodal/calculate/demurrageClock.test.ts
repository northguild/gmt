import { mockTemporalInstantFromThrow } from "../../test/mocks";
import { type ClockEvent, demurrageClock } from "./demurrageClock";

// An import: discharged Friday, available Saturday, out the next Thursday, empty back a week later.
const discharged: ClockEvent = {
  type: "discharged",
  at: "2024-06-14T19:00:00Z",
};
const available: ClockEvent = { type: "available", at: "2024-06-15T12:00:00Z" };
const gatedOut: ClockEvent = { type: "gatedOut", at: "2024-06-20T14:30:00Z" };
const emptyReturned: ClockEvent = {
  type: "emptyReturned",
  at: "2024-06-27T09:00:00Z",
};
const imported = [discharged, available, gatedOut, emptyReturned];

// An export: empty picked up, full received at the terminal, loaded on board.
const emptyReleased: ClockEvent = {
  type: "emptyReleased",
  at: "2024-07-01T08:00:00Z",
};
const gatedIn: ClockEvent = { type: "gatedIn", at: "2024-07-05T16:00:00Z" };
const loaded: ClockEvent = { type: "loaded", at: "2024-07-09T03:00:00Z" };
const exported = [emptyReleased, gatedIn, loaded];

const IMPORT = { direction: "import" } as const;
const EXPORT = { direction: "export" } as const;

describe("demurrageClock", () => {
  it("returns the spec's own example: detention runs from gate-out to empty return, not from discharge", () => {
    expect(demurrageClock(imported, "detention", IMPORT)).toEqual({
      start: gatedOut.at,
      end: emptyReturned.at,
    });
  });

  // The published tariff shape (Maersk terms, CMA CGM general terms, Hapag-Lloyd, ACL): every
  // scope in both directions, from one event list per leg.
  it.each`
    direction   | scope          | startEvent      | start               | end                 | reads
    ${"import"} | ${"demurrage"} | ${undefined}    | ${discharged.at}    | ${gatedOut.at}      | ${"discharge to full gate-out"}
    ${"import"} | ${"demurrage"} | ${"discharged"} | ${discharged.at}    | ${gatedOut.at}      | ${"discharge to full gate-out (explicit)"}
    ${"import"} | ${"demurrage"} | ${"available"}  | ${available.at}     | ${gatedOut.at}      | ${"availability to full gate-out"}
    ${"import"} | ${"storage"}   | ${undefined}    | ${discharged.at}    | ${gatedOut.at}      | ${"discharge to full gate-out"}
    ${"import"} | ${"storage"}   | ${"available"}  | ${available.at}     | ${gatedOut.at}      | ${"availability to full gate-out"}
    ${"import"} | ${"detention"} | ${undefined}    | ${gatedOut.at}      | ${emptyReturned.at} | ${"full gate-out to empty return"}
    ${"import"} | ${"detention"} | ${"available"}  | ${gatedOut.at}      | ${emptyReturned.at} | ${"full gate-out to empty return: startEvent is not read"}
    ${"import"} | ${"combined"}  | ${undefined}    | ${discharged.at}    | ${emptyReturned.at} | ${"discharge to empty return"}
    ${"import"} | ${"combined"}  | ${"available"}  | ${available.at}     | ${emptyReturned.at} | ${"availability to empty return"}
    ${"export"} | ${"demurrage"} | ${undefined}    | ${gatedIn.at}       | ${loaded.at}        | ${"full gate-in to loaded on board"}
    ${"export"} | ${"storage"}   | ${undefined}    | ${gatedIn.at}       | ${loaded.at}        | ${"full gate-in to loaded on board"}
    ${"export"} | ${"detention"} | ${undefined}    | ${emptyReleased.at} | ${gatedIn.at}       | ${"empty picked up to full gate-in"}
    ${"export"} | ${"combined"}  | ${undefined}    | ${emptyReleased.at} | ${loaded.at}        | ${"empty picked up to loaded on board"}
    ${"export"} | ${"demurrage"} | ${"available"}  | ${gatedIn.at}       | ${loaded.at}        | ${"full gate-in to loaded: startEvent is import only"}
  `(
    "selects $reads for $direction $scope",
    ({ direction, scope, startEvent, start, end }) => {
      const events = direction === "import" ? imported : exported;
      expect(demurrageClock(events, scope, { direction, startEvent })).toEqual({
        start,
        end,
      });
    },
  );

  it("reads each leg from a list holding the whole cycle", () => {
    const cycle = [...imported, ...exported];
    expect(demurrageClock(cycle, "combined", IMPORT)).toEqual({
      start: discharged.at,
      end: emptyReturned.at,
    });
    expect(demurrageClock(cycle, "combined", EXPORT)).toEqual({
      start: emptyReleased.at,
      end: loaded.at,
    });
  });

  it("does not care about event order", () => {
    expect(
      demurrageClock([...imported].reverse(), "demurrage", IMPORT),
    ).toEqual({
      start: discharged.at,
      end: gatedOut.at,
    });
  });

  it("echoes the caller's own strings, zone and all", () => {
    const local = {
      type: "gatedOut",
      at: "2024-06-20T10:30:00-04:00[America/New_York]",
    } as const;
    expect(demurrageClock([local, emptyReturned], "detention", IMPORT)).toEqual(
      {
        start: local.at,
        end: emptyReturned.at,
      },
    );
  });

  it("allows a clock that starts and ends at the same instant: an empty interval", () => {
    expect(
      demurrageClock(
        [discharged, { type: "gatedOut", at: discharged.at }],
        "demurrage",
        IMPORT,
      ),
    ).toEqual({ start: discharged.at, end: discharged.at });
  });

  it("does not need the events the requested clock does not read", () => {
    expect(demurrageClock([discharged, gatedOut], "demurrage", IMPORT)).toEqual(
      { start: discharged.at, end: gatedOut.at },
    );
    expect(
      demurrageClock([gatedOut, emptyReturned], "detention", IMPORT),
    ).toEqual({ start: gatedOut.at, end: emptyReturned.at });
    expect(demurrageClock([gatedIn, loaded], "demurrage", EXPORT)).toEqual({
      start: gatedIn.at,
      end: loaded.at,
    });
  });

  /** A hole in the event list: `Array.prototype.every` would skip it. */
  const holed: ClockEvent[] = [discharged];
  holed[2] = gatedOut;

  it.each`
    events                                                                             | scope          | options                                             | reason
    ${[discharged, gatedOut]}                                                          | ${"demurrage"} | ${undefined}                                        | ${"no options: direction has no default"}
    ${[discharged, gatedOut]}                                                          | ${"demurrage"} | ${{}}                                               | ${"direction has no default"}
    ${[discharged, gatedOut]}                                                          | ${"demurrage"} | ${{ direction: "inbound" }}                         | ${"unknown direction"}
    ${[discharged, gatedOut]}                                                          | ${"demurrage"} | ${{ direction: null }}                              | ${"null direction"}
    ${[discharged, gatedOut]}                                                          | ${"demurrage"} | ${{ direction: "import", startEvent: "available" }} | ${"no availability event"}
    ${[discharged]}                                                                    | ${"demurrage"} | ${IMPORT}                                           | ${"still in the terminal: no gate-out"}
    ${[discharged, available]}                                                         | ${"storage"}   | ${IMPORT}                                           | ${"no gate-out"}
    ${[discharged, gatedOut]}                                                          | ${"detention"} | ${IMPORT}                                           | ${"no empty return"}
    ${[discharged, gatedOut]}                                                          | ${"combined"}  | ${IMPORT}                                           | ${"combined clock with no empty return"}
    ${[emptyReturned]}                                                                 | ${"detention"} | ${IMPORT}                                           | ${"no gate-out"}
    ${imported}                                                                        | ${"demurrage"} | ${EXPORT}                                           | ${"an import list read as an export"}
    ${[emptyReleased, gatedIn]}                                                        | ${"demurrage"} | ${EXPORT}                                           | ${"not loaded yet"}
    ${[gatedIn, loaded]}                                                               | ${"detention"} | ${EXPORT}                                           | ${"no empty pick-up"}
    ${[discharged, { type: "discharged", at: "2024-06-15T19:00:00Z" }, gatedOut]}      | ${"demurrage"} | ${IMPORT}                                           | ${"discharged twice"}
    ${[gatedOut, gatedOut, emptyReturned]}                                             | ${"detention"} | ${IMPORT}                                           | ${"gated out twice"}
    ${[{ type: "discharged", at: "2024-06-21T19:00:00Z" }, gatedOut]}                  | ${"demurrage"} | ${IMPORT}                                           | ${"gate-out before discharge"}
    ${[gatedOut, { type: "emptyReturned", at: "2024-06-20T14:29:59Z" }]}               | ${"detention"} | ${IMPORT}                                           | ${"empty return before gate-out"}
    ${[{ type: "gatedIn", at: "2024-07-10T00:00:00Z" }, loaded]}                       | ${"demurrage"} | ${EXPORT}                                           | ${"loaded before gate-in"}
    ${[]}                                                                              | ${"demurrage"} | ${IMPORT}                                           | ${"no events"}
    ${"discharged"}                                                                    | ${"demurrage"} | ${IMPORT}                                           | ${"events not an array"}
    ${[discharged, gatedOut, null]}                                                    | ${"demurrage"} | ${IMPORT}                                           | ${"a null event"}
    ${holed}                                                                           | ${"demurrage"} | ${IMPORT}                                           | ${"a hole in the event list"}
    ${[discharged, gatedOut, { type: "customsReleased", at: "2024-06-16T10:00:00Z" }]} | ${"demurrage"} | ${IMPORT}                                           | ${"an unknown event type, even unused"}
    ${[discharged, gatedOut, { type: "emptyReturned", at: "2024-06-27" }]}             | ${"demurrage"} | ${IMPORT}                                           | ${"an unused event whose instant is not one"}
    ${[discharged, { type: "gatedOut", at: "2024-06-20T14:30:00" }]}                   | ${"demurrage"} | ${IMPORT}                                           | ${"a gate-out with no offset designator"}
    ${[discharged, { type: "gatedOut", at: 1718893800000 }]}                           | ${"demurrage"} | ${IMPORT}                                           | ${"an instant that is not a string"}
    ${imported}                                                                        | ${"laytime"}   | ${IMPORT}                                           | ${"not a clock this function selects"}
    ${imported}                                                                        | ${undefined}   | ${IMPORT}                                           | ${"no scope"}
    ${imported}                                                                        | ${"demurrage"} | ${null}                                             | ${"null options"}
    ${imported}                                                                        | ${"demurrage"} | ${"import"}                                         | ${"options as a string"}
    ${imported}                                                                        | ${"demurrage"} | ${{ direction: "import", startEvent: "gatedOut" }}  | ${"a start event that is not an import start"}
    ${imported}                                                                        | ${"demurrage"} | ${{ direction: "import", startEvent: null }}        | ${"a null start event: a value to validate, not an omission"}
  `("returns the sentinel for $reason", ({ events, scope, options }) => {
    expect(demurrageClock(events, scope, options)).toBeNull();
  });

  it("returns the sentinel when the instant parse throws", () => {
    mockTemporalInstantFromThrow();
    expect(demurrageClock(imported, "demurrage", IMPORT)).toBeNull();
  });
});
