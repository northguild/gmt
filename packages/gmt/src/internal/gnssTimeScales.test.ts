import { Temporal } from "@js-temporal/polyfill";
import { taiMinusUtc } from "../timescale/calculate/taiMinusUtc";
import { LEAP_SECOND_STEPS } from "./leapSeconds";
import {
  GNSS_TIME_SCALES,
  isGnssSystem,
  scaleLabelOfUtc,
  utcOfScaleLabel,
} from "./gnssTimeScales";

/** Label nanoseconds of a scale's wall clock (`YYYY-MM-DDTHH:MM:SS[.f]`), read as if UTC. */
function labelNs(label: string): bigint {
  return Temporal.PlainDateTime.from(label).toZonedDateTime("UTC")
    .epochNanoseconds;
}

function utcNs(iso: string): bigint {
  return Temporal.Instant.from(iso).epochNanoseconds;
}

function ordinary(iso: string) {
  return { epochNanoseconds: utcNs(iso), secondSixty: false };
}

describe("GNSS_TIME_SCALES", () => {
  // Each epoch label is the first label the scale defines, read as if UTC.
  it.each`
    system   | label                    | source
    ${"GPS"} | ${"1980-01-06T00:00:00"} | ${"IS-GPS-200N §3.3.4: midnight January 5/6, 1980"}
    ${"GAL"} | ${"1999-08-22T00:00:00"} | ${"RINEX 4.02 §4.1.3: GPS week 1024; Galileo OS SIS ICD Issue 2.2 §5.1.2"}
    ${"BDT"} | ${"2006-01-01T00:00:00"} | ${"BDS-SIS-ICD-B1I-3.0 §3.3: 00:00:00 UTC 1 January 2006"}
    ${"QZS"} | ${"1980-01-06T00:00:00"} | ${"IS-QZSS-PNT-006 §5.1: weeks from GPST's 1980-01-06"}
    ${"IRN"} | ${"1999-08-22T00:00:00"} | ${"RINEX 4.02 §4.1.6; ISRO-IRNSS-ICD-SPS-1.1 §5.7: 00:00:00 IRNSST 1999-08-22"}
  `("puts the $system epoch label at $label ($source)", ({ system, label }) => {
    expect(
      GNSS_TIME_SCALES[system as keyof typeof GNSS_TIME_SCALES].epochLabel,
    ).toBe(labelNs(label));
  });

  // BIPM Annual Report vol. 15 p. 48: "[TAI - GPS time] = 19 s + C0"; GPS time was UTC at its
  // epoch (IS-GPS-200N §3.3.4), when TAI − UTC was 19 s.
  it("sets GPS's TAI − scale to 19 s, TAI − UTC at the GPS epoch", () => {
    expect(GNSS_TIME_SCALES.GPS.taiMinusScale).toBe(19n);
    expect(taiMinusUtc("1980-01-06T00:00:00Z")).toBe(19);
  });

  // BIPM utc-gnss "[UTC-GALILEO time]: (19-xx) s"; cross-check: GST was 13 s ahead of UTC at
  // 1999-08-22 (Galileo Issue 2.2 §5.1.2), when TAI − UTC was 32 s.
  it("sets GAL's TAI − scale to 19 s, TAI − UTC at 1999-08-22 less Galileo's 13 s", () => {
    expect(GNSS_TIME_SCALES.GAL.taiMinusScale).toBe(19n);
    expect(taiMinusUtc("1999-08-22T00:00:00Z")).toBe(32);
    expect((taiMinusUtc("1999-08-22T00:00:00Z") as number) - 13).toBe(19);
  });

  // BIPM utc-gnss "[UTC-BEIDOU time]: (33-xx) s"; BDT was UTC at its epoch (B1I 3.0 §3.3).
  it("sets BDT's TAI − scale to 33 s, TAI − UTC at the BeiDou epoch", () => {
    expect(GNSS_TIME_SCALES.BDT.taiMinusScale).toBe(33n);
    expect(taiMinusUtc("2006-01-01T00:00:00Z")).toBe(33);
  });

  // RINEX 4.02 §4.1.7 Table 1: "GPS = QZS = UTC + ΔtLS"; IS-QZSS-PNT-006 §5.1: QZSST is "delayed
  // from TAI by 19 seconds".
  it("sets QZS's TAI − scale to 19 s, the same as GPS's", () => {
    expect(GNSS_TIME_SCALES.QZS.taiMinusScale).toBe(19n);
    expect(GNSS_TIME_SCALES.QZS.taiMinusScale).toBe(
      GNSS_TIME_SCALES.GPS.taiMinusScale,
    );
  });

  // Derived, not stated: BIPM publishes no NavIC row and no NavIC ICD mentions TAI. RINEX 4.02
  // Table 1 "GPS = IRN = UTC + ΔtLS"; NavIC led UTC by 13 s at its epoch 1999-08-21T23:59:47Z
  // (RINEX 4.02 §4.1.6; ISRO-IRNSS-ICD-SPS-1.1 §5.7), when TAI − UTC was 32 s (IERS).
  it("sets IRN's TAI − scale to 19 s, derived from the NavIC epoch and the IERS table", () => {
    expect(GNSS_TIME_SCALES.IRN.taiMinusScale).toBe(19n);
    expect((taiMinusUtc("1999-08-21T23:59:47Z") as number) - 13).toBe(19);
  });
});

