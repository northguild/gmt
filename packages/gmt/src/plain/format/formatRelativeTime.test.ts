import { vi } from "vitest";
import { expectOneOfIcu, MustTestLocales, oneOfIcu } from "../../test";
import {
  mockTemporalNowPlainTimeISOThrow,
  mockTemporalPlainTimeFromThrow,
} from "../../test/mocks";
import { formatRelativeTime } from "./formatRelativeTime";

const REF = "12:00:00";

describe("formatRelativeTime", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Auto unit selection
  // second (<60s), minute (60s–3599s), hour (3600s+)
  // ---------------------------------------------------------------------------
  describe("auto unit selection", () => {
    it.each`
      value         | expected
      ${"11:59:30"} | ${"30 seconds ago"}
      ${"12:00:30"} | ${"in 30 seconds"}
      ${"11:30:00"} | ${"30 minutes ago"}
      ${"12:30:00"} | ${"in 30 minutes"}
      ${"10:00:00"} | ${"2 hours ago"}
      ${"14:00:00"} | ${"in 2 hours"}
    `("formats $value relative to REF as $expected", ({ value, expected }) => {
      expect(
        formatRelativeTime(value, MustTestLocales.enUS, { reference: REF }),
      ).toBe(expected);
    });
  });

  // ---------------------------------------------------------------------------
  // ±1 and 0 permutations
  // ---------------------------------------------------------------------------
  describe("±1 and 0 permutations", () => {
    it.each`
      value         | expected
      ${"12:00:00"} | ${"now"}
      ${"12:00:01"} | ${"in 1 second"}
      ${"11:59:59"} | ${"1 second ago"}
      ${"12:01:00"} | ${"in 1 minute"}
      ${"11:59:00"} | ${"1 minute ago"}
      ${"13:00:00"} | ${"in 1 hour"}
      ${"11:00:00"} | ${"1 hour ago"}
    `("formats $value (en-US, auto) as $expected", ({ value, expected }) => {
      expect(
        formatRelativeTime(value, MustTestLocales.enUS, { reference: REF }),
      ).toBe(expected);
    });
  });

  // ---------------------------------------------------------------------------
  // Per-locale coverage — one block per locale, 11 rows each
  // rows: -30min long, +30min long, -30min short, -30min narrow, +30min narrow,
  //       -45s, +45s, -2h, +2h, -90s (second always), -120min (minute always)
  // ---------------------------------------------------------------------------

  // en-US
  it.each`
    value         | options                                                                           | expected
    ${"11:30:00"} | ${{ reference: REF }}                                                             | ${"30 minutes ago"}
    ${"12:30:00"} | ${{ reference: REF }}                                                             | ${"in 30 minutes"}
    ${"11:30:00"} | ${{ reference: REF, style: "short" as const }}                                    | ${"30 min. ago"}
    ${"11:30:00"} | ${{ reference: REF, style: "narrow" as const }}                                   | ${"30m ago"}
    ${"12:30:00"} | ${{ reference: REF, style: "narrow" as const }}                                   | ${"in 30m"}
    ${"11:59:15"} | ${{ reference: REF }}                                                             | ${"45 seconds ago"}
    ${"12:00:45"} | ${{ reference: REF }}                                                             | ${"in 45 seconds"}
    ${"10:00:00"} | ${{ reference: REF }}                                                             | ${"2 hours ago"}
    ${"14:00:00"} | ${{ reference: REF }}                                                             | ${"in 2 hours"}
    ${"11:58:30"} | ${{ reference: REF, largestUnit: "second" as const, numeric: "always" as const }} | ${"90 seconds ago"}
    ${"10:00:00"} | ${{ reference: REF, largestUnit: "minute" as const, numeric: "always" as const }} | ${"120 minutes ago"}
  `(
    "formats $value for en-US with $options as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeTime(value, MustTestLocales.enUS, options)).toBe(
        expected,
      );
    },
  );

  // en-GB
  it.each`
    value         | options                                                                           | expected
    ${"11:30:00"} | ${{ reference: REF }}                                                             | ${"30 minutes ago"}
    ${"12:30:00"} | ${{ reference: REF }}                                                             | ${"in 30 minutes"}
    ${"11:30:00"} | ${{ reference: REF, style: "short" as const }}                                    | ${"30 min ago"}
    ${"11:30:00"} | ${{ reference: REF, style: "narrow" as const }}                                   | ${"30 min ago"}
    ${"12:30:00"} | ${{ reference: REF, style: "narrow" as const }}                                   | ${"in 30 min"}
    ${"11:59:15"} | ${{ reference: REF }}                                                             | ${"45 seconds ago"}
    ${"12:00:45"} | ${{ reference: REF }}                                                             | ${"in 45 seconds"}
    ${"10:00:00"} | ${{ reference: REF }}                                                             | ${"2 hours ago"}
    ${"14:00:00"} | ${{ reference: REF }}                                                             | ${"in 2 hours"}
    ${"11:58:30"} | ${{ reference: REF, largestUnit: "second" as const, numeric: "always" as const }} | ${"90 seconds ago"}
    ${"10:00:00"} | ${{ reference: REF, largestUnit: "minute" as const, numeric: "always" as const }} | ${"120 minutes ago"}
  `(
    "formats $value for en-GB with $options as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeTime(value, MustTestLocales.enGB, options)).toBe(
        expected,
      );
    },
  );

  // de-DE
  it.each`
    value         | options                                                                           | expected
    ${"11:30:00"} | ${{ reference: REF }}                                                             | ${"vor 30 Minuten"}
    ${"12:30:00"} | ${{ reference: REF }}                                                             | ${"in 30 Minuten"}
    ${"11:30:00"} | ${{ reference: REF, style: "short" as const }}                                    | ${"vor 30 Min."}
    ${"11:30:00"} | ${{ reference: REF, style: "narrow" as const }}                                   | ${"vor 30 m"}
    ${"12:30:00"} | ${{ reference: REF, style: "narrow" as const }}                                   | ${"in 30 m"}
    ${"11:59:15"} | ${{ reference: REF }}                                                             | ${"vor 45 Sekunden"}
    ${"12:00:45"} | ${{ reference: REF }}                                                             | ${"in 45 Sekunden"}
    ${"10:00:00"} | ${{ reference: REF }}                                                             | ${"vor 2 Stunden"}
    ${"14:00:00"} | ${{ reference: REF }}                                                             | ${"in 2 Stunden"}
    ${"11:58:30"} | ${{ reference: REF, largestUnit: "second" as const, numeric: "always" as const }} | ${"vor 90 Sekunden"}
    ${"10:00:00"} | ${{ reference: REF, largestUnit: "minute" as const, numeric: "always" as const }} | ${"vor 120 Minuten"}
  `(
    "formats $value for de-DE with $options as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeTime(value, MustTestLocales.deDE, options)).toBe(
        expected,
      );
    },
  );

  // fr-FR
  it.each`
    value         | options                                                                           | expected
    ${"11:30:00"} | ${{ reference: REF }}                                                             | ${"il y a 30 minutes"}
    ${"12:30:00"} | ${{ reference: REF }}                                                             | ${"dans 30 minutes"}
    ${"11:30:00"} | ${{ reference: REF, style: "short" as const }}                                    | ${"il y a 30 min"}
    ${"11:30:00"} | ${{ reference: REF, style: "narrow" as const }}                                   | ${"-30 min"}
    ${"12:30:00"} | ${{ reference: REF, style: "narrow" as const }}                                   | ${"+30 min"}
    ${"11:59:15"} | ${{ reference: REF }}                                                             | ${"il y a 45 secondes"}
    ${"12:00:45"} | ${{ reference: REF }}                                                             | ${"dans 45 secondes"}
    ${"10:00:00"} | ${{ reference: REF }}                                                             | ${"il y a 2 heures"}
    ${"14:00:00"} | ${{ reference: REF }}                                                             | ${"dans 2 heures"}
    ${"11:58:30"} | ${{ reference: REF, largestUnit: "second" as const, numeric: "always" as const }} | ${"il y a 90 secondes"}
    ${"10:00:00"} | ${{ reference: REF, largestUnit: "minute" as const, numeric: "always" as const }} | ${"il y a 120 minutes"}
  `(
    "formats $value for fr-FR with $options as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeTime(value, MustTestLocales.frFR, options)).toBe(
        expected,
      );
    },
  );

  // es-ES
  it.each`
    value         | options                                                                           | expected
    ${"11:30:00"} | ${{ reference: REF }}                                                             | ${"hace 30 minutos"}
    ${"12:30:00"} | ${{ reference: REF }}                                                             | ${"dentro de 30 minutos"}
    ${"11:30:00"} | ${{ reference: REF, style: "short" as const }}                                    | ${"hace 30 min"}
    ${"11:30:00"} | ${{ reference: REF, style: "narrow" as const }}                                   | ${"hace 30 min"}
    ${"12:30:00"} | ${{ reference: REF, style: "narrow" as const }}                                   | ${"dentro de 30 min"}
    ${"11:59:15"} | ${{ reference: REF }}                                                             | ${"hace 45 segundos"}
    ${"12:00:45"} | ${{ reference: REF }}                                                             | ${"dentro de 45 segundos"}
    ${"10:00:00"} | ${{ reference: REF }}                                                             | ${"hace 2 horas"}
    ${"14:00:00"} | ${{ reference: REF }}                                                             | ${"dentro de 2 horas"}
    ${"11:58:30"} | ${{ reference: REF, largestUnit: "second" as const, numeric: "always" as const }} | ${"hace 90 segundos"}
    ${"10:00:00"} | ${{ reference: REF, largestUnit: "minute" as const, numeric: "always" as const }} | ${"hace 120 minutos"}
  `(
    "formats $value for es-ES with $options as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeTime(value, MustTestLocales.esES, options)).toBe(
        expected,
      );
    },
  );

  // it-IT
  it.each`
    value         | options                                                                           | expected
    ${"11:30:00"} | ${{ reference: REF }}                                                             | ${"30 minuti fa"}
    ${"12:30:00"} | ${{ reference: REF }}                                                             | ${"tra 30 minuti"}
    ${"11:30:00"} | ${{ reference: REF, style: "short" as const }}                                    | ${"30 min fa"}
    ${"11:30:00"} | ${{ reference: REF, style: "narrow" as const }}                                   | ${"30 min fa"}
    ${"12:30:00"} | ${{ reference: REF, style: "narrow" as const }}                                   | ${"tra 30 min"}
    ${"11:59:15"} | ${{ reference: REF }}                                                             | ${"45 secondi fa"}
    ${"12:00:45"} | ${{ reference: REF }}                                                             | ${"tra 45 secondi"}
    ${"10:00:00"} | ${{ reference: REF }}                                                             | ${"2 ore fa"}
    ${"14:00:00"} | ${{ reference: REF }}                                                             | ${"tra 2 ore"}
    ${"11:58:30"} | ${{ reference: REF, largestUnit: "second" as const, numeric: "always" as const }} | ${"90 secondi fa"}
    ${"10:00:00"} | ${{ reference: REF, largestUnit: "minute" as const, numeric: "always" as const }} | ${"120 minuti fa"}
  `(
    "formats $value for it-IT with $options as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeTime(value, MustTestLocales.itIT, options)).toBe(
        expected,
      );
    },
  );

  // pt-PT
  it.each`
    value         | options                                                                           | expected
    ${"11:30:00"} | ${{ reference: REF }}                                                             | ${"há 30 minutos"}
    ${"12:30:00"} | ${{ reference: REF }}                                                             | ${"dentro de 30 minutos"}
    ${"11:30:00"} | ${{ reference: REF, style: "short" as const }}                                    | ${"há 30 min"}
    ${"11:30:00"} | ${{ reference: REF, style: "narrow" as const }}                                   | ${"-30 min"}
    ${"12:30:00"} | ${{ reference: REF, style: "narrow" as const }}                                   | ${"+30 min"}
    ${"11:59:15"} | ${{ reference: REF }}                                                             | ${"há 45 segundos"}
    ${"12:00:45"} | ${{ reference: REF }}                                                             | ${"dentro de 45 segundos"}
    ${"10:00:00"} | ${{ reference: REF }}                                                             | ${"há 2 horas"}
    ${"14:00:00"} | ${{ reference: REF }}                                                             | ${"dentro de 2 horas"}
    ${"11:58:30"} | ${{ reference: REF, largestUnit: "second" as const, numeric: "always" as const }} | ${"há 90 segundos"}
    ${"10:00:00"} | ${{ reference: REF, largestUnit: "minute" as const, numeric: "always" as const }} | ${"há 120 minutos"}
  `(
    "formats $value for pt-PT with $options as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeTime(value, MustTestLocales.ptPT, options)).toBe(
        expected,
      );
    },
  );

  // sv-SE
  it.each`
    value         | options                                                                           | expected
    ${"11:30:00"} | ${{ reference: REF }}                                                             | ${"för 30 minuter sedan"}
    ${"12:30:00"} | ${{ reference: REF }}                                                             | ${"om 30 minuter"}
    ${"11:30:00"} | ${{ reference: REF, style: "short" as const }}                                    | ${"för 30 min sen"}
    ${"11:30:00"} | ${{ reference: REF, style: "narrow" as const }}                                   | ${"- 30 min"}
    ${"12:30:00"} | ${{ reference: REF, style: "narrow" as const }}                                   | ${"+30 min"}
    ${"11:59:15"} | ${{ reference: REF }}                                                             | ${"för 45 sekunder sedan"}
    ${"12:00:45"} | ${{ reference: REF }}                                                             | ${"om 45 sekunder"}
    ${"10:00:00"} | ${{ reference: REF }}                                                             | ${"för 2 timmar sedan"}
    ${"14:00:00"} | ${{ reference: REF }}                                                             | ${"om 2 timmar"}
    ${"11:58:30"} | ${{ reference: REF, largestUnit: "second" as const, numeric: "always" as const }} | ${"för 90 sekunder sedan"}
    ${"10:00:00"} | ${{ reference: REF, largestUnit: "minute" as const, numeric: "always" as const }} | ${"för 120 minuter sedan"}
  `(
    "formats $value for sv-SE with $options as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeTime(value, MustTestLocales.svSE, options)).toBe(
        expected,
      );
    },
  );

  // is-IS
  it.each`
    value         | options                                                                           | expected
    ${"11:30:00"} | ${{ reference: REF }}                                                             | ${"fyrir 30 mínútum"}
    ${"12:30:00"} | ${{ reference: REF }}                                                             | ${"eftir 30 mínútur"}
    ${"11:30:00"} | ${{ reference: REF, style: "short" as const }}                                    | ${"fyrir 30 mín."}
    ${"11:30:00"} | ${{ reference: REF, style: "narrow" as const }}                                   | ${"-30 mín."}
    ${"12:30:00"} | ${{ reference: REF, style: "narrow" as const }}                                   | ${"+30 mín."}
    ${"11:59:15"} | ${{ reference: REF }}                                                             | ${"fyrir 45 sekúndum"}
    ${"12:00:45"} | ${{ reference: REF }}                                                             | ${"eftir 45 sekúndur"}
    ${"10:00:00"} | ${{ reference: REF }}                                                             | ${"fyrir 2 klukkustundum"}
    ${"14:00:00"} | ${{ reference: REF }}                                                             | ${"eftir 2 klukkustundir"}
    ${"11:58:30"} | ${{ reference: REF, largestUnit: "second" as const, numeric: "always" as const }} | ${"fyrir 90 sekúndum"}
    ${"10:00:00"} | ${{ reference: REF, largestUnit: "minute" as const, numeric: "always" as const }} | ${"fyrir 120 mínútum"}
  `(
    "formats $value for is-IS with $options as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeTime(value, MustTestLocales.isIS, options)).toBe(
        expected,
      );
    },
  );

  // zh-CN
  it.each`
    value         | options                                                                           | expected
    ${"11:30:00"} | ${{ reference: REF }}                                                             | ${"30分钟前"}
    ${"12:30:00"} | ${{ reference: REF }}                                                             | ${"30分钟后"}
    ${"11:30:00"} | ${{ reference: REF, style: "short" as const }}                                    | ${"30分钟前"}
    ${"11:30:00"} | ${{ reference: REF, style: "narrow" as const }}                                   | ${"30分钟前"}
    ${"12:30:00"} | ${{ reference: REF, style: "narrow" as const }}                                   | ${"30分钟后"}
    ${"11:59:15"} | ${{ reference: REF }}                                                             | ${"45秒钟前"}
    ${"12:00:45"} | ${{ reference: REF }}                                                             | ${"45秒钟后"}
    ${"10:00:00"} | ${{ reference: REF }}                                                             | ${"2小时前"}
    ${"14:00:00"} | ${{ reference: REF }}                                                             | ${"2小时后"}
    ${"11:58:30"} | ${{ reference: REF, largestUnit: "second" as const, numeric: "always" as const }} | ${"90秒钟前"}
    ${"10:00:00"} | ${{ reference: REF, largestUnit: "minute" as const, numeric: "always" as const }} | ${"120分钟前"}
  `(
    "formats $value for zh-CN with $options as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeTime(value, MustTestLocales.zhCN, options)).toBe(
        expected,
      );
    },
  );

  // zh-TW
  it.each`
    value         | options                                                                           | expected
    ${"11:30:00"} | ${{ reference: REF }}                                                             | ${"30 分鐘前"}
    ${"12:30:00"} | ${{ reference: REF }}                                                             | ${"30 分鐘後"}
    ${"11:30:00"} | ${{ reference: REF, style: "short" as const }}                                    | ${"30 分鐘前"}
    ${"11:30:00"} | ${{ reference: REF, style: "narrow" as const }}                                   | ${"30 分鐘前"}
    ${"12:30:00"} | ${{ reference: REF, style: "narrow" as const }}                                   | ${"30 分鐘後"}
    ${"11:59:15"} | ${{ reference: REF }}                                                             | ${"45 秒前"}
    ${"12:00:45"} | ${{ reference: REF }}                                                             | ${"45 秒後"}
    ${"10:00:00"} | ${{ reference: REF }}                                                             | ${"2 小時前"}
    ${"14:00:00"} | ${{ reference: REF }}                                                             | ${"2 小時後"}
    ${"11:58:30"} | ${{ reference: REF, largestUnit: "second" as const, numeric: "always" as const }} | ${"90 秒前"}
    ${"10:00:00"} | ${{ reference: REF, largestUnit: "minute" as const, numeric: "always" as const }} | ${"120 分鐘前"}
  `(
    "formats $value for zh-TW with $options as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeTime(value, MustTestLocales.zhTW, options)).toBe(
        expected,
      );
    },
  );

  // ja-JP
  it.each`
    value         | options                                                                           | expected
    ${"11:30:00"} | ${{ reference: REF }}                                                             | ${"30 分前"}
    ${"12:30:00"} | ${{ reference: REF }}                                                             | ${"30 分後"}
    ${"11:30:00"} | ${{ reference: REF, style: "short" as const }}                                    | ${"30 分前"}
    ${"11:30:00"} | ${{ reference: REF, style: "narrow" as const }}                                   | ${"30分前"}
    ${"12:30:00"} | ${{ reference: REF, style: "narrow" as const }}                                   | ${"30分後"}
    ${"11:59:15"} | ${{ reference: REF }}                                                             | ${"45 秒前"}
    ${"12:00:45"} | ${{ reference: REF }}                                                             | ${"45 秒後"}
    ${"10:00:00"} | ${{ reference: REF }}                                                             | ${"2 時間前"}
    ${"14:00:00"} | ${{ reference: REF }}                                                             | ${"2 時間後"}
    ${"11:58:30"} | ${{ reference: REF, largestUnit: "second" as const, numeric: "always" as const }} | ${"90 秒前"}
    ${"10:00:00"} | ${{ reference: REF, largestUnit: "minute" as const, numeric: "always" as const }} | ${"120 分前"}
  `(
    "formats $value for ja-JP with $options as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeTime(value, MustTestLocales.jaJP, options)).toBe(
        expected,
      );
    },
  );

  // ko-KR
  it.each`
    value         | options                                                                           | expected
    ${"11:30:00"} | ${{ reference: REF }}                                                             | ${"30분 전"}
    ${"12:30:00"} | ${{ reference: REF }}                                                             | ${"30분 후"}
    ${"11:30:00"} | ${{ reference: REF, style: "short" as const }}                                    | ${"30분 전"}
    ${"11:30:00"} | ${{ reference: REF, style: "narrow" as const }}                                   | ${"30분 전"}
    ${"12:30:00"} | ${{ reference: REF, style: "narrow" as const }}                                   | ${"30분 후"}
    ${"11:59:15"} | ${{ reference: REF }}                                                             | ${"45초 전"}
    ${"12:00:45"} | ${{ reference: REF }}                                                             | ${"45초 후"}
    ${"10:00:00"} | ${{ reference: REF }}                                                             | ${"2시간 전"}
    ${"14:00:00"} | ${{ reference: REF }}                                                             | ${"2시간 후"}
    ${"11:58:30"} | ${{ reference: REF, largestUnit: "second" as const, numeric: "always" as const }} | ${"90초 전"}
    ${"10:00:00"} | ${{ reference: REF, largestUnit: "minute" as const, numeric: "always" as const }} | ${"120분 전"}
  `(
    "formats $value for ko-KR with $options as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeTime(value, MustTestLocales.koKR, options)).toBe(
        expected,
      );
    },
  );

  // ar-SA
  it.each`
    value         | options                                                                           | expected
    ${"11:30:00"} | ${{ reference: REF }}                                                             | ${"قبل ٣٠ دقيقة"}
    ${"12:30:00"} | ${{ reference: REF }}                                                             | ${"خلال ٣٠ دقيقة"}
    ${"11:30:00"} | ${{ reference: REF, style: "short" as const }}                                    | ${"قبل ٣٠ دقيقة"}
    ${"11:30:00"} | ${{ reference: REF, style: "narrow" as const }}                                   | ${"قبل ٣٠ دقيقة"}
    ${"12:30:00"} | ${{ reference: REF, style: "narrow" as const }}                                   | ${"خلال ٣٠ دقيقة"}
    ${"11:59:15"} | ${{ reference: REF }}                                                             | ${"قبل ٤٥ ثانية"}
    ${"12:00:45"} | ${{ reference: REF }}                                                             | ${"خلال ٤٥ ثانية"}
    ${"10:00:00"} | ${{ reference: REF }}                                                             | ${"قبل ساعتين"}
    ${"14:00:00"} | ${{ reference: REF }}                                                             | ${"خلال ساعتين"}
    ${"11:58:30"} | ${{ reference: REF, largestUnit: "second" as const, numeric: "always" as const }} | ${"قبل ٩٠ ثانية"}
    ${"10:00:00"} | ${{ reference: REF, largestUnit: "minute" as const, numeric: "always" as const }} | ${"قبل ١٢٠ دقيقة"}
  `(
    "formats $value for ar-SA with $options as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeTime(value, MustTestLocales.arSA, options)).toBe(
        expected,
      );
    },
  );

  // he-IL
  it.each`
    value         | options                                                                           | expected
    ${"11:30:00"} | ${{ reference: REF }}                                                             | ${"לפני 30 דקות"}
    ${"12:30:00"} | ${{ reference: REF }}                                                             | ${"בעוד 30 דקות"}
    ${"11:30:00"} | ${{ reference: REF, style: "short" as const }}                                    | ${"לפני 30 דק׳"}
    ${"11:30:00"} | ${{ reference: REF, style: "narrow" as const }}                                   | ${"לפני 30 דק׳"}
    ${"12:30:00"} | ${{ reference: REF, style: "narrow" as const }}                                   | ${"בעוד 30 דק׳"}
    ${"11:59:15"} | ${{ reference: REF }}                                                             | ${"לפני 45 שניות"}
    ${"12:00:45"} | ${{ reference: REF }}                                                             | ${"בעוד 45 שניות"}
    ${"11:58:30"} | ${{ reference: REF, largestUnit: "second" as const, numeric: "always" as const }} | ${"לפני 90 שניות"}
    ${"10:00:00"} | ${{ reference: REF, largestUnit: "minute" as const, numeric: "always" as const }} | ${"לפני 120 דקות"}
  `(
    "formats $value for he-IL with $options as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeTime(value, MustTestLocales.heIL, options)).toBe(
        expected,
      );
    },
  );

  // he-IL dual-form hour pluralization — CLDR started appending the
  // numeral in parentheses to the dual form ("שעתיים") starting ICU 78
  // (Node 22/24); ICU 77 (Node 20) omits it.
  it.each`
    value         | options               | expectedVariants
    ${"10:00:00"} | ${{ reference: REF }} | ${oneOfIcu("לפני שעתיים", "לפני שעתיים (2)")}
    ${"14:00:00"} | ${{ reference: REF }} | ${oneOfIcu("בעוד שעתיים", "בעוד שעתיים (2)")}
  `(
    "formats $value for he-IL with $options as one of the known ICU variants",
    ({ value, options, expectedVariants }) => {
      expectOneOfIcu(
        formatRelativeTime(value, MustTestLocales.heIL, options),
        expectedVariants,
      );
    },
  );

  // ru-RU
  it.each`
    value         | options                                                                           | expected
    ${"11:30:00"} | ${{ reference: REF }}                                                             | ${"30 минут назад"}
    ${"12:30:00"} | ${{ reference: REF }}                                                             | ${"через 30 минут"}
    ${"11:30:00"} | ${{ reference: REF, style: "short" as const }}                                    | ${"30 мин. назад"}
    ${"11:30:00"} | ${{ reference: REF, style: "narrow" as const }}                                   | ${"-30 мин"}
    ${"12:30:00"} | ${{ reference: REF, style: "narrow" as const }}                                   | ${"+30 мин"}
    ${"11:59:15"} | ${{ reference: REF }}                                                             | ${"45 секунд назад"}
    ${"12:00:45"} | ${{ reference: REF }}                                                             | ${"через 45 секунд"}
    ${"10:00:00"} | ${{ reference: REF }}                                                             | ${"2 часа назад"}
    ${"14:00:00"} | ${{ reference: REF }}                                                             | ${"через 2 часа"}
    ${"11:58:30"} | ${{ reference: REF, largestUnit: "second" as const, numeric: "always" as const }} | ${"90 секунд назад"}
    ${"10:00:00"} | ${{ reference: REF, largestUnit: "minute" as const, numeric: "always" as const }} | ${"120 минут назад"}
  `(
    "formats $value for ru-RU with $options as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeTime(value, MustTestLocales.ruRU, options)).toBe(
        expected,
      );
    },
  );

  // tr-TR
  it.each`
    value         | options                                                                           | expected
    ${"11:30:00"} | ${{ reference: REF }}                                                             | ${"30 dakika önce"}
    ${"12:30:00"} | ${{ reference: REF }}                                                             | ${"30 dakika sonra"}
    ${"11:30:00"} | ${{ reference: REF, style: "short" as const }}                                    | ${"30 dk. önce"}
    ${"11:30:00"} | ${{ reference: REF, style: "narrow" as const }}                                   | ${"30 dk. önce"}
    ${"12:30:00"} | ${{ reference: REF, style: "narrow" as const }}                                   | ${"30 dk. sonra"}
    ${"11:59:15"} | ${{ reference: REF }}                                                             | ${"45 saniye önce"}
    ${"12:00:45"} | ${{ reference: REF }}                                                             | ${"45 saniye sonra"}
    ${"10:00:00"} | ${{ reference: REF }}                                                             | ${"2 saat önce"}
    ${"14:00:00"} | ${{ reference: REF }}                                                             | ${"2 saat sonra"}
    ${"11:58:30"} | ${{ reference: REF, largestUnit: "second" as const, numeric: "always" as const }} | ${"90 saniye önce"}
    ${"10:00:00"} | ${{ reference: REF, largestUnit: "minute" as const, numeric: "always" as const }} | ${"120 dakika önce"}
  `(
    "formats $value for tr-TR with $options as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeTime(value, MustTestLocales.trTR, options)).toBe(
        expected,
      );
    },
  );

  // ---------------------------------------------------------------------------
  // style option
  // ---------------------------------------------------------------------------
  describe("style option", () => {
    const value = "11:30:00";

    it.each`
      style       | expected
      ${"long"}   | ${"30 minutes ago"}
      ${"short"}  | ${"30 min. ago"}
      ${"narrow"} | ${"30m ago"}
    `("style:$style formats -30min as $expected", ({ style, expected }) => {
      expect(
        formatRelativeTime(value, MustTestLocales.enUS, {
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
      value         | numeric     | expected
      ${"12:00:00"} | ${"auto"}   | ${"now"}
      ${"12:00:00"} | ${"always"} | ${"in 0 seconds"}
      ${"12:01:00"} | ${"auto"}   | ${"in 1 minute"}
      ${"12:01:00"} | ${"always"} | ${"in 1 minute"}
      ${"11:59:00"} | ${"auto"}   | ${"1 minute ago"}
      ${"11:59:00"} | ${"always"} | ${"1 minute ago"}
    `(
      "numeric:$numeric for $value → $expected",
      ({ value, numeric, expected }) => {
        expect(
          formatRelativeTime(value, MustTestLocales.enUS, {
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
      value         | largestUnit | expected
      ${"11:59:30"} | ${"second"} | ${"30 seconds ago"}
      ${"12:00:30"} | ${"second"} | ${"in 30 seconds"}
      ${"11:30:00"} | ${"minute"} | ${"30 minutes ago"}
      ${"12:30:00"} | ${"minute"} | ${"in 30 minutes"}
      ${"10:00:00"} | ${"hour"}   | ${"2 hours ago"}
      ${"14:00:00"} | ${"hour"}   | ${"in 2 hours"}
    `(
      "largestUnit:$largestUnit for $value → $expected",
      ({ value, largestUnit, expected }) => {
        expect(
          formatRelativeTime(value, MustTestLocales.enUS, {
            reference: REF,
            largestUnit,
          }),
        ).toBe(expected);
      },
    );

    it("largestUnit:second forces second for a 90-second diff", () => {
      expect(
        formatRelativeTime("11:58:30", MustTestLocales.enUS, {
          reference: REF,
          largestUnit: "second",
          numeric: "always",
        }),
      ).toBe("90 seconds ago");
    });

    it("largestUnit:minute forces minute for a 2-hour diff", () => {
      expect(
        formatRelativeTime("10:00:00", MustTestLocales.enUS, {
          reference: REF,
          largestUnit: "minute",
          numeric: "always",
        }),
      ).toBe("120 minutes ago");
    });
  });

  // ---------------------------------------------------------------------------
  // Invalid inputs — must return ""
  // ---------------------------------------------------------------------------
  describe("invalid inputs", () => {
    it.each`
      value
      ${""}
      ${"not-a-time"}
      ${"25:00:00"}
      ${"12:60:00"}
      ${"2024-03-15"}
      ${"2024-03-15T12:00:00"}
      ${null}
      ${undefined}
      ${42}
      ${true}
    `("returns '' for invalid value $value", ({ value }) => {
      expect(formatRelativeTime(value as never, MustTestLocales.enUS)).toBe("");
    });

    it("returns '' when reference is provided but invalid", () => {
      expect(
        formatRelativeTime("11:30:00", MustTestLocales.enUS, {
          reference: "not-a-time",
        }),
      ).toBe("");
    });

    it("returns '' when reference is an empty string", () => {
      expect(
        formatRelativeTime("11:30:00", MustTestLocales.enUS, { reference: "" }),
      ).toBe("");
    });
  });

  // ---------------------------------------------------------------------------
  // Temporal failures — internal errors must not throw, must return ""
  // ---------------------------------------------------------------------------
  describe("Temporal failures", () => {
    it("returns '' when Temporal.Now.plainTimeISO throws (no reference provided)", () => {
      mockTemporalNowPlainTimeISOThrow();
      expect(formatRelativeTime("11:30:00", MustTestLocales.enUS)).toBe("");
    });

    it("returns '' when Temporal.PlainTime.from throws", () => {
      mockTemporalPlainTimeFromThrow();
      expect(
        formatRelativeTime("11:30:00", MustTestLocales.enUS, {
          reference: REF,
        }),
      ).toBe("");
    });
  });
});
