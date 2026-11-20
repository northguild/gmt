import { clearFormatterCache } from "../../internal/formatterCache";
import { MustTestLocales } from "../../test";
import { mockTemporalPlainDateFromThrow } from "../../test/mocks";
import { countIntlConstructions } from "../../test/countIntlConstructions";
import { hostDateText } from "../../test/hostIntl";
import { isLunisolarTextCompatNeeded } from "../../internal/temporalCompat/capabilities";
import { formatDate } from "./formatDate";

describe("formatDate", () => {
  // en-US
  it.each`
    value           | options                                                  | expected                        | label
    ${"2024-02-03"} | ${{ dateStyle: "full" }}                                 | ${"Saturday, February 3, 2024"} | ${"dateStyle full"}
    ${"2024-02-03"} | ${{ dateStyle: "long" }}                                 | ${"February 3, 2024"}           | ${"dateStyle long"}
    ${"2024-02-03"} | ${{ dateStyle: "medium" }}                               | ${"Feb 3, 2024"}                | ${"dateStyle medium"}
    ${"2024-02-03"} | ${{ dateStyle: "short" }}                                | ${"2/3/24"}                     | ${"dateStyle short"}
    ${"2024-02-03"} | ${{ year: "numeric", month: "long", day: "numeric" }}    | ${"February 3, 2024"}           | ${"year numeric, month long, day numeric"}
    ${"2024-02-03"} | ${{ year: "numeric", month: "short", day: "numeric" }}   | ${"Feb 3, 2024"}                | ${"year numeric, month short, day numeric"}
    ${"2024-02-03"} | ${{ year: "numeric", month: "2-digit", day: "2-digit" }} | ${"02/03/2024"}                 | ${"year numeric, month 2-digit, day 2-digit"}
    ${"2024-02-03"} | ${{ year: "numeric", month: "numeric", day: "numeric" }} | ${"2/3/2024"}                   | ${"year numeric, month numeric, day numeric"}
    ${"2024-02-03"} | ${{ year: "2-digit", month: "numeric", day: "numeric" }} | ${"2/3/24"}                     | ${"year 2-digit, month numeric, day numeric"}
    ${"2024-02-03"} | ${{ year: "2-digit", month: "2-digit", day: "2-digit" }} | ${"02/03/24"}                   | ${"year 2-digit, month 2-digit, day 2-digit"}
  `(
    "formats valid date $value for en-US with options $label to $expected",
    ({ value, options, expected }) => {
      expect(formatDate(value, MustTestLocales.enUS, options)).toEqual(
        expected,
      );
    },
  );
  // en-GB
  it.each`
    value           | options                                                  | expected                       | label
    ${"2024-02-03"} | ${{ dateStyle: "full" }}                                 | ${"Saturday, 3 February 2024"} | ${"dateStyle full"}
    ${"2024-02-03"} | ${{ dateStyle: "long" }}                                 | ${"3 February 2024"}           | ${"dateStyle long"}
    ${"2024-02-03"} | ${{ dateStyle: "medium" }}                               | ${"3 Feb 2024"}                | ${"dateStyle medium"}
    ${"2024-02-03"} | ${{ dateStyle: "short" }}                                | ${"03/02/2024"}                | ${"dateStyle short"}
    ${"2024-02-03"} | ${{ year: "numeric", month: "long", day: "numeric" }}    | ${"3 February 2024"}           | ${"year numeric, month long, day numeric"}
    ${"2024-02-03"} | ${{ year: "numeric", month: "short", day: "numeric" }}   | ${"3 Feb 2024"}                | ${"year numeric, month short, day numeric"}
    ${"2024-02-03"} | ${{ year: "numeric", month: "2-digit", day: "2-digit" }} | ${"03/02/2024"}                | ${"year numeric, month 2-digit, day 2-digit"}
    ${"2024-02-03"} | ${{ year: "numeric", month: "numeric", day: "numeric" }} | ${"03/02/2024"}                | ${"year numeric, month numeric, day numeric"}
    ${"2024-02-03"} | ${{ year: "2-digit", month: "numeric", day: "numeric" }} | ${"03/02/24"}                  | ${"year 2-digit, month numeric, day numeric"}
    ${"2024-02-03"} | ${{ year: "2-digit", month: "2-digit", day: "2-digit" }} | ${"03/02/24"}                  | ${"year 2-digit, month 2-digit, day 2-digit"}
  `(
    "formats valid date $value for en-GB with options $label to $expected",
    ({ value, options, expected }) => {
      expect(formatDate(value, MustTestLocales.enGB, options)).toEqual(
        expected,
      );
    },
  );
  // de-DE
  it.each`
    value           | options                                                  | expected                      | label
    ${"2024-02-03"} | ${{ dateStyle: "full" }}                                 | ${"Samstag, 3. Februar 2024"} | ${"dateStyle full"}
    ${"2024-02-03"} | ${{ dateStyle: "long" }}                                 | ${"3. Februar 2024"}          | ${"dateStyle long"}
    ${"2024-02-03"} | ${{ dateStyle: "medium" }}                               | ${"03.02.2024"}               | ${"dateStyle medium"}
    ${"2024-02-03"} | ${{ dateStyle: "short" }}                                | ${"03.02.24"}                 | ${"dateStyle short"}
    ${"2024-02-03"} | ${{ year: "numeric", month: "long", day: "numeric" }}    | ${"3. Februar 2024"}          | ${"year numeric, month long, day numeric"}
    ${"2024-02-03"} | ${{ year: "numeric", month: "short", day: "numeric" }}   | ${"3. Feb. 2024"}             | ${"year numeric, month short, day numeric"}
    ${"2024-02-03"} | ${{ year: "numeric", month: "2-digit", day: "2-digit" }} | ${"03.02.2024"}               | ${"year numeric, month 2-digit, day 2-digit"}
    ${"2024-02-03"} | ${{ year: "numeric", month: "numeric", day: "numeric" }} | ${"3.2.2024"}                 | ${"year numeric, month numeric, day numeric"}
    ${"2024-02-03"} | ${{ year: "2-digit", month: "numeric", day: "numeric" }} | ${"3.2.24"}                   | ${"year 2-digit, month numeric, day numeric"}
    ${"2024-02-03"} | ${{ year: "2-digit", month: "2-digit", day: "2-digit" }} | ${"03.02.24"}                 | ${"year 2-digit, month 2-digit, day 2-digit"}
  `(
    "formats valid date $value for de-DE with options $label to $expected",
    ({ value, options, expected }) => {
      expect(formatDate(value, MustTestLocales.deDE, options)).toEqual(
        expected,
      );
    },
  );

  // fr-FR
  it.each`
    value           | options                                                  | expected                   | label
    ${"2024-02-03"} | ${{ dateStyle: "full" }}                                 | ${"samedi 3 février 2024"} | ${"dateStyle full"}
    ${"2024-02-03"} | ${{ dateStyle: "long" }}                                 | ${"3 février 2024"}        | ${"dateStyle long"}
    ${"2024-02-03"} | ${{ dateStyle: "medium" }}                               | ${"3 févr. 2024"}          | ${"dateStyle medium"}
    ${"2024-02-03"} | ${{ dateStyle: "short" }}                                | ${"03/02/2024"}            | ${"dateStyle short"}
    ${"2024-02-03"} | ${{ year: "numeric", month: "long", day: "numeric" }}    | ${"3 février 2024"}        | ${"year numeric, month long, day numeric"}
    ${"2024-02-03"} | ${{ year: "numeric", month: "short", day: "numeric" }}   | ${"3 févr. 2024"}          | ${"year numeric, month short, day numeric"}
    ${"2024-02-03"} | ${{ year: "numeric", month: "2-digit", day: "2-digit" }} | ${"03/02/2024"}            | ${"year numeric, month 2-digit, day 2-digit"}
    ${"2024-02-03"} | ${{ year: "numeric", month: "numeric", day: "numeric" }} | ${"03/02/2024"}            | ${"year numeric, month numeric, day numeric"}
    ${"2024-02-03"} | ${{ year: "2-digit", month: "numeric", day: "numeric" }} | ${"03/02/24"}              | ${"year 2-digit, month numeric, day numeric"}
    ${"2024-02-03"} | ${{ year: "2-digit", month: "2-digit", day: "2-digit" }} | ${"03/02/24"}              | ${"year 2-digit, month 2-digit, day 2-digit"}
  `(
    "formats valid date $value for fr-FR with options $label to $expected",
    ({ value, options, expected }) => {
      expect(formatDate(value, MustTestLocales.frFR, options)).toEqual(
        expected,
      );
    },
  );

  // es-ES
  it.each`
    value           | options                                                  | expected                          | label
    ${"2024-02-03"} | ${{ dateStyle: "full" }}                                 | ${"sábado, 3 de febrero de 2024"} | ${"dateStyle full"}
    ${"2024-02-03"} | ${{ dateStyle: "long" }}                                 | ${"3 de febrero de 2024"}         | ${"dateStyle long"}
    ${"2024-02-03"} | ${{ dateStyle: "medium" }}                               | ${"3 feb 2024"}                   | ${"dateStyle medium"}
    ${"2024-02-03"} | ${{ dateStyle: "short" }}                                | ${"3/2/24"}                       | ${"dateStyle short"}
    ${"2024-02-03"} | ${{ year: "numeric", month: "long", day: "numeric" }}    | ${"3 de febrero de 2024"}         | ${"year numeric, month long, day numeric"}
    ${"2024-02-03"} | ${{ year: "numeric", month: "short", day: "numeric" }}   | ${"3 feb 2024"}                   | ${"year numeric, month short, day numeric"}
    ${"2024-02-03"} | ${{ year: "numeric", month: "2-digit", day: "2-digit" }} | ${"03/02/2024"}                   | ${"year numeric, month 2-digit, day 2-digit"}
    ${"2024-02-03"} | ${{ year: "numeric", month: "numeric", day: "numeric" }} | ${"3/2/2024"}                     | ${"year numeric, month numeric, day numeric"}
    ${"2024-02-03"} | ${{ year: "2-digit", month: "numeric", day: "numeric" }} | ${"3/2/24"}                       | ${"year 2-digit, month numeric, day numeric"}
    ${"2024-02-03"} | ${{ year: "2-digit", month: "2-digit", day: "2-digit" }} | ${"03/02/24"}                     | ${"year 2-digit, month 2-digit, day 2-digit"}
  `(
    "formats valid date $value for es-ES with options $label to $expected",
    ({ value, options, expected }) => {
      expect(formatDate(value, MustTestLocales.esES, options)).toEqual(
        expected,
      );
    },
  );

  // it-IT
  it.each`
    value           | options                                                  | expected                    | label
    ${"2024-02-03"} | ${{ dateStyle: "full" }}                                 | ${"sabato 3 febbraio 2024"} | ${"dateStyle full"}
    ${"2024-02-03"} | ${{ dateStyle: "long" }}                                 | ${"3 febbraio 2024"}        | ${"dateStyle long"}
    ${"2024-02-03"} | ${{ dateStyle: "medium" }}                               | ${"3 feb 2024"}             | ${"dateStyle medium"}
    ${"2024-02-03"} | ${{ dateStyle: "short" }}                                | ${"03/02/24"}               | ${"dateStyle short"}
    ${"2024-02-03"} | ${{ year: "numeric", month: "long", day: "numeric" }}    | ${"3 febbraio 2024"}        | ${"year numeric, month long, day numeric"}
    ${"2024-02-03"} | ${{ year: "numeric", month: "short", day: "numeric" }}   | ${"3 feb 2024"}             | ${"year numeric, month short, day numeric"}
    ${"2024-02-03"} | ${{ year: "numeric", month: "2-digit", day: "2-digit" }} | ${"03/02/2024"}             | ${"year numeric, month 2-digit, day 2-digit"}
    ${"2024-02-03"} | ${{ year: "numeric", month: "numeric", day: "numeric" }} | ${"03/02/2024"}             | ${"year numeric, month numeric, day numeric"}
    ${"2024-02-03"} | ${{ year: "2-digit", month: "numeric", day: "numeric" }} | ${"03/02/24"}               | ${"year 2-digit, month numeric, day numeric"}
    ${"2024-02-03"} | ${{ year: "2-digit", month: "2-digit", day: "2-digit" }} | ${"03/02/24"}               | ${"year 2-digit, month 2-digit, day 2-digit"}
  `(
    "formats valid date $value for it-IT with options $label to $expected",
    ({ value, options, expected }) => {
      expect(formatDate(value, MustTestLocales.itIT, options)).toEqual(
        expected,
      );
    },
  );

  // pt-PT
  it.each`
    value           | options                                                  | expected                            | label
    ${"2024-02-03"} | ${{ dateStyle: "full" }}                                 | ${"sábado, 3 de fevereiro de 2024"} | ${"dateStyle full"}
    ${"2024-02-03"} | ${{ dateStyle: "long" }}                                 | ${"3 de fevereiro de 2024"}         | ${"dateStyle long"}
    ${"2024-02-03"} | ${{ dateStyle: "medium" }}                               | ${"03/02/2024"}                     | ${"dateStyle medium"}
    ${"2024-02-03"} | ${{ dateStyle: "short" }}                                | ${"03/02/24"}                       | ${"dateStyle short"}
    ${"2024-02-03"} | ${{ year: "numeric", month: "long", day: "numeric" }}    | ${"3 de fevereiro de 2024"}         | ${"year numeric, month long, day numeric"}
    ${"2024-02-03"} | ${{ year: "numeric", month: "short", day: "numeric" }}   | ${"3/02/2024"}                      | ${"year numeric, month short, day numeric"}
    ${"2024-02-03"} | ${{ year: "numeric", month: "2-digit", day: "2-digit" }} | ${"03/02/2024"}                     | ${"year numeric, month 2-digit, day 2-digit"}
    ${"2024-02-03"} | ${{ year: "numeric", month: "numeric", day: "numeric" }} | ${"03/02/2024"}                     | ${"year numeric, month numeric, day numeric"}
    ${"2024-02-03"} | ${{ year: "2-digit", month: "numeric", day: "numeric" }} | ${"03/02/24"}                       | ${"year 2-digit, month numeric, day numeric"}
    ${"2024-02-03"} | ${{ year: "2-digit", month: "2-digit", day: "2-digit" }} | ${"03/02/24"}                       | ${"year 2-digit, month 2-digit, day 2-digit"}
  `(
    "formats valid date $value for pt-PT with options $label to $expected",
    ({ value, options, expected }) => {
      expect(formatDate(value, MustTestLocales.ptPT, options)).toEqual(
        expected,
      );
    },
  );

  // sv-SE
  it.each`
    value           | options                                                  | expected                    | label
    ${"2024-02-03"} | ${{ dateStyle: "full" }}                                 | ${"lördag 3 februari 2024"} | ${"dateStyle full"}
    ${"2024-02-03"} | ${{ dateStyle: "long" }}                                 | ${"3 februari 2024"}        | ${"dateStyle long"}
    ${"2024-02-03"} | ${{ dateStyle: "medium" }}                               | ${"3 feb. 2024"}            | ${"dateStyle medium"}
    ${"2024-02-03"} | ${{ dateStyle: "short" }}                                | ${"2024-02-03"}             | ${"dateStyle short"}
    ${"2024-02-03"} | ${{ year: "numeric", month: "long", day: "numeric" }}    | ${"3 februari 2024"}        | ${"year numeric, month long, day numeric"}
    ${"2024-02-03"} | ${{ year: "numeric", month: "short", day: "numeric" }}   | ${"3 feb. 2024"}            | ${"year numeric, month short, day numeric"}
    ${"2024-02-03"} | ${{ year: "numeric", month: "2-digit", day: "2-digit" }} | ${"2024-02-03"}             | ${"year numeric, month 2-digit, day 2-digit"}
    ${"2024-02-03"} | ${{ year: "numeric", month: "numeric", day: "numeric" }} | ${"2024-02-03"}             | ${"year numeric, month numeric, day numeric"}
    ${"2024-02-03"} | ${{ year: "2-digit", month: "numeric", day: "numeric" }} | ${"24-02-03"}               | ${"year 2-digit, month numeric, day numeric"}
    ${"2024-02-03"} | ${{ year: "2-digit", month: "2-digit", day: "2-digit" }} | ${"24-02-03"}               | ${"year 2-digit, month 2-digit, day 2-digit"}
  `(
    "formats valid date $value for sv-SE with options $label to $expected",
    ({ value, options, expected }) => {
      expect(formatDate(value, MustTestLocales.svSE, options)).toEqual(
        expected,
      );
    },
  );

  // is-IS
  it.each`
    value           | options                                                  | label
    ${"2024-02-03"} | ${{ dateStyle: "full" }}                                 | ${"dateStyle full"}
    ${"2024-02-03"} | ${{ dateStyle: "long" }}                                 | ${"dateStyle long"}
    ${"2024-02-03"} | ${{ dateStyle: "medium" }}                               | ${"dateStyle medium"}
    ${"2024-02-03"} | ${{ dateStyle: "short" }}                                | ${"dateStyle short"}
    ${"2024-02-03"} | ${{ year: "numeric", month: "long", day: "numeric" }}    | ${"year numeric, month long, day numeric"}
    ${"2024-02-03"} | ${{ year: "numeric", month: "short", day: "numeric" }}   | ${"year numeric, month short, day numeric"}
    ${"2024-02-03"} | ${{ year: "numeric", month: "2-digit", day: "2-digit" }} | ${"year numeric, month 2-digit, day 2-digit"}
    ${"2024-02-03"} | ${{ year: "numeric", month: "numeric", day: "numeric" }} | ${"year numeric, month numeric, day numeric"}
    ${"2024-02-03"} | ${{ year: "2-digit", month: "numeric", day: "numeric" }} | ${"year 2-digit, month numeric, day numeric"}
    ${"2024-02-03"} | ${{ year: "2-digit", month: "2-digit", day: "2-digit" }} | ${"year 2-digit, month 2-digit, day 2-digit"}
  `(
    "formats valid date $value for is-IS with options $label in the host's wording",
    ({ value, options }) => {
      expect(formatDate(value, MustTestLocales.isIS, options)).toBe(
        hostDateText(MustTestLocales.isIS, options, value),
      );
    },
  );

  // zh-CN
  it.each`
    value           | options                                                  | label
    ${"2024-02-03"} | ${{ dateStyle: "full" }}                                 | ${"dateStyle full"}
    ${"2024-02-03"} | ${{ dateStyle: "long" }}                                 | ${"dateStyle long"}
    ${"2024-02-03"} | ${{ dateStyle: "medium" }}                               | ${"dateStyle medium"}
    ${"2024-02-03"} | ${{ dateStyle: "short" }}                                | ${"dateStyle short"}
    ${"2024-02-03"} | ${{ year: "numeric", month: "long", day: "numeric" }}    | ${"year numeric, month long, day numeric"}
    ${"2024-02-03"} | ${{ year: "numeric", month: "short", day: "numeric" }}   | ${"year numeric, month short, day numeric"}
    ${"2024-02-03"} | ${{ year: "numeric", month: "2-digit", day: "2-digit" }} | ${"year numeric, month 2-digit, day 2-digit"}
    ${"2024-02-03"} | ${{ year: "numeric", month: "numeric", day: "numeric" }} | ${"year numeric, month numeric, day numeric"}
    ${"2024-02-03"} | ${{ year: "2-digit", month: "numeric", day: "numeric" }} | ${"year 2-digit, month numeric, day numeric"}
    ${"2024-02-03"} | ${{ year: "2-digit", month: "2-digit", day: "2-digit" }} | ${"year 2-digit, month 2-digit, day 2-digit"}
  `(
    "formats valid date $value for zh-CN with options $label in the host's wording",
    ({ value, options }) => {
      expect(formatDate(value, MustTestLocales.zhCN, options)).toBe(
        hostDateText(MustTestLocales.zhCN, options, value),
      );
    },
  );

  // zh-TW
  it.each`
    value           | options                                                  | expected                 | label
    ${"2024-02-03"} | ${{ dateStyle: "full" }}                                 | ${"2024年2月3日 星期六"} | ${"dateStyle full"}
    ${"2024-02-03"} | ${{ dateStyle: "long" }}                                 | ${"2024年2月3日"}        | ${"dateStyle long"}
    ${"2024-02-03"} | ${{ dateStyle: "medium" }}                               | ${"2024年2月3日"}        | ${"dateStyle medium"}
    ${"2024-02-03"} | ${{ dateStyle: "short" }}                                | ${"2024/2/3"}            | ${"dateStyle short"}
    ${"2024-02-03"} | ${{ year: "numeric", month: "long", day: "numeric" }}    | ${"2024年2月3日"}        | ${"year numeric, month long, day numeric"}
    ${"2024-02-03"} | ${{ year: "numeric", month: "short", day: "numeric" }}   | ${"2024年2月3日"}        | ${"year numeric, month short, day numeric"}
    ${"2024-02-03"} | ${{ year: "numeric", month: "2-digit", day: "2-digit" }} | ${"2024/02/03"}          | ${"year numeric, month 2-digit, day 2-digit"}
    ${"2024-02-03"} | ${{ year: "numeric", month: "numeric", day: "numeric" }} | ${"2024/2/3"}            | ${"year numeric, month numeric, day numeric"}
    ${"2024-02-03"} | ${{ year: "2-digit", month: "numeric", day: "numeric" }} | ${"24/2/3"}              | ${"year 2-digit, month numeric, day numeric"}
    ${"2024-02-03"} | ${{ year: "2-digit", month: "2-digit", day: "2-digit" }} | ${"24/02/03"}            | ${"year 2-digit, month 2-digit, day 2-digit"}
  `(
    "formats valid date $value for zh-TW with options $label to $expected",
    ({ value, options, expected }) => {
      expect(formatDate(value, MustTestLocales.zhTW, options)).toEqual(
        expected,
      );
    },
  );

  // ja-JP
  it.each`
    value           | options                                                  | label
    ${"2024-02-03"} | ${{ dateStyle: "full" }}                                 | ${"dateStyle full"}
    ${"2024-02-03"} | ${{ dateStyle: "long" }}                                 | ${"dateStyle long"}
    ${"2024-02-03"} | ${{ dateStyle: "medium" }}                               | ${"dateStyle medium"}
    ${"2024-02-03"} | ${{ dateStyle: "short" }}                                | ${"dateStyle short"}
    ${"2024-02-03"} | ${{ year: "numeric", month: "long", day: "numeric" }}    | ${"year numeric, month long, day numeric"}
    ${"2024-02-03"} | ${{ year: "numeric", month: "short", day: "numeric" }}   | ${"year numeric, month short, day numeric"}
    ${"2024-02-03"} | ${{ year: "numeric", month: "2-digit", day: "2-digit" }} | ${"year numeric, month 2-digit, day 2-digit"}
    ${"2024-02-03"} | ${{ year: "numeric", month: "numeric", day: "numeric" }} | ${"year numeric, month numeric, day numeric"}
    ${"2024-02-03"} | ${{ year: "2-digit", month: "numeric", day: "numeric" }} | ${"year 2-digit, month numeric, day numeric"}
    ${"2024-02-03"} | ${{ year: "2-digit", month: "2-digit", day: "2-digit" }} | ${"year 2-digit, month 2-digit, day 2-digit"}
  `(
    "formats valid date $value for ja-JP with options $label in the host's wording",
    ({ value, options }) => {
      expect(formatDate(value, MustTestLocales.jaJP, options)).toBe(
        hostDateText(MustTestLocales.jaJP, options, value),
      );
    },
  );

  // ko-KR
  it.each`
    value           | options                                                  | label
    ${"2024-02-03"} | ${{ dateStyle: "full" }}                                 | ${"dateStyle full"}
    ${"2024-02-03"} | ${{ dateStyle: "long" }}                                 | ${"dateStyle long"}
    ${"2024-02-03"} | ${{ dateStyle: "medium" }}                               | ${"dateStyle medium"}
    ${"2024-02-03"} | ${{ dateStyle: "short" }}                                | ${"dateStyle short"}
    ${"2024-02-03"} | ${{ year: "numeric", month: "long", day: "numeric" }}    | ${"year numeric, month long, day numeric"}
    ${"2024-02-03"} | ${{ year: "numeric", month: "short", day: "numeric" }}   | ${"year numeric, month short, day numeric"}
    ${"2024-02-03"} | ${{ year: "numeric", month: "2-digit", day: "2-digit" }} | ${"year numeric, month 2-digit, day 2-digit"}
    ${"2024-02-03"} | ${{ year: "numeric", month: "numeric", day: "numeric" }} | ${"year numeric, month numeric, day numeric"}
    ${"2024-02-03"} | ${{ year: "2-digit", month: "numeric", day: "numeric" }} | ${"year 2-digit, month numeric, day numeric"}
    ${"2024-02-03"} | ${{ year: "2-digit", month: "2-digit", day: "2-digit" }} | ${"year 2-digit, month 2-digit, day 2-digit"}
  `(
    "formats valid date $value for ko-KR with options $label in the host's wording",
    ({ value, options }) => {
      expect(formatDate(value, MustTestLocales.koKR, options)).toBe(
        hostDateText(MustTestLocales.koKR, options, value),
      );
    },
  );

  // ar-SA
  it.each`
    value           | options                                                  | expected                  | label
    ${"2024-02-03"} | ${{ dateStyle: "full" }}                                 | ${"السبت، ٣ فبراير ٢٠٢٤"} | ${"dateStyle full"}
    ${"2024-02-03"} | ${{ dateStyle: "long" }}                                 | ${"٣ فبراير ٢٠٢٤"}        | ${"dateStyle long"}
    ${"2024-02-03"} | ${{ dateStyle: "medium" }}                               | ${"٠٣/٠٢/٢٠٢٤"}           | ${"dateStyle medium"}
    ${"2024-02-03"} | ${{ dateStyle: "short" }}                                | ${"٣/٢/٢٠٢٤"}             | ${"dateStyle short"}
    ${"2024-02-03"} | ${{ year: "numeric", month: "long", day: "numeric" }}    | ${"٣ فبراير ٢٠٢٤"}        | ${"year numeric, month long, day numeric"}
    ${"2024-02-03"} | ${{ year: "numeric", month: "short", day: "numeric" }}   | ${"٣ فبراير ٢٠٢٤"}        | ${"year numeric, month short, day numeric"}
    ${"2024-02-03"} | ${{ year: "numeric", month: "2-digit", day: "2-digit" }} | ${"٠٣/٠٢/٢٠٢٤"}           | ${"year numeric, month 2-digit, day 2-digit"}
    ${"2024-02-03"} | ${{ year: "numeric", month: "numeric", day: "numeric" }} | ${"٣/٢/٢٠٢٤"}             | ${"year numeric, month numeric, day numeric"}
    ${"2024-02-03"} | ${{ year: "2-digit", month: "numeric", day: "numeric" }} | ${"٣/٢/٢٤"}               | ${"year 2-digit, month numeric, day numeric"}
    ${"2024-02-03"} | ${{ year: "2-digit", month: "2-digit", day: "2-digit" }} | ${"٠٣/٠٢/٢٤"}             | ${"year 2-digit, month 2-digit, day 2-digit"}
  `(
    "formats valid date $value for ar-SA with options $label to $expected",
    ({ value, options, expected }) => {
      expect(formatDate(value, MustTestLocales.arSA, options)).toEqual(
        expected,
      );
    },
  );

  // he-IL
  it.each`
    value           | options                                                  | expected                     | label
    ${"2024-02-03"} | ${{ dateStyle: "full" }}                                 | ${"יום שבת, 3 בפברואר 2024"} | ${"dateStyle full"}
    ${"2024-02-03"} | ${{ dateStyle: "long" }}                                 | ${"3 בפברואר 2024"}          | ${"dateStyle long"}
    ${"2024-02-03"} | ${{ dateStyle: "medium" }}                               | ${"3 בפבר׳ 2024"}            | ${"dateStyle medium"}
    ${"2024-02-03"} | ${{ dateStyle: "short" }}                                | ${"3.2.2024"}                | ${"dateStyle short"}
    ${"2024-02-03"} | ${{ year: "numeric", month: "long", day: "numeric" }}    | ${"3 בפברואר 2024"}          | ${"year numeric, month long, day numeric"}
    ${"2024-02-03"} | ${{ year: "numeric", month: "short", day: "numeric" }}   | ${"3 בפבר׳ 2024"}            | ${"year numeric, month short, day numeric"}
    ${"2024-02-03"} | ${{ year: "numeric", month: "2-digit", day: "2-digit" }} | ${"03.02.2024"}              | ${"year numeric, month 2-digit, day 2-digit"}
    ${"2024-02-03"} | ${{ year: "numeric", month: "numeric", day: "numeric" }} | ${"3.2.2024"}                | ${"year numeric, month numeric, day numeric"}
    ${"2024-02-03"} | ${{ year: "2-digit", month: "numeric", day: "numeric" }} | ${"3.2.24"}                  | ${"year 2-digit, month numeric, day numeric"}
    ${"2024-02-03"} | ${{ year: "2-digit", month: "2-digit", day: "2-digit" }} | ${"03.02.24"}                | ${"year 2-digit, month 2-digit, day 2-digit"}
  `(
    "formats valid date $value for he-IL with options $label to $expected",
    ({ value, options, expected }) => {
      expect(formatDate(value, MustTestLocales.heIL, options)).toEqual(
        expected,
      );
    },
  );

  // ru-RU
  it.each`
    value           | options                                                  | expected                        | label
    ${"2024-02-03"} | ${{ dateStyle: "full" }}                                 | ${"суббота, 3 февраля 2024 г."} | ${"dateStyle full"}
    ${"2024-02-03"} | ${{ dateStyle: "long" }}                                 | ${"3 февраля 2024 г."}          | ${"dateStyle long"}
    ${"2024-02-03"} | ${{ dateStyle: "medium" }}                               | ${"3 февр. 2024 г."}            | ${"dateStyle medium"}
    ${"2024-02-03"} | ${{ dateStyle: "short" }}                                | ${"03.02.2024"}                 | ${"dateStyle short"}
    ${"2024-02-03"} | ${{ year: "numeric", month: "long", day: "numeric" }}    | ${"3 февраля 2024 г."}          | ${"year numeric, month long, day numeric"}
    ${"2024-02-03"} | ${{ year: "numeric", month: "short", day: "numeric" }}   | ${"3 февр. 2024 г."}            | ${"year numeric, month short, day numeric"}
    ${"2024-02-03"} | ${{ year: "numeric", month: "2-digit", day: "2-digit" }} | ${"03.02.2024"}                 | ${"year numeric, month 2-digit, day 2-digit"}
    ${"2024-02-03"} | ${{ year: "numeric", month: "numeric", day: "numeric" }} | ${"03.02.2024"}                 | ${"year numeric, month numeric, day numeric"}
    ${"2024-02-03"} | ${{ year: "2-digit", month: "numeric", day: "numeric" }} | ${"03.02.24"}                   | ${"year 2-digit, month numeric, day numeric"}
    ${"2024-02-03"} | ${{ year: "2-digit", month: "2-digit", day: "2-digit" }} | ${"03.02.24"}                   | ${"year 2-digit, month 2-digit, day 2-digit"}
  `(
    "formats valid date $value for ru-RU with options $label to $expected",
    ({ value, options, expected }) => {
      expect(formatDate(value, MustTestLocales.ruRU, options)).toEqual(
        expected,
      );
    },
  );

  // tr-TR
  it.each`
    value           | options                                                  | label
    ${"2024-02-03"} | ${{ dateStyle: "full" }}                                 | ${"dateStyle full"}
    ${"2024-02-03"} | ${{ dateStyle: "long" }}                                 | ${"dateStyle long"}
    ${"2024-02-03"} | ${{ dateStyle: "medium" }}                               | ${"dateStyle medium"}
    ${"2024-02-03"} | ${{ dateStyle: "short" }}                                | ${"dateStyle short"}
    ${"2024-02-03"} | ${{ year: "numeric", month: "long", day: "numeric" }}    | ${"year numeric, month long, day numeric"}
    ${"2024-02-03"} | ${{ year: "numeric", month: "short", day: "numeric" }}   | ${"year numeric, month short, day numeric"}
    ${"2024-02-03"} | ${{ year: "numeric", month: "2-digit", day: "2-digit" }} | ${"year numeric, month 2-digit, day 2-digit"}
    ${"2024-02-03"} | ${{ year: "numeric", month: "numeric", day: "numeric" }} | ${"year numeric, month numeric, day numeric"}
    ${"2024-02-03"} | ${{ year: "2-digit", month: "numeric", day: "numeric" }} | ${"year 2-digit, month numeric, day numeric"}
    ${"2024-02-03"} | ${{ year: "2-digit", month: "2-digit", day: "2-digit" }} | ${"year 2-digit, month 2-digit, day 2-digit"}
  `(
    "formats valid date $value for tr-TR with options $label in the host's wording",
    ({ value, options }) => {
      expect(formatDate(value, MustTestLocales.trTR, options)).toBe(
        hostDateText(MustTestLocales.trTR, options, value),
      );
    },
  );

  // Temporal ECMA-402 PlainDate format (CreateDateTimeFormat ~date~, ~date~;
  // GetDateTimeFormat inherit ~relevant~): the requested fields and widths are
  // kept, `timeZoneName` is not inherited, and a `timeStyle` is a TypeError.
  // Expected values: native Intl.DateTimeFormat at UTC with the adjusted options.
  it.each`
    locale                   | options                                                | expected                                                                                                                              | reason
    ${"ja-JP-u-ca-japanese"} | ${{ year: "numeric", month: "long" }}                  | ${"令和6年2月"}                                                                                                                       | ${"requested long month kept"}
    ${"ja-JP"}               | ${{ month: "long", day: "numeric" }}                   | ${"2月3日"}                                                                                                                           | ${"requested long month kept"}
    ${"ja-JP-u-ca-japanese"} | ${{ year: "2-digit", month: "short", day: "numeric" }} | ${"令和06年2月3日"}                                                                                                                   | ${"requested short month kept, 2-digit era year padded (D27)"}
    ${"en-US-u-ca-chinese"}  | ${{ year: "numeric", month: "long" }}                  | ${isLunisolarTextCompatNeeded("chinese") ? "" : hostDateText("en-US-u-ca-chinese", { year: "numeric", month: "long" }, "2024-02-03")} | ${"chinese is refused where the D33 probe fails, the host's text where it passes"}
    ${"en-US"}               | ${{ era: "long" }}                                     | ${"2/3/2024 Anno Domini"}                                                                                                             | ${"era alone gets the date defaults"}
    ${"en-US"}               | ${{ timeZoneName: "long" }}                            | ${"2/3/2024"}                                                                                                                         | ${"timeZoneName is not inherited, defaults apply"}
    ${"en-US"}               | ${{ dateStyle: "short", timeStyle: "short" }}          | ${""}                                                                                                                                 | ${"timeStyle on a PlainDate is a TypeError"}
    ${"en-US"}               | ${{ timeStyle: "short" }}                              | ${""}                                                                                                                                 | ${"timeStyle on a PlainDate is a TypeError"}
    ${"en-US"}               | ${{ dateStyle: "short" }}                              | ${"2/3/24"}                                                                                                                           | ${"only the style that applies gives the pre-1.16.0 text"}
    ${"en-US"}               | ${{ hour: "numeric" }}                                 | ${""}                                                                                                                                 | ${"only time fields: no PlainDate format"}
  `(
    "formats 2024-02-03 in $locale with $options to '$expected' ($reason)",
    ({ locale, options, expected }) => {
      expect(formatDate("2024-02-03", locale, options)).toBe(expected);
    },
  );

  // The era, the year and the month number are the calendar's values on every host; the month
  // name, the padding of the month number and the separators are the host's wording.
  it.each`
    locale                   | options                                  | reason
    ${"ja-JP-u-ca-japanese"} | ${{ year: "numeric", month: "numeric" }} | ${"numeric fields give the pre-1.16.0 text"}
    ${"ko-KR-u-ca-hebrew"}   | ${{ year: "numeric", month: "long" }}    | ${"requested long month kept"}
  `(
    "formats 2024-02-03 in $locale with $options in the host's wording ($reason)",
    ({ locale, options }) => {
      expect(formatDate("2024-02-03", locale, options)).toBe(
        hostDateText(locale, options, "2024-02-03"),
      );
    },
  );

  it.each`
    invalidValue             | label
    ${"not-a-date"}          | ${"'not-a-date'"}
    ${"2024-02-30"}          | ${"'2024-02-30'"}
    ${"2024-02-29T12:00:00"} | ${"'2024-02-29T12:00:00'"}
    ${""}                    | ${"''"}
    ${null}                  | ${"null"}
    ${undefined}             | ${"undefined"}
    ${true}                  | ${"true"}
  `("returns an empty string for invalid date $label", ({ invalidValue }) => {
    expect(formatDate(invalidValue as never)).toBe("");
  });

  it("returns empty string on failure", () => {
    mockTemporalPlainDateFromThrow();
    const result = formatDate("2024-02-29");
    expect(result).toBe("");
  });

  // ECMA-402 CanonicalizeLocaleList: `locale` may be a preference list; the first tag with locale data
  // is used, and a malformed tag anywhere in the list is invalid input. Expected strings from native
  // Intl with the same list.
  it.each`
    locale                                          | expected
    ${[MustTestLocales.frFR, MustTestLocales.enUS]} | ${"03/02/2024"}
    ${[MustTestLocales.frFR, "not a locale!!"]}     | ${""}
  `("returns '$expected' for locale list $locale", ({ locale, expected }) => {
    expect(
      formatDate("2024-02-03", locale, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }),
    ).toBe(expected);
  });
});

