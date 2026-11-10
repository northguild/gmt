import { parseTimeScaleString } from "../../internal";
import { Temporal } from "../../internal/temporal";
import {
  mockTemporalInstantFromEpochNanosecondsThrow,
  mockTemporalInstantFromThrow,
} from "../../test/mocks";
import { sameInstantBattleCases } from "../../test/timeZoneMatrix";
import { fromTT } from "./fromTT";
import { toTAI } from "./toTAI";
import { toTT } from "./toTT";

describe("toTT", () => {
  // TT = TAI + 32.184 s exactly (IERS Conventions 2010, TN 36 §10.1); TAI − UTC from the
  // Leap_Second.dat row in force. So TT − UTC is 42.184 s in 1972, 67.184 s in 2013, 69.184 s now.
  it.each`
    isoString                              | expected                              | why
    ${"2026-01-01T00:00:00Z"}              | ${"2026-01-01T00:01:09.184 TT"}       | ${"37 + 32.184 = 69.184 s"}
    ${"2013-06-01T00:00:00Z"}              | ${"2013-06-01T00:01:07.184 TT"}       | ${"35 + 32.184 s"}
    ${"1972-01-01T00:00:00Z"}              | ${"1972-01-01T00:00:42.184 TT"}       | ${"10 + 32.184 s, the first row"}
    ${"2016-12-31T23:59:59Z"}              | ${"2017-01-01T00:01:07.184 TT"}       | ${"36 + 32.184 s"}
    ${"2017-01-01T00:00:00Z"}              | ${"2017-01-01T00:01:09.184 TT"}       | ${"37 + 32.184 s"}
    ${"2026-01-01T00:00:00.000000001Z"}    | ${"2026-01-01T00:01:09.184000001 TT"} | ${"nanoseconds kept"}
    ${"2026-01-01T01:00:00+01:00"}         | ${"2026-01-01T00:01:09.184 TT"}       | ${"offset read"}
    ${"2026-01-01T00:00:00Z[Europe/Oslo]"} | ${"2026-01-01T00:01:09.184 TT"}       | ${"bracketed zone ignored"}
    ${"9999-12-31T23:58:50Z"}              | ${"9999-12-31T23:59:59.184 TT"}       | ${"last whole second that fits"}
    ${"9999-12-31T23:58:50.815999999Z"}    | ${"9999-12-31T23:59:59.999999999 TT"} | ${"last nanosecond that fits (TT is 69.184 s ahead in 9999)"}
    ${"9999-12-31T23:58:50.5Z"}            | ${"9999-12-31T23:59:59.684 TT"}       | ${"shortest fraction near the year edge"}
    ${"2026-01-01T00:00:00.5Z"}            | ${"2026-01-01T00:01:09.684 TT"}       | ${"69.184 + 0.5 s"}
    ${"2026-01-01T00:00:00.816Z"}          | ${"2026-01-01T00:01:10 TT"}           | ${"fraction .000 drops, whole second"}
    ${"2026-01-01T00:00:00.816000001Z"}    | ${"2026-01-01T00:01:10.000000001 TT"} | ${"1 ns past the whole second keeps all nine digits"}
    ${"2025-12-31T23:58:50.816Z"}          | ${"2026-01-01T00:00:00 TT"}           | ${"TT label passes the year while UTC has not"}
    ${"2025-12-31T23:58:50.815999999Z"}    | ${"2025-12-31T23:59:59.999999999 TT"} | ${"1 ns before the TT year rolls"}
    ${"2024-02-28T23:58:50.816Z"}          | ${"2024-02-29T00:00:00 TT"}           | ${"TT label reaches the leap day first"}
    ${"1972-01-01T00:00:00.000000001Z"}    | ${"1972-01-01T00:00:42.184000001 TT"} | ${"1 ns after the first instant"}
    ${"2016-12-31T23:59:59.999999999Z"}    | ${"2017-01-01T00:01:08.183999999 TT"} | ${"1 ns before the inserted second"}
    ${"2017-01-01T00:00:00.000000001Z"}    | ${"2017-01-01T00:01:09.184000001 TT"} | ${"1 ns after the inserted second"}
  `("returns $expected for $isoString ($why)", ({ isoString, expected }) => {
    expect(toTT(isoString)).toBe(expected);
  });

  // An inserted second maps to its own TT second: 36 + 1 + 32.184 s past 2017-01-01T00:00:00.
  it.each`
    isoString                           | expected
    ${"2016-12-31T23:59:60Z"}           | ${"2017-01-01T00:01:08.184 TT"}
    ${"2016-12-31T23:59:60.5Z"}         | ${"2017-01-01T00:01:08.684 TT"}
    ${"2016-12-31T23:59:60.999999999Z"} | ${"2017-01-01T00:01:09.183999999 TT"}
    ${"2015-06-30T23:59:60Z"}           | ${"2015-07-01T00:01:07.184 TT"}
  `(
    "maps the inserted second $isoString to $expected",
    ({ isoString, expected }) => {
      expect(toTT(isoString)).toBe(expected);
    },
  );

  it.each`
    isoString                           | why
    ${"9999-12-31T23:58:51Z"}           | ${"the TT label is 10000-01-01T00:00:00.184"}
    ${"2017-12-31T23:59:60Z"}           | ${"second 60 with no insertion that day"}
    ${"1971-12-31T23:59:59Z"}           | ${"before 1972"}
    ${"9999-12-31T23:58:50.816Z"}       | ${"1 ns past the last fit: TT label is 10000-01-01T00:00:00"}
    ${"9999-12-31T23:59:59Z"}           | ${"UTC still in 9999, TT past it"}
    ${"1971-12-31T23:59:59.999999999Z"} | ${"1 ns before 1972"}
    ${"2016-06-30T23:59:60Z"}           | ${"second 60 on a June 30 with no insertion"}
    ${"2015-12-31T23:59:60Z"}           | ${"second 60 on a December 31 with no insertion"}
    ${"+275760-09-13T00:00:00Z"}        | ${"Temporal's last instant"}
  `("returns '' for $isoString ($why)", ({ isoString }) => {
    expect(toTT(isoString)).toBe("");
  });

  it.each`
    isoString                | label
    ${null}                  | ${"null"}
    ${undefined}             | ${"undefined"}
    ${123}                   | ${"123"}
    ${""}                    | ${"''"}
    ${"garbage"}             | ${"'garbage'"}
    ${"2026-01-01"}          | ${"'2026-01-01'"}
    ${"2026-01-01T00:00:00"} | ${"'2026-01-01T00:00:00'"}
  `("returns '' for the invalid $label", ({ isoString }) => {
    expect(toTT(isoString)).toBe("");
  });

  it.each(sameInstantBattleCases)(
    "returns 2024-02-29T00:01:09.184 TT for 2024-02-29T00:00:00Z written in $timeZone",
    ({ value }) => {
      expect(toTT(value)).toBe("2024-02-29T00:01:09.184 TT");
    },
  );

  it("returns '' when Temporal.Instant.from throws on a second-60 string", () => {
    mockTemporalInstantFromThrow();
    expect(toTT("2016-12-31T23:59:60Z")).toBe("");
  });

  it("returns '' when Temporal.Instant.fromEpochNanoseconds throws while writing", () => {
    mockTemporalInstantFromEpochNanosecondsThrow();
    expect(toTT("2026-01-01T00:00:00Z")).toBe("");
  });
});

