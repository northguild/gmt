import { vi } from "vitest";
import { MustTestLocales } from "../../test";
import { mockTemporalNowPlainDateTimeISOThrow } from "../../test/mocks";
import { formatRelativeDateTime } from "./formatRelativeDateTime";

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
        formatRelativeDateTime(value, MustTestLocales.enUS, {
          reference: REF,
        }),
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
        formatRelativeDateTime(value, MustTestLocales.enUS, {
          reference: REF,
        }),
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
    value                    | options                                         | expected
    ${"2024-03-15T11:30:00"} | ${{ reference: REF }}                           | ${"30 minutes ago"}
    ${"2024-03-15T12:30:00"} | ${{ reference: REF }}                           | ${"in 30 minutes"}
    ${"2024-03-15T11:30:00"} | ${{ reference: REF, style: "short" as const }}  | ${"30 min. ago"}
    ${"2024-03-15T11:30:00"} | ${{ reference: REF, style: "narrow" as const }} | ${"30m ago"}
    ${"2024-03-15T12:30:00"} | ${{ reference: REF, style: "narrow" as const }} | ${"in 30m"}
    ${"2024-03-15T11:59:15"} | ${{ reference: REF }}                           | ${"45 seconds ago"}
    ${"2024-03-15T12:00:45"} | ${{ reference: REF }}                           | ${"in 45 seconds"}
    ${"2024-03-15T09:00:00"} | ${{ reference: REF }}                           | ${"3 hours ago"}
    ${"2024-03-15T15:00:00"} | ${{ reference: REF }}                           | ${"in 3 hours"}
    ${"2024-03-12T12:00:00"} | ${{ reference: REF }}                           | ${"3 days ago"}
    ${"2024-03-18T12:00:00"} | ${{ reference: REF }}                           | ${"in 3 days"}
  `(
    "formats $value for en-US with $options as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeDateTime(value, MustTestLocales.enUS, options)).toBe(
        expected,
      );
    },
  );

  // en-GB
  it.each`
    value                    | options                                         | expected
    ${"2024-03-15T11:30:00"} | ${{ reference: REF }}                           | ${"30 minutes ago"}
    ${"2024-03-15T12:30:00"} | ${{ reference: REF }}                           | ${"in 30 minutes"}
    ${"2024-03-15T11:30:00"} | ${{ reference: REF, style: "short" as const }}  | ${"30 min ago"}
    ${"2024-03-15T11:30:00"} | ${{ reference: REF, style: "narrow" as const }} | ${"30 min ago"}
    ${"2024-03-15T12:30:00"} | ${{ reference: REF, style: "narrow" as const }} | ${"in 30 min"}
    ${"2024-03-15T11:59:15"} | ${{ reference: REF }}                           | ${"45 seconds ago"}
    ${"2024-03-15T12:00:45"} | ${{ reference: REF }}                           | ${"in 45 seconds"}
    ${"2024-03-15T09:00:00"} | ${{ reference: REF }}                           | ${"3 hours ago"}
    ${"2024-03-15T15:00:00"} | ${{ reference: REF }}                           | ${"in 3 hours"}
    ${"2024-03-12T12:00:00"} | ${{ reference: REF }}                           | ${"3 days ago"}
    ${"2024-03-18T12:00:00"} | ${{ reference: REF }}                           | ${"in 3 days"}
  `(
    "formats $value for en-GB with $options as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeDateTime(value, MustTestLocales.enGB, options)).toBe(
        expected,
      );
    },
  );

  // de-DE
  it.each`
    value                    | options                                         | expected
    ${"2024-03-15T11:30:00"} | ${{ reference: REF }}                           | ${"vor 30 Minuten"}
    ${"2024-03-15T12:30:00"} | ${{ reference: REF }}                           | ${"in 30 Minuten"}
    ${"2024-03-15T11:30:00"} | ${{ reference: REF, style: "short" as const }}  | ${"vor 30 Min."}
    ${"2024-03-15T11:30:00"} | ${{ reference: REF, style: "narrow" as const }} | ${"vor 30 m"}
    ${"2024-03-15T12:30:00"} | ${{ reference: REF, style: "narrow" as const }} | ${"in 30 m"}
    ${"2024-03-15T11:59:15"} | ${{ reference: REF }}                           | ${"vor 45 Sekunden"}
    ${"2024-03-15T12:00:45"} | ${{ reference: REF }}                           | ${"in 45 Sekunden"}
    ${"2024-03-15T09:00:00"} | ${{ reference: REF }}                           | ${"vor 3 Stunden"}
    ${"2024-03-15T15:00:00"} | ${{ reference: REF }}                           | ${"in 3 Stunden"}
    ${"2024-03-12T12:00:00"} | ${{ reference: REF }}                           | ${"vor 3 Tagen"}
    ${"2024-03-18T12:00:00"} | ${{ reference: REF }}                           | ${"in 3 Tagen"}
  `(
    "formats $value for de-DE with $options as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeDateTime(value, MustTestLocales.deDE, options)).toBe(
        expected,
      );
    },
  );

  // fr-FR
  it.each`
    value                    | options                                         | expected
    ${"2024-03-15T11:30:00"} | ${{ reference: REF }}                           | ${"il y a 30 minutes"}
    ${"2024-03-15T12:30:00"} | ${{ reference: REF }}                           | ${"dans 30 minutes"}
    ${"2024-03-15T11:30:00"} | ${{ reference: REF, style: "short" as const }}  | ${"il y a 30 min"}
    ${"2024-03-15T11:30:00"} | ${{ reference: REF, style: "narrow" as const }} | ${"-30 min"}
    ${"2024-03-15T12:30:00"} | ${{ reference: REF, style: "narrow" as const }} | ${"+30 min"}
    ${"2024-03-15T11:59:15"} | ${{ reference: REF }}                           | ${"il y a 45 secondes"}
    ${"2024-03-15T12:00:45"} | ${{ reference: REF }}                           | ${"dans 45 secondes"}
    ${"2024-03-15T09:00:00"} | ${{ reference: REF }}                           | ${"il y a 3 heures"}
    ${"2024-03-15T15:00:00"} | ${{ reference: REF }}                           | ${"dans 3 heures"}
    ${"2024-03-12T12:00:00"} | ${{ reference: REF }}                           | ${"il y a 3 jours"}
    ${"2024-03-18T12:00:00"} | ${{ reference: REF }}                           | ${"dans 3 jours"}
  `(
    "formats $value for fr-FR with $options as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeDateTime(value, MustTestLocales.frFR, options)).toBe(
        expected,
      );
    },
  );

  // es-ES
  it.each`
    value                    | options                                         | expected
    ${"2024-03-15T11:30:00"} | ${{ reference: REF }}                           | ${"hace 30 minutos"}
    ${"2024-03-15T12:30:00"} | ${{ reference: REF }}                           | ${"dentro de 30 minutos"}
    ${"2024-03-15T11:30:00"} | ${{ reference: REF, style: "short" as const }}  | ${"hace 30 min"}
    ${"2024-03-15T11:30:00"} | ${{ reference: REF, style: "narrow" as const }} | ${"hace 30 min"}
    ${"2024-03-15T12:30:00"} | ${{ reference: REF, style: "narrow" as const }} | ${"dentro de 30 min"}
    ${"2024-03-15T11:59:15"} | ${{ reference: REF }}                           | ${"hace 45 segundos"}
    ${"2024-03-15T12:00:45"} | ${{ reference: REF }}                           | ${"dentro de 45 segundos"}
    ${"2024-03-15T09:00:00"} | ${{ reference: REF }}                           | ${"hace 3 horas"}
    ${"2024-03-15T15:00:00"} | ${{ reference: REF }}                           | ${"dentro de 3 horas"}
    ${"2024-03-12T12:00:00"} | ${{ reference: REF }}                           | ${"hace 3 días"}
    ${"2024-03-18T12:00:00"} | ${{ reference: REF }}                           | ${"dentro de 3 días"}
  `(
    "formats $value for es-ES with $options as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeDateTime(value, MustTestLocales.esES, options)).toBe(
        expected,
      );
    },
  );

  // it-IT
  it.each`
    value                    | options                                         | expected
    ${"2024-03-15T11:30:00"} | ${{ reference: REF }}                           | ${"30 minuti fa"}
    ${"2024-03-15T12:30:00"} | ${{ reference: REF }}                           | ${"tra 30 minuti"}
    ${"2024-03-15T11:30:00"} | ${{ reference: REF, style: "short" as const }}  | ${"30 min fa"}
    ${"2024-03-15T11:30:00"} | ${{ reference: REF, style: "narrow" as const }} | ${"30 min fa"}
    ${"2024-03-15T12:30:00"} | ${{ reference: REF, style: "narrow" as const }} | ${"tra 30 min"}
    ${"2024-03-15T11:59:15"} | ${{ reference: REF }}                           | ${"45 secondi fa"}
    ${"2024-03-15T12:00:45"} | ${{ reference: REF }}                           | ${"tra 45 secondi"}
    ${"2024-03-15T09:00:00"} | ${{ reference: REF }}                           | ${"3 ore fa"}
    ${"2024-03-15T15:00:00"} | ${{ reference: REF }}                           | ${"tra 3 ore"}
    ${"2024-03-12T12:00:00"} | ${{ reference: REF }}                           | ${"3 giorni fa"}
    ${"2024-03-18T12:00:00"} | ${{ reference: REF }}                           | ${"tra 3 giorni"}
  `(
    "formats $value for it-IT with $options as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeDateTime(value, MustTestLocales.itIT, options)).toBe(
        expected,
      );
    },
  );

  // pt-PT
  it.each`
    value                    | options                                         | expected
    ${"2024-03-15T11:30:00"} | ${{ reference: REF }}                           | ${"há 30 minutos"}
    ${"2024-03-15T12:30:00"} | ${{ reference: REF }}                           | ${"dentro de 30 minutos"}
    ${"2024-03-15T11:30:00"} | ${{ reference: REF, style: "short" as const }}  | ${"há 30 min"}
    ${"2024-03-15T11:30:00"} | ${{ reference: REF, style: "narrow" as const }} | ${"-30 min"}
    ${"2024-03-15T12:30:00"} | ${{ reference: REF, style: "narrow" as const }} | ${"+30 min"}
    ${"2024-03-15T11:59:15"} | ${{ reference: REF }}                           | ${"há 45 segundos"}
    ${"2024-03-15T12:00:45"} | ${{ reference: REF }}                           | ${"dentro de 45 segundos"}
    ${"2024-03-15T09:00:00"} | ${{ reference: REF }}                           | ${"há 3 horas"}
    ${"2024-03-15T15:00:00"} | ${{ reference: REF }}                           | ${"dentro de 3 horas"}
    ${"2024-03-12T12:00:00"} | ${{ reference: REF }}                           | ${"há 3 dias"}
    ${"2024-03-18T12:00:00"} | ${{ reference: REF }}                           | ${"dentro de 3 dias"}
  `(
    "formats $value for pt-PT with $options as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeDateTime(value, MustTestLocales.ptPT, options)).toBe(
        expected,
      );
    },
  );

  // sv-SE
  it.each`
    value                    | options                                         | expected
    ${"2024-03-15T11:30:00"} | ${{ reference: REF }}                           | ${"för 30 minuter sedan"}
    ${"2024-03-15T12:30:00"} | ${{ reference: REF }}                           | ${"om 30 minuter"}
    ${"2024-03-15T11:30:00"} | ${{ reference: REF, style: "short" as const }}  | ${"för 30 min sen"}
    ${"2024-03-15T11:30:00"} | ${{ reference: REF, style: "narrow" as const }} | ${"- 30 min"}
    ${"2024-03-15T12:30:00"} | ${{ reference: REF, style: "narrow" as const }} | ${"+30 min"}
    ${"2024-03-15T11:59:15"} | ${{ reference: REF }}                           | ${"för 45 sekunder sedan"}
    ${"2024-03-15T12:00:45"} | ${{ reference: REF }}                           | ${"om 45 sekunder"}
    ${"2024-03-15T09:00:00"} | ${{ reference: REF }}                           | ${"för 3 timmar sedan"}
    ${"2024-03-15T15:00:00"} | ${{ reference: REF }}                           | ${"om 3 timmar"}
    ${"2024-03-12T12:00:00"} | ${{ reference: REF }}                           | ${"för 3 dagar sedan"}
    ${"2024-03-18T12:00:00"} | ${{ reference: REF }}                           | ${"om 3 dagar"}
  `(
    "formats $value for sv-SE with $options as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeDateTime(value, MustTestLocales.svSE, options)).toBe(
        expected,
      );
    },
  );

  // is-IS
  it.each`
    value                    | options                                         | expected
    ${"2024-03-15T11:30:00"} | ${{ reference: REF }}                           | ${"fyrir 30 mínútum"}
    ${"2024-03-15T12:30:00"} | ${{ reference: REF }}                           | ${"eftir 30 mínútur"}
    ${"2024-03-15T11:30:00"} | ${{ reference: REF, style: "short" as const }}  | ${"fyrir 30 mín."}
    ${"2024-03-15T11:30:00"} | ${{ reference: REF, style: "narrow" as const }} | ${"-30 mín."}
    ${"2024-03-15T12:30:00"} | ${{ reference: REF, style: "narrow" as const }} | ${"+30 mín."}
    ${"2024-03-15T11:59:15"} | ${{ reference: REF }}                           | ${"fyrir 45 sekúndum"}
    ${"2024-03-15T12:00:45"} | ${{ reference: REF }}                           | ${"eftir 45 sekúndur"}
    ${"2024-03-15T09:00:00"} | ${{ reference: REF }}                           | ${"fyrir 3 klukkustundum"}
    ${"2024-03-15T15:00:00"} | ${{ reference: REF }}                           | ${"eftir 3 klukkustundir"}
    ${"2024-03-12T12:00:00"} | ${{ reference: REF }}                           | ${"fyrir 3 dögum"}
    ${"2024-03-18T12:00:00"} | ${{ reference: REF }}                           | ${"eftir 3 daga"}
  `(
    "formats $value for is-IS with $options as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeDateTime(value, MustTestLocales.isIS, options)).toBe(
        expected,
      );
    },
  );

  // zh-CN
  it.each`
    value                    | options                                         | expected
    ${"2024-03-15T11:30:00"} | ${{ reference: REF }}                           | ${"30分钟前"}
    ${"2024-03-15T12:30:00"} | ${{ reference: REF }}                           | ${"30分钟后"}
    ${"2024-03-15T11:30:00"} | ${{ reference: REF, style: "short" as const }}  | ${"30分钟前"}
    ${"2024-03-15T11:30:00"} | ${{ reference: REF, style: "narrow" as const }} | ${"30分钟前"}
    ${"2024-03-15T12:30:00"} | ${{ reference: REF, style: "narrow" as const }} | ${"30分钟后"}
    ${"2024-03-15T11:59:15"} | ${{ reference: REF }}                           | ${"45秒钟前"}
    ${"2024-03-15T12:00:45"} | ${{ reference: REF }}                           | ${"45秒钟后"}
    ${"2024-03-15T09:00:00"} | ${{ reference: REF }}                           | ${"3小时前"}
    ${"2024-03-15T15:00:00"} | ${{ reference: REF }}                           | ${"3小时后"}
    ${"2024-03-12T12:00:00"} | ${{ reference: REF }}                           | ${"3天前"}
    ${"2024-03-18T12:00:00"} | ${{ reference: REF }}                           | ${"3天后"}
  `(
    "formats $value for zh-CN with $options as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeDateTime(value, MustTestLocales.zhCN, options)).toBe(
        expected,
      );
    },
  );

  // zh-TW
  it.each`
    value                    | options                                         | expected
    ${"2024-03-15T11:30:00"} | ${{ reference: REF }}                           | ${"30 分鐘前"}
    ${"2024-03-15T12:30:00"} | ${{ reference: REF }}                           | ${"30 分鐘後"}
    ${"2024-03-15T11:30:00"} | ${{ reference: REF, style: "short" as const }}  | ${"30 分鐘前"}
    ${"2024-03-15T11:30:00"} | ${{ reference: REF, style: "narrow" as const }} | ${"30 分鐘前"}
    ${"2024-03-15T12:30:00"} | ${{ reference: REF, style: "narrow" as const }} | ${"30 分鐘後"}
    ${"2024-03-15T11:59:15"} | ${{ reference: REF }}                           | ${"45 秒前"}
    ${"2024-03-15T12:00:45"} | ${{ reference: REF }}                           | ${"45 秒後"}
    ${"2024-03-15T09:00:00"} | ${{ reference: REF }}                           | ${"3 小時前"}
    ${"2024-03-15T15:00:00"} | ${{ reference: REF }}                           | ${"3 小時後"}
    ${"2024-03-12T12:00:00"} | ${{ reference: REF }}                           | ${"3 天前"}
    ${"2024-03-18T12:00:00"} | ${{ reference: REF }}                           | ${"3 天後"}
  `(
    "formats $value for zh-TW with $options as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeDateTime(value, MustTestLocales.zhTW, options)).toBe(
        expected,
      );
    },
  );

  // ja-JP
  it.each`
    value                    | options                                         | expected
    ${"2024-03-15T11:30:00"} | ${{ reference: REF }}                           | ${"30 分前"}
    ${"2024-03-15T12:30:00"} | ${{ reference: REF }}                           | ${"30 分後"}
    ${"2024-03-15T11:30:00"} | ${{ reference: REF, style: "short" as const }}  | ${"30 分前"}
    ${"2024-03-15T11:30:00"} | ${{ reference: REF, style: "narrow" as const }} | ${"30分前"}
    ${"2024-03-15T12:30:00"} | ${{ reference: REF, style: "narrow" as const }} | ${"30分後"}
    ${"2024-03-15T11:59:15"} | ${{ reference: REF }}                           | ${"45 秒前"}
    ${"2024-03-15T12:00:45"} | ${{ reference: REF }}                           | ${"45 秒後"}
    ${"2024-03-15T09:00:00"} | ${{ reference: REF }}                           | ${"3 時間前"}
    ${"2024-03-15T15:00:00"} | ${{ reference: REF }}                           | ${"3 時間後"}
    ${"2024-03-12T12:00:00"} | ${{ reference: REF }}                           | ${"3 日前"}
    ${"2024-03-18T12:00:00"} | ${{ reference: REF }}                           | ${"3 日後"}
  `(
    "formats $value for ja-JP with $options as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeDateTime(value, MustTestLocales.jaJP, options)).toBe(
        expected,
      );
    },
  );

  // ko-KR
  it.each`
    value                    | options                                         | expected
    ${"2024-03-15T11:30:00"} | ${{ reference: REF }}                           | ${"30분 전"}
    ${"2024-03-15T12:30:00"} | ${{ reference: REF }}                           | ${"30분 후"}
    ${"2024-03-15T11:30:00"} | ${{ reference: REF, style: "short" as const }}  | ${"30분 전"}
    ${"2024-03-15T11:30:00"} | ${{ reference: REF, style: "narrow" as const }} | ${"30분 전"}
    ${"2024-03-15T12:30:00"} | ${{ reference: REF, style: "narrow" as const }} | ${"30분 후"}
    ${"2024-03-15T11:59:15"} | ${{ reference: REF }}                           | ${"45초 전"}
    ${"2024-03-15T12:00:45"} | ${{ reference: REF }}                           | ${"45초 후"}
    ${"2024-03-15T09:00:00"} | ${{ reference: REF }}                           | ${"3시간 전"}
    ${"2024-03-15T15:00:00"} | ${{ reference: REF }}                           | ${"3시간 후"}
    ${"2024-03-12T12:00:00"} | ${{ reference: REF }}                           | ${"3일 전"}
    ${"2024-03-18T12:00:00"} | ${{ reference: REF }}                           | ${"3일 후"}
  `(
    "formats $value for ko-KR with $options as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeDateTime(value, MustTestLocales.koKR, options)).toBe(
        expected,
      );
    },
  );

  // ar-SA
  it.each`
    value                    | options                                         | expected
    ${"2024-03-15T11:30:00"} | ${{ reference: REF }}                           | ${"قبل ٣٠ دقيقة"}
    ${"2024-03-15T12:30:00"} | ${{ reference: REF }}                           | ${"خلال ٣٠ دقيقة"}
    ${"2024-03-15T11:30:00"} | ${{ reference: REF, style: "short" as const }}  | ${"قبل ٣٠ دقيقة"}
    ${"2024-03-15T11:30:00"} | ${{ reference: REF, style: "narrow" as const }} | ${"قبل ٣٠ دقيقة"}
    ${"2024-03-15T12:30:00"} | ${{ reference: REF, style: "narrow" as const }} | ${"خلال ٣٠ دقيقة"}
    ${"2024-03-15T11:59:15"} | ${{ reference: REF }}                           | ${"قبل ٤٥ ثانية"}
    ${"2024-03-15T12:00:45"} | ${{ reference: REF }}                           | ${"خلال ٤٥ ثانية"}
    ${"2024-03-15T09:00:00"} | ${{ reference: REF }}                           | ${"قبل ٣ ساعات"}
    ${"2024-03-15T15:00:00"} | ${{ reference: REF }}                           | ${"خلال ٣ ساعات"}
    ${"2024-03-12T12:00:00"} | ${{ reference: REF }}                           | ${"قبل ٣ أيام"}
    ${"2024-03-18T12:00:00"} | ${{ reference: REF }}                           | ${"خلال ٣ أيام"}
  `(
    "formats $value for ar-SA with $options as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeDateTime(value, MustTestLocales.arSA, options)).toBe(
        expected,
      );
    },
  );

  // he-IL
  it.each`
    value                    | options                                         | expected
    ${"2024-03-15T11:30:00"} | ${{ reference: REF }}                           | ${"לפני 30 דקות"}
    ${"2024-03-15T12:30:00"} | ${{ reference: REF }}                           | ${"בעוד 30 דקות"}
    ${"2024-03-15T11:30:00"} | ${{ reference: REF, style: "short" as const }}  | ${"לפני 30 דק׳"}
    ${"2024-03-15T11:30:00"} | ${{ reference: REF, style: "narrow" as const }} | ${"לפני 30 דק׳"}
    ${"2024-03-15T12:30:00"} | ${{ reference: REF, style: "narrow" as const }} | ${"בעוד 30 דק׳"}
    ${"2024-03-15T11:59:15"} | ${{ reference: REF }}                           | ${"לפני 45 שניות"}
    ${"2024-03-15T12:00:45"} | ${{ reference: REF }}                           | ${"בעוד 45 שניות"}
    ${"2024-03-15T09:00:00"} | ${{ reference: REF }}                           | ${"לפני 3 שעות"}
    ${"2024-03-15T15:00:00"} | ${{ reference: REF }}                           | ${"בעוד 3 שעות"}
    ${"2024-03-12T12:00:00"} | ${{ reference: REF }}                           | ${"לפני 3 ימים"}
    ${"2024-03-18T12:00:00"} | ${{ reference: REF }}                           | ${"בעוד 3 ימים"}
  `(
    "formats $value for he-IL with $options as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeDateTime(value, MustTestLocales.heIL, options)).toBe(
        expected,
      );
    },
  );

  // ru-RU
  it.each`
    value                    | options                                         | expected
    ${"2024-03-15T11:30:00"} | ${{ reference: REF }}                           | ${"30 минут назад"}
    ${"2024-03-15T12:30:00"} | ${{ reference: REF }}                           | ${"через 30 минут"}
    ${"2024-03-15T11:30:00"} | ${{ reference: REF, style: "short" as const }}  | ${"30 мин. назад"}
    ${"2024-03-15T11:30:00"} | ${{ reference: REF, style: "narrow" as const }} | ${"-30 мин"}
    ${"2024-03-15T12:30:00"} | ${{ reference: REF, style: "narrow" as const }} | ${"+30 мин"}
    ${"2024-03-15T11:59:15"} | ${{ reference: REF }}                           | ${"45 секунд назад"}
    ${"2024-03-15T12:00:45"} | ${{ reference: REF }}                           | ${"через 45 секунд"}
    ${"2024-03-15T09:00:00"} | ${{ reference: REF }}                           | ${"3 часа назад"}
    ${"2024-03-15T15:00:00"} | ${{ reference: REF }}                           | ${"через 3 часа"}
    ${"2024-03-12T12:00:00"} | ${{ reference: REF }}                           | ${"3 дня назад"}
    ${"2024-03-18T12:00:00"} | ${{ reference: REF }}                           | ${"через 3 дня"}
  `(
    "formats $value for ru-RU with $options as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeDateTime(value, MustTestLocales.ruRU, options)).toBe(
        expected,
      );
    },
  );

  // tr-TR
  it.each`
    value                    | options                                         | expected
    ${"2024-03-15T11:30:00"} | ${{ reference: REF }}                           | ${"30 dakika önce"}
    ${"2024-03-15T12:30:00"} | ${{ reference: REF }}                           | ${"30 dakika sonra"}
    ${"2024-03-15T11:30:00"} | ${{ reference: REF, style: "short" as const }}  | ${"30 dk. önce"}
    ${"2024-03-15T11:30:00"} | ${{ reference: REF, style: "narrow" as const }} | ${"30 dk. önce"}
    ${"2024-03-15T12:30:00"} | ${{ reference: REF, style: "narrow" as const }} | ${"30 dk. sonra"}
    ${"2024-03-15T11:59:15"} | ${{ reference: REF }}                           | ${"45 saniye önce"}
    ${"2024-03-15T12:00:45"} | ${{ reference: REF }}                           | ${"45 saniye sonra"}
    ${"2024-03-15T09:00:00"} | ${{ reference: REF }}                           | ${"3 saat önce"}
    ${"2024-03-15T15:00:00"} | ${{ reference: REF }}                           | ${"3 saat sonra"}
    ${"2024-03-12T12:00:00"} | ${{ reference: REF }}                           | ${"3 gün önce"}
    ${"2024-03-18T12:00:00"} | ${{ reference: REF }}                           | ${"3 gün sonra"}
  `(
    "formats $value for tr-TR with $options as $expected",
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
  // Invalid inputs — must return ""
  // ---------------------------------------------------------------------------
  describe("invalid inputs", () => {
    it.each`
      value
      ${""}
      ${"not-a-date"}
      ${"2024-03-15"}
      ${"2024-13-01T00:00:00"}
      ${"2024-02-30T00:00:00"}
      ${"2024-12-31T23:59:60"}
      ${null}
      ${undefined}
      ${42}
      ${true}
    `("returns '' for invalid value $value", ({ value }) => {
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
    it("returns '' when Temporal.Now.plainDateTimeISO throws (no reference provided)", () => {
      mockTemporalNowPlainDateTimeISOThrow();
      expect(
        formatRelativeDateTime("2024-03-15T12:00:00", MustTestLocales.enUS),
      ).toBe("");
    });
  });
});
