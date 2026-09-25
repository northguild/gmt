import { mockTemporalPlainDateFromThrow } from "../../test/mocks";
import { hostileProxy, revokedProxy } from "../../test/noThrow";
import { convertUtcToPlainDate } from "../../utc/convert/convertUtcToPlainDate";
import { billingTimeline } from "./billingTimeline";
import { chargeableDays } from "./chargeableDays";

/** Three 30-day windows: the caller-supplied shape, with one sample number. */
const thirty = { issueDays: 30, disputeDays: 30, resolutionDays: 30 };

/** A forecast: only the anchor exists, so only the invoice deadline is known. */
const forecast = {
  issuedByDeadline: null,
  disputeDeadline: null,
  requestedByDeadline: null,
  resolutionDeadline: null,
};

/** An options bag whose `key` getter throws: the harness cannot see a hostile member. */
function throwingMember<T extends object>(base: T, key: string): T {
  return Object.defineProperty({ ...base }, key, {
    enumerable: true,
    get(): never {
      throw new Error(`hostile ${key}`);
    },
  }) as T;
}

describe("billingTimeline", () => {
  it("returns the spec's own example: an invoice on day 30 is by the deadline, day 31 is not", () => {
    expect(
      billingTimeline(
        { anchorOn: "2026-03-01", invoiceIssuedOn: "2026-03-31" },
        thirty,
      ),
    ).toEqual({
      invoiceDeadline: "2026-03-31",
      issuedByDeadline: true,
      disputeDeadline: "2026-04-30",
      requestedByDeadline: null,
      resolutionDeadline: null,
    });
    expect(
      billingTimeline(
        { anchorOn: "2026-03-01", invoiceIssuedOn: "2026-04-01" },
        thirty,
      ),
    ).toEqual({
      invoiceDeadline: "2026-03-31",
      issuedByDeadline: false,
      disputeDeadline: "2026-05-01",
      requestedByDeadline: null,
      resolutionDeadline: null,
    });
  });

  it("is a forecast with only an anchor: the invoice deadline is known and every other field is null", () => {
    expect(billingTimeline({ anchorOn: "2026-03-01" }, thirty)).toEqual({
      invoiceDeadline: "2026-03-31",
      ...forecast,
    });
  });

  // Day zero is the anchor and the deadline is `anchor + days` in calendar days on the ISO
  // calendar (Temporal.PlainDate.add): a leap day, a month end, a year end and a span across a
  // DST change are each 30 dates, never 30 × 24 hours.
  it.each`
    anchorOn           | issueDays | invoiceDeadline    | crosses
    ${"2028-01-30"}    | ${30}     | ${"2028-02-29"}    | ${"a leap day"}
    ${"2027-01-30"}    | ${30}     | ${"2027-03-01"}    | ${"a February with no leap day"}
    ${"2026-01-31"}    | ${30}     | ${"2026-03-02"}    | ${"a month end"}
    ${"2025-12-31"}    | ${30}     | ${"2026-01-30"}    | ${"a year end"}
    ${"2026-02-20"}    | ${30}     | ${"2026-03-22"}    | ${"8 March 2026, a spring-forward date in some zones"}
    ${"2026-03-10"}    | ${30}     | ${"2026-04-09"}    | ${"29 March 2026, a spring-forward date in some zones"}
    ${"2026-10-20"}    | ${30}     | ${"2026-11-19"}    | ${"25 October and 1 November 2026, fall-back dates in some zones"}
    ${"2026-03-01"}    | ${0}      | ${"2026-03-01"}    | ${"nothing: a zero window ends on the anchor"}
    ${"2026-03-01"}    | ${-0}     | ${"2026-03-01"}    | ${"nothing: negative zero is the integer 0, not a negative window"}
    ${"-271821-04-19"} | ${30}     | ${"-271821-05-19"} | ${"the range minimum"}
  `(
    "counts $issueDays calendar days from $anchorOn across $crosses to $invoiceDeadline",
    ({ anchorOn, issueDays, invoiceDeadline }) => {
      expect(billingTimeline({ anchorOn }, { ...thirty, issueDays })).toEqual({
        invoiceDeadline,
        ...forecast,
      });
    },
  );

  // `+275760-09-13` is the last PlainDate; every link in the chain that counts past it is out of
  // range. An agreed date replaces the computed resolution deadline, so that one is never counted.
  const last = "+275760-09-13";
  it.each`
    dates                                                                 | windows                                                                          | expected                                                                                                                         | reads
    ${{ anchorOn: last }}                                                 | ${thirty}                                                                        | ${null}                                                                                                                          | ${"an invoice deadline past the range"}
    ${{ anchorOn: last }}                                                 | ${{ ...thirty, issueDays: 0 }}                                                   | ${{ invoiceDeadline: last, ...forecast }}                                                                                        | ${"a zero-day invoice window on the last date: in range"}
    ${{ anchorOn: last, invoiceIssuedOn: last }}                          | ${{ issueDays: 0, disputeDays: 1, resolutionDays: 0 }}                           | ${null}                                                                                                                          | ${"a dispute deadline past the range"}
    ${{ anchorOn: last, invoiceIssuedOn: last, requestReceivedOn: last }} | ${{ issueDays: 0, disputeDays: 0, resolutionDays: 1 }}                           | ${null}                                                                                                                          | ${"a resolution deadline past the range"}
    ${{ anchorOn: last, invoiceIssuedOn: last, requestReceivedOn: last }} | ${{ issueDays: 0, disputeDays: 0, resolutionDays: 1, agreedResolutionOn: last }} | ${{ invoiceDeadline: last, issuedByDeadline: true, disputeDeadline: last, requestedByDeadline: true, resolutionDeadline: last }} | ${"an agreed date in range: the computed resolution deadline is replaced, never counted"}
    ${Object.create({ anchorOn: "2026-03-01" })}                          | ${Object.create(thirty)}                                                         | ${{ invoiceDeadline: "2026-03-31", ...forecast }}                                                                                | ${"inherited members (TC39 Get)"}
  `("reads $reads", ({ dates, windows, expected }) => {
    expect(billingTimeline(dates, windows)).toEqual(expected);
  });

  // The chain fills in as its dates exist. With a request the dispute deadline is compared and
  // the resolution deadline is counted from the request, or replaced by an agreed date.
  it.each`
    invoiceIssuedOn | requestReceivedOn | agreedResolutionOn | requestedByDeadline | resolutionDeadline | reads
    ${"2026-03-20"} | ${"2026-04-19"}   | ${undefined}       | ${true}             | ${"2026-05-19"}    | ${"a request on the dispute deadline, resolution counted from it"}
    ${"2026-03-20"} | ${"2026-04-20"}   | ${undefined}       | ${false}            | ${"2026-05-20"}    | ${"a request a day after the dispute deadline: still counted"}
    ${"2026-03-20"} | ${"2026-04-20"}   | ${"2026-06-01"}    | ${false}            | ${"2026-06-01"}    | ${"an agreed date after the request replaces the computed one"}
    ${"2026-03-20"} | ${"2026-04-19"}   | ${"2026-04-19"}    | ${true}             | ${"2026-04-19"}    | ${"an agreed date on the request day is accepted"}
    ${"2026-03-20"} | ${"2026-04-19"}   | ${"2026-05-19"}    | ${true}             | ${"2026-05-19"}    | ${"an agreed date equal to the computed one (2026-04-19 + 30): same result as none"}
    ${"2026-03-20"} | ${"2026-03-20"}   | ${undefined}       | ${true}             | ${"2026-04-19"}    | ${"a request on the invoice day is accepted"}
  `(
    "reads $reads",
    ({
      invoiceIssuedOn,
      requestReceivedOn,
      agreedResolutionOn,
      requestedByDeadline,
      resolutionDeadline,
    }) => {
      expect(
        billingTimeline(
          { anchorOn: "2026-03-01", invoiceIssuedOn, requestReceivedOn },
          { ...thirty, agreedResolutionOn },
        ),
      ).toEqual({
        invoiceDeadline: "2026-03-31",
        issuedByDeadline: true,
        disputeDeadline: "2026-04-19",
        requestedByDeadline,
        resolutionDeadline,
      });
    },
  );

  it("counts zero-day windows: each deadline is the date it is counted from, and that date is by it", () => {
    expect(
      billingTimeline(
        {
          anchorOn: "2026-03-01",
          invoiceIssuedOn: "2026-03-01",
          requestReceivedOn: "2026-03-01",
        },
        { issueDays: 0, disputeDays: 0, resolutionDays: 0 },
      ),
    ).toEqual({
      invoiceDeadline: "2026-03-01",
      issuedByDeadline: true,
      disputeDeadline: "2026-03-01",
      requestedByDeadline: true,
      resolutionDeadline: "2026-03-01",
    });
  });

  it("anchors a re-bill on the invoice it received, not on the charge", () => {
    expect(
      billingTimeline(
        { anchorOn: "2026-03-10", invoiceIssuedOn: "2026-04-05" },
        thirty,
      ),
    ).toEqual({
      invoiceDeadline: "2026-04-09",
      issuedByDeadline: true,
      disputeDeadline: "2026-05-05",
      requestedByDeadline: null,
      resolutionDeadline: null,
    });
  });

  it("runs a service contract's own windows through the same chain", () => {
    expect(
      billingTimeline(
        {
          anchorOn: "2026-03-01",
          invoiceIssuedOn: "2026-03-05",
          requestReceivedOn: "2026-03-18",
        },
        { issueDays: 14, disputeDays: 14, resolutionDays: 45 },
      ),
    ).toEqual({
      invoiceDeadline: "2026-03-15",
      issuedByDeadline: true,
      disputeDeadline: "2026-03-19",
      requestedByDeadline: true,
      resolutionDeadline: "2026-05-02",
    });
  });

  it("allows an invoice issued before the anchor: charges may still be accruing", () => {
    expect(
      billingTimeline(
        { anchorOn: "2026-03-01", invoiceIssuedOn: "2026-02-20" },
        thirty,
      ),
    ).toEqual({
      invoiceDeadline: "2026-03-31",
      issuedByDeadline: true,
      disputeDeadline: "2026-03-22",
      requestedByDeadline: null,
      resolutionDeadline: null,
    });
  });

  // RFC 9557 annotations, as `isValidDate` reads them: the ISO calendar and an elective unknown
  // annotation are accepted and stripped from every output; a critical unknown annotation and a
  // non-ISO calendar are rejected. An ISO 8601 expanded year (`+002026`) is the same date and is
  // emitted in the canonical four-digit form.
  it.each`
    anchorOn                      | expected
    ${"2026-03-01[u-ca=iso8601]"} | ${{ invoiceDeadline: "2026-03-31", ...forecast }}
    ${"2026-03-01[foo=bar]"}      | ${{ invoiceDeadline: "2026-03-31", ...forecast }}
    ${"2026-03-01[!foo=bar]"}     | ${null}
    ${"2026-03-01[u-ca=hebrew]"}  | ${null}
    ${"2026-03-01[Europe/Paris]"} | ${{ invoiceDeadline: "2026-03-31", ...forecast }}
    ${"+002026-03-01"}            | ${{ invoiceDeadline: "2026-03-31", ...forecast }}
  `(
    "reads anchor $anchorOn as isValidDate does, emitting bare canonical ISO",
    ({ anchorOn, expected }) => {
      expect(billingTimeline({ anchorOn }, thirty)).toEqual(expected);
    },
  );

  it.each`
    agreedResolutionOn            | resolutionDeadline
    ${"2026-06-01[u-ca=iso8601]"} | ${"2026-06-01"}
    ${"2026-06-01[foo=bar]"}      | ${"2026-06-01"}
    ${"2026-06-01[!foo=bar]"}     | ${null}
    ${"2026-06-01[u-ca=hebrew]"}  | ${null}
  `(
    "emits an agreed date $agreedResolutionOn as bare ISO, or the sentinel",
    ({ agreedResolutionOn, resolutionDeadline }) => {
      expect(
        billingTimeline(
          {
            anchorOn: "2026-03-01",
            invoiceIssuedOn: "2026-03-20",
            requestReceivedOn: "2026-04-19",
          },
          { ...thirty, agreedResolutionOn },
        ),
      ).toEqual(
        resolutionDeadline === null
          ? null
          : {
              invoiceDeadline: "2026-03-31",
              issuedByDeadline: true,
              disputeDeadline: "2026-04-19",
              requestedByDeadline: true,
              resolutionDeadline,
            },
      );
    },
  );

  it("emits the dispute deadline bare when the invoice date carries an annotation", () => {
    expect(
      billingTimeline(
        { anchorOn: "2026-03-01", invoiceIssuedOn: "2026-03-31[u-ca=iso8601]" },
        thirty,
      ),
    ).toEqual({
      invoiceDeadline: "2026-03-31",
      issuedByDeadline: true,
      disputeDeadline: "2026-04-30",
      requestedByDeadline: null,
      resolutionDeadline: null,
    });
  });

  it("emits the resolution deadline bare when the request date carries an annotation", () => {
    expect(
      billingTimeline(
        {
          anchorOn: "2026-03-01",
          invoiceIssuedOn: "2026-03-20",
          requestReceivedOn: "2026-04-19[foo=bar]",
        },
        thirty,
      ),
    ).toEqual({
      invoiceDeadline: "2026-03-31",
      issuedByDeadline: true,
      disputeDeadline: "2026-04-19",
      requestedByDeadline: true,
      resolutionDeadline: "2026-05-19",
    });
  });

  // No window has a default, and each is a safe integer of at least 0.
  it.each`
    windows                                              | reason
    ${{ disputeDays: 30, resolutionDays: 30 }}           | ${"issueDays has no default"}
    ${{ issueDays: 30, resolutionDays: 30 }}             | ${"disputeDays has no default"}
    ${{ issueDays: 30, disputeDays: 30 }}                | ${"resolutionDays has no default"}
    ${{ ...thirty, issueDays: 30.5 }}                    | ${"a fractional window"}
    ${{ ...thirty, disputeDays: "30" }}                  | ${"a window as a string"}
    ${{ ...thirty, resolutionDays: Number.NaN }}         | ${"a NaN window"}
    ${{ ...thirty, issueDays: -1 }}                      | ${"a negative window"}
    ${{ ...thirty, disputeDays: 2 ** 53 }}               | ${"a window past the safe integer range"}
    ${{ ...thirty, issueDays: Number.MAX_SAFE_INTEGER }} | ${"a safe-integer window past Temporal's range"}
    ${{ ...thirty, issueDays: Infinity }}                | ${"an infinite window"}
    ${{ ...thirty, resolutionDays: null }}               | ${"a null window"}
    ${{ ...thirty, issueDays: undefined }}               | ${"an explicitly undefined window"}
  `("returns the sentinel for $reason", ({ windows }) => {
    expect(
      billingTimeline(
        { anchorOn: "2026-03-01", invoiceIssuedOn: "2026-03-31" },
        windows,
      ),
    ).toBeNull();
  });

  // An explicit `undefined` on an optional date or the agreed date is an omission (TC39
  // GetOption); the result equals the call without it.
  it.each`
    dates                                                        | windows
    ${{ anchorOn: "2026-03-01", invoiceIssuedOn: undefined }}    | ${thirty}
    ${{ anchorOn: "2026-03-01", requestReceivedOn: undefined }}  | ${thirty}
    ${{ anchorOn: "2026-03-01" }}                                | ${{ ...thirty, agreedResolutionOn: undefined }}
    ${{ anchorOn: "2026-03-01", invoiceIssuedOn: "2026-03-31" }} | ${{ ...thirty, agreedResolutionOn: undefined }}
  `(
    "treats an explicit undefined as absent in $dates with $windows",
    ({ dates, windows }) => {
      const stripped = Object.fromEntries(
        Object.entries(dates).filter(([, value]) => value !== undefined),
      ) as { anchorOn: string };
      expect(billingTimeline(dates, windows)).toEqual(
        billingTimeline(stripped, thirty),
      );
      expect(billingTimeline(dates, windows)).not.toBeNull();
    },
  );

  it.each`
    dates                                                                                                      | windows                                            | reason
    ${null}                                                                                                    | ${thirty}                                          | ${"null dates"}
    ${"2026-03-01"}                                                                                            | ${thirty}                                          | ${"dates as a string"}
    ${[]}                                                                                                      | ${thirty}                                          | ${"dates as an array"}
    ${{ anchorOn: "2026-03-01" }}                                                                              | ${null}                                            | ${"null windows"}
    ${{ anchorOn: "2026-03-01" }}                                                                              | ${1}                                               | ${"windows as a number"}
    ${{ anchorOn: "2026-03-01" }}                                                                              | ${[]}                                              | ${"windows as an array"}
    ${{}}                                                                                                      | ${thirty}                                          | ${"no anchor"}
    ${{ anchorOn: 123 }}                                                                                       | ${thirty}                                          | ${"non-string anchor"}
    ${{ anchorOn: "2026-02-30" }}                                                                              | ${thirty}                                          | ${"an anchor date that does not exist"}
    ${{ anchorOn: "2026-03-01T00:00" }}                                                                        | ${thirty}                                          | ${"an anchor with a time: not a date"}
    ${{ anchorOn: "2026-03-01T00:00:00Z" }}                                                                    | ${thirty}                                          | ${"an anchor instant: reduce it to a date first"}
    ${{ anchorOn: "-271821-04-18" }}                                                                           | ${thirty}                                          | ${"an anchor a day before the minimum"}
    ${{ anchorOn: "2026-03-01", invoiceIssuedOn: null }}                                                       | ${thirty}                                          | ${"null invoice date: not an omission"}
    ${{ anchorOn: "2026-03-01", invoiceIssuedOn: "2026-02-30" }}                                               | ${thirty}                                          | ${"an invoice date that does not exist"}
    ${{ anchorOn: "2026-03-01", invoiceIssuedOn: "2026-03-31", requestReceivedOn: null }}                      | ${thirty}                                          | ${"null request date: not an omission"}
    ${{ anchorOn: "2026-03-01", invoiceIssuedOn: "2026-03-31", requestReceivedOn: "x" }}                       | ${thirty}                                          | ${"invalid request date"}
    ${{ anchorOn: "2026-03-01", invoiceIssuedOn: "2026-03-31[u-ca=hebrew]" }}                                  | ${thirty}                                          | ${"an invoice date in a non-ISO calendar"}
    ${{ anchorOn: "2026-03-01", invoiceIssuedOn: "2026-03-31[!foo=bar]" }}                                     | ${thirty}                                          | ${"an invoice date with a critical unknown annotation"}
    ${{ anchorOn: "2026-03-01", invoiceIssuedOn: "2026-03-20", requestReceivedOn: "2026-04-19[u-ca=hebrew]" }} | ${thirty}                                          | ${"a request date in a non-ISO calendar"}
    ${{ anchorOn: "2026-03-01", invoiceIssuedOn: "2026-03-20", requestReceivedOn: "2026-04-19[!foo=bar]" }}    | ${thirty}                                          | ${"a request date with a critical unknown annotation"}
    ${{ anchorOn: "2026-03-01", requestReceivedOn: "2026-04-19" }}                                             | ${thirty}                                          | ${"a request without an invoice"}
    ${{ anchorOn: "2026-03-01", invoiceIssuedOn: "2026-03-31", requestReceivedOn: "2026-03-30" }}              | ${thirty}                                          | ${"a request before its invoice"}
    ${{ anchorOn: "2026-03-01", invoiceIssuedOn: "2026-03-20", requestReceivedOn: "2026-04-19" }}              | ${{ ...thirty, agreedResolutionOn: "2026-04-18" }} | ${"an agreed date before the request"}
    ${{ anchorOn: "2026-03-01", invoiceIssuedOn: "2026-03-20", requestReceivedOn: "2026-04-19" }}              | ${{ ...thirty, agreedResolutionOn: "2026-02-30" }} | ${"an agreed date that does not exist"}
    ${{ anchorOn: "2026-03-01" }}                                                                              | ${{ ...thirty, agreedResolutionOn: "x" }}          | ${"an invalid agreed date with no request: still validated"}
    ${{ anchorOn: "2026-03-01" }}                                                                              | ${{ ...thirty, agreedResolutionOn: null }}         | ${"a null agreed date: not an omission"}
  `("returns the sentinel for $reason", ({ dates, windows }) => {
    expect(billingTimeline(dates, windows)).toBeNull();
  });

  it("validates an agreed date without a request but cannot act on it", () => {
    expect(
      billingTimeline(
        { anchorOn: "2026-03-01", invoiceIssuedOn: "2026-03-31" },
        { ...thirty, agreedResolutionOn: "2026-01-01" },
      ),
    ).toEqual({
      invoiceDeadline: "2026-03-31",
      issuedByDeadline: true,
      disputeDeadline: "2026-04-30",
      requestedByDeadline: null,
      resolutionDeadline: null,
    });
  });

  it("returns the sentinel when the date parse throws", () => {
    mockTemporalPlainDateFromThrow();
    expect(billingTimeline({ anchorOn: "2026-03-01" }, thirty)).toBeNull();
  });

  // Core Rule 3: a value hostile to every access returns the sentinel, never throws. A hostile
  // proxy passes the object guard and throws on the first read, so the outer catch is what holds.
  const dates = { anchorOn: "2026-03-01", invoiceIssuedOn: "2026-03-31" };
  it.each`
    hostile                                  | make
    ${"a Proxy that throws on any trap"}     | ${() => hostileProxy()}
    ${"a revoked Proxy"}                     | ${() => revokedProxy()}
    ${"a throwing anchorOn getter"}          | ${() => throwingMember(dates, "anchorOn")}
    ${"a throwing invoiceIssuedOn getter"}   | ${() => throwingMember(dates, "invoiceIssuedOn")}
    ${"a throwing requestReceivedOn getter"} | ${() => throwingMember(dates, "requestReceivedOn")}
  `("returns the sentinel for dates that are $hostile", ({ make }) => {
    expect(() => billingTimeline(make() as never, thirty)).not.toThrow();
    expect(billingTimeline(make() as never, thirty)).toBeNull();
  });

  it.each`
    hostile                                   | make
    ${"a Proxy that throws on any trap"}      | ${() => hostileProxy()}
    ${"a revoked Proxy"}                      | ${() => revokedProxy()}
    ${"a throwing issueDays getter"}          | ${() => throwingMember(thirty, "issueDays")}
    ${"a throwing agreedResolutionOn getter"} | ${() => throwingMember(thirty, "agreedResolutionOn")}
  `("returns the sentinel for windows that are $hostile", ({ make }) => {
    expect(() => billingTimeline(dates, make() as never)).not.toThrow();
    expect(billingTimeline(dates, make() as never)).toBeNull();
  });

  // The anchor comes from the free-time layer: the last charged date of a real `chargeableDays`
  // result, or an instant reduced to the billing party's local date. Both name 24 June 2024, and
  // 30 days on is 24 July.
  it("takes its anchor from a chargeableDays result or a reduced instant", () => {
    const charges = chargeableDays(
      "2024-06-14T19:00:00Z",
      "2024-06-24T15:00:00Z",
      3,
      {
        basis: "calendar",
        chargeBasis: "calendar",
        timeZone: "America/New_York",
        firstDay: "eventDay",
      },
    );
    const lastCharged = charges!.chargedDates.at(-1)!;
    expect(lastCharged).toBe("2024-06-24");
    expect(
      convertUtcToPlainDate(charges!.expiresAt, {
        timeZone: "America/New_York",
      }),
    ).toBe(charges!.chargedDates[0]);
    const anchorOn = convertUtcToPlainDate("2024-06-25T03:00:00Z", {
      timeZone: "America/New_York",
    });
    expect(anchorOn).toBe(lastCharged);
    expect(billingTimeline({ anchorOn: lastCharged }, thirty)).toEqual({
      invoiceDeadline: "2024-07-24",
      ...forecast,
    });
  });
});