// Every inserted leap second (ITU-R TF.460-6 Annex 1 §2.2; 27 rows after the first in
// Leap_Second.dat): the second before, the second 60 and the next midnight are consecutive TT
// seconds, TT = UTC + (TAI − UTC) + 32.184 s with the row that starts at nextDay's midnight.
describe("toTT around every inserted leap second", () => {
  it.each`
    leapDay         | nextDay         | beforeTT                        | duringTT                        | afterTT
    ${"1972-06-30"} | ${"1972-07-01"} | ${"1972-07-01T00:00:41.184 TT"} | ${"1972-07-01T00:00:42.184 TT"} | ${"1972-07-01T00:00:43.184 TT"}
    ${"1972-12-31"} | ${"1973-01-01"} | ${"1973-01-01T00:00:42.184 TT"} | ${"1973-01-01T00:00:43.184 TT"} | ${"1973-01-01T00:00:44.184 TT"}
    ${"1973-12-31"} | ${"1974-01-01"} | ${"1974-01-01T00:00:43.184 TT"} | ${"1974-01-01T00:00:44.184 TT"} | ${"1974-01-01T00:00:45.184 TT"}
    ${"1974-12-31"} | ${"1975-01-01"} | ${"1975-01-01T00:00:44.184 TT"} | ${"1975-01-01T00:00:45.184 TT"} | ${"1975-01-01T00:00:46.184 TT"}
    ${"1975-12-31"} | ${"1976-01-01"} | ${"1976-01-01T00:00:45.184 TT"} | ${"1976-01-01T00:00:46.184 TT"} | ${"1976-01-01T00:00:47.184 TT"}
    ${"1976-12-31"} | ${"1977-01-01"} | ${"1977-01-01T00:00:46.184 TT"} | ${"1977-01-01T00:00:47.184 TT"} | ${"1977-01-01T00:00:48.184 TT"}
    ${"1977-12-31"} | ${"1978-01-01"} | ${"1978-01-01T00:00:47.184 TT"} | ${"1978-01-01T00:00:48.184 TT"} | ${"1978-01-01T00:00:49.184 TT"}
    ${"1978-12-31"} | ${"1979-01-01"} | ${"1979-01-01T00:00:48.184 TT"} | ${"1979-01-01T00:00:49.184 TT"} | ${"1979-01-01T00:00:50.184 TT"}
    ${"1979-12-31"} | ${"1980-01-01"} | ${"1980-01-01T00:00:49.184 TT"} | ${"1980-01-01T00:00:50.184 TT"} | ${"1980-01-01T00:00:51.184 TT"}
    ${"1981-06-30"} | ${"1981-07-01"} | ${"1981-07-01T00:00:50.184 TT"} | ${"1981-07-01T00:00:51.184 TT"} | ${"1981-07-01T00:00:52.184 TT"}
    ${"1982-06-30"} | ${"1982-07-01"} | ${"1982-07-01T00:00:51.184 TT"} | ${"1982-07-01T00:00:52.184 TT"} | ${"1982-07-01T00:00:53.184 TT"}
    ${"1983-06-30"} | ${"1983-07-01"} | ${"1983-07-01T00:00:52.184 TT"} | ${"1983-07-01T00:00:53.184 TT"} | ${"1983-07-01T00:00:54.184 TT"}
    ${"1985-06-30"} | ${"1985-07-01"} | ${"1985-07-01T00:00:53.184 TT"} | ${"1985-07-01T00:00:54.184 TT"} | ${"1985-07-01T00:00:55.184 TT"}
    ${"1987-12-31"} | ${"1988-01-01"} | ${"1988-01-01T00:00:54.184 TT"} | ${"1988-01-01T00:00:55.184 TT"} | ${"1988-01-01T00:00:56.184 TT"}
    ${"1989-12-31"} | ${"1990-01-01"} | ${"1990-01-01T00:00:55.184 TT"} | ${"1990-01-01T00:00:56.184 TT"} | ${"1990-01-01T00:00:57.184 TT"}
    ${"1990-12-31"} | ${"1991-01-01"} | ${"1991-01-01T00:00:56.184 TT"} | ${"1991-01-01T00:00:57.184 TT"} | ${"1991-01-01T00:00:58.184 TT"}
    ${"1992-06-30"} | ${"1992-07-01"} | ${"1992-07-01T00:00:57.184 TT"} | ${"1992-07-01T00:00:58.184 TT"} | ${"1992-07-01T00:00:59.184 TT"}
    ${"1993-06-30"} | ${"1993-07-01"} | ${"1993-07-01T00:00:58.184 TT"} | ${"1993-07-01T00:00:59.184 TT"} | ${"1993-07-01T00:01:00.184 TT"}
    ${"1994-06-30"} | ${"1994-07-01"} | ${"1994-07-01T00:00:59.184 TT"} | ${"1994-07-01T00:01:00.184 TT"} | ${"1994-07-01T00:01:01.184 TT"}
    ${"1995-12-31"} | ${"1996-01-01"} | ${"1996-01-01T00:01:00.184 TT"} | ${"1996-01-01T00:01:01.184 TT"} | ${"1996-01-01T00:01:02.184 TT"}
    ${"1997-06-30"} | ${"1997-07-01"} | ${"1997-07-01T00:01:01.184 TT"} | ${"1997-07-01T00:01:02.184 TT"} | ${"1997-07-01T00:01:03.184 TT"}
    ${"1998-12-31"} | ${"1999-01-01"} | ${"1999-01-01T00:01:02.184 TT"} | ${"1999-01-01T00:01:03.184 TT"} | ${"1999-01-01T00:01:04.184 TT"}
    ${"2005-12-31"} | ${"2006-01-01"} | ${"2006-01-01T00:01:03.184 TT"} | ${"2006-01-01T00:01:04.184 TT"} | ${"2006-01-01T00:01:05.184 TT"}
    ${"2008-12-31"} | ${"2009-01-01"} | ${"2009-01-01T00:01:04.184 TT"} | ${"2009-01-01T00:01:05.184 TT"} | ${"2009-01-01T00:01:06.184 TT"}
    ${"2012-06-30"} | ${"2012-07-01"} | ${"2012-07-01T00:01:05.184 TT"} | ${"2012-07-01T00:01:06.184 TT"} | ${"2012-07-01T00:01:07.184 TT"}
    ${"2015-06-30"} | ${"2015-07-01"} | ${"2015-07-01T00:01:06.184 TT"} | ${"2015-07-01T00:01:07.184 TT"} | ${"2015-07-01T00:01:08.184 TT"}
    ${"2016-12-31"} | ${"2017-01-01"} | ${"2017-01-01T00:01:07.184 TT"} | ${"2017-01-01T00:01:08.184 TT"} | ${"2017-01-01T00:01:09.184 TT"}
  `(
    "maps $leapDay T23:59:59, T23:59:60 and $nextDay T00:00:00 to $beforeTT, $duringTT, $afterTT",
    ({ leapDay, nextDay, beforeTT, duringTT, afterTT }) => {
      expect(toTT(`${leapDay}T23:59:59Z`)).toBe(beforeTT);
      expect(toTT(`${leapDay}T23:59:60Z`)).toBe(duringTT);
      expect(toTT(`${nextDay}T00:00:00Z`)).toBe(afterTT);
    },
  );
});

