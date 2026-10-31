import { MustTestLocales } from "../../test";
import { mockTemporalNowPlainDateTimeISOThrow } from "../../test/mocks";
import {
  formatRelativeDateTime,
  type FormatRelativeDateTimeOptions,
} from "./formatRelativeDateTime";

const REF = "2024-03-15T12:00:00";

describe("formatRelativeDateTime", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Auto unit selection
  // second (<60s), minute (60s–3599s), hour (3600s–86399s), day (86400s+)
  // ---------------------------------------------------------------------------
  describe("auto unit selection", () => {
    it.each`
      value                    | expected
      ${"2024-03-15T11:59:30"} | ${"30 seconds ago"}
      ${"2024-03-15T12:00:30"} | ${"in 30 seconds"}
      ${"2024-03-15T11:30:00"} | ${"30 minutes ago"}
      ${"2024-03-15T12:30:00"} | ${"in 30 minutes"}
      ${"2024-03-15T09:00:00"} | ${"3 hours ago"}
      ${"2024-03-15T15:00:00"} | ${"in 3 hours"}
      ${"2024-03-12T12:00:00"} | ${"3 days ago"}
      ${"2024-03-18T12:00:00"} | ${"in 3 days"}
    `("formats $value relative to REF as $expected", ({ value, expected }) => {
      expect(
        formatRelativeDateTime(value, MustTestLocales.enUS, { reference: REF }),
      ).toBe(expected);
    });
  });

  // ---------------------------------------------------------------------------
  // ±1 and 0 permutations
  // ---------------------------------------------------------------------------
  describe("±1 and 0 permutations", () => {
    it.each`
      value                    | expected
      ${"2024-03-15T12:00:00"} | ${"now"}
      ${"2024-03-15T12:00:01"} | ${"in 1 second"}
      ${"2024-03-15T11:59:59"} | ${"1 second ago"}
      ${"2024-03-15T12:01:00"} | ${"in 1 minute"}
      ${"2024-03-15T11:59:00"} | ${"1 minute ago"}
      ${"2024-03-15T13:00:00"} | ${"in 1 hour"}
      ${"2024-03-15T11:00:00"} | ${"1 hour ago"}
      ${"2024-03-16T12:00:00"} | ${"tomorrow"}
      ${"2024-03-14T12:00:00"} | ${"yesterday"}
    `("formats $value (en-US, auto) as $expected", ({ value, expected }) => {
      expect(
        formatRelativeDateTime(value, MustTestLocales.enUS, { reference: REF }),
      ).toBe(expected);
    });
  });

  // ---------------------------------------------------------------------------
  // Per-locale coverage — one block per locale, 11 rows each
  // rows: -30min long, +30min long, -30min short, -30min narrow, +30min narrow,
  //       -45s, +45s, -3h, +3h, -3d, +3d
  // ---------------------------------------------------------------------------

  // en-US
  it.each`
    value                    | options                                         | expected            | label
    ${"2024-03-15T11:30:00"} | ${{ reference: REF }}                           | ${"30 minutes ago"} | ${"default options"}
    ${"2024-03-15T12:30:00"} | ${{ reference: REF }}                           | ${"in 30 minutes"}  | ${"default options"}
    ${"2024-03-15T11:30:00"} | ${{ reference: REF, style: "short" as const }}  | ${"30 min. ago"}    | ${"style short"}
    ${"2024-03-15T11:30:00"} | ${{ reference: REF, style: "narrow" as const }} | ${"30m ago"}        | ${"style narrow"}
    ${"2024-03-15T12:30:00"} | ${{ reference: REF, style: "narrow" as const }} | ${"in 30m"}         | ${"style narrow"}
    ${"2024-03-15T11:59:15"} | ${{ reference: REF }}                           | ${"45 seconds ago"} | ${"default options"}
    ${"2024-03-15T12:00:45"} | ${{ reference: REF }}                           | ${"in 45 seconds"}  | ${"default options"}
    ${"2024-03-15T09:00:00"} | ${{ reference: REF }}                           | ${"3 hours ago"}    | ${"default options"}
    ${"2024-03-15T15:00:00"} | ${{ reference: REF }}                           | ${"in 3 hours"}     | ${"default options"}
    ${"2024-03-12T12:00:00"} | ${{ reference: REF }}                           | ${"3 days ago"}     | ${"default options"}
    ${"2024-03-18T12:00:00"} | ${{ reference: REF }}                           | ${"in 3 days"}      | ${"default options"}
  `(
    "formats $value for en-US with $label as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeDateTime(value, MustTestLocales.enUS, options)).toBe(
        expected,
      );
    },
  );

  // en-GB
  it.each`
    value                    | options                                         | expected            | label
    ${"2024-03-15T11:30:00"} | ${{ reference: REF }}                           | ${"30 minutes ago"} | ${"default options"}
    ${"2024-03-15T12:30:00"} | ${{ reference: REF }}                           | ${"in 30 minutes"}  | ${"default options"}
    ${"2024-03-15T11:30:00"} | ${{ reference: REF, style: "short" as const }}  | ${"30 min ago"}     | ${"style short"}
    ${"2024-03-15T11:30:00"} | ${{ reference: REF, style: "narrow" as const }} | ${"30 min ago"}     | ${"style narrow"}
    ${"2024-03-15T12:30:00"} | ${{ reference: REF, style: "narrow" as const }} | ${"in 30 min"}      | ${"style narrow"}
    ${"2024-03-15T11:59:15"} | ${{ reference: REF }}                           | ${"45 seconds ago"} | ${"default options"}
    ${"2024-03-15T12:00:45"} | ${{ reference: REF }}                           | ${"in 45 seconds"}  | ${"default options"}
    ${"2024-03-15T09:00:00"} | ${{ reference: REF }}                           | ${"3 hours ago"}    | ${"default options"}
    ${"2024-03-15T15:00:00"} | ${{ reference: REF }}                           | ${"in 3 hours"}     | ${"default options"}
    ${"2024-03-12T12:00:00"} | ${{ reference: REF }}                           | ${"3 days ago"}     | ${"default options"}
    ${"2024-03-18T12:00:00"} | ${{ reference: REF }}                           | ${"in 3 days"}      | ${"default options"}
  `(
    "formats $value for en-GB with $label as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeDateTime(value, MustTestLocales.enGB, options)).toBe(
        expected,
      );
    },
  );

  // de-DE
  it.each`
    value                    | options                                         | expected             | label
    ${"2024-03-15T11:30:00"} | ${{ reference: REF }}                           | ${"vor 30 Minuten"}  | ${"default options"}
    ${"2024-03-15T12:30:00"} | ${{ reference: REF }}                           | ${"in 30 Minuten"}   | ${"default options"}
    ${"2024-03-15T11:30:00"} | ${{ reference: REF, style: "short" as const }}  | ${"vor 30 Min."}     | ${"style short"}
    ${"2024-03-15T11:30:00"} | ${{ reference: REF, style: "narrow" as const }} | ${"vor 30 m"}        | ${"style narrow"}
    ${"2024-03-15T12:30:00"} | ${{ reference: REF, style: "narrow" as const }} | ${"in 30 m"}         | ${"style narrow"}
    ${"2024-03-15T11:59:15"} | ${{ reference: REF }}                           | ${"vor 45 Sekunden"} | ${"default options"}
    ${"2024-03-15T12:00:45"} | ${{ reference: REF }}                           | ${"in 45 Sekunden"}  | ${"default options"}
    ${"2024-03-15T09:00:00"} | ${{ reference: REF }}                           | ${"vor 3 Stunden"}   | ${"default options"}
    ${"2024-03-15T15:00:00"} | ${{ reference: REF }}                           | ${"in 3 Stunden"}    | ${"default options"}
    ${"2024-03-12T12:00:00"} | ${{ reference: REF }}                           | ${"vor 3 Tagen"}     | ${"default options"}
    ${"2024-03-18T12:00:00"} | ${{ reference: REF }}                           | ${"in 3 Tagen"}      | ${"default options"}
  `(
    "formats $value for de-DE with $label as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeDateTime(value, MustTestLocales.deDE, options)).toBe(
        expected,
      );
    },
  );

  // fr-FR
  it.each`
    value                    | options                                         | expected                | label
    ${"2024-03-15T11:30:00"} | ${{ reference: REF }}                           | ${"il y a 30 minutes"}  | ${"default options"}
    ${"2024-03-15T12:30:00"} | ${{ reference: REF }}                           | ${"dans 30 minutes"}    | ${"default options"}
    ${"2024-03-15T11:30:00"} | ${{ reference: REF, style: "short" as const }}  | ${"il y a 30 min"}      | ${"style short"}
    ${"2024-03-15T11:30:00"} | ${{ reference: REF, style: "narrow" as const }} | ${"-30 min"}            | ${"style narrow"}
    ${"2024-03-15T12:30:00"} | ${{ reference: REF, style: "narrow" as const }} | ${"+30 min"}            | ${"style narrow"}
    ${"2024-03-15T11:59:15"} | ${{ reference: REF }}                           | ${"il y a 45 secondes"} | ${"default options"}
    ${"2024-03-15T12:00:45"} | ${{ reference: REF }}                           | ${"dans 45 secondes"}   | ${"default options"}
    ${"2024-03-15T09:00:00"} | ${{ reference: REF }}                           | ${"il y a 3 heures"}    | ${"default options"}
    ${"2024-03-15T15:00:00"} | ${{ reference: REF }}                           | ${"dans 3 heures"}      | ${"default options"}
    ${"2024-03-12T12:00:00"} | ${{ reference: REF }}                           | ${"il y a 3 jours"}     | ${"default options"}
    ${"2024-03-18T12:00:00"} | ${{ reference: REF }}                           | ${"dans 3 jours"}       | ${"default options"}
  `(
    "formats $value for fr-FR with $label as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeDateTime(value, MustTestLocales.frFR, options)).toBe(
        expected,
      );
    },
  );

  // es-ES
  it.each`
    value                    | options                                         | expected                   | label
    ${"2024-03-15T11:30:00"} | ${{ reference: REF }}                           | ${"hace 30 minutos"}       | ${"default options"}
    ${"2024-03-15T12:30:00"} | ${{ reference: REF }}                           | ${"dentro de 30 minutos"}  | ${"default options"}
    ${"2024-03-15T11:30:00"} | ${{ reference: REF, style: "short" as const }}  | ${"hace 30 min"}           | ${"style short"}
    ${"2024-03-15T11:30:00"} | ${{ reference: REF, style: "narrow" as const }} | ${"hace 30 min"}           | ${"style narrow"}
    ${"2024-03-15T12:30:00"} | ${{ reference: REF, style: "narrow" as const }} | ${"dentro de 30 min"}      | ${"style narrow"}
    ${"2024-03-15T11:59:15"} | ${{ reference: REF }}                           | ${"hace 45 segundos"}      | ${"default options"}
    ${"2024-03-15T12:00:45"} | ${{ reference: REF }}                           | ${"dentro de 45 segundos"} | ${"default options"}
    ${"2024-03-15T09:00:00"} | ${{ reference: REF }}                           | ${"hace 3 horas"}          | ${"default options"}
    ${"2024-03-15T15:00:00"} | ${{ reference: REF }}                           | ${"dentro de 3 horas"}     | ${"default options"}
    ${"2024-03-12T12:00:00"} | ${{ reference: REF }}                           | ${"hace 3 días"}           | ${"default options"}
    ${"2024-03-18T12:00:00"} | ${{ reference: REF }}                           | ${"dentro de 3 días"}      | ${"default options"}
  `(
    "formats $value for es-ES with $label as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeDateTime(value, MustTestLocales.esES, options)).toBe(
        expected,
      );
    },
  );

  // it-IT
  it.each`
    value                    | options                                         | expected            | label
    ${"2024-03-15T11:30:00"} | ${{ reference: REF }}                           | ${"30 minuti fa"}   | ${"default options"}
    ${"2024-03-15T12:30:00"} | ${{ reference: REF }}                           | ${"tra 30 minuti"}  | ${"default options"}
    ${"2024-03-15T11:30:00"} | ${{ reference: REF, style: "short" as const }}  | ${"30 min fa"}      | ${"style short"}
    ${"2024-03-15T11:30:00"} | ${{ reference: REF, style: "narrow" as const }} | ${"30 min fa"}      | ${"style narrow"}
    ${"2024-03-15T12:30:00"} | ${{ reference: REF, style: "narrow" as const }} | ${"tra 30 min"}     | ${"style narrow"}
    ${"2024-03-15T11:59:15"} | ${{ reference: REF }}                           | ${"45 secondi fa"}  | ${"default options"}
    ${"2024-03-15T12:00:45"} | ${{ reference: REF }}                           | ${"tra 45 secondi"} | ${"default options"}
    ${"2024-03-15T09:00:00"} | ${{ reference: REF }}                           | ${"3 ore fa"}       | ${"default options"}
    ${"2024-03-15T15:00:00"} | ${{ reference: REF }}                           | ${"tra 3 ore"}      | ${"default options"}
    ${"2024-03-12T12:00:00"} | ${{ reference: REF }}                           | ${"3 giorni fa"}    | ${"default options"}
    ${"2024-03-18T12:00:00"} | ${{ reference: REF }}                           | ${"tra 3 giorni"}   | ${"default options"}
  `(
    "formats $value for it-IT with $label as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeDateTime(value, MustTestLocales.itIT, options)).toBe(
        expected,
      );
    },
  );

  // pt-PT
  it.each`
    value                    | options                                         | expected                   | label
    ${"2024-03-15T11:30:00"} | ${{ reference: REF }}                           | ${"há 30 minutos"}         | ${"default options"}
    ${"2024-03-15T12:30:00"} | ${{ reference: REF }}                           | ${"dentro de 30 minutos"}  | ${"default options"}
    ${"2024-03-15T11:30:00"} | ${{ reference: REF, style: "short" as const }}  | ${"há 30 min"}             | ${"style short"}
    ${"2024-03-15T11:30:00"} | ${{ reference: REF, style: "narrow" as const }} | ${"-30 min"}               | ${"style narrow"}
    ${"2024-03-15T12:30:00"} | ${{ reference: REF, style: "narrow" as const }} | ${"+30 min"}               | ${"style narrow"}
    ${"2024-03-15T11:59:15"} | ${{ reference: REF }}                           | ${"há 45 segundos"}        | ${"default options"}
    ${"2024-03-15T12:00:45"} | ${{ reference: REF }}                           | ${"dentro de 45 segundos"} | ${"default options"}
    ${"2024-03-15T09:00:00"} | ${{ reference: REF }}                           | ${"há 3 horas"}            | ${"default options"}
    ${"2024-03-15T15:00:00"} | ${{ reference: REF }}                           | ${"dentro de 3 horas"}     | ${"default options"}
    ${"2024-03-12T12:00:00"} | ${{ reference: REF }}                           | ${"há 3 dias"}             | ${"default options"}
    ${"2024-03-18T12:00:00"} | ${{ reference: REF }}                           | ${"dentro de 3 dias"}      | ${"default options"}
  `(
    "formats $value for pt-PT with $label as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeDateTime(value, MustTestLocales.ptPT, options)).toBe(
        expected,
      );
    },
  );

  // sv-SE
  it.each`
    value                    | options                                         | expected                   | label
    ${"2024-03-15T11:30:00"} | ${{ reference: REF }}                           | ${"för 30 minuter sedan"}  | ${"default options"}
    ${"2024-03-15T12:30:00"} | ${{ reference: REF }}                           | ${"om 30 minuter"}         | ${"default options"}
    ${"2024-03-15T11:30:00"} | ${{ reference: REF, style: "short" as const }}  | ${"för 30 min sen"}        | ${"style short"}
    ${"2024-03-15T11:30:00"} | ${{ reference: REF, style: "narrow" as const }} | ${"- 30 min"}              | ${"style narrow"}
    ${"2024-03-15T12:30:00"} | ${{ reference: REF, style: "narrow" as const }} | ${"+30 min"}               | ${"style narrow"}
    ${"2024-03-15T11:59:15"} | ${{ reference: REF }}                           | ${"för 45 sekunder sedan"} | ${"default options"}
    ${"2024-03-15T12:00:45"} | ${{ reference: REF }}                           | ${"om 45 sekunder"}        | ${"default options"}
    ${"2024-03-15T09:00:00"} | ${{ reference: REF }}                           | ${"för 3 timmar sedan"}    | ${"default options"}
    ${"2024-03-15T15:00:00"} | ${{ reference: REF }}                           | ${"om 3 timmar"}           | ${"default options"}
    ${"2024-03-12T12:00:00"} | ${{ reference: REF }}                           | ${"för 3 dagar sedan"}     | ${"default options"}
    ${"2024-03-18T12:00:00"} | ${{ reference: REF }}                           | ${"om 3 dagar"}            | ${"default options"}
  `(
    "formats $value for sv-SE with $label as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeDateTime(value, MustTestLocales.svSE, options)).toBe(
        expected,
      );
    },
  );

  // is-IS
  it.each`
    value                    | options                                         | expected                   | label
    ${"2024-03-15T11:30:00"} | ${{ reference: REF }}                           | ${"fyrir 30 mínútum"}      | ${"default options"}
    ${"2024-03-15T12:30:00"} | ${{ reference: REF }}                           | ${"eftir 30 mínútur"}      | ${"default options"}
    ${"2024-03-15T11:30:00"} | ${{ reference: REF, style: "short" as const }}  | ${"fyrir 30 mín."}         | ${"style short"}
    ${"2024-03-15T11:30:00"} | ${{ reference: REF, style: "narrow" as const }} | ${"-30 mín."}              | ${"style narrow"}
    ${"2024-03-15T12:30:00"} | ${{ reference: REF, style: "narrow" as const }} | ${"+30 mín."}              | ${"style narrow"}
    ${"2024-03-15T11:59:15"} | ${{ reference: REF }}                           | ${"fyrir 45 sekúndum"}     | ${"default options"}
    ${"2024-03-15T12:00:45"} | ${{ reference: REF }}                           | ${"eftir 45 sekúndur"}     | ${"default options"}
    ${"2024-03-15T09:00:00"} | ${{ reference: REF }}                           | ${"fyrir 3 klukkustundum"} | ${"default options"}
    ${"2024-03-15T15:00:00"} | ${{ reference: REF }}                           | ${"eftir 3 klukkustundir"} | ${"default options"}
    ${"2024-03-12T12:00:00"} | ${{ reference: REF }}                           | ${"fyrir 3 dögum"}         | ${"default options"}
    ${"2024-03-18T12:00:00"} | ${{ reference: REF }}                           | ${"eftir 3 daga"}          | ${"default options"}
  `(
    "formats $value for is-IS with $label as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeDateTime(value, MustTestLocales.isIS, options)).toBe(
        expected,
      );
    },
  );

  // zh-CN
  it.each`
    value                    | options                                         | expected      | label
    ${"2024-03-15T11:30:00"} | ${{ reference: REF }}                           | ${"30分钟前"} | ${"default options"}
    ${"2024-03-15T12:30:00"} | ${{ reference: REF }}                           | ${"30分钟后"} | ${"default options"}
    ${"2024-03-15T11:30:00"} | ${{ reference: REF, style: "short" as const }}  | ${"30分钟前"} | ${"style short"}
    ${"2024-03-15T11:30:00"} | ${{ reference: REF, style: "narrow" as const }} | ${"30分钟前"} | ${"style narrow"}
    ${"2024-03-15T12:30:00"} | ${{ reference: REF, style: "narrow" as const }} | ${"30分钟后"} | ${"style narrow"}
    ${"2024-03-15T11:59:15"} | ${{ reference: REF }}                           | ${"45秒钟前"} | ${"default options"}
    ${"2024-03-15T12:00:45"} | ${{ reference: REF }}                           | ${"45秒钟后"} | ${"default options"}
    ${"2024-03-15T09:00:00"} | ${{ reference: REF }}                           | ${"3小时前"}  | ${"default options"}
    ${"2024-03-15T15:00:00"} | ${{ reference: REF }}                           | ${"3小时后"}  | ${"default options"}
    ${"2024-03-12T12:00:00"} | ${{ reference: REF }}                           | ${"3天前"}    | ${"default options"}
    ${"2024-03-18T12:00:00"} | ${{ reference: REF }}                           | ${"3天后"}    | ${"default options"}
  `(
    "formats $value for zh-CN with $label as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeDateTime(value, MustTestLocales.zhCN, options)).toBe(
        expected,
      );
    },
  );

  // zh-TW
  it.each`
    value                    | options                                         | expected       | label
    ${"2024-03-15T11:30:00"} | ${{ reference: REF }}                           | ${"30 分鐘前"} | ${"default options"}
    ${"2024-03-15T12:30:00"} | ${{ reference: REF }}                           | ${"30 分鐘後"} | ${"default options"}
    ${"2024-03-15T11:30:00"} | ${{ reference: REF, style: "short" as const }}  | ${"30 分鐘前"} | ${"style short"}
    ${"2024-03-15T11:30:00"} | ${{ reference: REF, style: "narrow" as const }} | ${"30 分鐘前"} | ${"style narrow"}
    ${"2024-03-15T12:30:00"} | ${{ reference: REF, style: "narrow" as const }} | ${"30 分鐘後"} | ${"style narrow"}
    ${"2024-03-15T11:59:15"} | ${{ reference: REF }}                           | ${"45 秒前"}   | ${"default options"}
    ${"2024-03-15T12:00:45"} | ${{ reference: REF }}                           | ${"45 秒後"}   | ${"default options"}
    ${"2024-03-15T09:00:00"} | ${{ reference: REF }}                           | ${"3 小時前"}  | ${"default options"}
    ${"2024-03-15T15:00:00"} | ${{ reference: REF }}                           | ${"3 小時後"}  | ${"default options"}
    ${"2024-03-12T12:00:00"} | ${{ reference: REF }}                           | ${"3 天前"}    | ${"default options"}
    ${"2024-03-18T12:00:00"} | ${{ reference: REF }}                           | ${"3 天後"}    | ${"default options"}
  `(
    "formats $value for zh-TW with $label as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeDateTime(value, MustTestLocales.zhTW, options)).toBe(
        expected,
      );
    },
  );

  // ja-JP
  it.each`
    value                    | options                                         | expected      | label
    ${"2024-03-15T11:30:00"} | ${{ reference: REF }}                           | ${"30 分前"}  | ${"default options"}
    ${"2024-03-15T12:30:00"} | ${{ reference: REF }}                           | ${"30 分後"}  | ${"default options"}
    ${"2024-03-15T11:30:00"} | ${{ reference: REF, style: "short" as const }}  | ${"30 分前"}  | ${"style short"}
    ${"2024-03-15T11:30:00"} | ${{ reference: REF, style: "narrow" as const }} | ${"30分前"}   | ${"style narrow"}
    ${"2024-03-15T12:30:00"} | ${{ reference: REF, style: "narrow" as const }} | ${"30分後"}   | ${"style narrow"}
    ${"2024-03-15T11:59:15"} | ${{ reference: REF }}                           | ${"45 秒前"}  | ${"default options"}
    ${"2024-03-15T12:00:45"} | ${{ reference: REF }}                           | ${"45 秒後"}  | ${"default options"}
    ${"2024-03-15T09:00:00"} | ${{ reference: REF }}                           | ${"3 時間前"} | ${"default options"}
    ${"2024-03-15T15:00:00"} | ${{ reference: REF }}                           | ${"3 時間後"} | ${"default options"}
    ${"2024-03-12T12:00:00"} | ${{ reference: REF }}                           | ${"3 日前"}   | ${"default options"}
    ${"2024-03-18T12:00:00"} | ${{ reference: REF }}                           | ${"3 日後"}   | ${"default options"}
  `(
    "formats $value for ja-JP with $label as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeDateTime(value, MustTestLocales.jaJP, options)).toBe(
        expected,
      );
    },
  );

  // ko-KR
  it.each`
    value                    | options                                         | expected      | label
    ${"2024-03-15T11:30:00"} | ${{ reference: REF }}                           | ${"30분 전"}  | ${"default options"}
    ${"2024-03-15T12:30:00"} | ${{ reference: REF }}                           | ${"30분 후"}  | ${"default options"}
    ${"2024-03-15T11:30:00"} | ${{ reference: REF, style: "short" as const }}  | ${"30분 전"}  | ${"style short"}
    ${"2024-03-15T11:30:00"} | ${{ reference: REF, style: "narrow" as const }} | ${"30분 전"}  | ${"style narrow"}
    ${"2024-03-15T12:30:00"} | ${{ reference: REF, style: "narrow" as const }} | ${"30분 후"}  | ${"style narrow"}
    ${"2024-03-15T11:59:15"} | ${{ reference: REF }}                           | ${"45초 전"}  | ${"default options"}
    ${"2024-03-15T12:00:45"} | ${{ reference: REF }}                           | ${"45초 후"}  | ${"default options"}
    ${"2024-03-15T09:00:00"} | ${{ reference: REF }}                           | ${"3시간 전"} | ${"default options"}
    ${"2024-03-15T15:00:00"} | ${{ reference: REF }}                           | ${"3시간 후"} | ${"default options"}
    ${"2024-03-12T12:00:00"} | ${{ reference: REF }}                           | ${"3일 전"}   | ${"default options"}
    ${"2024-03-18T12:00:00"} | ${{ reference: REF }}                           | ${"3일 후"}   | ${"default options"}
  `(
    "formats $value for ko-KR with $label as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeDateTime(value, MustTestLocales.koKR, options)).toBe(
        expected,
      );
    },
  );

  // ar-SA
  it.each`
    value                    | options                                         | expected          | label
    ${"2024-03-15T11:30:00"} | ${{ reference: REF }}                           | ${"قبل ٣٠ دقيقة"} | ${"default options"}
    ${"2024-03-15T12:30:00"} | ${{ reference: REF }}                           | ${"خلال ٣٠ دقيقة"} | ${"default options"}
    ${"2024-03-15T11:30:00"} | ${{ reference: REF, style: "short" as const }}  | ${"قبل ٣٠ دقيقة"} | ${"style short"}
    ${"2024-03-15T11:30:00"} | ${{ reference: REF, style: "narrow" as const }} | ${"قبل ٣٠ دقيقة"} | ${"style narrow"}
    ${"2024-03-15T12:30:00"} | ${{ reference: REF, style: "narrow" as const }} | ${"خلال ٣٠ دقيقة"} | ${"style narrow"}
    ${"2024-03-15T11:59:15"} | ${{ reference: REF }}                           | ${"قبل ٤٥ ثانية"} | ${"default options"}
    ${"2024-03-15T12:00:45"} | ${{ reference: REF }}                           | ${"خلال ٤٥ ثانية"} | ${"default options"}
    ${"2024-03-15T09:00:00"} | ${{ reference: REF }}                           | ${"قبل ٣ ساعات"}  | ${"default options"}
    ${"2024-03-15T15:00:00"} | ${{ reference: REF }}                           | ${"خلال ٣ ساعات"}  | ${"default options"}
    ${"2024-03-12T12:00:00"} | ${{ reference: REF }}                           | ${"قبل ٣ أيام"}   | ${"default options"}
    ${"2024-03-18T12:00:00"} | ${{ reference: REF }}                           | ${"خلال ٣ أيام"}   | ${"default options"}
  `(
    "formats $value for ar-SA with $label as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeDateTime(value, MustTestLocales.arSA, options)).toBe(
        expected,
      );
    },
  );

  // he-IL
  it.each`
    value                    | options                                         | expected           | label
    ${"2024-03-15T11:30:00"} | ${{ reference: REF }}                           | ${"לפני 30 דקות"}  | ${"default options"}
    ${"2024-03-15T12:30:00"} | ${{ reference: REF }}                           | ${"בעוד 30 דקות"}  | ${"default options"}
    ${"2024-03-15T11:30:00"} | ${{ reference: REF, style: "short" as const }}  | ${"לפני 30 דק׳"}   | ${"style short"}
    ${"2024-03-15T11:30:00"} | ${{ reference: REF, style: "narrow" as const }} | ${"לפני 30 דק׳"}   | ${"style narrow"}
    ${"2024-03-15T12:30:00"} | ${{ reference: REF, style: "narrow" as const }} | ${"בעוד 30 דק׳"}   | ${"style narrow"}
    ${"2024-03-15T11:59:15"} | ${{ reference: REF }}                           | ${"לפני 45 שניות"} | ${"default options"}
    ${"2024-03-15T12:00:45"} | ${{ reference: REF }}                           | ${"בעוד 45 שניות"} | ${"default options"}
    ${"2024-03-15T09:00:00"} | ${{ reference: REF }}                           | ${"לפני 3 שעות"}   | ${"default options"}
    ${"2024-03-15T15:00:00"} | ${{ reference: REF }}                           | ${"בעוד 3 שעות"}   | ${"default options"}
    ${"2024-03-12T12:00:00"} | ${{ reference: REF }}                           | ${"לפני 3 ימים"}   | ${"default options"}
    ${"2024-03-18T12:00:00"} | ${{ reference: REF }}                           | ${"בעוד 3 ימים"}   | ${"default options"}
  `(
    "formats $value for he-IL with $label as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeDateTime(value, MustTestLocales.heIL, options)).toBe(
        expected,
      );
    },
  );

  // ru-RU
  it.each`
    value                    | options                                         | expected             | label
    ${"2024-03-15T11:30:00"} | ${{ reference: REF }}                           | ${"30 минут назад"}  | ${"default options"}
    ${"2024-03-15T12:30:00"} | ${{ reference: REF }}                           | ${"через 30 минут"}  | ${"default options"}
    ${"2024-03-15T11:30:00"} | ${{ reference: REF, style: "short" as const }}  | ${"30 мин. назад"}   | ${"style short"}
    ${"2024-03-15T11:30:00"} | ${{ reference: REF, style: "narrow" as const }} | ${"-30 мин"}         | ${"style narrow"}
    ${"2024-03-15T12:30:00"} | ${{ reference: REF, style: "narrow" as const }} | ${"+30 мин"}         | ${"style narrow"}
    ${"2024-03-15T11:59:15"} | ${{ reference: REF }}                           | ${"45 секунд назад"} | ${"default options"}
    ${"2024-03-15T12:00:45"} | ${{ reference: REF }}                           | ${"через 45 секунд"} | ${"default options"}
    ${"2024-03-15T09:00:00"} | ${{ reference: REF }}                           | ${"3 часа назад"}    | ${"default options"}
    ${"2024-03-15T15:00:00"} | ${{ reference: REF }}                           | ${"через 3 часа"}    | ${"default options"}
    ${"2024-03-12T12:00:00"} | ${{ reference: REF }}                           | ${"3 дня назад"}     | ${"default options"}
    ${"2024-03-18T12:00:00"} | ${{ reference: REF }}                           | ${"через 3 дня"}     | ${"default options"}
  `(
    "formats $value for ru-RU with $label as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeDateTime(value, MustTestLocales.ruRU, options)).toBe(
        expected,
      );
    },
  );

  // tr-TR
  it.each`
    value                    | options                                         | expected             | label
    ${"2024-03-15T11:30:00"} | ${{ reference: REF }}                           | ${"30 dakika önce"}  | ${"default options"}
    ${"2024-03-15T12:30:00"} | ${{ reference: REF }}                           | ${"30 dakika sonra"} | ${"default options"}
    ${"2024-03-15T11:30:00"} | ${{ reference: REF, style: "short" as const }}  | ${"30 dk. önce"}     | ${"style short"}
    ${"2024-03-15T11:30:00"} | ${{ reference: REF, style: "narrow" as const }} | ${"30 dk. önce"}     | ${"style narrow"}
    ${"2024-03-15T12:30:00"} | ${{ reference: REF, style: "narrow" as const }} | ${"30 dk. sonra"}    | ${"style narrow"}
    ${"2024-03-15T11:59:15"} | ${{ reference: REF }}                           | ${"45 saniye önce"}  | ${"default options"}
    ${"2024-03-15T12:00:45"} | ${{ reference: REF }}                           | ${"45 saniye sonra"} | ${"default options"}
    ${"2024-03-15T09:00:00"} | ${{ reference: REF }}                           | ${"3 saat önce"}     | ${"default options"}
    ${"2024-03-15T15:00:00"} | ${{ reference: REF }}                           | ${"3 saat sonra"}    | ${"default options"}
    ${"2024-03-12T12:00:00"} | ${{ reference: REF }}                           | ${"3 gün önce"}      | ${"default options"}
    ${"2024-03-18T12:00:00"} | ${{ reference: REF }}                           | ${"3 gün sonra"}     | ${"default options"}
  `(
    "formats $value for tr-TR with $label as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeDateTime(value, MustTestLocales.trTR, options)).toBe(
        expected,
      );
    },
  );

  // ---------------------------------------------------------------------------
  // style option
  // ---------------------------------------------------------------------------
  describe("style option", () => {
    const value = "2024-03-15T11:30:00";

    it.each`
      style       | expected
      ${"long"}   | ${"30 minutes ago"}
      ${"short"}  | ${"30 min. ago"}
      ${"narrow"} | ${"30m ago"}
    `("style:$style formats -30min as $expected", ({ style, expected }) => {
      expect(
        formatRelativeDateTime(value, MustTestLocales.enUS, {
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
      value                    | numeric     | expected
      ${"2024-03-15T12:00:00"} | ${"auto"}   | ${"now"}
      ${"2024-03-15T12:00:00"} | ${"always"} | ${"in 0 seconds"}
      ${"2024-03-16T12:00:00"} | ${"auto"}   | ${"tomorrow"}
      ${"2024-03-16T12:00:00"} | ${"always"} | ${"in 1 day"}
      ${"2024-03-14T12:00:00"} | ${"auto"}   | ${"yesterday"}
      ${"2024-03-14T12:00:00"} | ${"always"} | ${"1 day ago"}
    `(
      "numeric:$numeric for $value → $expected",
      ({ value, numeric, expected }) => {
        expect(
          formatRelativeDateTime(value, MustTestLocales.enUS, {
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
      value                    | largestUnit | expected
      ${"2024-03-15T11:59:30"} | ${"minute"} | ${"0 minutes ago"}
      ${"2024-03-15T09:00:00"} | ${"minute"} | ${"180 minutes ago"}
      ${"2024-03-15T11:30:00"} | ${"hour"}   | ${"0 hours ago"}
      ${"2024-03-15T09:00:00"} | ${"hour"}   | ${"3 hours ago"}
      ${"2024-03-12T12:00:00"} | ${"day"}    | ${"3 days ago"}
      ${"2024-03-18T12:00:00"} | ${"day"}    | ${"in 3 days"}
    `(
      "largestUnit:$largestUnit for $value → $expected",
      ({ value, largestUnit, expected }) => {
        expect(
          formatRelativeDateTime(value, MustTestLocales.enUS, {
            reference: REF,
            largestUnit,
            numeric: "always",
          }),
        ).toBe(expected);
      },
    );

    it("largestUnit:month — 2 months ago", () => {
      expect(
        formatRelativeDateTime("2024-01-15T12:00:00", MustTestLocales.enUS, {
          reference: REF,
          largestUnit: "month",
        }),
      ).toBe("2 months ago");
    });

    it("largestUnit:month — in 2 months", () => {
      expect(
        formatRelativeDateTime("2024-05-15T12:00:00", MustTestLocales.enUS, {
          reference: REF,
          largestUnit: "month",
        }),
      ).toBe("in 2 months");
    });

    it("largestUnit:year — last year", () => {
      expect(
        formatRelativeDateTime("2023-03-15T12:00:00", MustTestLocales.enUS, {
          reference: REF,
          largestUnit: "year",
        }),
      ).toBe("last year");
    });

    it("largestUnit:year — next year", () => {
      expect(
        formatRelativeDateTime("2025-03-15T12:00:00", MustTestLocales.enUS, {
          reference: REF,
          largestUnit: "year",
        }),
      ).toBe("next year");
    });
  });

  // ---------------------------------------------------------------------------
  // roundingMethod option
  // Controls how the fractional distance rounds to the display unit.
  // "round" (default) matches current Math.round behavior; "floor"/"ceil"
  // apply directly to the signed value, so they respect past vs. future.
  // ---------------------------------------------------------------------------
  describe("roundingMethod option", () => {
    it.each`
      value                    | roundingMethod | expected
      ${"2024-03-15T09:42:00"} | ${"floor"}     | ${"3 hours ago"}
      ${"2024-03-15T09:42:00"} | ${"ceil"}      | ${"2 hours ago"}
      ${"2024-03-15T09:42:00"} | ${"round"}     | ${"2 hours ago"}
      ${"2024-03-15T14:18:00"} | ${"floor"}     | ${"in 2 hours"}
      ${"2024-03-15T14:18:00"} | ${"ceil"}      | ${"in 3 hours"}
      ${"2024-03-15T14:18:00"} | ${"round"}     | ${"in 2 hours"}
      ${"2024-03-15T09:30:00"} | ${"floor"}     | ${"3 hours ago"}
      ${"2024-03-15T09:30:00"} | ${"ceil"}      | ${"2 hours ago"}
      ${"2024-03-15T09:30:00"} | ${"round"}     | ${"2 hours ago"}
      ${"2024-03-15T09:00:00"} | ${"floor"}     | ${"3 hours ago"}
      ${"2024-03-15T09:00:00"} | ${"ceil"}      | ${"3 hours ago"}
      ${"2024-03-15T09:00:00"} | ${"round"}     | ${"3 hours ago"}
    `(
      "roundingMethod:$roundingMethod for $value → $expected",
      ({ value, roundingMethod, expected }) => {
        expect(
          formatRelativeDateTime(value, MustTestLocales.enUS, {
            reference: REF,
            largestUnit: "hour",
            numeric: "always",
            roundingMethod,
          }),
        ).toBe(expected);
      },
    );

    it("defaults to 'round' when roundingMethod is omitted (matches explicit 'round')", () => {
      const value = "2024-03-15T09:00:00";
      const omitted = formatRelativeDateTime(value, MustTestLocales.enUS, {
        reference: REF,
      });
      const explicit = formatRelativeDateTime(value, MustTestLocales.enUS, {
        reference: REF,
        roundingMethod: "round",
      });
      expect(omitted).toBe("3 hours ago");
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
          formatRelativeDateTime("2024-01-10T12:00:00", MustTestLocales.enUS, {
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
          formatRelativeDateTime("2024-03-15T09:42:00", MustTestLocales.enUS, {
            reference: REF,
            roundingMethod,
          }),
        ).toBe("");
      },
    );

    // ECMA-402 GetOption (the Temporal specification defines the same operation): an option whose
    // value is undefined is absent, so the default applies.
    it("reads roundingMethod: undefined as the omitted option (default 'round')", () => {
      const omitted = formatRelativeDateTime(
        "2024-03-15T09:42:00",
        MustTestLocales.enUS,
        {
          reference: REF,
        },
      );
      const explicitUndefined = formatRelativeDateTime(
        "2024-03-15T09:42:00",
        MustTestLocales.enUS,
        {
          reference: REF,
          roundingMethod: undefined,
        },
      );
      // -2 h 18 min is -2.3 hours, which rounds to -2.
      expect(omitted).toBe("2 hours ago");
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
      ${"2024-03-15"}          | ${"'2024-03-15'"}
      ${"2024-13-01T00:00:00"} | ${"'2024-13-01T00:00:00'"}
      ${"2024-02-30T00:00:00"} | ${"'2024-02-30T00:00:00'"}
      ${"2024-12-31T23:59:60"} | ${"'2024-12-31T23:59:60'"}
      ${null}                  | ${"null"}
      ${undefined}             | ${"undefined"}
      ${42}                    | ${"42"}
      ${true}                  | ${"true"}
    `("returns '' for invalid value $label", ({ value }) => {
      expect(formatRelativeDateTime(value as never, MustTestLocales.enUS)).toBe(
        "",
      );
    });

    it("returns '' when reference is provided but invalid", () => {
      expect(
        formatRelativeDateTime("2024-03-15T12:00:00", MustTestLocales.enUS, {
          reference: "not-a-date",
        }),
      ).toBe("");
    });

    it("returns '' when reference is a plain date (no time component)", () => {
      expect(
        formatRelativeDateTime("2024-03-15T12:00:00", MustTestLocales.enUS, {
          reference: "2024-03-15",
        }),
      ).toBe("");
    });

    it("returns '' when reference is an empty string", () => {
      expect(
        formatRelativeDateTime("2024-03-15T12:00:00", MustTestLocales.enUS, {
          reference: "",
        }),
      ).toBe("");
    });
  });

  // ---------------------------------------------------------------------------
  // Temporal failures — internal errors must not throw, must return ""
  // ---------------------------------------------------------------------------
  describe("Temporal failures", () => {
    it("returns '' when Temporal.Now.zonedDateTimeISO throws (no reference provided)", () => {
      mockTemporalNowPlainDateTimeISOThrow();
      expect(
        formatRelativeDateTime("2024-03-15T12:00:00", MustTestLocales.enUS),
      ).toBe("");
    });
  });

  // ECMA-402 CanonicalizeLocaleList: `locale` may be a preference list; the first tag with locale data
  // is used, and a malformed tag anywhere in the list is invalid input. Expected strings from native
  // Intl with the same list.
  it.each`
    locale                                          | expected
    ${[MustTestLocales.frFR, MustTestLocales.enUS]} | ${"il y a 3 heures"}
    ${[MustTestLocales.frFR, "not a locale!!"]}     | ${""}
  `("returns '$expected' for locale list $locale", ({ locale, expected }) => {
    expect(
      formatRelativeDateTime("2024-03-15T09:00:00", locale, {
        reference: "2024-03-15T12:00:00",
      }),
    ).toBe(expected);
  });

  // Beyond a day, the unit is auto-picked with formatRelativeDate's thresholds: day under 7 days, week under
  // 28, month under 365, year beyond. Totals are rounded (default "round"); labels from native
  // Intl.RelativeTimeFormat("en-US", { numeric: "auto" }).
  it.each`
    value                    | expected          | reason
    ${"2024-03-12T12:00:00"} | ${"3 days ago"}   | ${"3 days: day"}
    ${"2024-03-08T12:00:00"} | ${"last week"}    | ${"7 days: week"}
    ${"2024-03-01T12:00:00"} | ${"2 weeks ago"}  | ${"14 days: week"}
    ${"2024-01-15T12:00:00"} | ${"2 months ago"} | ${"60 days: month, 15 January to 15 March"}
    ${"2025-03-15T12:00:00"} | ${"next year"}    | ${"365 days: year"}
    ${"2021-03-15T12:00:00"} | ${"3 years ago"}  | ${"1096 days: year"}
  `(
    "formats $value against 2024-03-15T12:00 as $expected ($reason)",
    ({ value, expected }) => {
      expect(
        formatRelativeDateTime(value, "en-US", {
          reference: "2024-03-15T12:00:00",
        }),
      ).toBe(expected);
    },
  );
});

// Plan #14: options must be an object or omitted, as Temporal's GetOptionsObject requires (native
// Chromium 153 `Temporal.PlainDate.from("2024-02-03", null)`, `"x"` and `1` all throw TypeError), so
// null and every other non-object is invalid input.
describe("formatRelativeDateTime with non-object options", () => {
  it.each`
    options
    ${null}
    ${"long"}
    ${1}
  `("returns an empty string for options $options", ({ options }) => {
    expect(
      formatRelativeDateTime(
        "2024-03-12T10:00:00",
        MustTestLocales.enUS,
        options as never,
      ),
    ).toBe("");
  });
});

// The allowed units of `largestUnit` are the ones the option's type lists: "year", "month", "week", "day", "hour", "minute", "second", each
// singular or plural. Temporal reads a unit option with GetTemporalUnitValuedOption (a plural name
// is its singular) and then ValidateTemporalUnitValue against the unit group of the type — here
// datetime — which throws RangeError for a unit outside it (test262 largestunit-invalid-string.js
// for PlainDate, PlainTime, PlainDateTime, Instant and ZonedDateTime `until`). A RangeError is "".
describe("formatRelativeDateTime largestUnit", () => {
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
    hour: "hour",
    hours: "hours",
    minute: "minute",
    minutes: "minutes",
    second: "second",
    seconds: "seconds",
  } satisfies Record<
    string,
    NonNullable<FormatRelativeDateTimeOptions["largestUnit"]>
  >;

  // 17 March 2023 to 17 March 2024 spans 29 February 2024: 1 year, 12 months, 366 days (52.29 weeks,
  // rounded to 52), 8,784 hours, 527,040 minutes, 31,622,400 seconds.
  // A plural names the same unit as its singular, so both rows of a unit expect the same text.
  it.each`
    largestUnit     | expected
    ${UNIT.year}    | ${"last year"}
    ${UNIT.years}   | ${"last year"}
    ${UNIT.month}   | ${"12 months ago"}
    ${UNIT.months}  | ${"12 months ago"}
    ${UNIT.week}    | ${"52 weeks ago"}
    ${UNIT.weeks}   | ${"52 weeks ago"}
    ${UNIT.day}     | ${"366 days ago"}
    ${UNIT.days}    | ${"366 days ago"}
    ${UNIT.hour}    | ${"8,784 hours ago"}
    ${UNIT.hours}   | ${"8,784 hours ago"}
    ${UNIT.minute}  | ${"527,040 minutes ago"}
    ${UNIT.minutes} | ${"527,040 minutes ago"}
    ${UNIT.second}  | ${"31,622,400 seconds ago"}
    ${UNIT.seconds} | ${"31,622,400 seconds ago"}
  `(
    "returns $expected for the listed unit largestUnit: $largestUnit",
    ({ largestUnit, expected }) => {
      const options: FormatRelativeDateTimeOptions = {
        reference: "2024-03-17T12:00:00",
        largestUnit,
      };

      expect(
        formatRelativeDateTime(
          "2023-03-17T12:00:00",
          MustTestLocales.enUS,
          options,
        ),
      ).toBe(expected);
    },
  );

  it.each`
    label                          | largestUnit                  | why
    ${"'quarter'"}                 | ${"quarter"}                 | ${"not a unit of the function"}
    ${"'quarters'"}                | ${"quarters"}                | ${"not a unit of the function"}
    ${"'millisecond'"}             | ${"millisecond"}             | ${"not a unit of the function"}
    ${"'nanoseconds'"}             | ${"nanoseconds"}             | ${"not a unit of the function"}
    ${"'auto'"}                    | ${"auto"}                    | ${"not a unit of the function"}
    ${"'DAY'"}                     | ${"DAY"}                     | ${"unit names are lower case"}
    ${"'Days'"}                    | ${"Days"}                    | ${"unit names are lower case"}
    ${"''"}                        | ${""}                        | ${"an empty string"}
    ${"'x'"}                       | ${"x"}                       | ${"not a unit"}
    ${"null"}                      | ${null}                      | ${"null is a value, not an omission"}
    ${"1"}                         | ${1}                         | ${"a number"}
    ${"true"}                      | ${true}                      | ${"a boolean"}
    ${"['day']"}                   | ${["day"]}                   | ${"an array, not a string"}
    ${"{ toString: () => 'day' }"} | ${{ toString: () => "day" }} | ${"an object, not a string"}
  `(
    "returns '' for largestUnit $label outside the listed units ($why)",
    ({ largestUnit }) => {
      expect(
        formatRelativeDateTime("2023-03-17T12:00:00", MustTestLocales.enUS, {
          reference: "2024-03-17T12:00:00",
          largestUnit: largestUnit as never,
        }),
      ).toBe("");
    },
  );

  // An explicit undefined is the omitted option (GetOption), so the unit is picked from the
  // distance exactly as it is with no largestUnit at all.
  it("picks the unit from the distance for largestUnit: undefined, as when it is omitted", () => {
    const picked = formatRelativeDateTime(
      "2023-03-17T12:00:00",
      MustTestLocales.enUS,
      {
        reference: "2024-03-17T12:00:00",
      },
    );

    expect(picked).toBe("last year");
    expect(
      formatRelativeDateTime("2023-03-17T12:00:00", MustTestLocales.enUS, {
        reference: "2024-03-17T12:00:00",
        largestUnit: undefined,
      }),
    ).toBe(picked);
  });
});
