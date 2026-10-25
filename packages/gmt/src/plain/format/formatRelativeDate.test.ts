import { expectOneOfIcu, MustTestLocales, oneOfIcu } from "../../test";
import { mockTemporalNowPlainDateISOThrow } from "../../test/mocks";
import {
  formatRelativeDate,
  type FormatRelativeDateOptions,
} from "./formatRelativeDate";

const REF = "2024-03-15";

describe("formatRelativeDate", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Auto unit selection
  // day (<7 days), week (7–27), month (28–364), year (365+)
  // ---------------------------------------------------------------------------
  describe("auto unit selection", () => {
    it.each`
      value           | expected
      ${"2024-03-12"} | ${"3 days ago"}
      ${"2024-03-18"} | ${"in 3 days"}
      ${"2024-03-08"} | ${"last week"}
      ${"2024-03-22"} | ${"next week"}
      ${"2024-02-16"} | ${"last month"}
      ${"2024-04-12"} | ${"next month"}
      ${"2023-03-15"} | ${"last year"}
      ${"2025-03-15"} | ${"next year"}
    `("formats $value relative to REF as $expected", ({ value, expected }) => {
      expect(
        formatRelativeDate(value, MustTestLocales.enUS, { reference: REF }),
      ).toBe(expected);
    });
  });

  // ---------------------------------------------------------------------------
  // ±1 and 0 permutations
  // ---------------------------------------------------------------------------
  describe("±1 and 0 permutations", () => {
    it.each`
      value           | expected
      ${"2024-03-15"} | ${"today"}
      ${"2024-03-14"} | ${"yesterday"}
      ${"2024-03-16"} | ${"tomorrow"}
      ${"2024-03-08"} | ${"last week"}
      ${"2024-03-22"} | ${"next week"}
      ${"2024-02-16"} | ${"last month"}
      ${"2024-04-12"} | ${"next month"}
      ${"2023-03-15"} | ${"last year"}
      ${"2025-03-15"} | ${"next year"}
    `("formats $value (en-US, auto) as $expected", ({ value, expected }) => {
      expect(
        formatRelativeDate(value, MustTestLocales.enUS, { reference: REF }),
      ).toBe(expected);
    });
  });

  // ---------------------------------------------------------------------------
  // Per-locale coverage — one block per locale, 12 rows each
  // rows: -3d long, +3d long, -3d short, -3d narrow, +3d narrow,
  //       -1wk, +1wk, -2mo, +2mo, -1yr, +1yr, -3wks (largestUnit:week always)
  // ---------------------------------------------------------------------------

  // en-US
  it.each`
    value           | options                                                                         | expected          | label
    ${"2024-03-12"} | ${{ reference: REF }}                                                           | ${"3 days ago"}   | ${"default options"}
    ${"2024-03-18"} | ${{ reference: REF }}                                                           | ${"in 3 days"}    | ${"default options"}
    ${"2024-03-12"} | ${{ reference: REF, style: "short" as const }}                                  | ${"3 days ago"}   | ${"style short"}
    ${"2024-03-12"} | ${{ reference: REF, style: "narrow" as const }}                                 | ${"3d ago"}       | ${"style narrow"}
    ${"2024-03-18"} | ${{ reference: REF, style: "narrow" as const }}                                 | ${"in 3d"}        | ${"style narrow"}
    ${"2024-03-08"} | ${{ reference: REF }}                                                           | ${"last week"}    | ${"default options"}
    ${"2024-03-22"} | ${{ reference: REF }}                                                           | ${"next week"}    | ${"default options"}
    ${"2024-01-15"} | ${{ reference: REF }}                                                           | ${"2 months ago"} | ${"default options"}
    ${"2024-05-15"} | ${{ reference: REF }}                                                           | ${"in 2 months"}  | ${"default options"}
    ${"2023-03-15"} | ${{ reference: REF }}                                                           | ${"last year"}    | ${"default options"}
    ${"2025-03-15"} | ${{ reference: REF }}                                                           | ${"next year"}    | ${"default options"}
    ${"2024-02-23"} | ${{ reference: REF, largestUnit: "week" as const, numeric: "always" as const }} | ${"3 weeks ago"}  | ${"largestUnit week, numeric always"}
  `(
    "formats $value for en-US with $label as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeDate(value, MustTestLocales.enUS, options)).toBe(
        expected,
      );
    },
  );

  // en-GB
  it.each`
    value           | options                                                                         | expected          | label
    ${"2024-03-12"} | ${{ reference: REF }}                                                           | ${"3 days ago"}   | ${"default options"}
    ${"2024-03-18"} | ${{ reference: REF }}                                                           | ${"in 3 days"}    | ${"default options"}
    ${"2024-03-12"} | ${{ reference: REF, style: "short" as const }}                                  | ${"3 days ago"}   | ${"style short"}
    ${"2024-03-12"} | ${{ reference: REF, style: "narrow" as const }}                                 | ${"3 days ago"}   | ${"style narrow"}
    ${"2024-03-18"} | ${{ reference: REF, style: "narrow" as const }}                                 | ${"in 3 days"}    | ${"style narrow"}
    ${"2024-03-08"} | ${{ reference: REF }}                                                           | ${"last week"}    | ${"default options"}
    ${"2024-03-22"} | ${{ reference: REF }}                                                           | ${"next week"}    | ${"default options"}
    ${"2024-01-15"} | ${{ reference: REF }}                                                           | ${"2 months ago"} | ${"default options"}
    ${"2024-05-15"} | ${{ reference: REF }}                                                           | ${"in 2 months"}  | ${"default options"}
    ${"2023-03-15"} | ${{ reference: REF }}                                                           | ${"last year"}    | ${"default options"}
    ${"2025-03-15"} | ${{ reference: REF }}                                                           | ${"next year"}    | ${"default options"}
    ${"2024-02-23"} | ${{ reference: REF, largestUnit: "week" as const, numeric: "always" as const }} | ${"3 weeks ago"}  | ${"largestUnit week, numeric always"}
  `(
    "formats $value for en-GB with $label as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeDate(value, MustTestLocales.enGB, options)).toBe(
        expected,
      );
    },
  );

  // de-DE
  it.each`
    value           | options                                                                         | expected           | label
    ${"2024-03-12"} | ${{ reference: REF }}                                                           | ${"vor 3 Tagen"}   | ${"default options"}
    ${"2024-03-18"} | ${{ reference: REF }}                                                           | ${"in 3 Tagen"}    | ${"default options"}
    ${"2024-03-12"} | ${{ reference: REF, style: "short" as const }}                                  | ${"vor 3 Tagen"}   | ${"style short"}
    ${"2024-03-12"} | ${{ reference: REF, style: "narrow" as const }}                                 | ${"vor 3 Tagen"}   | ${"style narrow"}
    ${"2024-03-18"} | ${{ reference: REF, style: "narrow" as const }}                                 | ${"in 3 Tagen"}    | ${"style narrow"}
    ${"2024-03-08"} | ${{ reference: REF }}                                                           | ${"letzte Woche"}  | ${"default options"}
    ${"2024-03-22"} | ${{ reference: REF }}                                                           | ${"nächste Woche"} | ${"default options"}
    ${"2024-01-15"} | ${{ reference: REF }}                                                           | ${"vor 2 Monaten"} | ${"default options"}
    ${"2024-05-15"} | ${{ reference: REF }}                                                           | ${"in 2 Monaten"}  | ${"default options"}
    ${"2023-03-15"} | ${{ reference: REF }}                                                           | ${"letztes Jahr"}  | ${"default options"}
    ${"2025-03-15"} | ${{ reference: REF }}                                                           | ${"nächstes Jahr"} | ${"default options"}
    ${"2024-02-23"} | ${{ reference: REF, largestUnit: "week" as const, numeric: "always" as const }} | ${"vor 3 Wochen"}  | ${"largestUnit week, numeric always"}
  `(
    "formats $value for de-DE with $label as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeDate(value, MustTestLocales.deDE, options)).toBe(
        expected,
      );
    },
  );

  // fr-FR
  it.each`
    value           | options                                                                         | expected                  | label
    ${"2024-03-12"} | ${{ reference: REF }}                                                           | ${"il y a 3 jours"}       | ${"default options"}
    ${"2024-03-18"} | ${{ reference: REF }}                                                           | ${"dans 3 jours"}         | ${"default options"}
    ${"2024-03-12"} | ${{ reference: REF, style: "short" as const }}                                  | ${"il y a 3 j"}           | ${"style short"}
    ${"2024-03-12"} | ${{ reference: REF, style: "narrow" as const }}                                 | ${"-3 j"}                 | ${"style narrow"}
    ${"2024-03-18"} | ${{ reference: REF, style: "narrow" as const }}                                 | ${"+3 j"}                 | ${"style narrow"}
    ${"2024-03-08"} | ${{ reference: REF }}                                                           | ${"la semaine dernière"}  | ${"default options"}
    ${"2024-03-22"} | ${{ reference: REF }}                                                           | ${"la semaine prochaine"} | ${"default options"}
    ${"2024-01-15"} | ${{ reference: REF }}                                                           | ${"il y a 2 mois"}        | ${"default options"}
    ${"2024-05-15"} | ${{ reference: REF }}                                                           | ${"dans 2 mois"}          | ${"default options"}
    ${"2023-03-15"} | ${{ reference: REF }}                                                           | ${"l’année dernière"}     | ${"default options"}
    ${"2025-03-15"} | ${{ reference: REF }}                                                           | ${"l’année prochaine"}    | ${"default options"}
    ${"2024-02-23"} | ${{ reference: REF, largestUnit: "week" as const, numeric: "always" as const }} | ${"il y a 3 semaines"}    | ${"largestUnit week, numeric always"}
  `(
    "formats $value for fr-FR with $label as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeDate(value, MustTestLocales.frFR, options)).toBe(
        expected,
      );
    },
  );

  // es-ES
  it.each`
    value           | options                                                                         | expected               | label
    ${"2024-03-12"} | ${{ reference: REF }}                                                           | ${"hace 3 días"}       | ${"default options"}
    ${"2024-03-18"} | ${{ reference: REF }}                                                           | ${"dentro de 3 días"}  | ${"default options"}
    ${"2024-03-12"} | ${{ reference: REF, style: "short" as const }}                                  | ${"hace 3 d"}          | ${"style short"}
    ${"2024-03-12"} | ${{ reference: REF, style: "narrow" as const }}                                 | ${"hace 3 d"}          | ${"style narrow"}
    ${"2024-03-18"} | ${{ reference: REF, style: "narrow" as const }}                                 | ${"dentro de 3 d"}     | ${"style narrow"}
    ${"2024-03-08"} | ${{ reference: REF }}                                                           | ${"la semana pasada"}  | ${"default options"}
    ${"2024-03-22"} | ${{ reference: REF }}                                                           | ${"la próxima semana"} | ${"default options"}
    ${"2024-01-15"} | ${{ reference: REF }}                                                           | ${"hace 2 meses"}      | ${"default options"}
    ${"2024-05-15"} | ${{ reference: REF }}                                                           | ${"dentro de 2 meses"} | ${"default options"}
    ${"2023-03-15"} | ${{ reference: REF }}                                                           | ${"el año pasado"}     | ${"default options"}
    ${"2025-03-15"} | ${{ reference: REF }}                                                           | ${"el próximo año"}    | ${"default options"}
    ${"2024-02-23"} | ${{ reference: REF, largestUnit: "week" as const, numeric: "always" as const }} | ${"hace 3 semanas"}    | ${"largestUnit week, numeric always"}
  `(
    "formats $value for es-ES with $label as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeDate(value, MustTestLocales.esES, options)).toBe(
        expected,
      );
    },
  );

  // it-IT
  it.each`
    value           | options                                                                         | expected                | label
    ${"2024-03-12"} | ${{ reference: REF }}                                                           | ${"3 giorni fa"}        | ${"default options"}
    ${"2024-03-18"} | ${{ reference: REF }}                                                           | ${"tra 3 giorni"}       | ${"default options"}
    ${"2024-03-12"} | ${{ reference: REF, style: "short" as const }}                                  | ${"3 gg fa"}            | ${"style short"}
    ${"2024-03-12"} | ${{ reference: REF, style: "narrow" as const }}                                 | ${"3 gg fa"}            | ${"style narrow"}
    ${"2024-03-18"} | ${{ reference: REF, style: "narrow" as const }}                                 | ${"tra 3 gg"}           | ${"style narrow"}
    ${"2024-03-08"} | ${{ reference: REF }}                                                           | ${"settimana scorsa"}   | ${"default options"}
    ${"2024-03-22"} | ${{ reference: REF }}                                                           | ${"settimana prossima"} | ${"default options"}
    ${"2024-01-15"} | ${{ reference: REF }}                                                           | ${"2 mesi fa"}          | ${"default options"}
    ${"2024-05-15"} | ${{ reference: REF }}                                                           | ${"tra 2 mesi"}         | ${"default options"}
    ${"2023-03-15"} | ${{ reference: REF }}                                                           | ${"anno scorso"}        | ${"default options"}
    ${"2025-03-15"} | ${{ reference: REF }}                                                           | ${"anno prossimo"}      | ${"default options"}
    ${"2024-02-23"} | ${{ reference: REF, largestUnit: "week" as const, numeric: "always" as const }} | ${"3 settimane fa"}     | ${"largestUnit week, numeric always"}
  `(
    "formats $value for it-IT with $label as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeDate(value, MustTestLocales.itIT, options)).toBe(
        expected,
      );
    },
  );

  // pt-PT
  it.each`
    value           | options                                                                         | expected               | label
    ${"2024-03-12"} | ${{ reference: REF }}                                                           | ${"há 3 dias"}         | ${"default options"}
    ${"2024-03-18"} | ${{ reference: REF }}                                                           | ${"dentro de 3 dias"}  | ${"default options"}
    ${"2024-03-12"} | ${{ reference: REF, style: "short" as const }}                                  | ${"há 3 dias"}         | ${"style short"}
    ${"2024-03-12"} | ${{ reference: REF, style: "narrow" as const }}                                 | ${"-3 dias"}           | ${"style narrow"}
    ${"2024-03-18"} | ${{ reference: REF, style: "narrow" as const }}                                 | ${"+3 dias"}           | ${"style narrow"}
    ${"2024-03-08"} | ${{ reference: REF }}                                                           | ${"semana passada"}    | ${"default options"}
    ${"2024-03-22"} | ${{ reference: REF }}                                                           | ${"próxima semana"}    | ${"default options"}
    ${"2024-01-15"} | ${{ reference: REF }}                                                           | ${"há 2 meses"}        | ${"default options"}
    ${"2024-05-15"} | ${{ reference: REF }}                                                           | ${"dentro de 2 meses"} | ${"default options"}
    ${"2023-03-15"} | ${{ reference: REF }}                                                           | ${"ano passado"}       | ${"default options"}
    ${"2025-03-15"} | ${{ reference: REF }}                                                           | ${"próximo ano"}       | ${"default options"}
    ${"2024-02-23"} | ${{ reference: REF, largestUnit: "week" as const, numeric: "always" as const }} | ${"há 3 semanas"}      | ${"largestUnit week, numeric always"}
  `(
    "formats $value for pt-PT with $label as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeDate(value, MustTestLocales.ptPT, options)).toBe(
        expected,
      );
    },
  );

  // sv-SE
  it.each`
    value           | options                                                                         | expected                 | label
    ${"2024-03-12"} | ${{ reference: REF }}                                                           | ${"för 3 dagar sedan"}   | ${"default options"}
    ${"2024-03-18"} | ${{ reference: REF }}                                                           | ${"om 3 dagar"}          | ${"default options"}
    ${"2024-03-12"} | ${{ reference: REF, style: "short" as const }}                                  | ${"för 3 d sedan"}       | ${"style short"}
    ${"2024-03-12"} | ${{ reference: REF, style: "narrow" as const }}                                 | ${"- 3 d"}               | ${"style narrow"}
    ${"2024-03-18"} | ${{ reference: REF, style: "narrow" as const }}                                 | ${"+3 d"}                | ${"style narrow"}
    ${"2024-03-08"} | ${{ reference: REF }}                                                           | ${"förra veckan"}        | ${"default options"}
    ${"2024-03-22"} | ${{ reference: REF }}                                                           | ${"nästa vecka"}         | ${"default options"}
    ${"2024-01-15"} | ${{ reference: REF }}                                                           | ${"för 2 månader sedan"} | ${"default options"}
    ${"2024-05-15"} | ${{ reference: REF }}                                                           | ${"om 2 månader"}        | ${"default options"}
    ${"2025-03-15"} | ${{ reference: REF }}                                                           | ${"nästa år"}            | ${"default options"}
    ${"2024-02-23"} | ${{ reference: REF, largestUnit: "week" as const, numeric: "always" as const }} | ${"för 3 veckor sedan"}  | ${"largestUnit week, numeric always"}
  `(
    "formats $value for sv-SE with $label as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeDate(value, MustTestLocales.svSE, options)).toBe(
        expected,
      );
    },
  );

  // sv-SE "last year" — CLDR changed the idiom from "i fjol" (ICU 77 /
  // Node 22.16–22.22) to "förra året" (ICU 78 / Node 22.23+, 24, 26).
  it("formats 2023-03-15 for sv-SE with default options as one of the known ICU variants", () => {
    expectOneOfIcu(
      formatRelativeDate("2023-03-15", MustTestLocales.svSE, {
        reference: REF,
      }),
      oneOfIcu("i fjol", "förra året"),
    );
  });

  // is-IS
  it.each`
    value           | options                                                                         | expected             | label
    ${"2024-03-12"} | ${{ reference: REF }}                                                           | ${"fyrir 3 dögum"}   | ${"default options"}
    ${"2024-03-18"} | ${{ reference: REF }}                                                           | ${"eftir 3 daga"}    | ${"default options"}
    ${"2024-03-12"} | ${{ reference: REF, style: "short" as const }}                                  | ${"fyrir 3 dögum"}   | ${"style short"}
    ${"2024-03-12"} | ${{ reference: REF, style: "narrow" as const }}                                 | ${"fyrir 3 dögum"}   | ${"style narrow"}
    ${"2024-03-18"} | ${{ reference: REF, style: "narrow" as const }}                                 | ${"eftir 3 daga"}    | ${"style narrow"}
    ${"2024-03-08"} | ${{ reference: REF }}                                                           | ${"í síðustu viku"}  | ${"default options"}
    ${"2024-03-22"} | ${{ reference: REF }}                                                           | ${"í næstu viku"}    | ${"default options"}
    ${"2024-01-15"} | ${{ reference: REF }}                                                           | ${"fyrir 2 mánuðum"} | ${"default options"}
    ${"2024-05-15"} | ${{ reference: REF }}                                                           | ${"eftir 2 mánuði"}  | ${"default options"}
    ${"2023-03-15"} | ${{ reference: REF }}                                                           | ${"á síðasta ári"}   | ${"default options"}
    ${"2025-03-15"} | ${{ reference: REF }}                                                           | ${"á næsta ári"}     | ${"default options"}
    ${"2024-02-23"} | ${{ reference: REF, largestUnit: "week" as const, numeric: "always" as const }} | ${"fyrir 3 vikum"}   | ${"largestUnit week, numeric always"}
  `(
    "formats $value for is-IS with $label as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeDate(value, MustTestLocales.isIS, options)).toBe(
        expected,
      );
    },
  );

  // zh-CN
  it.each`
    value           | options                                                                         | expected     | label
    ${"2024-03-12"} | ${{ reference: REF }}                                                           | ${"3天前"}   | ${"default options"}
    ${"2024-03-18"} | ${{ reference: REF }}                                                           | ${"3天后"}   | ${"default options"}
    ${"2024-03-12"} | ${{ reference: REF, style: "short" as const }}                                  | ${"3天前"}   | ${"style short"}
    ${"2024-03-12"} | ${{ reference: REF, style: "narrow" as const }}                                 | ${"3天前"}   | ${"style narrow"}
    ${"2024-03-18"} | ${{ reference: REF, style: "narrow" as const }}                                 | ${"3天后"}   | ${"style narrow"}
    ${"2024-03-08"} | ${{ reference: REF }}                                                           | ${"上周"}    | ${"default options"}
    ${"2024-03-22"} | ${{ reference: REF }}                                                           | ${"下周"}    | ${"default options"}
    ${"2024-01-15"} | ${{ reference: REF }}                                                           | ${"2个月前"} | ${"default options"}
    ${"2024-05-15"} | ${{ reference: REF }}                                                           | ${"2个月后"} | ${"default options"}
    ${"2023-03-15"} | ${{ reference: REF }}                                                           | ${"去年"}    | ${"default options"}
    ${"2025-03-15"} | ${{ reference: REF }}                                                           | ${"明年"}    | ${"default options"}
    ${"2024-02-23"} | ${{ reference: REF, largestUnit: "week" as const, numeric: "always" as const }} | ${"3周前"}   | ${"largestUnit week, numeric always"}
  `(
    "formats $value for zh-CN with $label as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeDate(value, MustTestLocales.zhCN, options)).toBe(
        expected,
      );
    },
  );

  // zh-TW
  it.each`
    value           | options                                                                         | expected      | label
    ${"2024-03-12"} | ${{ reference: REF }}                                                           | ${"3 天前"}   | ${"default options"}
    ${"2024-03-18"} | ${{ reference: REF }}                                                           | ${"3 天後"}   | ${"default options"}
    ${"2024-03-12"} | ${{ reference: REF, style: "short" as const }}                                  | ${"3 天前"}   | ${"style short"}
    ${"2024-03-12"} | ${{ reference: REF, style: "narrow" as const }}                                 | ${"3 天前"}   | ${"style narrow"}
    ${"2024-03-18"} | ${{ reference: REF, style: "narrow" as const }}                                 | ${"3 天後"}   | ${"style narrow"}
    ${"2024-03-08"} | ${{ reference: REF }}                                                           | ${"上週"}     | ${"default options"}
    ${"2024-03-22"} | ${{ reference: REF }}                                                           | ${"下週"}     | ${"default options"}
    ${"2024-01-15"} | ${{ reference: REF }}                                                           | ${"2 個月前"} | ${"default options"}
    ${"2024-05-15"} | ${{ reference: REF }}                                                           | ${"2 個月後"} | ${"default options"}
    ${"2023-03-15"} | ${{ reference: REF }}                                                           | ${"去年"}     | ${"default options"}
    ${"2025-03-15"} | ${{ reference: REF }}                                                           | ${"明年"}     | ${"default options"}
    ${"2024-02-23"} | ${{ reference: REF, largestUnit: "week" as const, numeric: "always" as const }} | ${"3 週前"}   | ${"largestUnit week, numeric always"}
  `(
    "formats $value for zh-TW with $label as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeDate(value, MustTestLocales.zhTW, options)).toBe(
        expected,
      );
    },
  );

  // ja-JP
  it.each`
    value           | options                                                                         | expected      | label
    ${"2024-03-12"} | ${{ reference: REF }}                                                           | ${"3 日前"}   | ${"default options"}
    ${"2024-03-18"} | ${{ reference: REF }}                                                           | ${"3 日後"}   | ${"default options"}
    ${"2024-03-12"} | ${{ reference: REF, style: "short" as const }}                                  | ${"3 日前"}   | ${"style short"}
    ${"2024-03-12"} | ${{ reference: REF, style: "narrow" as const }}                                 | ${"3日前"}    | ${"style narrow"}
    ${"2024-03-18"} | ${{ reference: REF, style: "narrow" as const }}                                 | ${"3日後"}    | ${"style narrow"}
    ${"2024-03-08"} | ${{ reference: REF }}                                                           | ${"先週"}     | ${"default options"}
    ${"2024-03-22"} | ${{ reference: REF }}                                                           | ${"来週"}     | ${"default options"}
    ${"2024-01-15"} | ${{ reference: REF }}                                                           | ${"2 か月前"} | ${"default options"}
    ${"2024-05-15"} | ${{ reference: REF }}                                                           | ${"2 か月後"} | ${"default options"}
    ${"2023-03-15"} | ${{ reference: REF }}                                                           | ${"昨年"}     | ${"default options"}
    ${"2025-03-15"} | ${{ reference: REF }}                                                           | ${"来年"}     | ${"default options"}
    ${"2024-02-23"} | ${{ reference: REF, largestUnit: "week" as const, numeric: "always" as const }} | ${"3 週間前"} | ${"largestUnit week, numeric always"}
  `(
    "formats $value for ja-JP with $label as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeDate(value, MustTestLocales.jaJP, options)).toBe(
        expected,
      );
    },
  );

  // ko-KR
  it.each`
    value           | options                                                                         | expected      | label
    ${"2024-03-12"} | ${{ reference: REF }}                                                           | ${"3일 전"}   | ${"default options"}
    ${"2024-03-18"} | ${{ reference: REF }}                                                           | ${"3일 후"}   | ${"default options"}
    ${"2024-03-12"} | ${{ reference: REF, style: "short" as const }}                                  | ${"3일 전"}   | ${"style short"}
    ${"2024-03-12"} | ${{ reference: REF, style: "narrow" as const }}                                 | ${"3일 전"}   | ${"style narrow"}
    ${"2024-03-18"} | ${{ reference: REF, style: "narrow" as const }}                                 | ${"3일 후"}   | ${"style narrow"}
    ${"2024-03-08"} | ${{ reference: REF }}                                                           | ${"지난주"}   | ${"default options"}
    ${"2024-03-22"} | ${{ reference: REF }}                                                           | ${"다음 주"}  | ${"default options"}
    ${"2024-01-15"} | ${{ reference: REF }}                                                           | ${"2개월 전"} | ${"default options"}
    ${"2024-05-15"} | ${{ reference: REF }}                                                           | ${"2개월 후"} | ${"default options"}
    ${"2023-03-15"} | ${{ reference: REF }}                                                           | ${"작년"}     | ${"default options"}
    ${"2025-03-15"} | ${{ reference: REF }}                                                           | ${"내년"}     | ${"default options"}
    ${"2024-02-23"} | ${{ reference: REF, largestUnit: "week" as const, numeric: "always" as const }} | ${"3주 전"}   | ${"largestUnit week, numeric always"}
  `(
    "formats $value for ko-KR with $label as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeDate(value, MustTestLocales.koKR, options)).toBe(
        expected,
      );
    },
  );

  // ar-SA
  it.each`
    value           | options                                                                         | expected           | label
    ${"2024-03-12"} | ${{ reference: REF }}                                                           | ${"قبل ٣ أيام"}    | ${"default options"}
    ${"2024-03-18"} | ${{ reference: REF }}                                                           | ${"خلال ٣ أيام"}    | ${"default options"}
    ${"2024-03-12"} | ${{ reference: REF, style: "short" as const }}                                  | ${"قبل ٣ أيام"}    | ${"style short"}
    ${"2024-03-12"} | ${{ reference: REF, style: "narrow" as const }}                                 | ${"قبل ٣ أيام"}    | ${"style narrow"}
    ${"2024-03-18"} | ${{ reference: REF, style: "narrow" as const }}                                 | ${"خلال ٣ أيام"}    | ${"style narrow"}
    ${"2024-03-08"} | ${{ reference: REF }}                                                           | ${"الأسبوع الماضي"} | ${"default options"}
    ${"2024-03-22"} | ${{ reference: REF }}                                                           | ${"الأسبوع القادم"} | ${"default options"}
    ${"2024-01-15"} | ${{ reference: REF }}                                                           | ${"قبل شهرين"}     | ${"default options"}
    ${"2024-05-15"} | ${{ reference: REF }}                                                           | ${"خلال شهرين"}     | ${"default options"}
    ${"2023-03-15"} | ${{ reference: REF }}                                                           | ${"السنة الماضية"} | ${"default options"}
    ${"2025-03-15"} | ${{ reference: REF }}                                                           | ${"السنة القادمة"} | ${"default options"}
    ${"2024-02-23"} | ${{ reference: REF, largestUnit: "week" as const, numeric: "always" as const }} | ${"قبل ٣ أسابيع"}  | ${"largestUnit week, numeric always"}
  `(
    "formats $value for ar-SA with $label as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeDate(value, MustTestLocales.arSA, options)).toBe(
        expected,
      );
    },
  );

  // he-IL
  it.each`
    value           | options                                                                         | expected           | label
    ${"2024-03-12"} | ${{ reference: REF }}                                                           | ${"לפני 3 ימים"}   | ${"default options"}
    ${"2024-03-18"} | ${{ reference: REF }}                                                           | ${"בעוד 3 ימים"}   | ${"default options"}
    ${"2024-03-12"} | ${{ reference: REF, style: "short" as const }}                                  | ${"לפני 3 ימים"}   | ${"style short"}
    ${"2024-03-12"} | ${{ reference: REF, style: "narrow" as const }}                                 | ${"לפני 3 ימים"}   | ${"style narrow"}
    ${"2024-03-18"} | ${{ reference: REF, style: "narrow" as const }}                                 | ${"בעוד 3 ימים"}   | ${"style narrow"}
    ${"2024-03-08"} | ${{ reference: REF }}                                                           | ${"השבוע שעבר"}    | ${"default options"}
    ${"2024-03-22"} | ${{ reference: REF }}                                                           | ${"השבוע הבא"}     | ${"default options"}
    ${"2023-03-15"} | ${{ reference: REF }}                                                           | ${"השנה שעברה"}    | ${"default options"}
    ${"2025-03-15"} | ${{ reference: REF }}                                                           | ${"השנה הבאה"}     | ${"default options"}
    ${"2024-02-23"} | ${{ reference: REF, largestUnit: "week" as const, numeric: "always" as const }} | ${"לפני 3 שבועות"} | ${"largestUnit week, numeric always"}
  `(
    "formats $value for he-IL with $label as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeDate(value, MustTestLocales.heIL, options)).toBe(
        expected,
      );
    },
  );

  // he-IL dual-form month pluralization — CLDR started appending the
  // numeral in parentheses to the dual form ("חודשיים") starting ICU 78
  // (Node 22.23+, 24, 26); ICU 77 (Node 22.16–22.22) omits it.
  it.each`
    value           | options               | expectedVariants
    ${"2024-01-15"} | ${{ reference: REF }} | ${oneOfIcu("לפני חודשיים", "לפני חודשיים (2)")}
    ${"2024-05-15"} | ${{ reference: REF }} | ${oneOfIcu("בעוד חודשיים", "בעוד חודשיים (2)")}
  `(
    "formats $value for he-IL with $options as one of the known ICU variants",
    ({ value, options, expectedVariants }) => {
      expectOneOfIcu(
        formatRelativeDate(value, MustTestLocales.heIL, options),
        expectedVariants,
      );
    },
  );

  // ru-RU
  it.each`
    value           | options                                                                         | expected                 | label
    ${"2024-03-12"} | ${{ reference: REF }}                                                           | ${"3 дня назад"}         | ${"default options"}
    ${"2024-03-18"} | ${{ reference: REF }}                                                           | ${"через 3 дня"}         | ${"default options"}
    ${"2024-03-12"} | ${{ reference: REF, style: "short" as const }}                                  | ${"3 дн. назад"}         | ${"style short"}
    ${"2024-03-12"} | ${{ reference: REF, style: "narrow" as const }}                                 | ${"-3 дн."}              | ${"style narrow"}
    ${"2024-03-18"} | ${{ reference: REF, style: "narrow" as const }}                                 | ${"+3 дн."}              | ${"style narrow"}
    ${"2024-03-08"} | ${{ reference: REF }}                                                           | ${"на прошлой неделе"}   | ${"default options"}
    ${"2024-03-22"} | ${{ reference: REF }}                                                           | ${"на следующей неделе"} | ${"default options"}
    ${"2024-01-15"} | ${{ reference: REF }}                                                           | ${"2 месяца назад"}      | ${"default options"}
    ${"2024-05-15"} | ${{ reference: REF }}                                                           | ${"через 2 месяца"}      | ${"default options"}
    ${"2023-03-15"} | ${{ reference: REF }}                                                           | ${"в прошлом году"}      | ${"default options"}
    ${"2025-03-15"} | ${{ reference: REF }}                                                           | ${"в следующем году"}    | ${"default options"}
    ${"2024-02-23"} | ${{ reference: REF, largestUnit: "week" as const, numeric: "always" as const }} | ${"3 недели назад"}      | ${"largestUnit week, numeric always"}
  `(
    "formats $value for ru-RU with $label as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeDate(value, MustTestLocales.ruRU, options)).toBe(
        expected,
      );
    },
  );

  // tr-TR
  it.each`
    value           | options                                                                         | expected           | label
    ${"2024-03-12"} | ${{ reference: REF }}                                                           | ${"3 gün önce"}    | ${"default options"}
    ${"2024-03-18"} | ${{ reference: REF }}                                                           | ${"3 gün sonra"}   | ${"default options"}
    ${"2024-03-12"} | ${{ reference: REF, style: "short" as const }}                                  | ${"3 gün önce"}    | ${"style short"}
    ${"2024-03-12"} | ${{ reference: REF, style: "narrow" as const }}                                 | ${"3 gün önce"}    | ${"style narrow"}
    ${"2024-03-18"} | ${{ reference: REF, style: "narrow" as const }}                                 | ${"3 gün sonra"}   | ${"style narrow"}
    ${"2024-03-08"} | ${{ reference: REF }}                                                           | ${"geçen hafta"}   | ${"default options"}
    ${"2024-03-22"} | ${{ reference: REF }}                                                           | ${"gelecek hafta"} | ${"default options"}
    ${"2024-01-15"} | ${{ reference: REF }}                                                           | ${"2 ay önce"}     | ${"default options"}
    ${"2024-05-15"} | ${{ reference: REF }}                                                           | ${"2 ay sonra"}    | ${"default options"}
    ${"2023-03-15"} | ${{ reference: REF }}                                                           | ${"geçen yıl"}     | ${"default options"}
    ${"2025-03-15"} | ${{ reference: REF }}                                                           | ${"gelecek yıl"}   | ${"default options"}
    ${"2024-02-23"} | ${{ reference: REF, largestUnit: "week" as const, numeric: "always" as const }} | ${"3 hafta önce"}  | ${"largestUnit week, numeric always"}
  `(
    "formats $value for tr-TR with $label as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeDate(value, MustTestLocales.trTR, options)).toBe(
        expected,
      );
    },
  );

  // ---------------------------------------------------------------------------
  // style option
  // ---------------------------------------------------------------------------
  describe("style option", () => {
    const value = "2024-03-12";

    it.each`
      style       | expected
      ${"long"}   | ${"3 days ago"}
      ${"short"}  | ${"3 days ago"}
      ${"narrow"} | ${"3d ago"}
    `("style:$style formats -3 days as $expected", ({ style, expected }) => {
      expect(
        formatRelativeDate(value, MustTestLocales.enUS, {
          reference: REF,
          style,
        }),
      ).toBe(expected);
    });
  });

  // ---------------------------------------------------------------------------
  // numeric option
  // ---------------------------------------------------------------------------
  describe("numeric option", () => {
    it.each`
      value           | numeric     | expected
      ${"2024-03-15"} | ${"auto"}   | ${"today"}
      ${"2024-03-15"} | ${"always"} | ${"in 0 days"}
      ${"2024-03-16"} | ${"auto"}   | ${"tomorrow"}
      ${"2024-03-16"} | ${"always"} | ${"in 1 day"}
      ${"2024-03-14"} | ${"auto"}   | ${"yesterday"}
      ${"2024-03-14"} | ${"always"} | ${"1 day ago"}
    `(
      "numeric:$numeric for $value → $expected",
      ({ value, numeric, expected }) => {
        expect(
          formatRelativeDate(value, MustTestLocales.enUS, {
            reference: REF,
            numeric,
          }),
        ).toBe(expected);
      },
    );
  });

  // ---------------------------------------------------------------------------
  // explicit largestUnit
  // ---------------------------------------------------------------------------
  describe("explicit largestUnit", () => {
    it.each`
      value           | largestUnit | expected
      ${"2024-03-12"} | ${"day"}    | ${"3 days ago"}
      ${"2024-03-18"} | ${"day"}    | ${"in 3 days"}
      ${"2024-02-23"} | ${"week"}   | ${"3 weeks ago"}
      ${"2024-03-08"} | ${"week"}   | ${"last week"}
      ${"2024-03-22"} | ${"week"}   | ${"next week"}
    `(
      "largestUnit:$largestUnit for $value → $expected",
      ({ value, largestUnit, expected }) => {
        expect(
          formatRelativeDate(value, MustTestLocales.enUS, {
            reference: REF,
            largestUnit,
          }),
        ).toBe(expected);
      },
    );

    it("largestUnit:month — 2 months ago", () => {
      expect(
        formatRelativeDate("2024-01-15", MustTestLocales.enUS, {
          reference: REF,
          largestUnit: "month",
        }),
      ).toBe("2 months ago");
    });

    it("largestUnit:month — in 2 months", () => {
      expect(
        formatRelativeDate("2024-05-15", MustTestLocales.enUS, {
          reference: REF,
          largestUnit: "month",
        }),
      ).toBe("in 2 months");
    });

    it("largestUnit:year — last year", () => {
      expect(
        formatRelativeDate("2023-03-15", MustTestLocales.enUS, {
          reference: REF,
          largestUnit: "year",
        }),
      ).toBe("last year");
    });

    it("largestUnit:year — next year", () => {
      expect(
        formatRelativeDate("2025-03-15", MustTestLocales.enUS, {
          reference: REF,
          largestUnit: "year",
        }),
      ).toBe("next year");
    });

    it("largestUnit:year — 2 years ago", () => {
      expect(
        formatRelativeDate("2022-03-15", MustTestLocales.enUS, {
          reference: REF,
          largestUnit: "year",
        }),
      ).toBe("2 years ago");
    });
  });

  // ---------------------------------------------------------------------------
  // roundingMethod option
  // Controls how the fractional distance rounds to the display unit.
  // "round" (default) matches current Math.round behavior; "floor"/"ceil"
  // apply directly to the signed value, so they respect past vs. future.
  // PlainDate has no sub-day component, so "day" totals are always whole
  // numbers — the fractional cases live at "week" (10/11 days ÷ 7) and
  // "month" (calendrical) instead.
  // ---------------------------------------------------------------------------
  describe("roundingMethod option", () => {
    it.each`
      value           | roundingMethod | expected
      ${"2024-03-05"} | ${"floor"}     | ${"2 weeks ago"}
      ${"2024-03-05"} | ${"ceil"}      | ${"1 week ago"}
      ${"2024-03-05"} | ${"round"}     | ${"1 week ago"}
      ${"2024-03-25"} | ${"floor"}     | ${"in 1 week"}
      ${"2024-03-25"} | ${"ceil"}      | ${"in 2 weeks"}
      ${"2024-03-25"} | ${"round"}     | ${"in 1 week"}
      ${"2024-03-04"} | ${"floor"}     | ${"2 weeks ago"}
      ${"2024-03-04"} | ${"ceil"}      | ${"1 week ago"}
      ${"2024-03-04"} | ${"round"}     | ${"2 weeks ago"}
      ${"2024-02-23"} | ${"floor"}     | ${"3 weeks ago"}
      ${"2024-02-23"} | ${"ceil"}      | ${"3 weeks ago"}
      ${"2024-02-23"} | ${"round"}     | ${"3 weeks ago"}
    `(
      "roundingMethod:$roundingMethod for $value → $expected",
      ({ value, roundingMethod, expected }) => {
        expect(
          formatRelativeDate(value, MustTestLocales.enUS, {
            reference: REF,
            largestUnit: "week",
            numeric: "always",
            roundingMethod,
          }),
        ).toBe(expected);
      },
    );

    it("defaults to 'round' when roundingMethod is omitted (matches explicit 'round')", () => {
      const value = "2024-02-23";
      const omitted = formatRelativeDate(value, MustTestLocales.enUS, {
        reference: REF,
        largestUnit: "week",
        numeric: "always",
      });
      const explicit = formatRelativeDate(value, MustTestLocales.enUS, {
        reference: REF,
        largestUnit: "week",
        numeric: "always",
        roundingMethod: "round",
      });
      expect(omitted).toBe("3 weeks ago");
      expect(explicit).toBe(omitted);
    });

    it.each`
      roundingMethod | expected
      ${"floor"}     | ${"3 months ago"}
      ${"ceil"}      | ${"2 months ago"}
      ${"round"}     | ${"2 months ago"}
    `(
      "combines with largestUnit:month (calendrical branch): $roundingMethod → $expected",
      ({ roundingMethod, expected }) => {
        expect(
          formatRelativeDate("2024-01-10", MustTestLocales.enUS, {
            reference: REF,
            largestUnit: "month",
            roundingMethod,
          }),
        ).toBe(expected);
      },
    );

    // RelativeRoundingMethod is "floor" | "ceil" | "round". Any other value is invalid input and
    // returns the sentinel (Core Rule 3), including the name of another Math function, an
    // inherited Object.prototype key, another letter case and null.
    it.each`
      roundingMethod      | label
      ${"nonsense"}       | ${"'nonsense'"}
      ${"abs"}            | ${"'abs'"}
      ${"trunc"}          | ${"'trunc'"}
      ${"sign"}           | ${"'sign'"}
      ${"random"}         | ${"'random'"}
      ${"constructor"}    | ${"'constructor'"}
      ${"hasOwnProperty"} | ${"'hasOwnProperty'"}
      ${"toString"}       | ${"'toString'"}
      ${"ROUND"}          | ${"'ROUND'"}
      ${""}               | ${"''"}
      ${null}             | ${"null"}
    `(
      "returns '' for the invalid roundingMethod $label",
      ({ roundingMethod }) => {
        expect(
          formatRelativeDate("2024-03-05", MustTestLocales.enUS, {
            reference: REF,
            roundingMethod,
          }),
        ).toBe("");
      },
    );

    // ECMA-402 GetOption (the Temporal specification defines the same operation): an option whose
    // value is undefined is absent, so the default applies.
    it("reads roundingMethod: undefined as the omitted option (default 'round')", () => {
      const omitted = formatRelativeDate("2024-03-05", MustTestLocales.enUS, {
        reference: REF,
      });
      const explicitUndefined = formatRelativeDate(
        "2024-03-05",
        MustTestLocales.enUS,
        {
          reference: REF,
          roundingMethod: undefined,
        },
      );
      // -10 days is -1.43 weeks, which rounds to -1.
      expect(omitted).toBe("last week");
      expect(explicitUndefined).toBe(omitted);
    });
  });

  // ---------------------------------------------------------------------------
  // Invalid inputs — must return ""
  // ---------------------------------------------------------------------------
  describe("invalid inputs", () => {
    it.each`
      value                    | label
      ${""}                    | ${"''"}
      ${"not-a-date"}          | ${"'not-a-date'"}
      ${"2024-13-01"}          | ${"'2024-13-01'"}
      ${"2024-02-30"}          | ${"'2024-02-30'"}
      ${"2024-02-29T12:00:00"} | ${"'2024-02-29T12:00:00'"}
      ${null}                  | ${"null"}
      ${undefined}             | ${"undefined"}
      ${42}                    | ${"42"}
      ${true}                  | ${"true"}
    `("returns '' for invalid value $label", ({ value }) => {
      expect(formatRelativeDate(value as never, MustTestLocales.enUS)).toBe("");
    });

    it("returns '' when reference is provided but invalid", () => {
      expect(
        formatRelativeDate("2024-03-12", MustTestLocales.enUS, {
          reference: "not-a-date",
        }),
      ).toBe("");
    });

    it("returns '' when reference is an empty string", () => {
      expect(
        formatRelativeDate("2024-03-12", MustTestLocales.enUS, {
          reference: "",
        }),
      ).toBe("");
    });
  });

  // ---------------------------------------------------------------------------
  // Temporal failures — internal errors must not throw, must return ""
  // ---------------------------------------------------------------------------
  describe("Temporal failures", () => {
    it("returns '' when Temporal.Now.plainDateISO throws (no reference provided)", () => {
      mockTemporalNowPlainDateISOThrow();
      expect(formatRelativeDate("2024-03-12", MustTestLocales.enUS)).toBe("");
    });
  });

  // ECMA-402 CanonicalizeLocaleList: `locale` may be a preference list; the first tag with locale data
  // is used, and a malformed tag anywhere in the list is invalid input. Expected strings from native
  // Intl with the same list.
  it.each`
    locale                                          | expected
    ${[MustTestLocales.frFR, MustTestLocales.enUS]} | ${"il y a 2 mois"}
    ${[MustTestLocales.frFR, "not a locale!!"]}     | ${""}
  `("returns '$expected' for locale list $locale", ({ locale, expected }) => {
    expect(
      formatRelativeDate("2024-01-15", locale, { reference: "2024-03-15" }),
    ).toBe(expected);
  });
});