// Plan #14: ECMA-402 CoerceOptionsToObject throws TypeError for null options and wraps any other
// primitive with ToObject, which carries no formatting fields, so a string or number formats with
// the defaults. Expected strings from native Chromium 153 (`toLocaleString("en-US", 1)` and
// `new Intl.DateTimeFormat("en-US", null)`, which throws).
describe("formatDate with primitive options", () => {
  it.each`
    options   | expected
    ${null}   | ${""}
    ${"long"} | ${"2/3/2024"}
    ${1}      | ${"2/3/2024"}
  `("returns '$expected' for options $options", ({ options, expected }) => {
    expect(
      formatDate("2024-02-03", MustTestLocales.enUS, options as never),
    ).toBe(expected);
  });
});

// ECMA-402 GetOption step 1 is Get(options, property), which follows the prototype chain, so an
// inherited option is read exactly as the same option held as an own property. Here the date is 15
// March 2024, a Friday, so dateStyle "full" in en-US names the weekday.
describe("formatDate with inherited options", () => {
  it.each`
    label          | options
    ${"own"}       | ${{ dateStyle: "full" }}
    ${"inherited"} | ${Object.create({ dateStyle: "full" })}
  `(
    "formats with $label options { dateStyle: 'full' }, an inherited option being read like an own one",
    ({ options }) => {
      expect(formatDate("2024-03-15", "en-US", options)).toBe(
        "Friday, March 15, 2024",
      );
    },
  );
});