// RINEX 4.02 §4.1.2 ("the same hours as UTC and not UTC+3 h"), §5.2.8 ("GLO to identify the
// GLONASS UTC time"); BIPM Annual Report vol. 15 p. 49 ("[UTC - GLONASS time] = 0 s + C1"). No
// stated epoch, so its labels start where whole-second UTC does: the table's first row (D10).
describe("GNSS_TIME_SCALES: GLO", () => {
  it("has no TAI offset: GLO labels are UTC's own wall clock", () => {
    expect(GNSS_TIME_SCALES.GLO.taiMinusScale).toBeNull();
  });

  it("starts GLO labels at the leap-second table's first row, 1972-01-01T00:00:00", () => {
    expect(GNSS_TIME_SCALES.GLO.epochLabel).toBe(LEAP_SECOND_STEPS.at[0]);
    expect(GNSS_TIME_SCALES.GLO.epochLabel).toBe(
      labelNs("1972-01-01T00:00:00"),
    );
  });
});

describe("isGnssSystem", () => {
  it.each`
    value
    ${"GPS"}
    ${"GAL"}
    ${"BDT"}
    ${"QZS"}
    ${"GLO"}
    ${"IRN"}
  `("accepts the RINEX time-system identifier $value", ({ value }) => {
    expect(isGnssSystem(value)).toBe(true);
  });

  it.each`
    value          | why
    ${"gps"}       | ${"lower case"}
    ${"BDS"}       | ${"the constellation, not a time token"}
    ${"GLONASS"}   | ${"not a RINEX token"}
    ${"NAVIC"}     | ${"not a RINEX token"}
    ${"TAI"}       | ${"not a satellite system"}
    ${""}          | ${"empty"}
    ${"toString"}  | ${"an inherited property name"}
    ${"__proto__"} | ${"the prototype accessor"}
    ${null}        | ${"null"}
    ${1}           | ${"a number"}
  `("rejects $value ($why)", ({ value }) => {
    expect(isGnssSystem(value)).toBe(false);
  });
});