// Plan #14: options must be an object or omitted, as Temporal's GetOptionsObject requires (native
// Chromium 153 `Temporal.PlainDate.from("2024-02-03", null)`, `"x"` and `1` all throw TypeError), so
// null and every other non-object is invalid input.
describe("formatRelativeDate with non-object options", () => {
  it.each`
    options
    ${null}
    ${"long"}
    ${1}
  `("returns an empty string for options $options", ({ options }) => {
    expect(
      formatRelativeDate("2024-03-12", MustTestLocales.enUS, options as never),
    ).toBe("");
  });
});

// The allowed units of `largestUnit` are the ones the option's type lists: "year", "month", "week", "day", each
// singular or plural. Temporal reads a unit option with GetTemporalUnitValuedOption (a plural name
// is its singular) and then ValidateTemporalUnitValue against the unit group of the type — here
// date — which throws RangeError for a unit outside it (test262 largestunit-invalid-string.js
// for PlainDate, PlainTime, PlainDateTime, Instant and ZonedDateTime `until`). A RangeError is "".
describe("formatRelativeDate largestUnit", () => {
  // Every value is checked against the option's own type, so `tsc` fails this file if a singular
  // or a plural name leaves the `largestUnit` type. The table below takes its units from here.
  const UNIT = {
    year: "year",
    years: "years",
    month: "month",
    months: "months",
    week: "week",
    weeks: "weeks",
    day: "day",
    days: "days",
  } satisfies Record<
    string,
    NonNullable<FormatRelativeDateOptions["largestUnit"]>
  >;

  // 17 March 2023 to 17 March 2024 spans 29 February 2024: 1 year, 12 months, 366 days (52.29 weeks,
  // rounded to 52).
  // A plural names the same unit as its singular, so both rows of a unit expect the same text.
  it.each`
    largestUnit    | expected
    ${UNIT.year}   | ${"last year"}
    ${UNIT.years}  | ${"last year"}
    ${UNIT.month}  | ${"12 months ago"}
    ${UNIT.months} | ${"12 months ago"}
    ${UNIT.week}   | ${"52 weeks ago"}
    ${UNIT.weeks}  | ${"52 weeks ago"}
    ${UNIT.day}    | ${"366 days ago"}
    ${UNIT.days}   | ${"366 days ago"}
  `(
    "returns $expected for the listed unit largestUnit: $largestUnit",
    ({ largestUnit, expected }) => {
      const options: FormatRelativeDateOptions = {
        reference: "2024-03-17",
        largestUnit,
      };

      expect(
        formatRelativeDate("2023-03-17", MustTestLocales.enUS, options),
      ).toBe(expected);
    },
  );

  it.each`
    label                          | largestUnit                  | why
    ${"hour"}                      | ${"hour"}                    | ${"a time unit; a date has none"}
    ${"hours"}                     | ${"hours"}                   | ${"a time unit; a date has none"}
    ${"minute"}                    | ${"minute"}                  | ${"a time unit; a date has none"}
    ${"minutes"}                   | ${"minutes"}                 | ${"a time unit; a date has none"}
    ${"second"}                    | ${"second"}                  | ${"a time unit; a date has none"}
    ${"seconds"}                   | ${"seconds"}                 | ${"a time unit; a date has none"}
    ${"quarter"}                   | ${"quarter"}                 | ${"not a unit of the function"}
    ${"quarters"}                  | ${"quarters"}                | ${"not a unit of the function"}
    ${"millisecond"}               | ${"millisecond"}             | ${"not a unit of the function"}
    ${"nanoseconds"}               | ${"nanoseconds"}             | ${"not a unit of the function"}
    ${"auto"}                      | ${"auto"}                    | ${"not a unit of the function"}
    ${"DAY"}                       | ${"DAY"}                     | ${"unit names are lower case"}
    ${"Days"}                      | ${"Days"}                    | ${"unit names are lower case"}
    ${""}                          | ${""}                        | ${"an empty string"}
    ${"x"}                         | ${"x"}                       | ${"not a unit"}
    ${"null"}                      | ${null}                      | ${"null is a value, not an omission"}
    ${"1"}                         | ${1}                         | ${"a number"}
    ${"true"}                      | ${true}                      | ${"a boolean"}
    ${'["day"]'}                   | ${["day"]}                   | ${"an array, not a string"}
    ${'{ toString: () => "day" }'} | ${{ toString: () => "day" }} | ${"an object, not a string"}
  `(
    "returns '' for largestUnit '$label' outside the listed units ($why)",
    ({ largestUnit }) => {
      expect(
        formatRelativeDate("2023-03-17", MustTestLocales.enUS, {
          reference: "2024-03-17",
          largestUnit: largestUnit as never,
        }),
      ).toBe("");
    },
  );

  // An explicit undefined is the omitted option (GetOption), so the unit is picked from the
  // distance exactly as it is with no largestUnit at all.
  it("picks the unit from the distance for largestUnit: undefined, as when it is omitted", () => {
    const picked = formatRelativeDate("2023-03-17", MustTestLocales.enUS, {
      reference: "2024-03-17",
    });

    expect(picked).toBe("last year");
    expect(
      formatRelativeDate("2023-03-17", MustTestLocales.enUS, {
        reference: "2024-03-17",
        largestUnit: undefined,
      }),
    ).toBe(picked);
  });
});
