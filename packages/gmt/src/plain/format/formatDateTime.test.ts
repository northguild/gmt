import { normalizeDateTime } from "../../internal";
import {
  expectDateTimeEqual,
  expectOneOfDateTimeIcu,
  expectOneOfIcu,
  MustTestLocales,
  oneOfIcu,
  arSAGregorian,
} from "../../test";
import { hostDateTimeText } from "../../test/hostIntl";
import { mockTemporalPlainDateTimeFromThrow } from "../../test/mocks";
import { formatDateTime } from "./formatDateTime";

describe("formatDateTime", () => {
  // en-US
  it.each`
    value                    | options                                                                                                                        | label
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "full", timeStyle: "full" }}                                                                                    | ${"dateStyle full, timeStyle full"}
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "long", timeStyle: "long" }}                                                                                    | ${"dateStyle long, timeStyle long"}
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "medium", timeStyle: "medium" }}                                                                                | ${"dateStyle medium, timeStyle medium"}
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "short", timeStyle: "short" }}                                                                                  | ${"dateStyle short, timeStyle short"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" }}                   | ${"year numeric, month long, day numeric, hour numeric, minute numeric, second numeric"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "numeric" }}                                     | ${"year numeric, month short, day numeric, hour numeric, minute numeric"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }}                | ${"year numeric, month 2-digit, day 2-digit, hour 2-digit, minute 2-digit, second 2-digit"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }}                                   | ${"year numeric, month 2-digit, day 2-digit, hour 2-digit, minute 2-digit"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }}  | ${"year numeric, month 2-digit, day 2-digit, hour 2-digit, minute 2-digit, second 2-digit, hour12 true"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", hour12: false }} | ${"year numeric, month numeric, day numeric, hour numeric, minute numeric, second numeric, hour12 false"}
  `(
    "formats valid datetime $value for en-US with $label in the host's wording",
    ({ value, options }) => {
      expect(formatDateTime(value, MustTestLocales.enUS, options)).toBe(
        hostDateTimeText(MustTestLocales.enUS, options, value),
      );
    },
  );

  // en-GB
  it.each`
    value                    | options                                                                                                                        | label
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "full", timeStyle: "full" }}                                                                                    | ${"dateStyle full, timeStyle full"}
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "long", timeStyle: "long" }}                                                                                    | ${"dateStyle long, timeStyle long"}
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "medium", timeStyle: "medium" }}                                                                                | ${"dateStyle medium, timeStyle medium"}
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "short", timeStyle: "short" }}                                                                                  | ${"dateStyle short, timeStyle short"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" }}                   | ${"year numeric, month long, day numeric, hour numeric, minute numeric, second numeric"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "numeric" }}                                     | ${"year numeric, month short, day numeric, hour numeric, minute numeric"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }}                | ${"year numeric, month 2-digit, day 2-digit, hour 2-digit, minute 2-digit, second 2-digit"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }}                                   | ${"year numeric, month 2-digit, day 2-digit, hour 2-digit, minute 2-digit"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }}  | ${"year numeric, month 2-digit, day 2-digit, hour 2-digit, minute 2-digit, second 2-digit, hour12 true"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", hour12: false }} | ${"year numeric, month numeric, day numeric, hour numeric, minute numeric, second numeric, hour12 false"}
  `(
    "formats valid datetime $value for en-GB with $label in the host's wording",
    ({ value, options }) => {
      expect(formatDateTime(value, MustTestLocales.enGB, options)).toBe(
        hostDateTimeText(MustTestLocales.enGB, options, value),
      );
    },
  );

  // de-DE
  it.each`
    value                    | options                                                                                                                        | expected
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "full", timeStyle: "full" }}                                                                                    | ${"Samstag, 3. Februar 2024 um 14:30:45"}
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "long", timeStyle: "long" }}                                                                                    | ${"3. Februar 2024 um 14:30:45"}
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "medium", timeStyle: "medium" }}                                                                                | ${"03.02.2024, 14:30:45"}
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "short", timeStyle: "short" }}                                                                                  | ${"03.02.24, 14:30"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" }}                   | ${"3. Februar 2024 um 14:30:45"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "numeric" }}                                     | ${"3. Feb. 2024, 14:30"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }}                | ${"03.02.2024, 14:30:45"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }}                                   | ${"03.02.2024, 14:30"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }}  | ${"03.02.2024, 02:30:45 PM"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", hour12: false }} | ${"3.2.2024, 14:30:45"}
  `(
    "formats valid datetime $value for de-DE with options $options to $expected",
    ({ value, options, expected }) => {
      expect(formatDateTime(value, MustTestLocales.deDE, options)).toEqual(
        expected,
      );
    },
  );

  // fr-FR
  it.each`
    value                    | options                                                                                                                        | label
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "full", timeStyle: "full" }}                                                                                    | ${"dateStyle full, timeStyle full"}
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "long", timeStyle: "long" }}                                                                                    | ${"dateStyle long, timeStyle long"}
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "medium", timeStyle: "medium" }}                                                                                | ${"dateStyle medium, timeStyle medium"}
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "short", timeStyle: "short" }}                                                                                  | ${"dateStyle short, timeStyle short"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" }}                   | ${"year numeric, month long, day numeric, hour numeric, minute numeric, second numeric"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "numeric" }}                                     | ${"year numeric, month short, day numeric, hour numeric, minute numeric"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }}                | ${"year numeric, month 2-digit, day 2-digit, hour 2-digit, minute 2-digit, second 2-digit"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }}                                   | ${"year numeric, month 2-digit, day 2-digit, hour 2-digit, minute 2-digit"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }}  | ${"year numeric, month 2-digit, day 2-digit, hour 2-digit, minute 2-digit, second 2-digit, hour12 true"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", hour12: false }} | ${"year numeric, month numeric, day numeric, hour numeric, minute numeric, second numeric, hour12 false"}
  `(
    "formats valid datetime $value for fr-FR with $label in the host's wording",
    ({ value, options }) => {
      expect(formatDateTime(value, MustTestLocales.frFR, options)).toBe(
        hostDateTimeText(MustTestLocales.frFR, options, value),
      );
    },
  );

  // es-ES
  it.each`
    value                    | options                                                                                                                        | expected
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "full", timeStyle: "full" }}                                                                                    | ${"sábado, 3 de febrero de 2024, 14:30:45"}
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "medium", timeStyle: "medium" }}                                                                                | ${"3 feb 2024, 14:30:45"}
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "short", timeStyle: "short" }}                                                                                  | ${"3/2/24, 14:30"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "numeric" }}                                     | ${"3 feb 2024, 14:30"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }}                | ${"03/02/2024, 14:30:45"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }}                                   | ${"03/02/2024, 14:30"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }}  | ${"03/02/2024, 02:30:45 p. m."}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", hour12: false }} | ${"3/2/2024, 14:30:45"}
  `(
    "formats valid datetime $value for es-ES with options $options to $expected",
    ({ value, options, expected }) => {
      expect(formatDateTime(value, MustTestLocales.esES, options)).toEqual(
        expected,
      );
    },
  );

  // es-ES dateStyle:"long" — CLDR changed the date/time connector from a
  // comma (ICU 77 / Node 22.16–22.22) to " a las " (ICU 78 / Node 22.23+, 24, 26).
  it.each`
    options                                                                                                      | expectedVariants
    ${{ dateStyle: "long", timeStyle: "long" }}                                                                  | ${oneOfIcu("3 de febrero de 2024, 14:30:45", "3 de febrero de 2024 a las 14:30:45")}
    ${{ year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" }} | ${oneOfIcu("3 de febrero de 2024, 14:30:45", "3 de febrero de 2024 a las 14:30:45")}
  `(
    "formats valid datetime 2024-02-03T14:30:45 for es-ES with options $options as one of the known ICU variants",
    ({ options, expectedVariants }) => {
      expectOneOfIcu(
        formatDateTime("2024-02-03T14:30:45", MustTestLocales.esES, options),
        expectedVariants,
      );
    },
  );

  // it-IT
  it.each`
    value                    | options                                                                                                                        | expected
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "full", timeStyle: "full" }}                                                                                    | ${"sabato 3 febbraio 2024 alle ore 14:30:45"}
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "long", timeStyle: "long" }}                                                                                    | ${"3 febbraio 2024 alle ore 14:30:45"}
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "medium", timeStyle: "medium" }}                                                                                | ${"3 feb 2024, 14:30:45"}
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "short", timeStyle: "short" }}                                                                                  | ${"03/02/24, 14:30"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" }}                   | ${"3 febbraio 2024 alle ore 14:30:45"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "numeric" }}                                     | ${"3 feb 2024, 14:30"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }}                | ${"03/02/2024, 14:30:45"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }}                                   | ${"03/02/2024, 14:30"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }}  | ${"03/02/2024, 02:30:45 PM"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", hour12: false }} | ${"03/02/2024, 14:30:45"}
  `(
    "formats valid datetime $value for it-IT with options $options to $expected",
    ({ value, options, expected }) => {
      expect(formatDateTime(value, MustTestLocales.itIT, options)).toEqual(
        expected,
      );
    },
  );

  // pt-PT
  it.each`
    value                    | options                                                                                                                        | label
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "full", timeStyle: "full" }}                                                                                    | ${"dateStyle full, timeStyle full"}
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "long", timeStyle: "long" }}                                                                                    | ${"dateStyle long, timeStyle long"}
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "medium", timeStyle: "medium" }}                                                                                | ${"dateStyle medium, timeStyle medium"}
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "short", timeStyle: "short" }}                                                                                  | ${"dateStyle short, timeStyle short"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" }}                   | ${"year numeric, month long, day numeric, hour numeric, minute numeric, second numeric"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "numeric" }}                                     | ${"year numeric, month short, day numeric, hour numeric, minute numeric"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }}                | ${"year numeric, month 2-digit, day 2-digit, hour 2-digit, minute 2-digit, second 2-digit"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }}                                   | ${"year numeric, month 2-digit, day 2-digit, hour 2-digit, minute 2-digit"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", hour12: false }} | ${"year numeric, month numeric, day numeric, hour numeric, minute numeric, second numeric, hour12 false"}
  `(
    "formats valid datetime $value for pt-PT with $label in the host's wording",
    ({ value, options }) => {
      expect(formatDateTime(value, MustTestLocales.ptPT, options)).toBe(
        hostDateTimeText(MustTestLocales.ptPT, options, value),
      );
    },
  );

  // pt-PT 12-hour day period: the wording is the host's ("da tarde" in ICU 77, "p.m." in
  // ICU 78, "PM" in WebKit); the 14:30:45 value is the same on every host.
  it("formats valid datetime 2024-02-03T14:30:45 for pt-PT with a 12-hour day period in the host's wording", () => {
    const options = {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    } as const;
    expect(
      formatDateTime("2024-02-03T14:30:45", MustTestLocales.ptPT, options),
    ).toBe(
      hostDateTimeText(MustTestLocales.ptPT, options, "2024-02-03T14:30:45"),
    );
  });

  // sv-SE
  it.each`
    value                    | options                                                                                                                        | label
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "full", timeStyle: "full" }}                                                                                    | ${"dateStyle full, timeStyle full"}
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "long", timeStyle: "long" }}                                                                                    | ${"dateStyle long, timeStyle long"}
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "medium", timeStyle: "medium" }}                                                                                | ${"dateStyle medium, timeStyle medium"}
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "short", timeStyle: "short" }}                                                                                  | ${"dateStyle short, timeStyle short"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" }}                   | ${"year numeric, month long, day numeric, hour numeric, minute numeric, second numeric"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "numeric" }}                                     | ${"year numeric, month short, day numeric, hour numeric, minute numeric"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }}                | ${"year numeric, month 2-digit, day 2-digit, hour 2-digit, minute 2-digit, second 2-digit"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }}                                   | ${"year numeric, month 2-digit, day 2-digit, hour 2-digit, minute 2-digit"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }}  | ${"year numeric, month 2-digit, day 2-digit, hour 2-digit, minute 2-digit, second 2-digit, hour12 true"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", hour12: false }} | ${"year numeric, month numeric, day numeric, hour numeric, minute numeric, second numeric, hour12 false"}
  `(
    "formats valid datetime $value for sv-SE with $label in the host's wording",
    ({ value, options }) => {
      expect(formatDateTime(value, MustTestLocales.svSE, options)).toBe(
        hostDateTimeText(MustTestLocales.svSE, options, value),
      );
    },
  );

  // is-IS
  it.each`
    value                    | options                                                                                                                        | label
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "full", timeStyle: "full" }}                                                                                    | ${"dateStyle full, timeStyle full"}
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "long", timeStyle: "long" }}                                                                                    | ${"dateStyle long, timeStyle long"}
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "medium", timeStyle: "medium" }}                                                                                | ${"dateStyle medium, timeStyle medium"}
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "short", timeStyle: "short" }}                                                                                  | ${"dateStyle short, timeStyle short"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" }}                   | ${"year numeric, month long, day numeric, hour numeric, minute numeric, second numeric"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "numeric" }}                                     | ${"year numeric, month short, day numeric, hour numeric, minute numeric"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }}                | ${"year numeric, month 2-digit, day 2-digit, hour 2-digit, minute 2-digit, second 2-digit"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }}                                   | ${"year numeric, month 2-digit, day 2-digit, hour 2-digit, minute 2-digit"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }}  | ${"year numeric, month 2-digit, day 2-digit, hour 2-digit, minute 2-digit, second 2-digit, hour12 true"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", hour12: false }} | ${"year numeric, month numeric, day numeric, hour numeric, minute numeric, second numeric, hour12 false"}
  `(
    "formats valid datetime $value for is-IS with $label in the host's wording",
    ({ value, options }) => {
      expect(formatDateTime(value, MustTestLocales.isIS, options)).toBe(
        hostDateTimeText(MustTestLocales.isIS, options, value),
      );
    },
  );

  // zh-CN
  it.each`
    value                    | options                                                                                                                        | label
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "full", timeStyle: "full" }}                                                                                    | ${"dateStyle full, timeStyle full"}
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "long", timeStyle: "long" }}                                                                                    | ${"dateStyle long, timeStyle long"}
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "medium", timeStyle: "medium" }}                                                                                | ${"dateStyle medium, timeStyle medium"}
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "short", timeStyle: "short" }}                                                                                  | ${"dateStyle short, timeStyle short"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" }}                   | ${"year numeric, month long, day numeric, hour numeric, minute numeric, second numeric"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "numeric" }}                                     | ${"year numeric, month short, day numeric, hour numeric, minute numeric"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }}                | ${"year numeric, month 2-digit, day 2-digit, hour 2-digit, minute 2-digit, second 2-digit"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }}                                   | ${"year numeric, month 2-digit, day 2-digit, hour 2-digit, minute 2-digit"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }}  | ${"year numeric, month 2-digit, day 2-digit, hour 2-digit, minute 2-digit, second 2-digit, hour12 true"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", hour12: false }} | ${"year numeric, month numeric, day numeric, hour numeric, minute numeric, second numeric, hour12 false"}
  `(
    "formats valid datetime $value for zh-CN with $label in the host's wording",
    ({ value, options }) => {
      expect(formatDateTime(value, MustTestLocales.zhCN, options)).toBe(
        hostDateTimeText(MustTestLocales.zhCN, options, value),
      );
    },
  );

  // zh-TW
  it.each`
    value                    | options                                                                                                                        | expected
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "long", timeStyle: "long" }}                                                                                    | ${"2024年2月3日 下午2:30:45"}
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "medium", timeStyle: "medium" }}                                                                                | ${"2024年2月3日 下午2:30:45"}
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "short", timeStyle: "short" }}                                                                                  | ${"2024/2/3 下午2:30"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" }}                   | ${"2024年2月3日 下午2:30:45"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "numeric" }}                                     | ${"2024年2月3日 下午2:30"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }}                | ${"2024/02/03 下午02:30:45"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }}                                   | ${"2024/02/03 下午02:30"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }}  | ${"2024/02/03 下午02:30:45"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", hour12: false }} | ${"2024/2/3 14:30:45"}
  `(
    "formats valid datetime $value for zh-TW with options $options to $expected",
    ({ value, options, expected }) => {
      expectDateTimeEqual(
        formatDateTime(value, MustTestLocales.zhTW, options),
        expected,
      );
    },
  );

  // zh-TW dateStyle:"full" — CLDR changed the weekday/time spacing
  // between ICU 77 (Node 22.16–22.22) and ICU 78 (Node 22.23+, 24, 26).
  it("formats valid datetime 2024-02-03T14:30:45 for zh-TW with dateStyle/timeStyle full as one of the known ICU variants", () => {
    expectOneOfDateTimeIcu(
      formatDateTime("2024-02-03T14:30:45", MustTestLocales.zhTW, {
        dateStyle: "full",
        timeStyle: "full",
      }),
      oneOfIcu(
        "2024年2月3日 星期六 下午2:30:45",
        "2024年2月3日星期六 下午2:30:45",
      ),
    );
  });

  // ja-JP
  it.each`
    value                    | options                                                                                                                        | label
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "full", timeStyle: "full" }}                                                                                    | ${"dateStyle full, timeStyle full"}
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "long", timeStyle: "long" }}                                                                                    | ${"dateStyle long, timeStyle long"}
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "medium", timeStyle: "medium" }}                                                                                | ${"dateStyle medium, timeStyle medium"}
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "short", timeStyle: "short" }}                                                                                  | ${"dateStyle short, timeStyle short"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" }}                   | ${"year numeric, month long, day numeric, hour numeric, minute numeric, second numeric"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "numeric" }}                                     | ${"year numeric, month short, day numeric, hour numeric, minute numeric"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }}                | ${"year numeric, month 2-digit, day 2-digit, hour 2-digit, minute 2-digit, second 2-digit"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }}                                   | ${"year numeric, month 2-digit, day 2-digit, hour 2-digit, minute 2-digit"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }}  | ${"year numeric, month 2-digit, day 2-digit, hour 2-digit, minute 2-digit, second 2-digit, hour12 true"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", hour12: false }} | ${"year numeric, month numeric, day numeric, hour numeric, minute numeric, second numeric, hour12 false"}
  `(
    "formats valid datetime $value for ja-JP with $label in the host's wording",
    ({ value, options }) => {
      expect(formatDateTime(value, MustTestLocales.jaJP, options)).toBe(
        hostDateTimeText(MustTestLocales.jaJP, options, value),
      );
    },
  );

  // ko-KR
  it.each`
    value                    | options                                                                                                                        | label
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "full", timeStyle: "full" }}                                                                                    | ${"dateStyle full, timeStyle full"}
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "long", timeStyle: "long" }}                                                                                    | ${"dateStyle long, timeStyle long"}
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "medium", timeStyle: "medium" }}                                                                                | ${"dateStyle medium, timeStyle medium"}
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "short", timeStyle: "short" }}                                                                                  | ${"dateStyle short, timeStyle short"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" }}                   | ${"year numeric, month long, day numeric, hour numeric, minute numeric, second numeric"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "numeric" }}                                     | ${"year numeric, month short, day numeric, hour numeric, minute numeric"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }}                | ${"year numeric, month 2-digit, day 2-digit, hour 2-digit, minute 2-digit, second 2-digit"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }}                                   | ${"year numeric, month 2-digit, day 2-digit, hour 2-digit, minute 2-digit"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }}  | ${"year numeric, month 2-digit, day 2-digit, hour 2-digit, minute 2-digit, second 2-digit, hour12 true"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", hour12: false }} | ${"year numeric, month numeric, day numeric, hour numeric, minute numeric, second numeric, hour12 false"}
  `(
    "formats valid datetime $value for ko-KR with $label in the host's wording",
    ({ value, options }) => {
      expect(formatDateTime(value, MustTestLocales.koKR, options)).toBe(
        hostDateTimeText(MustTestLocales.koKR, options, value),
      );
    },
  );

  // ar-SA
  it.each`
    value                    | options                                                                                                                        | label
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "full", timeStyle: "full" }}                                                                                    | ${"dateStyle full, timeStyle full"}
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "long", timeStyle: "long" }}                                                                                    | ${"dateStyle long, timeStyle long"}
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "medium", timeStyle: "medium" }}                                                                                | ${"dateStyle medium, timeStyle medium"}
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "short", timeStyle: "short" }}                                                                                  | ${"dateStyle short, timeStyle short"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" }}                   | ${"year numeric, month long, day numeric, hour numeric, minute numeric, second numeric"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "numeric" }}                                     | ${"year numeric, month short, day numeric, hour numeric, minute numeric"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }}                | ${"year numeric, month 2-digit, day 2-digit, hour 2-digit, minute 2-digit, second 2-digit"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }}                                   | ${"year numeric, month 2-digit, day 2-digit, hour 2-digit, minute 2-digit"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }}  | ${"year numeric, month 2-digit, day 2-digit, hour 2-digit, minute 2-digit, second 2-digit, hour12 true"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", hour12: false }} | ${"year numeric, month numeric, day numeric, hour numeric, minute numeric, second numeric, hour12 false"}
  `(
    "formats valid datetime $value for ar-SA-u-ca-gregory with $label in the host's wording",
    ({ value, options }) => {
      expect(formatDateTime(value, arSAGregorian, options)).toBe(
        hostDateTimeText(arSAGregorian, options, value),
      );
    },
  );

  // he-IL
  it.each`
    value                    | options                                                                                                                        | label
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "full", timeStyle: "full" }}                                                                                    | ${"dateStyle full, timeStyle full"}
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "long", timeStyle: "long" }}                                                                                    | ${"dateStyle long, timeStyle long"}
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "medium", timeStyle: "medium" }}                                                                                | ${"dateStyle medium, timeStyle medium"}
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "short", timeStyle: "short" }}                                                                                  | ${"dateStyle short, timeStyle short"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" }}                   | ${"year numeric, month long, day numeric, hour numeric, minute numeric, second numeric"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "numeric" }}                                     | ${"year numeric, month short, day numeric, hour numeric, minute numeric"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }}                | ${"year numeric, month 2-digit, day 2-digit, hour 2-digit, minute 2-digit, second 2-digit"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }}                                   | ${"year numeric, month 2-digit, day 2-digit, hour 2-digit, minute 2-digit"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }}  | ${"year numeric, month 2-digit, day 2-digit, hour 2-digit, minute 2-digit, second 2-digit, hour12 true"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", hour12: false }} | ${"year numeric, month numeric, day numeric, hour numeric, minute numeric, second numeric, hour12 false"}
  `(
    "formats valid datetime $value for he-IL with $label in the host's wording",
    ({ value, options }) => {
      expect(formatDateTime(value, MustTestLocales.heIL, options)).toBe(
        hostDateTimeText(MustTestLocales.heIL, options, value),
      );
    },
  );

  // ru-RU
  it.each`
    value                    | options                                                                                                                        | expected
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "full", timeStyle: "full" }}                                                                                    | ${"суббота, 3 февраля 2024 г. в 14:30:45"}
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "long", timeStyle: "long" }}                                                                                    | ${"3 февраля 2024 г. в 14:30:45"}
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "medium", timeStyle: "medium" }}                                                                                | ${"3 февр. 2024 г., 14:30:45"}
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "short", timeStyle: "short" }}                                                                                  | ${"03.02.2024, 14:30"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" }}                   | ${"3 февраля 2024 г. в 14:30:45"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "numeric" }}                                     | ${"3 февр. 2024 г., 14:30"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }}                | ${"03.02.2024, 14:30:45"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }}                                   | ${"03.02.2024, 14:30"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }}  | ${"03.02.2024, 02:30:45 PM"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", hour12: false }} | ${"03.02.2024, 14:30:45"}
  `(
    "formats valid datetime $value for ru-RU with options $options to $expected",
    ({ value, options, expected }) => {
      expect(formatDateTime(value, MustTestLocales.ruRU, options)).toEqual(
        expected,
      );
    },
  );

  // tr-TR
  it.each`
    value                    | options                                                                                                                        | label
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "full", timeStyle: "full" }}                                                                                    | ${"dateStyle full, timeStyle full"}
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "long", timeStyle: "long" }}                                                                                    | ${"dateStyle long, timeStyle long"}
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "medium", timeStyle: "medium" }}                                                                                | ${"dateStyle medium, timeStyle medium"}
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "short", timeStyle: "short" }}                                                                                  | ${"dateStyle short, timeStyle short"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" }}                   | ${"year numeric, month long, day numeric, hour numeric, minute numeric, second numeric"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "numeric" }}                                     | ${"year numeric, month short, day numeric, hour numeric, minute numeric"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }}                | ${"year numeric, month 2-digit, day 2-digit, hour 2-digit, minute 2-digit, second 2-digit"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }}                                   | ${"year numeric, month 2-digit, day 2-digit, hour 2-digit, minute 2-digit"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }}  | ${"year numeric, month 2-digit, day 2-digit, hour 2-digit, minute 2-digit, second 2-digit, hour12 true"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", hour12: false }} | ${"year numeric, month numeric, day numeric, hour numeric, minute numeric, second numeric, hour12 false"}
  `(
    "formats valid datetime $value for tr-TR with $label in the host's wording",
    ({ value, options }) => {
      expect(formatDateTime(value, MustTestLocales.trTR, options)).toBe(
        hostDateTimeText(MustTestLocales.trTR, options, value),
      );
    },
  );

  it.each`
    value                        | locale     | options
    ${"2024-02-29T14:30:45.123"} | ${"en-GB"} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }}
  `("formats edge case datetime $value", ({ value, locale, options }) => {
    expect(formatDateTime(value, locale, options)).not.toBe("");
  });

  // Temporal ECMA-402 PlainDateTime format (GetDateTimeFormat ~any~, ~all~,
  // inherit ~relevant~; AdjustDateTimeStyleFormat for styles): the requested
  // fields and style widths are kept, `era` alone still gets the date and time
  // defaults, and `timeZoneName` is not inherited. Expected values: native
  // Intl.DateTimeFormat at UTC with the adjusted options.
  it.each`
    locale                   | options                                                                                   | expected                              | reason
    ${"en-US"}               | ${{ dateStyle: "short", timeStyle: "full" }}                                              | ${"2/3/24, 2:30:45 PM"}               | ${"short date width kept, zone field removed"}
    ${"de-DE"}               | ${{ dateStyle: "medium", timeStyle: "long" }}                                             | ${"03.02.2024, 14:30:45"}             | ${"medium date width kept, zone field removed"}
    ${"ja-JP-u-ca-japanese"} | ${{ year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "numeric" }} | ${"令和6年2月3日 14:30"}              | ${"requested long month kept"}
    ${"en-US"}               | ${{ era: "long" }}                                                                        | ${"2/3/2024 Anno Domini, 2:30:45 PM"} | ${"era alone gets the date and time defaults"}
    ${"en-US"}               | ${{ era: "long", year: "numeric", month: "numeric", day: "numeric" }}                     | ${"2/3/2024 Anno Domini"}             | ${"date fields give the pre-1.16.0 era text"}
    ${"en-US"}               | ${{ timeZoneName: "long" }}                                                               | ${"2/3/2024, 2:30:45 PM"}             | ${"timeZoneName is not inherited, defaults apply"}
  `(
    "formats 2024-02-03T14:30:45 in $locale with $options to $expected ($reason)",
    ({ locale, options, expected }) => {
      expect(formatDateTime("2024-02-03T14:30:45", locale, options)).toBe(
        expected,
      );
    },
  );

  it.each`
    invalidValue             | label
    ${"not-a-datetime"}      | ${"'not-a-datetime'"}
    ${"2024-02-29"}          | ${"'2024-02-29'"}
    ${"2024-02-29T24:00:00"} | ${"'2024-02-29T24:00:00'"}
    ${""}                    | ${"''"}
    ${null}                  | ${"null"}
    ${undefined}             | ${"undefined"}
    ${true}                  | ${"true"}
  `(
    "returns an empty string for invalid datetime $label",
    ({ invalidValue }) => {
      expect(formatDateTime(invalidValue as never)).toBe("");
    },
  );

  it("returns empty string on failure", () => {
    mockTemporalPlainDateTimeFromThrow();
    const result = formatDateTime("2024-02-29T00:00:00");
    expect(result).toBe("");
  });

  // ECMA-402 CanonicalizeLocaleList: `locale` may be a preference list; the first tag with locale data
  // is used, and a malformed tag anywhere in the list is invalid input. Expected strings from native
  // Intl with the same list.
  it.each`
    locale                                          | expected
    ${[MustTestLocales.frFR, MustTestLocales.enUS]} | ${"03/02/2024 14:30"}
    ${[MustTestLocales.frFR, "not a locale!!"]}     | ${""}
  `("returns '$expected' for locale list $locale", ({ locale, expected }) => {
    expect(
      formatDateTime("2024-02-03T14:30:45", locale, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }),
    ).toBe(normalizeDateTime(expected));
  });
});