describe("scaleLabelOfUtc and utcOfScaleLabel: GPS", () => {
  // GPS = TAI − 19 s, and TAI − UTC comes from the IERS table.
  it.each`
    utc                       | label
    ${"1980-01-06T00:00:00Z"} | ${"1980-01-06T00:00:00"}
    ${"2024-01-01T00:00:00Z"} | ${"2024-01-01T00:00:18"}
  `("places UTC $utc at GPS label $label and back", ({ utc, label }) => {
    expect(scaleLabelOfUtc("GPS", ordinary(utc))).toEqual({
      labelNanoseconds: labelNs(label),
      secondSixty: false,
    });
    expect(
      utcOfScaleLabel("GPS", {
        labelNanoseconds: labelNs(label),
        secondSixty: false,
      }),
    ).toEqual(ordinary(utc));
  });

  it("places the inserted second 2016-12-31T23:59:60Z at GPS 2017-01-01T00:00:17", () => {
    const reading = {
      epochNanoseconds: utcNs("2016-12-31T23:59:59Z"),
      secondSixty: true,
    };
    const label = {
      labelNanoseconds: labelNs("2017-01-01T00:00:17"),
      secondSixty: false,
    };
    expect(scaleLabelOfUtc("GPS", reading)).toEqual(label);
    expect(utcOfScaleLabel("GPS", label)).toEqual(reading);
  });

  it.each`
    utc                                 | why
    ${"1980-01-05T23:59:59.999999999Z"} | ${"before the GPS epoch"}
    ${"1971-12-31T23:59:59Z"}           | ${"before the leap-second table"}
  `("returns null for UTC $utc ($why)", ({ utc }) => {
    expect(scaleLabelOfUtc("GPS", ordinary(utc))).toBeNull();
  });

  it("returns null for a second-60 reading on a day with no insertion", () => {
    expect(
      scaleLabelOfUtc("GPS", {
        epochNanoseconds: utcNs("2017-12-31T23:59:59Z"),
        secondSixty: true,
      }),
    ).toBeNull();
  });

  it.each`
    label                              | secondSixty | why
    ${"1980-01-05T23:59:59.999999999"} | ${false}    | ${"before the GPS epoch"}
    ${"2016-12-31T23:59:59"}           | ${true}     | ${"GPS is continuous: no second 60"}
  `(
    "returns null for GPS label $label, secondSixty $secondSixty ($why)",
    ({ label, secondSixty }) => {
      expect(
        utcOfScaleLabel("GPS", {
          labelNanoseconds: labelNs(label),
          secondSixty,
        }),
      ).toBeNull();
    },
  );
});

describe("scaleLabelOfUtc and utcOfScaleLabel: GLO", () => {
  it.each`
    clock                    | secondSixty | why
    ${"2024-01-01T00:00:00"} | ${false}    | ${"an ordinary second"}
    ${"1972-01-01T00:00:00"} | ${false}    | ${"the first GLO label"}
    ${"2016-12-31T23:59:59"} | ${true}     | ${"the inserted second 23:59:60, kept as second 60"}
  `(
    "keeps UTC's wall clock $clock, secondSixty $secondSixty, both ways ($why)",
    ({ clock, secondSixty }) => {
      const reading = { epochNanoseconds: labelNs(clock), secondSixty };
      const label = { labelNanoseconds: labelNs(clock), secondSixty };
      expect(scaleLabelOfUtc("GLO", reading)).toEqual(label);
      expect(utcOfScaleLabel("GLO", label)).toEqual(reading);
    },
  );

  it.each`
    clock                    | secondSixty | why
    ${"1971-12-31T23:59:59"} | ${false}    | ${"before 1972"}
    ${"2017-12-31T23:59:59"} | ${true}     | ${"second 60 on a day with no insertion"}
  `(
    "returns null both ways for $clock, secondSixty $secondSixty ($why)",
    ({ clock, secondSixty }) => {
      expect(
        scaleLabelOfUtc("GLO", {
          epochNanoseconds: labelNs(clock),
          secondSixty,
        }),
      ).toBeNull();
      expect(
        utcOfScaleLabel("GLO", {
          labelNanoseconds: labelNs(clock),
          secondSixty,
        }),
      ).toBeNull();
    },
  );
});