describe("toTT against toTAI", () => {
  const inputs = [
    "2026-01-01T00:00:00Z",
    "2013-06-01T00:00:00Z",
    "1972-01-01T00:00:00Z",
    "2016-12-31T23:59:60Z",
    "2016-12-31T23:59:60.5Z",
    "2016-12-31T23:59:59Z",
    "2017-01-01T00:00:00Z",
    "2026-01-01T00:00:00.000000001Z",
    "9999-12-31T23:58:50Z",
  ];

  it.each(inputs)(
    "TT − TAI is exactly 32.184 s for %s (IERS TN 36 §10.1)",
    (iso) => {
      const tt = parseTimeScaleString(toTT(iso), "TT");
      const tai = parseTimeScaleString(toTAI(iso), "TAI");
      expect(tt?.labelNanoseconds).toBeDefined();
      expect(tt!.labelNanoseconds - tai!.labelNanoseconds).toBe(
        32_184_000_000n,
      );
    },
  );
});

describe("toTT and fromTT round trip", () => {
  it.each`
    iso
    ${"2026-01-01T00:00:00Z"}
    ${"2013-06-01T00:00:00Z"}
    ${"1972-01-01T00:00:00Z"}
    ${"2016-12-31T23:59:60Z"}
    ${"2016-12-31T23:59:60.5Z"}
    ${"2016-12-31T23:59:59Z"}
    ${"2017-01-01T00:00:00Z"}
    ${"2026-01-01T00:00:00.000000001Z"}
    ${"9999-12-31T23:58:50Z"}
  `("fromTT(toTT($iso)) returns $iso", ({ iso }) => {
    expect(fromTT(toTT(iso))).toBe(iso);
  });

  it("fromTT(toTT(x)) is the same instant for an offset input", () => {
    const back = fromTT(toTT("2026-01-01T01:00:00+01:00"));
    expect(Temporal.Instant.from(back).epochNanoseconds).toBe(
      Temporal.Instant.from("2026-01-01T00:00:00Z").epochNanoseconds,
    );
  });
});