// ECMA-402 GetOption would turn an object option into its ToString. A function accepts a
// string for a string option and nothing else, so it returns its sentinel and the caller's
// toString() is never run.
describe("formatDate with an option that is an object", () => {
  it("returns the sentinel for month given as an object, and never calls its toString()", () => {
    let coercions = 0;
    const month = {
      toString() {
        coercions += 1;
        return coercions === 1 ? "long" : "narrow";
      },
    };
    const out = formatDate("2024-03-15", "en-US", {
      month,
      day: "numeric",
    } as never);
    expect({ out, coercions }).toEqual({ out: "", coercions: 0 });
  });

  // Formatters are shared only when their arguments are fully plain.
  describe("formatter cache", () => {
    function countConstructions(run: () => void, warmUp?: () => void): number {
      return countIntlConstructions(["DateTimeFormat"], run, warmUp);
    }

    beforeEach(() => {
      clearFormatterCache();
    });

    it("builds nothing the second time for the same locale and options", () => {
      let first = "";
      const built = countConstructions(
        () => {
          expect(formatDate("2024-07-04", "en-GB", { dateStyle: "long" })).toBe(
            first,
          );
        },
        () => {
          first = formatDate("2024-07-04", "en-GB", { dateStyle: "long" });
        },
      );
      expect(first).toBe("4 July 2024");
      expect(built).toBe(0);
    });

    it("answers from a replaced Intl.DateTimeFormat, never a formatter it built before", () => {
      const args = ["2024-07-04", "en-GB", { dateStyle: "long" }] as const;
      expect(formatDate(...args)).toBe("4 July 2024");
      const Native = Intl.DateTimeFormat;
      Intl.DateTimeFormat = class extends Native {
        override format(date?: Date | number): string {
          return `PATCHED ${super.format(date)}`;
        }
      } as typeof Intl.DateTimeFormat;
      try {
        expect(formatDate(...args)).toBe("PATCHED 4 July 2024");
      } finally {
        Intl.DateTimeFormat = Native;
      }
      expect(formatDate(...args)).toBe("4 July 2024");
    });

    it("constructs on every call when the locale is omitted", () => {
      const built = countConstructions(() => {
        formatDate("2024-07-04", undefined, { dateStyle: "long" });
        formatDate("2024-07-04", undefined, { dateStyle: "long" });
      });
      expect(built).toBeGreaterThanOrEqual(2);
    });

    it("returns the sentinel on every call for an object option, without running its toString", () => {
      let coercions = 0;
      const options = {
        month: { toString: () => ((coercions += 1), "long") },
        day: "numeric",
      } as never;
      expect(formatDate("2024-03-15", "en-US", options)).toBe("");
      expect(formatDate("2024-03-15", "en-US", options)).toBe("");
      expect(coercions).toBe(0);
    });

    it("returns an empty string twice for an invalid timeZoneName", () => {
      const options = { timeZoneName: "nonsense" } as never;
      expect(formatDate("2024-07-04", "en-US", options)).toBe("");
      expect(formatDate("2024-07-04", "en-US", options)).toBe("");
    });

    it("stays correct across the 256-per-kind clear", () => {
      const zones = Array.from({ length: 257 }, (_, index) => index);
      const first = formatDate("2024-07-04", "en-US", { dateStyle: "short" });
      for (const index of zones) {
        formatDate("2024-07-04", `en-US-u-nu-latn-x-t${index}`.slice(0, 5), {
          dateStyle: "short",
          timeZone: `Etc/GMT+${(index % 12) + 1}`,
          hour12: index % 2 === 0,
          minute: index > 128 ? "2-digit" : undefined,
        } as never);
      }
      expect(formatDate("2024-07-04", "en-US", { dateStyle: "short" })).toBe(
        first,
      );
      expect(first).toBe("7/4/24");
    });
  });
});