// Plan #14: ECMA-402 CoerceOptionsToObject throws TypeError for null options and wraps any other
// primitive with ToObject, which carries no formatting fields, so a string or number formats with
// the defaults. Expected strings from native Chromium 153 (`toLocaleString("en-US", 1)` and
// `new Intl.DateTimeFormat("en-US", null)`, which throws).
describe("formatDateTime with primitive options", () => {
  it.each`
    options   | expected
    ${null}   | ${""}
    ${"long"} | ${"2/3/2024, 2:30:00 PM"}
    ${1}      | ${"2/3/2024, 2:30:00 PM"}
  `("returns '$expected' for options $options", ({ options, expected }) => {
    expect(
      formatDateTime(
        "2024-02-03T14:30:00",
        MustTestLocales.enUS,
        options as never,
      ),
    ).toBe(expected);
  });
});

// ECMA-402 GetOption step 1 is Get(options, property), which follows the prototype chain, so an
// inherited option is read exactly as the same option held as an own property. Here the date is 15
// March 2024, a Friday, so dateStyle "full" in en-US names the weekday.
describe("formatDateTime with inherited options", () => {
  it.each`
    label          | options
    ${"own"}       | ${{ dateStyle: "full" }}
    ${"inherited"} | ${Object.create({ dateStyle: "full" })}
  `(
    "formats with $label options { dateStyle: 'full' }, an inherited option being read like an own one",
    ({ options }) => {
      expect(formatDateTime("2024-03-15T20:00:00", "en-US", options)).toBe(
        "Friday, March 15, 2024",
      );
    },
  );
});

