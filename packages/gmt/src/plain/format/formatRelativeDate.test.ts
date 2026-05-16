import { vi } from "vitest";
import { hasFullIcu, MustTestLocales } from "../../test";
import { mockTemporalNowPlainDateISOThrow } from "../../test/mocks";
import { formatRelativeDate } from "./formatRelativeDate";

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
    value           | options                                                                         | expected
    ${"2024-03-12"} | ${{ reference: REF }}                                                           | ${"3 days ago"}
    ${"2024-03-18"} | ${{ reference: REF }}                                                           | ${"in 3 days"}
    ${"2024-03-12"} | ${{ reference: REF, style: "short" as const }}                                  | ${"3 days ago"}
    ${"2024-03-12"} | ${{ reference: REF, style: "narrow" as const }}                                 | ${"3d ago"}
    ${"2024-03-18"} | ${{ reference: REF, style: "narrow" as const }}                                 | ${"in 3d"}
    ${"2024-03-08"} | ${{ reference: REF }}                                                           | ${"last week"}
    ${"2024-03-22"} | ${{ reference: REF }}                                                           | ${"next week"}
    ${"2024-01-15"} | ${{ reference: REF }}                                                           | ${"2 months ago"}
    ${"2024-05-15"} | ${{ reference: REF }}                                                           | ${"in 2 months"}
    ${"2023-03-15"} | ${{ reference: REF }}                                                           | ${"last year"}
    ${"2025-03-15"} | ${{ reference: REF }}                                                           | ${"next year"}
    ${"2024-02-23"} | ${{ reference: REF, largestUnit: "week" as const, numeric: "always" as const }} | ${"3 weeks ago"}
  `(
    "formats $value for en-US with $options as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeDate(value, MustTestLocales.enUS, options)).toBe(
        expected,
      );
    },
  );

  // en-GB
  it.each`
    value           | options                                                                         | expected
    ${"2024-03-12"} | ${{ reference: REF }}                                                           | ${"3 days ago"}
    ${"2024-03-18"} | ${{ reference: REF }}                                                           | ${"in 3 days"}
    ${"2024-03-12"} | ${{ reference: REF, style: "short" as const }}                                  | ${"3 days ago"}
    ${"2024-03-12"} | ${{ reference: REF, style: "narrow" as const }}                                 | ${"3 days ago"}
    ${"2024-03-18"} | ${{ reference: REF, style: "narrow" as const }}                                 | ${"in 3 days"}
    ${"2024-03-08"} | ${{ reference: REF }}                                                           | ${"last week"}
    ${"2024-03-22"} | ${{ reference: REF }}                                                           | ${"next week"}
    ${"2024-01-15"} | ${{ reference: REF }}                                                           | ${"2 months ago"}
    ${"2024-05-15"} | ${{ reference: REF }}                                                           | ${"in 2 months"}
    ${"2023-03-15"} | ${{ reference: REF }}                                                           | ${"last year"}
    ${"2025-03-15"} | ${{ reference: REF }}                                                           | ${"next year"}
    ${"2024-02-23"} | ${{ reference: REF, largestUnit: "week" as const, numeric: "always" as const }} | ${"3 weeks ago"}
  `(
    "formats $value for en-GB with $options as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeDate(value, MustTestLocales.enGB, options)).toBe(
        expected,
      );
    },
  );

  // de-DE
  it.each`
    value           | options                                                                         | expected
    ${"2024-03-12"} | ${{ reference: REF }}                                                           | ${"vor 3 Tagen"}
    ${"2024-03-18"} | ${{ reference: REF }}                                                           | ${"in 3 Tagen"}
    ${"2024-03-12"} | ${{ reference: REF, style: "short" as const }}                                  | ${"vor 3 Tagen"}
    ${"2024-03-12"} | ${{ reference: REF, style: "narrow" as const }}                                 | ${"vor 3 Tagen"}
    ${"2024-03-18"} | ${{ reference: REF, style: "narrow" as const }}                                 | ${"in 3 Tagen"}
    ${"2024-03-08"} | ${{ reference: REF }}                                                           | ${"letzte Woche"}
    ${"2024-03-22"} | ${{ reference: REF }}                                                           | ${"nächste Woche"}
    ${"2024-01-15"} | ${{ reference: REF }}                                                           | ${"vor 2 Monaten"}
    ${"2024-05-15"} | ${{ reference: REF }}                                                           | ${"in 2 Monaten"}
    ${"2023-03-15"} | ${{ reference: REF }}                                                           | ${"letztes Jahr"}
    ${"2025-03-15"} | ${{ reference: REF }}                                                           | ${"nächstes Jahr"}
    ${"2024-02-23"} | ${{ reference: REF, largestUnit: "week" as const, numeric: "always" as const }} | ${"vor 3 Wochen"}
  `(
    "formats $value for de-DE with $options as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeDate(value, MustTestLocales.deDE, options)).toBe(
        expected,
      );
    },
  );

  // fr-FR
  it.each`
    value           | options                                                                         | expected
    ${"2024-03-12"} | ${{ reference: REF }}                                                           | ${"il y a 3 jours"}
    ${"2024-03-18"} | ${{ reference: REF }}                                                           | ${"dans 3 jours"}
    ${"2024-03-12"} | ${{ reference: REF, style: "short" as const }}                                  | ${"il y a 3 j"}
    ${"2024-03-12"} | ${{ reference: REF, style: "narrow" as const }}                                 | ${"-3 j"}
    ${"2024-03-18"} | ${{ reference: REF, style: "narrow" as const }}                                 | ${"+3 j"}
    ${"2024-03-08"} | ${{ reference: REF }}                                                           | ${"la semaine dernière"}
    ${"2024-03-22"} | ${{ reference: REF }}                                                           | ${"la semaine prochaine"}
    ${"2024-01-15"} | ${{ reference: REF }}                                                           | ${"il y a 2 mois"}
    ${"2024-05-15"} | ${{ reference: REF }}                                                           | ${"dans 2 mois"}
    ${"2023-03-15"} | ${{ reference: REF }}                                                           | ${"l’année dernière"}
    ${"2025-03-15"} | ${{ reference: REF }}                                                           | ${"l’année prochaine"}
    ${"2024-02-23"} | ${{ reference: REF, largestUnit: "week" as const, numeric: "always" as const }} | ${"il y a 3 semaines"}
  `(
    "formats $value for fr-FR with $options as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeDate(value, MustTestLocales.frFR, options)).toBe(
        expected,
      );
    },
  );

  // es-ES
  it.each`
    value           | options                                                                         | expected
    ${"2024-03-12"} | ${{ reference: REF }}                                                           | ${"hace 3 días"}
    ${"2024-03-18"} | ${{ reference: REF }}                                                           | ${"dentro de 3 días"}
    ${"2024-03-12"} | ${{ reference: REF, style: "short" as const }}                                  | ${"hace 3 d"}
    ${"2024-03-12"} | ${{ reference: REF, style: "narrow" as const }}                                 | ${"hace 3 d"}
    ${"2024-03-18"} | ${{ reference: REF, style: "narrow" as const }}                                 | ${"dentro de 3 d"}
    ${"2024-03-08"} | ${{ reference: REF }}                                                           | ${"la semana pasada"}
    ${"2024-03-22"} | ${{ reference: REF }}                                                           | ${"la próxima semana"}
    ${"2024-01-15"} | ${{ reference: REF }}                                                           | ${"hace 2 meses"}
    ${"2024-05-15"} | ${{ reference: REF }}                                                           | ${"dentro de 2 meses"}
    ${"2023-03-15"} | ${{ reference: REF }}                                                           | ${"el año pasado"}
    ${"2025-03-15"} | ${{ reference: REF }}                                                           | ${"el próximo año"}
    ${"2024-02-23"} | ${{ reference: REF, largestUnit: "week" as const, numeric: "always" as const }} | ${"hace 3 semanas"}
  `(
    "formats $value for es-ES with $options as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeDate(value, MustTestLocales.esES, options)).toBe(
        expected,
      );
    },
  );

  // it-IT
  it.each`
    value           | options                                                                         | expected
    ${"2024-03-12"} | ${{ reference: REF }}                                                           | ${"3 giorni fa"}
    ${"2024-03-18"} | ${{ reference: REF }}                                                           | ${"tra 3 giorni"}
    ${"2024-03-12"} | ${{ reference: REF, style: "short" as const }}                                  | ${"3 gg fa"}
    ${"2024-03-12"} | ${{ reference: REF, style: "narrow" as const }}                                 | ${"3 gg fa"}
    ${"2024-03-18"} | ${{ reference: REF, style: "narrow" as const }}                                 | ${"tra 3 gg"}
    ${"2024-03-08"} | ${{ reference: REF }}                                                           | ${"settimana scorsa"}
    ${"2024-03-22"} | ${{ reference: REF }}                                                           | ${"settimana prossima"}
    ${"2024-01-15"} | ${{ reference: REF }}                                                           | ${"2 mesi fa"}
    ${"2024-05-15"} | ${{ reference: REF }}                                                           | ${"tra 2 mesi"}
    ${"2023-03-15"} | ${{ reference: REF }}                                                           | ${"anno scorso"}
    ${"2025-03-15"} | ${{ reference: REF }}                                                           | ${"anno prossimo"}
    ${"2024-02-23"} | ${{ reference: REF, largestUnit: "week" as const, numeric: "always" as const }} | ${"3 settimane fa"}
  `(
    "formats $value for it-IT with $options as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeDate(value, MustTestLocales.itIT, options)).toBe(
        expected,
      );
    },
  );

  // pt-PT
  it.each`
    value           | options                                                                         | expected
    ${"2024-03-12"} | ${{ reference: REF }}                                                           | ${"há 3 dias"}
    ${"2024-03-18"} | ${{ reference: REF }}                                                           | ${"dentro de 3 dias"}
    ${"2024-03-12"} | ${{ reference: REF, style: "short" as const }}                                  | ${"há 3 dias"}
    ${"2024-03-12"} | ${{ reference: REF, style: "narrow" as const }}                                 | ${"-3 dias"}
    ${"2024-03-18"} | ${{ reference: REF, style: "narrow" as const }}                                 | ${"+3 dias"}
    ${"2024-03-08"} | ${{ reference: REF }}                                                           | ${"semana passada"}
    ${"2024-03-22"} | ${{ reference: REF }}                                                           | ${"próxima semana"}
    ${"2024-01-15"} | ${{ reference: REF }}                                                           | ${"há 2 meses"}
    ${"2024-05-15"} | ${{ reference: REF }}                                                           | ${"dentro de 2 meses"}
    ${"2023-03-15"} | ${{ reference: REF }}                                                           | ${"ano passado"}
    ${"2025-03-15"} | ${{ reference: REF }}                                                           | ${"próximo ano"}
    ${"2024-02-23"} | ${{ reference: REF, largestUnit: "week" as const, numeric: "always" as const }} | ${"há 3 semanas"}
  `(
    "formats $value for pt-PT with $options as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeDate(value, MustTestLocales.ptPT, options)).toBe(
        expected,
      );
    },
  );

  // sv-SE
  it.each`
    value           | options                                                                         | expected
    ${"2024-03-12"} | ${{ reference: REF }}                                                           | ${"för 3 dagar sedan"}
    ${"2024-03-18"} | ${{ reference: REF }}                                                           | ${"om 3 dagar"}
    ${"2024-03-12"} | ${{ reference: REF, style: "short" as const }}                                  | ${"för 3 d sedan"}
    ${"2024-03-12"} | ${{ reference: REF, style: "narrow" as const }}                                 | ${"- 3 d"}
    ${"2024-03-18"} | ${{ reference: REF, style: "narrow" as const }}                                 | ${"+3 d"}
    ${"2024-03-08"} | ${{ reference: REF }}                                                           | ${"förra veckan"}
    ${"2024-03-22"} | ${{ reference: REF }}                                                           | ${"nästa vecka"}
    ${"2024-01-15"} | ${{ reference: REF }}                                                           | ${"för 2 månader sedan"}
    ${"2024-05-15"} | ${{ reference: REF }}                                                           | ${"om 2 månader"}
    ${"2023-03-15"} | ${{ reference: REF }}                                                           | ${hasFullIcu ? "i fjol" : "förra året"}
    ${"2025-03-15"} | ${{ reference: REF }}                                                           | ${"nästa år"}
    ${"2024-02-23"} | ${{ reference: REF, largestUnit: "week" as const, numeric: "always" as const }} | ${"för 3 veckor sedan"}
  `(
    "formats $value for sv-SE with $options as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeDate(value, MustTestLocales.svSE, options)).toBe(
        expected,
      );
    },
  );

  // is-IS
  it.each`
    value           | options                                                                         | expected
    ${"2024-03-12"} | ${{ reference: REF }}                                                           | ${"fyrir 3 dögum"}
    ${"2024-03-18"} | ${{ reference: REF }}                                                           | ${"eftir 3 daga"}
    ${"2024-03-12"} | ${{ reference: REF, style: "short" as const }}                                  | ${"fyrir 3 dögum"}
    ${"2024-03-12"} | ${{ reference: REF, style: "narrow" as const }}                                 | ${"fyrir 3 dögum"}
    ${"2024-03-18"} | ${{ reference: REF, style: "narrow" as const }}                                 | ${"eftir 3 daga"}
    ${"2024-03-08"} | ${{ reference: REF }}                                                           | ${"í síðustu viku"}
    ${"2024-03-22"} | ${{ reference: REF }}                                                           | ${"í næstu viku"}
    ${"2024-01-15"} | ${{ reference: REF }}                                                           | ${"fyrir 2 mánuðum"}
    ${"2024-05-15"} | ${{ reference: REF }}                                                           | ${"eftir 2 mánuði"}
    ${"2023-03-15"} | ${{ reference: REF }}                                                           | ${"á síðasta ári"}
    ${"2025-03-15"} | ${{ reference: REF }}                                                           | ${"á næsta ári"}
    ${"2024-02-23"} | ${{ reference: REF, largestUnit: "week" as const, numeric: "always" as const }} | ${"fyrir 3 vikum"}
  `(
    "formats $value for is-IS with $options as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeDate(value, MustTestLocales.isIS, options)).toBe(
        expected,
      );
    },
  );

  // zh-CN
  it.each`
    value           | options                                                                         | expected
    ${"2024-03-12"} | ${{ reference: REF }}                                                           | ${"3天前"}
    ${"2024-03-18"} | ${{ reference: REF }}                                                           | ${"3天后"}
    ${"2024-03-12"} | ${{ reference: REF, style: "short" as const }}                                  | ${"3天前"}
    ${"2024-03-12"} | ${{ reference: REF, style: "narrow" as const }}                                 | ${"3天前"}
    ${"2024-03-18"} | ${{ reference: REF, style: "narrow" as const }}                                 | ${"3天后"}
    ${"2024-03-08"} | ${{ reference: REF }}                                                           | ${"上周"}
    ${"2024-03-22"} | ${{ reference: REF }}                                                           | ${"下周"}
    ${"2024-01-15"} | ${{ reference: REF }}                                                           | ${"2个月前"}
    ${"2024-05-15"} | ${{ reference: REF }}                                                           | ${"2个月后"}
    ${"2023-03-15"} | ${{ reference: REF }}                                                           | ${"去年"}
    ${"2025-03-15"} | ${{ reference: REF }}                                                           | ${"明年"}
    ${"2024-02-23"} | ${{ reference: REF, largestUnit: "week" as const, numeric: "always" as const }} | ${"3周前"}
  `(
    "formats $value for zh-CN with $options as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeDate(value, MustTestLocales.zhCN, options)).toBe(
        expected,
      );
    },
  );

  // zh-TW
  it.each`
    value           | options                                                                         | expected
    ${"2024-03-12"} | ${{ reference: REF }}                                                           | ${"3 天前"}
    ${"2024-03-18"} | ${{ reference: REF }}                                                           | ${"3 天後"}
    ${"2024-03-12"} | ${{ reference: REF, style: "short" as const }}                                  | ${"3 天前"}
    ${"2024-03-12"} | ${{ reference: REF, style: "narrow" as const }}                                 | ${"3 天前"}
    ${"2024-03-18"} | ${{ reference: REF, style: "narrow" as const }}                                 | ${"3 天後"}
    ${"2024-03-08"} | ${{ reference: REF }}                                                           | ${"上週"}
    ${"2024-03-22"} | ${{ reference: REF }}                                                           | ${"下週"}
    ${"2024-01-15"} | ${{ reference: REF }}                                                           | ${"2 個月前"}
    ${"2024-05-15"} | ${{ reference: REF }}                                                           | ${"2 個月後"}
    ${"2023-03-15"} | ${{ reference: REF }}                                                           | ${"去年"}
    ${"2025-03-15"} | ${{ reference: REF }}                                                           | ${"明年"}
    ${"2024-02-23"} | ${{ reference: REF, largestUnit: "week" as const, numeric: "always" as const }} | ${"3 週前"}
  `(
    "formats $value for zh-TW with $options as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeDate(value, MustTestLocales.zhTW, options)).toBe(
        expected,
      );
    },
  );

  // ja-JP
  it.each`
    value           | options                                                                         | expected
    ${"2024-03-12"} | ${{ reference: REF }}                                                           | ${"3 日前"}
    ${"2024-03-18"} | ${{ reference: REF }}                                                           | ${"3 日後"}
    ${"2024-03-12"} | ${{ reference: REF, style: "short" as const }}                                  | ${"3 日前"}
    ${"2024-03-12"} | ${{ reference: REF, style: "narrow" as const }}                                 | ${"3日前"}
    ${"2024-03-18"} | ${{ reference: REF, style: "narrow" as const }}                                 | ${"3日後"}
    ${"2024-03-08"} | ${{ reference: REF }}                                                           | ${"先週"}
    ${"2024-03-22"} | ${{ reference: REF }}                                                           | ${"来週"}
    ${"2024-01-15"} | ${{ reference: REF }}                                                           | ${"2 か月前"}
    ${"2024-05-15"} | ${{ reference: REF }}                                                           | ${"2 か月後"}
    ${"2023-03-15"} | ${{ reference: REF }}                                                           | ${"昨年"}
    ${"2025-03-15"} | ${{ reference: REF }}                                                           | ${"来年"}
    ${"2024-02-23"} | ${{ reference: REF, largestUnit: "week" as const, numeric: "always" as const }} | ${"3 週間前"}
  `(
    "formats $value for ja-JP with $options as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeDate(value, MustTestLocales.jaJP, options)).toBe(
        expected,
      );
    },
  );

  // ko-KR
  it.each`
    value           | options                                                                         | expected
    ${"2024-03-12"} | ${{ reference: REF }}                                                           | ${"3일 전"}
    ${"2024-03-18"} | ${{ reference: REF }}                                                           | ${"3일 후"}
    ${"2024-03-12"} | ${{ reference: REF, style: "short" as const }}                                  | ${"3일 전"}
    ${"2024-03-12"} | ${{ reference: REF, style: "narrow" as const }}                                 | ${"3일 전"}
    ${"2024-03-18"} | ${{ reference: REF, style: "narrow" as const }}                                 | ${"3일 후"}
    ${"2024-03-08"} | ${{ reference: REF }}                                                           | ${"지난주"}
    ${"2024-03-22"} | ${{ reference: REF }}                                                           | ${"다음 주"}
    ${"2024-01-15"} | ${{ reference: REF }}                                                           | ${"2개월 전"}
    ${"2024-05-15"} | ${{ reference: REF }}                                                           | ${"2개월 후"}
    ${"2023-03-15"} | ${{ reference: REF }}                                                           | ${"작년"}
    ${"2025-03-15"} | ${{ reference: REF }}                                                           | ${"내년"}
    ${"2024-02-23"} | ${{ reference: REF, largestUnit: "week" as const, numeric: "always" as const }} | ${"3주 전"}
  `(
    "formats $value for ko-KR with $options as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeDate(value, MustTestLocales.koKR, options)).toBe(
        expected,
      );
    },
  );

  // ar-SA
  it.each`
    value           | options                                                                         | expected
    ${"2024-03-12"} | ${{ reference: REF }}                                                           | ${"قبل ٣ أيام"}
    ${"2024-03-18"} | ${{ reference: REF }}                                                           | ${"خلال ٣ أيام"}
    ${"2024-03-12"} | ${{ reference: REF, style: "short" as const }}                                  | ${"قبل ٣ أيام"}
    ${"2024-03-12"} | ${{ reference: REF, style: "narrow" as const }}                                 | ${"قبل ٣ أيام"}
    ${"2024-03-18"} | ${{ reference: REF, style: "narrow" as const }}                                 | ${"خلال ٣ أيام"}
    ${"2024-03-08"} | ${{ reference: REF }}                                                           | ${"الأسبوع الماضي"}
    ${"2024-03-22"} | ${{ reference: REF }}                                                           | ${"الأسبوع القادم"}
    ${"2024-01-15"} | ${{ reference: REF }}                                                           | ${"قبل شهرين"}
    ${"2024-05-15"} | ${{ reference: REF }}                                                           | ${"خلال شهرين"}
    ${"2023-03-15"} | ${{ reference: REF }}                                                           | ${"السنة الماضية"}
    ${"2025-03-15"} | ${{ reference: REF }}                                                           | ${"السنة القادمة"}
    ${"2024-02-23"} | ${{ reference: REF, largestUnit: "week" as const, numeric: "always" as const }} | ${"قبل ٣ أسابيع"}
  `(
    "formats $value for ar-SA with $options as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeDate(value, MustTestLocales.arSA, options)).toBe(
        expected,
      );
    },
  );

  // he-IL
  it.each`
    value           | options                                                                         | expected
    ${"2024-03-12"} | ${{ reference: REF }}                                                           | ${"לפני 3 ימים"}
    ${"2024-03-18"} | ${{ reference: REF }}                                                           | ${"בעוד 3 ימים"}
    ${"2024-03-12"} | ${{ reference: REF, style: "short" as const }}                                  | ${"לפני 3 ימים"}
    ${"2024-03-12"} | ${{ reference: REF, style: "narrow" as const }}                                 | ${"לפני 3 ימים"}
    ${"2024-03-18"} | ${{ reference: REF, style: "narrow" as const }}                                 | ${"בעוד 3 ימים"}
    ${"2024-03-08"} | ${{ reference: REF }}                                                           | ${"השבוע שעבר"}
    ${"2024-03-22"} | ${{ reference: REF }}                                                           | ${"השבוע הבא"}
    ${"2024-01-15"} | ${{ reference: REF }}                                                           | ${hasFullIcu ? "לפני חודשיים" : "לפני חודשיים (2)"}
    ${"2024-05-15"} | ${{ reference: REF }}                                                           | ${hasFullIcu ? "בעוד חודשיים" : "בעוד חודשיים (2)"}
    ${"2023-03-15"} | ${{ reference: REF }}                                                           | ${"השנה שעברה"}
    ${"2025-03-15"} | ${{ reference: REF }}                                                           | ${"השנה הבאה"}
    ${"2024-02-23"} | ${{ reference: REF, largestUnit: "week" as const, numeric: "always" as const }} | ${"לפני 3 שבועות"}
  `(
    "formats $value for he-IL with $options as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeDate(value, MustTestLocales.heIL, options)).toBe(
        expected,
      );
    },
  );

  // ru-RU
  it.each`
    value           | options                                                                         | expected
    ${"2024-03-12"} | ${{ reference: REF }}                                                           | ${"3 дня назад"}
    ${"2024-03-18"} | ${{ reference: REF }}                                                           | ${"через 3 дня"}
    ${"2024-03-12"} | ${{ reference: REF, style: "short" as const }}                                  | ${"3 дн. назад"}
    ${"2024-03-12"} | ${{ reference: REF, style: "narrow" as const }}                                 | ${"-3 дн."}
    ${"2024-03-18"} | ${{ reference: REF, style: "narrow" as const }}                                 | ${"+3 дн."}
    ${"2024-03-08"} | ${{ reference: REF }}                                                           | ${"на прошлой неделе"}
    ${"2024-03-22"} | ${{ reference: REF }}                                                           | ${"на следующей неделе"}
    ${"2024-01-15"} | ${{ reference: REF }}                                                           | ${"2 месяца назад"}
    ${"2024-05-15"} | ${{ reference: REF }}                                                           | ${"через 2 месяца"}
    ${"2023-03-15"} | ${{ reference: REF }}                                                           | ${"в прошлом году"}
    ${"2025-03-15"} | ${{ reference: REF }}                                                           | ${"в следующем году"}
    ${"2024-02-23"} | ${{ reference: REF, largestUnit: "week" as const, numeric: "always" as const }} | ${"3 недели назад"}
  `(
    "formats $value for ru-RU with $options as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeDate(value, MustTestLocales.ruRU, options)).toBe(
        expected,
      );
    },
  );

  // tr-TR
  it.each`
    value           | options                                                                         | expected
    ${"2024-03-12"} | ${{ reference: REF }}                                                           | ${"3 gün önce"}
    ${"2024-03-18"} | ${{ reference: REF }}                                                           | ${"3 gün sonra"}
    ${"2024-03-12"} | ${{ reference: REF, style: "short" as const }}                                  | ${"3 gün önce"}
    ${"2024-03-12"} | ${{ reference: REF, style: "narrow" as const }}                                 | ${"3 gün önce"}
    ${"2024-03-18"} | ${{ reference: REF, style: "narrow" as const }}                                 | ${"3 gün sonra"}
    ${"2024-03-08"} | ${{ reference: REF }}                                                           | ${"geçen hafta"}
    ${"2024-03-22"} | ${{ reference: REF }}                                                           | ${"gelecek hafta"}
    ${"2024-01-15"} | ${{ reference: REF }}                                                           | ${"2 ay önce"}
    ${"2024-05-15"} | ${{ reference: REF }}                                                           | ${"2 ay sonra"}
    ${"2023-03-15"} | ${{ reference: REF }}                                                           | ${"geçen yıl"}
    ${"2025-03-15"} | ${{ reference: REF }}                                                           | ${"gelecek yıl"}
    ${"2024-02-23"} | ${{ reference: REF, largestUnit: "week" as const, numeric: "always" as const }} | ${"3 hafta önce"}
  `(
    "formats $value for tr-TR with $options as $expected",
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
  // Invalid inputs — must return ""
  // ---------------------------------------------------------------------------
  describe("invalid inputs", () => {
    it.each`
      value
      ${""}
      ${"not-a-date"}
      ${"2024-13-01"}
      ${"2024-02-30"}
      ${"2024-02-29T12:00:00"}
      ${null}
      ${undefined}
      ${42}
      ${true}
    `("returns '' for invalid value $value", ({ value }) => {
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
});
