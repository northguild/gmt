import { MustTestLocales } from "../../test";
import { formatDateTime } from "./formatDateTime";

describe("formatDateTime", () => {
  // en-US
  it.each`
    value                    | options                                                                                                                        | expected
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "full", timeStyle: "full" }}                                                                                    | ${"Saturday, February 3, 2024 at 2:30:45 PM"}
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "long", timeStyle: "long" }}                                                                                    | ${"February 3, 2024 at 2:30:45 PM"}
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "medium", timeStyle: "medium" }}                                                                                | ${"Feb 3, 2024, 2:30:45 PM"}
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "short", timeStyle: "short" }}                                                                                  | ${"2/3/24, 2:30 PM"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" }}                   | ${"February 3, 2024 at 2:30:45 PM"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "numeric" }}                                     | ${"Feb 3, 2024, 2:30 PM"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }}                | ${"02/03/2024, 02:30:45 PM"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }}                                   | ${"02/03/2024, 02:30 PM"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }}  | ${"02/03/2024, 02:30:45 PM"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", hour12: false }} | ${"2/3/2024, 14:30:45"}
  `(
    "formats valid datetime $value for en-US with options $options to $expected",
    ({ value, options, expected }) => {
      expect(formatDateTime(value, MustTestLocales.enUS, options)).toEqual(
        expected,
      );
    },
  );

  // en-GB
  it.each`
    value                    | options                                                                                                                        | expected
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "full", timeStyle: "full" }}                                                                                    | ${"Saturday, 3 February 2024 at 14:30:45"}
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "long", timeStyle: "long" }}                                                                                    | ${"3 February 2024 at 14:30:45"}
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "medium", timeStyle: "medium" }}                                                                                | ${"3 Feb 2024, 14:30:45"}
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "short", timeStyle: "short" }}                                                                                  | ${"03/02/2024, 14:30"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" }}                   | ${"3 February 2024 at 14:30:45"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "numeric" }}                                     | ${"3 Feb 2024, 14:30"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }}                | ${"03/02/2024, 14:30:45"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }}                                   | ${"03/02/2024, 14:30"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }}  | ${"03/02/2024, 02:30:45 pm"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", hour12: false }} | ${"03/02/2024, 14:30:45"}
  `(
    "formats valid datetime $value for en-GB with options $options to $expected",
    ({ value, options, expected }) => {
      expect(formatDateTime(value, MustTestLocales.enGB, options)).toEqual(
        expected,
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
    value                    | options                                                                                                                        | expected
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "full", timeStyle: "full" }}                                                                                    | ${"samedi 3 février 2024 à 14:30:45"}
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "long", timeStyle: "long" }}                                                                                    | ${"3 février 2024 à 14:30:45"}
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "medium", timeStyle: "medium" }}                                                                                | ${"3 févr. 2024, 14:30:45"}
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "short", timeStyle: "short" }}                                                                                  | ${"03/02/2024 14:30"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" }}                   | ${"3 février 2024 à 14:30:45"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "numeric" }}                                     | ${"3 févr. 2024, 14:30"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }}                | ${"03/02/2024 14:30:45"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }}                                   | ${"03/02/2024 14:30"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }}  | ${"03/02/2024 02:30:45 PM"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", hour12: false }} | ${"03/02/2024 14:30:45"}
  `(
    "formats valid datetime $value for fr-FR with options $options to $expected",
    ({ value, options, expected }) => {
      expect(formatDateTime(value, MustTestLocales.frFR, options)).toEqual(
        expected,
      );
    },
  );

  // es-ES
  it.each`
    value                    | options                                                                                                                        | expected
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "full", timeStyle: "full" }}                                                                                    | ${"sábado, 3 de febrero de 2024, 14:30:45"}
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "long", timeStyle: "long" }}                                                                                    | ${"3 de febrero de 2024 a las 14:30:45"}
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "medium", timeStyle: "medium" }}                                                                                | ${"3 feb 2024, 14:30:45"}
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "short", timeStyle: "short" }}                                                                                  | ${"3/2/24, 14:30"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" }}                   | ${"3 de febrero de 2024 a las 14:30:45"}
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
    value                    | options                                                                                                                        | expected
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "full", timeStyle: "full" }}                                                                                    | ${"sábado, 3 de fevereiro de 2024 às 14:30:45"}
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "long", timeStyle: "long" }}                                                                                    | ${"3 de fevereiro de 2024 às 14:30:45"}
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "medium", timeStyle: "medium" }}                                                                                | ${"03/02/2024, 14:30:45"}
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "short", timeStyle: "short" }}                                                                                  | ${"03/02/24, 14:30"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" }}                   | ${"3 de fevereiro de 2024 às 14:30:45"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "numeric" }}                                     | ${"3/02/2024, 14:30"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }}                | ${"03/02/2024, 14:30:45"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }}                                   | ${"03/02/2024, 14:30"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }}  | ${"03/02/2024, 02:30:45 p.m."}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", hour12: false }} | ${"03/02/2024, 14:30:45"}
  `(
    "formats valid datetime $value for pt-PT with options $options to $expected",
    ({ value, options, expected }) => {
      expect(formatDateTime(value, MustTestLocales.ptPT, options)).toEqual(
        expected,
      );
    },
  );

  // sv-SE
  it.each`
    value                    | options                                                                                                                        | expected
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "full", timeStyle: "full" }}                                                                                    | ${"lördag 3 februari 2024 kl. 14:30:45"}
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "long", timeStyle: "long" }}                                                                                    | ${"3 februari 2024 kl. 14:30:45"}
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "medium", timeStyle: "medium" }}                                                                                | ${"3 feb. 2024 14:30:45"}
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "short", timeStyle: "short" }}                                                                                  | ${"2024-02-03 14:30"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" }}                   | ${"3 februari 2024 kl. 14:30:45"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "numeric" }}                                     | ${"3 feb. 2024 14:30"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }}                | ${"2024-02-03 14:30:45"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }}                                   | ${"2024-02-03 14:30"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }}  | ${"2024-02-03 02:30:45 em"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", hour12: false }} | ${"2024-02-03 14:30:45"}
  `(
    "formats valid datetime $value for sv-SE with options $options to $expected",
    ({ value, options, expected }) => {
      expect(formatDateTime(value, MustTestLocales.svSE, options)).toEqual(
        expected,
      );
    },
  );

  // is-IS
  it.each`
    value                    | options                                                                                                                        | expected
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "full", timeStyle: "full" }}                                                                                    | ${"laugardagur, 3. febrúar 2024 kl. 14:30:45"}
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "long", timeStyle: "long" }}                                                                                    | ${"3. febrúar 2024 kl. 14:30:45"}
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "medium", timeStyle: "medium" }}                                                                                | ${"3. feb. 2024, 14:30:45"}
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "short", timeStyle: "short" }}                                                                                  | ${"3.2.2024, 14:30"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" }}                   | ${"3. febrúar 2024 kl. 14:30:45"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "numeric" }}                                     | ${"3. feb. 2024, 14:30"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }}                | ${"03.02.2024, 14:30:45"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }}                                   | ${"03.02.2024, 14:30"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }}  | ${"03.02.2024, 02:30:45 e.h."}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", hour12: false }} | ${"3.2.2024, 14:30:45"}
  `(
    "formats valid datetime $value for is-IS with options $options to $expected",
    ({ value, options, expected }) => {
      expect(formatDateTime(value, MustTestLocales.isIS, options)).toEqual(
        expected,
      );
    },
  );

  // zh-CN
  it.each`
    value                    | options                                                                                                                        | expected
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "full", timeStyle: "full" }}                                                                                    | ${"2024年2月3日星期六 14:30:45"}
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "long", timeStyle: "long" }}                                                                                    | ${"2024年2月3日 14:30:45"}
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "medium", timeStyle: "medium" }}                                                                                | ${"2024年2月3日 14:30:45"}
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "short", timeStyle: "short" }}                                                                                  | ${"2024/2/3 14:30"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" }}                   | ${"2024/2/3 14:30:45"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "numeric" }}                                     | ${"2024/2/3 14:30"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }}                | ${"2024/02/03 14:30:45"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }}                                   | ${"2024/02/03 14:30"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }}  | ${"2024/02/03 下午02:30:45"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", hour12: false }} | ${"2024/2/3 14:30:45"}
  `(
    "formats valid datetime $value for zh-CN with options $options to $expected",
    ({ value, options, expected }) => {
      expect(formatDateTime(value, MustTestLocales.zhCN, options)).toEqual(
        expected,
      );
    },
  );

  // zh-TW
  it.each`
    value                    | options                                                                                                                        | expected
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "full", timeStyle: "full" }}                                                                                    | ${"2024年2月3日星期六 下午2:30:45"}
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "long", timeStyle: "long" }}                                                                                    | ${"2024年2月3日 下午2:30:45"}
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "medium", timeStyle: "medium" }}                                                                                | ${"2024年2月3日 下午2:30:45"}
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "short", timeStyle: "short" }}                                                                                  | ${"2024/2/3 下午2:30"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" }}                   | ${"2024/2/3 下午2:30:45"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "numeric" }}                                     | ${"2024/2/3 下午2:30"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }}                | ${"2024/02/03 下午02:30:45"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }}                                   | ${"2024/02/03 下午02:30"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }}  | ${"2024/02/03 下午02:30:45"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", hour12: false }} | ${"2024/2/3 14:30:45"}
  `(
    "formats valid datetime $value for zh-TW with options $options to $expected",
    ({ value, options, expected }) => {
      expect(formatDateTime(value, MustTestLocales.zhTW, options)).toEqual(
        expected,
      );
    },
  );

  // ja-JP
  it.each`
    value                    | options                                                                                                                        | expected
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "full", timeStyle: "full" }}                                                                                    | ${"2024年2月3日土曜日 14:30:45"}
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "long", timeStyle: "long" }}                                                                                    | ${"2024年2月3日 14:30:45"}
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "medium", timeStyle: "medium" }}                                                                                | ${"2024/02/03 14:30:45"}
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "short", timeStyle: "short" }}                                                                                  | ${"2024/02/03 14:30"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" }}                   | ${"2024/2/3 14:30:45"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "numeric" }}                                     | ${"2024/2/3 14:30"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }}                | ${"2024/02/03 14:30:45"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }}                                   | ${"2024/02/03 14:30"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }}  | ${"2024/02/03 午後02:30:45"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", hour12: false }} | ${"2024/2/3 14:30:45"}
  `(
    "formats valid datetime $value for ja-JP with options $options to $expected",
    ({ value, options, expected }) => {
      expect(formatDateTime(value, MustTestLocales.jaJP, options)).toEqual(
        expected,
      );
    },
  );

  // ko-KR
  it.each`
    value                    | options                                                                                                                        | expected
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "full", timeStyle: "full" }}                                                                                    | ${"2024년 2월 3일 토요일 PM 2:30:45"}
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "long", timeStyle: "long" }}                                                                                    | ${"2024년 2월 3일 PM 2:30:45"}
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "medium", timeStyle: "medium" }}                                                                                | ${"2024. 2. 3. PM 2:30:45"}
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "short", timeStyle: "short" }}                                                                                  | ${"24. 2. 3. PM 2:30"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" }}                   | ${"2024년 2월 3일 PM 2:30:45"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "numeric" }}                                     | ${"2024년 2월 3일 PM 2:30"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }}                | ${"2024. 02. 03. PM 02:30:45"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }}                                   | ${"2024. 02. 03. PM 02:30"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }}  | ${"2024. 02. 03. PM 02:30:45"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", hour12: false }} | ${"2024. 2. 3. 14시 30분 45초"}
  `(
    "formats valid datetime $value for ko-KR with options $options to $expected",
    ({ value, options, expected }) => {
      expect(formatDateTime(value, MustTestLocales.koKR, options)).toEqual(
        expected,
      );
    },
  );

  // ar-SA
  it.each`
    value                    | options                                                                                                                        | expected
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "full", timeStyle: "full" }}                                                                                    | ${"السبت، ٣ فبراير ٢٠٢٤ في ٢:٣٠:٤٥ م"}
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "long", timeStyle: "long" }}                                                                                    | ${"٣ فبراير ٢٠٢٤ في ٢:٣٠:٤٥ م"}
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "medium", timeStyle: "medium" }}                                                                                | ${"٠٣/٠٢/٢٠٢٤، ٢:٣٠:٤٥ م"}
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "short", timeStyle: "short" }}                                                                                  | ${"٣/٢/٢٠٢٤، ٢:٣٠ م"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" }}                   | ${"٣ فبراير ٢٠٢٤ في ٢:٣٠:٤٥ م"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "numeric" }}                                     | ${"٣ فبراير ٢٠٢٤، ٢:٣٠ م"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }}                | ${"٠٣/٠٢/٢٠٢٤، ٠٢:٣٠:٤٥ م"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }}                                   | ${"٠٣/٠٢/٢٠٢٤، ٠٢:٣٠ م"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }}  | ${"٠٣/٠٢/٢٠٢٤، ٠٢:٣٠:٤٥ م"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", hour12: false }} | ${"٣/٢/٢٠٢٤، ١٤:٣٠:٤٥"}
  `(
    "formats valid datetime $value for ar-SA with options $options to $expected",
    ({ value, options, expected }) => {
      expect(formatDateTime(value, MustTestLocales.arSA, options)).toEqual(
        expected,
      );
    },
  );

  // he-IL
  it.each`
    value                    | options                                                                                                                        | expected
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "full", timeStyle: "full" }}                                                                                    | ${"יום שבת, 3 בפברואר 2024 בשעה 14:30:45"}
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "long", timeStyle: "long" }}                                                                                    | ${"3 בפברואר 2024 בשעה 14:30:45"}
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "medium", timeStyle: "medium" }}                                                                                | ${"3 בפבר׳ 2024, 14:30:45"}
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "short", timeStyle: "short" }}                                                                                  | ${"3.2.2024, 14:30"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" }}                   | ${"3 בפברואר 2024 בשעה 14:30:45"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "numeric" }}                                     | ${"3 בפבר׳ 2024, 14:30"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }}                | ${"03.02.2024, 14:30:45"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }}                                   | ${"03.02.2024, 14:30"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }}  | ${"03.02.2024, 02:30:45 PM"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", hour12: false }} | ${"3.2.2024, 14:30:45"}
  `(
    "formats valid datetime $value for he-IL with options $options to $expected",
    ({ value, options, expected }) => {
      expect(formatDateTime(value, MustTestLocales.heIL, options)).toEqual(
        expected,
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
    value                    | options                                                                                                                        | expected
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "full", timeStyle: "full" }}                                                                                    | ${"3 Şubat 2024 Cumartesi 14:30:45"}
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "long", timeStyle: "long" }}                                                                                    | ${"3 Şubat 2024 14:30:45"}
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "medium", timeStyle: "medium" }}                                                                                | ${"3 Şub 2024 14:30:45"}
    ${"2024-02-03T14:30:45"} | ${{ dateStyle: "short", timeStyle: "short" }}                                                                                  | ${"3.02.2024 14:30"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" }}                   | ${"3 Şubat 2024 14:30:45"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "numeric" }}                                     | ${"3 Şub 2024 14:30"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }}                | ${"03.02.2024 14:30:45"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }}                                   | ${"03.02.2024 14:30"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }}  | ${"03.02.2024 ÖS 02:30:45"}
    ${"2024-02-03T14:30:45"} | ${{ year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", hour12: false }} | ${"03.02.2024 14:30:45"}
  `(
    "formats valid datetime $value for tr-TR with options $options to $expected",
    ({ value, options, expected }) => {
      expect(formatDateTime(value, MustTestLocales.trTR, options)).toEqual(
        expected,
      );
    },
  );

  it.each`
    value                        | locale     | options
    ${"2024-02-29T14:30:45.123"} | ${"en-GB"} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }}
  `("formats edge case datetime $value", ({ value, locale, options }) => {
    expect(formatDateTime(value, locale, options)).not.toBe("");
  });

  it.each`
    invalidValue
    ${"not-a-datetime"}
    ${"2024-02-29"}
    ${"2024-02-29T24:00:00"}
    ${""}
    ${null}
    ${undefined}
    ${true}
  `(
    "returns an empty string for invalid datetime $invalidValue",
    ({ invalidValue }) => {
      expect(formatDateTime(invalidValue as never)).toBe("");
    },
  );
});