// ECMA-402 GetOption would turn an object option into its ToString. A function accepts a
// string for a string option and nothing else, so it returns its sentinel and the caller's
// toString() is never run.
describe("formatDateTime with an option that is an object", () => {
  it("returns the sentinel for month given as an object, and never calls its toString()", () => {
    let coercions = 0;
    const month = {
      toString() {
        coercions += 1;
        return coercions === 1 ? "long" : "narrow";
      },
    };
    const out = formatDateTime("2024-03-15T20:00:00", "en-US", {
      month,
      day: "numeric",
    } as never);
    expect({ out, coercions }).toEqual({ out: "", coercions: 0 });
  });
});

// A plain date-time has no zone, so a "full" timeStyle is written without one (AdjustDateTimeStyleFormat
// removes the zone field): 20:05:00 in en-US is "8:05:00 PM". A String object is not the string
// the type names, so it is refused with the sentinel, where 1.17 treated it as the string it holds.
describe("formatDateTime with a timeStyle that is a String object", () => {
  it('formats 2024-03-15T20:05:00 with timeStyle "full" as 8:05:00 PM, with no zone name', () => {
    expect(
      formatDateTime("2024-03-15T20:05:00", "en-US", { timeStyle: "full" }),
    ).toBe("8:05:00 PM");
  });

  it('returns "" for 2024-03-15T20:05:00 with timeStyle new String("full")', () => {
    expect(
      formatDateTime("2024-03-15T20:05:00", "en-US", {
        timeStyle: new String("full"),
      } as never),
    ).toBe("");
  });
});
