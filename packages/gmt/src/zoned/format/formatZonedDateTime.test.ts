import { MustTestLocales } from "../../test/localeMatrix";
import { localeZonedDateTimeInputByLocale } from "../test/localeZonedFixtures";
import { sameInstantBattleCases } from "../test/timezoneFixtures";
import { formatZonedDateTime } from "./formatZonedDateTime";

describe("formatZonedDateTime", () => {
  const valueByLocale = localeZonedDateTimeInputByLocale;

  // en-US
  it.each`
    value                                  | options                                                                                                                        | expected
    ${valueByLocale[MustTestLocales.enUS]} | ${{ dateStyle: "full", timeStyle: "full" }}                                                                                    | ${"Saturday, February 3, 2024 at 2:30:45 PM Eastern Standard Time"}
    ${valueByLocale[MustTestLocales.enUS]} | ${{ dateStyle: "long", timeStyle: "long" }}                                                                                    | ${"February 3, 2024 at 2:30:45 PM EST"}
    ${valueByLocale[MustTestLocales.enUS]} | ${{ dateStyle: "medium", timeStyle: "medium" }}                                                                                | ${"Feb 3, 2024, 2:30:45 PM"}
    ${valueByLocale[MustTestLocales.enUS]} | ${{ dateStyle: "short", timeStyle: "short" }}                                                                                  | ${"2/3/24, 2:30 PM"}
    ${valueByLocale[MustTestLocales.enUS]} | ${{ hour: "numeric", minute: "numeric", timeZoneName: "shortOffset" }}                                                         | ${"2:30 PM GMT-5"}
    ${valueByLocale[MustTestLocales.enUS]} | ${{ hour: "numeric", minute: "numeric", timeZoneName: "longOffset" }}                                                          | ${"2:30 PM GMT-05:00"}
    ${valueByLocale[MustTestLocales.enUS]} | ${{ year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" }}                   | ${"February 3, 2024 at 2:30:45 PM"}
    ${valueByLocale[MustTestLocales.enUS]} | ${{ year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "numeric" }}                                     | ${"Feb 3, 2024, 2:30 PM"}
    ${valueByLocale[MustTestLocales.enUS]} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }}                | ${"02/03/2024, 02:30:45 PM"}
    ${valueByLocale[MustTestLocales.enUS]} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }}                                   | ${"02/03/2024, 02:30 PM"}
    ${valueByLocale[MustTestLocales.enUS]} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }}  | ${"02/03/2024, 02:30:45 PM"}
    ${valueByLocale[MustTestLocales.enUS]} | ${{ year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", hour12: false }} | ${"2/3/2024, 14:30:45"}
  `(
    "formats valid zoned datetime $value for en-US with options $options to $expected",
    ({ value, options, expected }) => {
      expect(formatZonedDateTime(value, MustTestLocales.enUS, options)).toEqual(
        expected,
      );
    },
  );

  // en-GB
  it.each`
    value                                  | options                                                                                                                        | expected
    ${valueByLocale[MustTestLocales.enGB]} | ${{ dateStyle: "full", timeStyle: "full" }}                                                                                    | ${"Saturday, 3 February 2024 at 14:30:45 Greenwich Mean Time"}
    ${valueByLocale[MustTestLocales.enGB]} | ${{ dateStyle: "long", timeStyle: "long" }}                                                                                    | ${"3 February 2024 at 14:30:45 GMT"}
    ${valueByLocale[MustTestLocales.enGB]} | ${{ dateStyle: "medium", timeStyle: "medium" }}                                                                                | ${"3 Feb 2024, 14:30:45"}
    ${valueByLocale[MustTestLocales.enGB]} | ${{ dateStyle: "short", timeStyle: "short" }}                                                                                  | ${"03/02/2024, 14:30"}
    ${valueByLocale[MustTestLocales.enGB]} | ${{ year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" }}                   | ${"3 February 2024 at 14:30:45"}
    ${valueByLocale[MustTestLocales.enGB]} | ${{ year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "numeric" }}                                     | ${"3 Feb 2024, 14:30"}
    ${valueByLocale[MustTestLocales.enGB]} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }}                | ${"03/02/2024, 14:30:45"}
    ${valueByLocale[MustTestLocales.enGB]} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }}                                   | ${"03/02/2024, 14:30"}
    ${valueByLocale[MustTestLocales.enGB]} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }}  | ${"03/02/2024, 02:30:45 pm"}
    ${valueByLocale[MustTestLocales.enGB]} | ${{ year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", hour12: false }} | ${"03/02/2024, 14:30:45"}
  `(
    "formats valid zoned datetime $value for en-GB with options $options to $expected",
    ({ value, options, expected }) => {
      expect(formatZonedDateTime(value, MustTestLocales.enGB, options)).toEqual(
        expected,
      );
    },
  );

  // de-DE
  it.each`
    value                                  | options                                                                                                                        | expected
    ${valueByLocale[MustTestLocales.deDE]} | ${{ dateStyle: "full", timeStyle: "full" }}                                                                                    | ${"Samstag, 3. Februar 2024 um 14:30:45 Mitteleuropäische Normalzeit"}
    ${valueByLocale[MustTestLocales.deDE]} | ${{ dateStyle: "long", timeStyle: "long" }}                                                                                    | ${"3. Februar 2024 um 14:30:45 MEZ"}
    ${valueByLocale[MustTestLocales.deDE]} | ${{ dateStyle: "medium", timeStyle: "medium" }}                                                                                | ${"03.02.2024, 14:30:45"}
    ${valueByLocale[MustTestLocales.deDE]} | ${{ dateStyle: "short", timeStyle: "short" }}                                                                                  | ${"03.02.24, 14:30"}
    ${valueByLocale[MustTestLocales.deDE]} | ${{ year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" }}                   | ${"3. Februar 2024 um 14:30:45"}
    ${valueByLocale[MustTestLocales.deDE]} | ${{ year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "numeric" }}                                     | ${"3. Feb. 2024, 14:30"}
    ${valueByLocale[MustTestLocales.deDE]} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }}                | ${"03.02.2024, 14:30:45"}
    ${valueByLocale[MustTestLocales.deDE]} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }}                                   | ${"03.02.2024, 14:30"}
    ${valueByLocale[MustTestLocales.deDE]} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }}  | ${"03.02.2024, 02:30:45 PM"}
    ${valueByLocale[MustTestLocales.deDE]} | ${{ year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", hour12: false }} | ${"3.2.2024, 14:30:45"}
  `(
    "formats valid zoned datetime $value for de-DE with options $options to $expected",
    ({ value, options, expected }) => {
      expect(formatZonedDateTime(value, MustTestLocales.deDE, options)).toEqual(
        expected,
      );
    },
  );

  // fr-FR
  it.each`
    value                                  | options                                                                                                                        | expected
    ${valueByLocale[MustTestLocales.frFR]} | ${{ dateStyle: "full", timeStyle: "full" }}                                                                                    | ${"samedi 3 février 2024 à 14:30:45 heure normale d’Europe centrale"}
    ${valueByLocale[MustTestLocales.frFR]} | ${{ dateStyle: "long", timeStyle: "long" }}                                                                                    | ${"3 février 2024 à 14:30:45 UTC+1"}
    ${valueByLocale[MustTestLocales.frFR]} | ${{ dateStyle: "medium", timeStyle: "medium" }}                                                                                | ${"3 févr. 2024, 14:30:45"}
    ${valueByLocale[MustTestLocales.frFR]} | ${{ dateStyle: "short", timeStyle: "short" }}                                                                                  | ${"03/02/2024 14:30"}
    ${valueByLocale[MustTestLocales.frFR]} | ${{ year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" }}                   | ${"3 février 2024 à 14:30:45"}
    ${valueByLocale[MustTestLocales.frFR]} | ${{ year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "numeric" }}                                     | ${"3 févr. 2024, 14:30"}
    ${valueByLocale[MustTestLocales.frFR]} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }}                | ${"03/02/2024 14:30:45"}
    ${valueByLocale[MustTestLocales.frFR]} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }}                                   | ${"03/02/2024 14:30"}
    ${valueByLocale[MustTestLocales.frFR]} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }}  | ${"03/02/2024 02:30:45 PM"}
    ${valueByLocale[MustTestLocales.frFR]} | ${{ year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", hour12: false }} | ${"03/02/2024 14:30:45"}
  `(
    "formats valid zoned datetime $value for fr-FR with options $options to $expected",
    ({ value, options, expected }) => {
      expect(formatZonedDateTime(value, MustTestLocales.frFR, options)).toEqual(
        expected,
      );
    },
  );

  // es-ES
  it.each`
    value                                  | options                                                                                                                        | expected
    ${valueByLocale[MustTestLocales.esES]} | ${{ dateStyle: "full", timeStyle: "full" }}                                                                                    | ${"sábado, 3 de febrero de 2024, 14:30:45 (hora estándar de Europa central)"}
    ${valueByLocale[MustTestLocales.esES]} | ${{ dateStyle: "long", timeStyle: "long" }}                                                                                    | ${"3 de febrero de 2024 a las 14:30:45 CET"}
    ${valueByLocale[MustTestLocales.esES]} | ${{ dateStyle: "medium", timeStyle: "medium" }}                                                                                | ${"3 feb 2024, 14:30:45"}
    ${valueByLocale[MustTestLocales.esES]} | ${{ dateStyle: "short", timeStyle: "short" }}                                                                                  | ${"3/2/24, 14:30"}
    ${valueByLocale[MustTestLocales.esES]} | ${{ year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" }}                   | ${"3 de febrero de 2024 a las 14:30:45"}
    ${valueByLocale[MustTestLocales.esES]} | ${{ year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "numeric" }}                                     | ${"3 feb 2024, 14:30"}
    ${valueByLocale[MustTestLocales.esES]} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }}                | ${"03/02/2024, 14:30:45"}
    ${valueByLocale[MustTestLocales.esES]} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }}                                   | ${"03/02/2024, 14:30"}
    ${valueByLocale[MustTestLocales.esES]} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }}  | ${"03/02/2024, 02:30:45 p. m."}
    ${valueByLocale[MustTestLocales.esES]} | ${{ year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", hour12: false }} | ${"3/2/2024, 14:30:45"}
  `(
    "formats valid zoned datetime $value for es-ES with options $options to $expected",
    ({ value, options, expected }) => {
      expect(formatZonedDateTime(value, MustTestLocales.esES, options)).toEqual(
        expected,
      );
    },
  );

  // it-IT
  it.each`
    value                                  | options                                                                                                                        | expected
    ${valueByLocale[MustTestLocales.itIT]} | ${{ dateStyle: "full", timeStyle: "full" }}                                                                                    | ${"sabato 3 febbraio 2024 alle ore 14:30:45 Ora standard dell’Europa centrale"}
    ${valueByLocale[MustTestLocales.itIT]} | ${{ dateStyle: "long", timeStyle: "long" }}                                                                                    | ${"3 febbraio 2024 alle ore 14:30:45 CET"}
    ${valueByLocale[MustTestLocales.itIT]} | ${{ dateStyle: "medium", timeStyle: "medium" }}                                                                                | ${"3 feb 2024, 14:30:45"}
    ${valueByLocale[MustTestLocales.itIT]} | ${{ dateStyle: "short", timeStyle: "short" }}                                                                                  | ${"03/02/24, 14:30"}
    ${valueByLocale[MustTestLocales.itIT]} | ${{ year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" }}                   | ${"3 febbraio 2024 alle ore 14:30:45"}
    ${valueByLocale[MustTestLocales.itIT]} | ${{ year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "numeric" }}                                     | ${"3 feb 2024, 14:30"}
    ${valueByLocale[MustTestLocales.itIT]} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }}                | ${"03/02/2024, 14:30:45"}
    ${valueByLocale[MustTestLocales.itIT]} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }}                                   | ${"03/02/2024, 14:30"}
    ${valueByLocale[MustTestLocales.itIT]} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }}  | ${"03/02/2024, 02:30:45 PM"}
    ${valueByLocale[MustTestLocales.itIT]} | ${{ year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", hour12: false }} | ${"03/02/2024, 14:30:45"}
  `(
    "formats valid zoned datetime $value for it-IT with options $options to $expected",
    ({ value, options, expected }) => {
      expect(formatZonedDateTime(value, MustTestLocales.itIT, options)).toEqual(
        expected,
      );
    },
  );

  // pt-PT
  it.each`
    value                                  | options                                                                                                                        | expected
    ${valueByLocale[MustTestLocales.ptPT]} | ${{ dateStyle: "full", timeStyle: "full" }}                                                                                    | ${"sábado, 3 de fevereiro de 2024 às 14:30:45 Hora padrão da Europa Ocidental"}
    ${valueByLocale[MustTestLocales.ptPT]} | ${{ dateStyle: "long", timeStyle: "long" }}                                                                                    | ${"3 de fevereiro de 2024 às 14:30:45 WET"}
    ${valueByLocale[MustTestLocales.ptPT]} | ${{ dateStyle: "medium", timeStyle: "medium" }}                                                                                | ${"03/02/2024, 14:30:45"}
    ${valueByLocale[MustTestLocales.ptPT]} | ${{ dateStyle: "short", timeStyle: "short" }}                                                                                  | ${"03/02/24, 14:30"}
    ${valueByLocale[MustTestLocales.ptPT]} | ${{ year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" }}                   | ${"3 de fevereiro de 2024 às 14:30:45"}
    ${valueByLocale[MustTestLocales.ptPT]} | ${{ year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "numeric" }}                                     | ${"3/02/2024, 14:30"}
    ${valueByLocale[MustTestLocales.ptPT]} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }}                | ${"03/02/2024, 14:30:45"}
    ${valueByLocale[MustTestLocales.ptPT]} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }}                                   | ${"03/02/2024, 14:30"}
    ${valueByLocale[MustTestLocales.ptPT]} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }}  | ${"03/02/2024, 02:30:45 p.m."}
    ${valueByLocale[MustTestLocales.ptPT]} | ${{ year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", hour12: false }} | ${"03/02/2024, 14:30:45"}
  `(
    "formats valid zoned datetime $value for pt-PT with options $options to $expected",
    ({ value, options, expected }) => {
      expect(formatZonedDateTime(value, MustTestLocales.ptPT, options)).toEqual(
        expected,
      );
    },
  );

  // sv-SE
  it.each`
    value                                  | options                                                                                                                        | expected
    ${valueByLocale[MustTestLocales.svSE]} | ${{ dateStyle: "full", timeStyle: "full" }}                                                                                    | ${"lördag 3 februari 2024 kl. 14:30:45 centraleuropeisk normaltid"}
    ${valueByLocale[MustTestLocales.svSE]} | ${{ dateStyle: "long", timeStyle: "long" }}                                                                                    | ${"3 februari 2024 kl. 14:30:45 CET"}
    ${valueByLocale[MustTestLocales.svSE]} | ${{ dateStyle: "medium", timeStyle: "medium" }}                                                                                | ${"3 feb. 2024 14:30:45"}
    ${valueByLocale[MustTestLocales.svSE]} | ${{ dateStyle: "short", timeStyle: "short" }}                                                                                  | ${"2024-02-03 14:30"}
    ${valueByLocale[MustTestLocales.svSE]} | ${{ year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" }}                   | ${"3 februari 2024 kl. 14:30:45"}
    ${valueByLocale[MustTestLocales.svSE]} | ${{ year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "numeric" }}                                     | ${"3 feb. 2024 14:30"}
    ${valueByLocale[MustTestLocales.svSE]} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }}                | ${"2024-02-03 14:30:45"}
    ${valueByLocale[MustTestLocales.svSE]} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }}                                   | ${"2024-02-03 14:30"}
    ${valueByLocale[MustTestLocales.svSE]} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }}  | ${"2024-02-03 02:30:45 em"}
    ${valueByLocale[MustTestLocales.svSE]} | ${{ year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", hour12: false }} | ${"2024-02-03 14:30:45"}
  `(
    "formats valid zoned datetime $value for sv-SE with options $options to $expected",
    ({ value, options, expected }) => {
      expect(formatZonedDateTime(value, MustTestLocales.svSE, options)).toEqual(
        expected,
      );
    },
  );

  // is-IS
  it.each`
    value                                  | options                                                                                                                        | expected
    ${valueByLocale[MustTestLocales.isIS]} | ${{ dateStyle: "full", timeStyle: "full" }}                                                                                    | ${"laugardagur, 3. febrúar 2024 kl. 14:30:45 Greenwich-staðaltími"}
    ${valueByLocale[MustTestLocales.isIS]} | ${{ dateStyle: "long", timeStyle: "long" }}                                                                                    | ${"3. febrúar 2024 kl. 14:30:45 GMT+0"}
    ${valueByLocale[MustTestLocales.isIS]} | ${{ dateStyle: "medium", timeStyle: "medium" }}                                                                                | ${"3. feb. 2024, 14:30:45"}
    ${valueByLocale[MustTestLocales.isIS]} | ${{ dateStyle: "short", timeStyle: "short" }}                                                                                  | ${"3.2.2024, 14:30"}
    ${valueByLocale[MustTestLocales.isIS]} | ${{ year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" }}                   | ${"3. febrúar 2024 kl. 14:30:45"}
    ${valueByLocale[MustTestLocales.isIS]} | ${{ year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "numeric" }}                                     | ${"3. feb. 2024, 14:30"}
    ${valueByLocale[MustTestLocales.isIS]} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }}                | ${"03.02.2024, 14:30:45"}
    ${valueByLocale[MustTestLocales.isIS]} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }}                                   | ${"03.02.2024, 14:30"}
    ${valueByLocale[MustTestLocales.isIS]} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }}  | ${"03.02.2024, 02:30:45 e.h."}
    ${valueByLocale[MustTestLocales.isIS]} | ${{ year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", hour12: false }} | ${"3.2.2024, 14:30:45"}
  `(
    "formats valid zoned datetime $value for is-IS with options $options to $expected",
    ({ value, options, expected }) => {
      expect(formatZonedDateTime(value, MustTestLocales.isIS, options)).toEqual(
        expected,
      );
    },
  );

  // zh-CN
  it.each`
    value                                  | options                                                                                                                        | expected
    ${valueByLocale[MustTestLocales.zhCN]} | ${{ dateStyle: "full", timeStyle: "full" }}                                                                                    | ${"2024年2月3日星期六 中国标准时间 14:30:45"}
    ${valueByLocale[MustTestLocales.zhCN]} | ${{ dateStyle: "long", timeStyle: "long" }}                                                                                    | ${"2024年2月3日 GMT+8 14:30:45"}
    ${valueByLocale[MustTestLocales.zhCN]} | ${{ dateStyle: "medium", timeStyle: "medium" }}                                                                                | ${"2024年2月3日 14:30:45"}
    ${valueByLocale[MustTestLocales.zhCN]} | ${{ dateStyle: "short", timeStyle: "short" }}                                                                                  | ${"2024/2/3 14:30"}
    ${valueByLocale[MustTestLocales.zhCN]} | ${{ year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" }}                   | ${"2024/2/3 14:30:45"}
    ${valueByLocale[MustTestLocales.zhCN]} | ${{ year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "numeric" }}                                     | ${"2024/2/3 14:30"}
    ${valueByLocale[MustTestLocales.zhCN]} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }}                | ${"2024/02/03 14:30:45"}
    ${valueByLocale[MustTestLocales.zhCN]} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }}                                   | ${"2024/02/03 14:30"}
    ${valueByLocale[MustTestLocales.zhCN]} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }}  | ${"2024/02/03 下午02:30:45"}
    ${valueByLocale[MustTestLocales.zhCN]} | ${{ year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", hour12: false }} | ${"2024/2/3 14:30:45"}
  `(
    "formats valid zoned datetime $value for zh-CN with options $options to $expected",
    ({ value, options, expected }) => {
      expect(formatZonedDateTime(value, MustTestLocales.zhCN, options)).toEqual(
        expected,
      );
    },
  );

  // zh-TW
  it.each`
    value                                  | options                                                                                                                        | expected
    ${valueByLocale[MustTestLocales.zhTW]} | ${{ dateStyle: "full", timeStyle: "full" }}                                                                                    | ${"2024年2月3日 星期六 下午2:30:45 [台北標準時間]"}
    ${valueByLocale[MustTestLocales.zhTW]} | ${{ dateStyle: "long", timeStyle: "long" }}                                                                                    | ${"2024年2月3日 下午2:30:45 [GMT+8]"}
    ${valueByLocale[MustTestLocales.zhTW]} | ${{ dateStyle: "medium", timeStyle: "medium" }}                                                                                | ${"2024年2月3日 下午2:30:45"}
    ${valueByLocale[MustTestLocales.zhTW]} | ${{ dateStyle: "short", timeStyle: "short" }}                                                                                  | ${"2024/2/3 下午2:30"}
    ${valueByLocale[MustTestLocales.zhTW]} | ${{ year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" }}                   | ${"2024/2/3 下午2:30:45"}
    ${valueByLocale[MustTestLocales.zhTW]} | ${{ year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "numeric" }}                                     | ${"2024/2/3 下午2:30"}
    ${valueByLocale[MustTestLocales.zhTW]} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }}                | ${"2024/02/03 下午02:30:45"}
    ${valueByLocale[MustTestLocales.zhTW]} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }}                                   | ${"2024/02/03 下午02:30"}
    ${valueByLocale[MustTestLocales.zhTW]} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }}  | ${"2024/02/03 下午02:30:45"}
    ${valueByLocale[MustTestLocales.zhTW]} | ${{ year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", hour12: false }} | ${"2024/2/3 14:30:45"}
  `(
    "formats valid zoned datetime $value for zh-TW with options $options to $expected",
    ({ value, options, expected }) => {
      expect(formatZonedDateTime(value, MustTestLocales.zhTW, options)).toEqual(
        expected,
      );
    },
  );

  // ja-JP
  it.each`
    value                                  | options                                                                                                                        | expected
    ${valueByLocale[MustTestLocales.jaJP]} | ${{ dateStyle: "full", timeStyle: "full" }}                                                                                    | ${"2024年2月3日土曜日 14時30分45秒 日本標準時"}
    ${valueByLocale[MustTestLocales.jaJP]} | ${{ dateStyle: "long", timeStyle: "long" }}                                                                                    | ${"2024年2月3日 14:30:45 JST"}
    ${valueByLocale[MustTestLocales.jaJP]} | ${{ dateStyle: "medium", timeStyle: "medium" }}                                                                                | ${"2024/02/03 14:30:45"}
    ${valueByLocale[MustTestLocales.jaJP]} | ${{ dateStyle: "short", timeStyle: "short" }}                                                                                  | ${"2024/02/03 14:30"}
    ${valueByLocale[MustTestLocales.jaJP]} | ${{ year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" }}                   | ${"2024/2/3 14:30:45"}
    ${valueByLocale[MustTestLocales.jaJP]} | ${{ year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "numeric" }}                                     | ${"2024/2/3 14:30"}
    ${valueByLocale[MustTestLocales.jaJP]} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }}                | ${"2024/02/03 14:30:45"}
    ${valueByLocale[MustTestLocales.jaJP]} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }}                                   | ${"2024/02/03 14:30"}
    ${valueByLocale[MustTestLocales.jaJP]} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }}  | ${"2024/02/03 午後02:30:45"}
    ${valueByLocale[MustTestLocales.jaJP]} | ${{ year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", hour12: false }} | ${"2024/2/3 14:30:45"}
  `(
    "formats valid zoned datetime $value for ja-JP with options $options to $expected",
    ({ value, options, expected }) => {
      expect(formatZonedDateTime(value, MustTestLocales.jaJP, options)).toEqual(
        expected,
      );
    },
  );

  // ko-KR
  it.each`
    value                                  | options                                                                                                                        | expected
    ${valueByLocale[MustTestLocales.koKR]} | ${{ dateStyle: "full", timeStyle: "full" }}                                                                                    | ${"2024년 2월 3일 토요일 PM 2시 30분 45초 한국 표준시"}
    ${valueByLocale[MustTestLocales.koKR]} | ${{ dateStyle: "long", timeStyle: "long" }}                                                                                    | ${"2024년 2월 3일 PM 2시 30분 45초 GMT+9"}
    ${valueByLocale[MustTestLocales.koKR]} | ${{ dateStyle: "medium", timeStyle: "medium" }}                                                                                | ${"2024. 2. 3. PM 2:30:45"}
    ${valueByLocale[MustTestLocales.koKR]} | ${{ dateStyle: "short", timeStyle: "short" }}                                                                                  | ${"24. 2. 3. PM 2:30"}
    ${valueByLocale[MustTestLocales.koKR]} | ${{ year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" }}                   | ${"2024년 2월 3일 PM 2:30:45"}
    ${valueByLocale[MustTestLocales.koKR]} | ${{ year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "numeric" }}                                     | ${"2024년 2월 3일 PM 2:30"}
    ${valueByLocale[MustTestLocales.koKR]} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }}                | ${"2024. 02. 03. PM 02:30:45"}
    ${valueByLocale[MustTestLocales.koKR]} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }}                                   | ${"2024. 02. 03. PM 02:30"}
    ${valueByLocale[MustTestLocales.koKR]} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }}  | ${"2024. 02. 03. PM 02:30:45"}
    ${valueByLocale[MustTestLocales.koKR]} | ${{ year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", hour12: false }} | ${"2024. 2. 3. 14시 30분 45초"}
  `(
    "formats valid zoned datetime $value for ko-KR with options $options to $expected",
    ({ value, options, expected }) => {
      expect(formatZonedDateTime(value, MustTestLocales.koKR, options)).toEqual(
        expected,
      );
    },
  );

  // ar-SA
  it.each`
    value                                  | options                                                                                                                        | expected
    ${valueByLocale[MustTestLocales.arSA]} | ${{ dateStyle: "full", timeStyle: "full" }}                                                                                    | ${"السبت، ٣ فبراير ٢٠٢٤ في ٢:٣٠:٤٥ م التوقيت العربي الرسمي"}
    ${valueByLocale[MustTestLocales.arSA]} | ${{ dateStyle: "long", timeStyle: "long" }}                                                                                    | ${"٣ فبراير ٢٠٢٤ في ٢:٣٠:٤٥ م غرينتش+٣"}
    ${valueByLocale[MustTestLocales.arSA]} | ${{ dateStyle: "medium", timeStyle: "medium" }}                                                                                | ${"٠٣‏/٠٢‏/٢٠٢٤، ٢:٣٠:٤٥ م"}
    ${valueByLocale[MustTestLocales.arSA]} | ${{ dateStyle: "short", timeStyle: "short" }}                                                                                  | ${"٣‏/٢‏/٢٠٢٤، ٢:٣٠ م"}
    ${valueByLocale[MustTestLocales.arSA]} | ${{ year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" }}                   | ${"٣ فبراير ٢٠٢٤ في ٢:٣٠:٤٥ م"}
    ${valueByLocale[MustTestLocales.arSA]} | ${{ year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "numeric" }}                                     | ${"٣ فبراير ٢٠٢٤، ٢:٣٠ م"}
    ${valueByLocale[MustTestLocales.arSA]} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }}                | ${"٠٣‏/٠٢‏/٢٠٢٤، ٠٢:٣٠:٤٥ م"}
    ${valueByLocale[MustTestLocales.arSA]} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }}                                   | ${"٠٣‏/٠٢‏/٢٠٢٤، ٠٢:٣٠ م"}
    ${valueByLocale[MustTestLocales.arSA]} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }}  | ${"٠٣‏/٠٢‏/٢٠٢٤، ٠٢:٣٠:٤٥ م"}
    ${valueByLocale[MustTestLocales.arSA]} | ${{ year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", hour12: false }} | ${"٣‏/٢‏/٢٠٢٤، ١٤:٣٠:٤٥"}
  `(
    "formats valid zoned datetime $value for ar-SA with options $options to $expected",
    ({ value, options, expected }) => {
      expect(formatZonedDateTime(value, MustTestLocales.arSA, options)).toEqual(
        expected,
      );
    },
  );

  // he-IL
  it.each`
    value                                  | options                                                                                                                        | expected
    ${valueByLocale[MustTestLocales.heIL]} | ${{ dateStyle: "full", timeStyle: "full" }}                                                                                    | ${"יום שבת, 3 בפברואר 2024 בשעה 14:30:45 שעון ישראל (חורף)"}
    ${valueByLocale[MustTestLocales.heIL]} | ${{ dateStyle: "long", timeStyle: "long" }}                                                                                    | ${"3 בפברואר 2024 בשעה 14:30:45 GMT‎+2‎"}
    ${valueByLocale[MustTestLocales.heIL]} | ${{ dateStyle: "medium", timeStyle: "medium" }}                                                                                | ${"3 בפבר׳ 2024, 14:30:45"}
    ${valueByLocale[MustTestLocales.heIL]} | ${{ dateStyle: "short", timeStyle: "short" }}                                                                                  | ${"3.2.2024, 14:30"}
    ${valueByLocale[MustTestLocales.heIL]} | ${{ year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" }}                   | ${"3 בפברואר 2024 בשעה 14:30:45"}
    ${valueByLocale[MustTestLocales.heIL]} | ${{ year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "numeric" }}                                     | ${"3 בפבר׳ 2024, 14:30"}
    ${valueByLocale[MustTestLocales.heIL]} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }}                | ${"03.02.2024, 14:30:45"}
    ${valueByLocale[MustTestLocales.heIL]} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }}                                   | ${"03.02.2024, 14:30"}
    ${valueByLocale[MustTestLocales.heIL]} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }}  | ${"03.02.2024, 02:30:45 PM"}
    ${valueByLocale[MustTestLocales.heIL]} | ${{ year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", hour12: false }} | ${"3.2.2024, 14:30:45"}
  `(
    "formats valid zoned datetime $value for he-IL with options $options to $expected",
    ({ value, options, expected }) => {
      expect(formatZonedDateTime(value, MustTestLocales.heIL, options)).toEqual(
        expected,
      );
    },
  );

  // ru-RU
  it.each`
    value                                  | options                                                                                                                        | expected
    ${valueByLocale[MustTestLocales.ruRU]} | ${{ dateStyle: "full", timeStyle: "full" }}                                                                                    | ${"суббота, 3 февраля 2024 г. в 14:30:45 Москва, стандартное время"}
    ${valueByLocale[MustTestLocales.ruRU]} | ${{ dateStyle: "long", timeStyle: "long" }}                                                                                    | ${"3 февраля 2024 г. в 14:30:45 GMT+3"}
    ${valueByLocale[MustTestLocales.ruRU]} | ${{ dateStyle: "medium", timeStyle: "medium" }}                                                                                | ${"3 февр. 2024 г., 14:30:45"}
    ${valueByLocale[MustTestLocales.ruRU]} | ${{ dateStyle: "short", timeStyle: "short" }}                                                                                  | ${"03.02.2024, 14:30"}
    ${valueByLocale[MustTestLocales.ruRU]} | ${{ year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" }}                   | ${"3 февраля 2024 г. в 14:30:45"}
    ${valueByLocale[MustTestLocales.ruRU]} | ${{ year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "numeric" }}                                     | ${"3 февр. 2024 г., 14:30"}
    ${valueByLocale[MustTestLocales.ruRU]} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }}                | ${"03.02.2024, 14:30:45"}
    ${valueByLocale[MustTestLocales.ruRU]} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }}                                   | ${"03.02.2024, 14:30"}
    ${valueByLocale[MustTestLocales.ruRU]} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }}  | ${"03.02.2024, 02:30:45 PM"}
    ${valueByLocale[MustTestLocales.ruRU]} | ${{ year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", hour12: false }} | ${"03.02.2024, 14:30:45"}
  `(
    "formats valid zoned datetime $value for ru-RU with options $options to $expected",
    ({ value, options, expected }) => {
      expect(formatZonedDateTime(value, MustTestLocales.ruRU, options)).toEqual(
        expected,
      );
    },
  );

  // tr-TR
  it.each`
    value                                  | options                                                                                                                        | expected
    ${valueByLocale[MustTestLocales.trTR]} | ${{ dateStyle: "full", timeStyle: "full" }}                                                                                    | ${"3 Şubat 2024 Cumartesi 14:30:45 Türkiye Standart Saati"}
    ${valueByLocale[MustTestLocales.trTR]} | ${{ dateStyle: "long", timeStyle: "long" }}                                                                                    | ${"3 Şubat 2024 14:30:45 GMT+3"}
    ${valueByLocale[MustTestLocales.trTR]} | ${{ dateStyle: "medium", timeStyle: "medium" }}                                                                                | ${"3 Şub 2024 14:30:45"}
    ${valueByLocale[MustTestLocales.trTR]} | ${{ dateStyle: "short", timeStyle: "short" }}                                                                                  | ${"3.02.2024 14:30"}
    ${valueByLocale[MustTestLocales.trTR]} | ${{ year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" }}                   | ${"3 Şubat 2024 14:30:45"}
    ${valueByLocale[MustTestLocales.trTR]} | ${{ year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "numeric" }}                                     | ${"3 Şub 2024 14:30"}
    ${valueByLocale[MustTestLocales.trTR]} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }}                | ${"03.02.2024 14:30:45"}
    ${valueByLocale[MustTestLocales.trTR]} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }}                                   | ${"03.02.2024 14:30"}
    ${valueByLocale[MustTestLocales.trTR]} | ${{ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }}  | ${"03.02.2024 ÖS 02:30:45"}
    ${valueByLocale[MustTestLocales.trTR]} | ${{ year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", hour12: false }} | ${"03.02.2024 14:30:45"}
  `(
    "formats valid zoned datetime $value for tr-TR with options $options to $expected",
    ({ value, options, expected }) => {
      expect(formatZonedDateTime(value, MustTestLocales.trTR, options)).toEqual(
        expected,
      );
    },
  );

  // Invalid input
  it.each`
    invalidValue
    ${"not a zoned datetime"}
    ${"2024-02-03T14:30:45"}
    ${""}
    ${null}
    ${undefined}
  `(
    "returns empty string for invalid input $invalidValue",
    ({ invalidValue }) => {
      expect(formatZonedDateTime(invalidValue)).toBe("");
    },
  );

  // Battle tests for DST coverage
  for (const { timeZone, value } of sameInstantBattleCases) {
    it(`formats a battle-test zoned datetime in ${timeZone}`, () => {
      expect(formatZonedDateTime(value, MustTestLocales.enUS)).not.toBe("");
    });
  }
});
