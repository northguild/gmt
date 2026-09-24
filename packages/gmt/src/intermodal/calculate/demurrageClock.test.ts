import { mockTemporalInstantFromThrow } from "../../test/mocks";
import { type ClockEvent, demurrageClock } from "./demurrageClock";

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
const all = [discharged, available, gatedOut, emptyReturned];

describe("demurrageClock", () => {
  it("returns the spec's own example: detention runs from gate-out to empty return, not from discharge", () => {
    expect(demurrageClock(all, "detention")).toEqual({
      start: gatedOut.at,
      end: emptyReturned.at,
    });
  });

  // The three clocks and the two import start events, from one event list.
  it.each`
    scope          | options                         | start            | end                 | reads
    ${"demurrage"} | ${undefined}                    | ${discharged.at} | ${gatedOut.at}      | ${"discharge to gate-out"}
    ${"demurrage"} | ${{}}                           | ${discharged.at} | ${gatedOut.at}      | ${"discharge to gate-out (empty options)"}
    ${"demurrage"} | ${{ startEvent: undefined }}    | ${discharged.at} | ${gatedOut.at}      | ${"discharge to gate-out (explicit undefined is the default)"}
    ${"demurrage"} | ${{ startEvent: "discharged" }} | ${discharged.at} | ${gatedOut.at}      | ${"discharge to gate-out (explicit)"}
    ${"demurrage"} | ${{ startEvent: "available" }}  | ${available.at}  | ${gatedOut.at}      | ${"availability to gate-out"}
    ${"storage"}   | ${undefined}                    | ${discharged.at} | ${gatedOut.at}      | ${"discharge to gate-out"}
    ${"storage"}   | ${{ startEvent: "available" }}  | ${available.at}  | ${gatedOut.at}      | ${"availability to gate-out"}
    ${"detention"} | ${undefined}                    | ${gatedOut.at}   | ${emptyReturned.at} | ${"gate-out to empty return"}
    ${"detention"} | ${{ startEvent: "available" }}  | ${gatedOut.at}   | ${emptyReturned.at} | ${"gate-out to empty return: startEvent is not read"}
  `("selects $reads for $scope", ({ scope, options, start, end }) => {
    expect(demurrageClock(all, scope, options)).toEqual({ start, end });
  });

  it("does not care about event order", () => {
    expect(demurrageClock([...all].reverse(), "demurrage")).toEqual({
      start: discharged.at,
      end: gatedOut.at,
    });
  });

  it("echoes the caller's own strings, zone and all", () => {
    const local = {
      type: "gatedOut",
      at: "2024-06-20T10:30:00-04:00[America/New_York]",
    } as const;
    expect(demurrageClock([local, emptyReturned], "detention")).toEqual({
      start: local.at,
      end: emptyReturned.at,
    });
  });

  it("allows a clock that starts and ends at the same instant: an empty interval", () => {
    expect(
      demurrageClock(
        [discharged, { type: "gatedOut", at: discharged.at }],
        "demurrage",
      ),
    ).toEqual({
      start: discharged.at,
      end: discharged.at,
    });
  });

  it("does not need the events the requested clock does not read", () => {
    expect(demurrageClock([discharged, gatedOut], "demurrage")).toEqual({
      start: discharged.at,
      end: gatedOut.at,
    });
    expect(demurrageClock([gatedOut, emptyReturned], "detention")).toEqual({
      start: gatedOut.at,
      end: emptyReturned.at,
    });
  });

  it.each`
    events                                                                        | scope          | options                        | reason
    ${[discharged, gatedOut]}                                                     | ${"demurrage"} | ${{ startEvent: "available" }} | ${"no availability event"}
    ${[discharged]}                                                               | ${"demurrage"} | ${undefined}                   | ${"still in the terminal: no gate-out"}
    ${[discharged, available]}                                                    | ${"storage"}   | ${undefined}                   | ${"no gate-out"}
    ${[discharged, gatedOut]}                                                     | ${"detention"} | ${undefined}                   | ${"no empty return"}
    ${[emptyReturned]}                                                            | ${"detention"} | ${undefined}                   | ${"no gate-out"}
    ${[discharged, { type: "discharged", at: "2024-06-15T19:00:00Z" }, gatedOut]} | ${"demurrage"} | ${undefined}                   | ${"discharged twice"}
    ${[gatedOut, gatedOut, emptyReturned]}                                        | ${"detention"} | ${undefined}                   | ${"gated out twice"}
    ${[{ type: "discharged", at: "2024-06-21T19:00:00Z" }, gatedOut]}             | ${"demurrage"} | ${undefined}                   | ${"gate-out before discharge"}
    ${[gatedOut, { type: "emptyReturned", at: "2024-06-20T14:29:59Z" }]}          | ${"detention"} | ${undefined}                   | ${"empty return before gate-out"}
    ${[]}                                                                         | ${"demurrage"} | ${undefined}                   | ${"no events"}
    ${"discharged"}                                                               | ${"demurrage"} | ${undefined}                   | ${"events not an array"}
    ${[discharged, gatedOut, null]}                                               | ${"demurrage"} | ${undefined}                   | ${"a null event"}
    ${[discharged, gatedOut, { type: "loaded", at: "2024-06-10T19:00:00Z" }]}     | ${"demurrage"} | ${undefined}                   | ${"an unknown event type, even unused"}
    ${[discharged, gatedOut, { type: "emptyReturned", at: "2024-06-27" }]}        | ${"demurrage"} | ${undefined}                   | ${"an unused event whose instant is not one"}
    ${[discharged, { type: "gatedOut", at: "2024-06-20T14:30:00" }]}              | ${"demurrage"} | ${undefined}                   | ${"a gate-out with no offset designator"}
    ${[discharged, { type: "gatedOut", at: 1718893800000 }]}                      | ${"demurrage"} | ${undefined}                   | ${"an instant that is not a string"}
    ${all}                                                                        | ${"laytime"}   | ${undefined}                   | ${"not a clock this function selects"}
    ${all}                                                                        | ${undefined}   | ${undefined}                   | ${"no scope"}
    ${all}                                                                        | ${"demurrage"} | ${null}                        | ${"null options"}
    ${all}                                                                        | ${"demurrage"} | ${"available"}                 | ${"options as a string"}
    ${all}                                                                        | ${"demurrage"} | ${{ startEvent: "gatedOut" }}  | ${"a start event that is not an import start"}
    ${all}                                                                        | ${"demurrage"} | ${{ startEvent: null }}        | ${"a null start event: a value to validate, not an omission"}
  `("returns the sentinel for $reason", ({ events, scope, options }) => {
    expect(demurrageClock(events, scope, options)).toBeNull();
  });

  it("returns the sentinel when the instant parse throws", () => {
    mockTemporalInstantFromThrow();
    expect(demurrageClock(all, "demurrage")).toBeNull();
  });
});
