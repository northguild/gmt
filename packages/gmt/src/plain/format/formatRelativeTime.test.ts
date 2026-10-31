import { expectOneOfIcu, MustTestLocales, oneOfIcu } from "../../test";
import {
  mockTemporalNowPlainTimeISOThrow,
  mockTemporalPlainTimeFromThrow,
} from "../../test/mocks";
import {
  formatRelativeTime,
  type FormatRelativeTimeOptions,
} from "./formatRelativeTime";

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
    value         | options                                                                           | expected             | label
    ${"11:30:00"} | ${{ reference: REF }}                                                             | ${"30 minutes ago"}  | ${"default options"}
    ${"12:30:00"} | ${{ reference: REF }}                                                             | ${"in 30 minutes"}   | ${"default options"}
    ${"11:30:00"} | ${{ reference: REF, style: "short" as const }}                                    | ${"30 min. ago"}     | ${"style short"}
    ${"11:30:00"} | ${{ reference: REF, style: "narrow" as const }}                                   | ${"30m ago"}         | ${"style narrow"}
    ${"12:30:00"} | ${{ reference: REF, style: "narrow" as const }}                                   | ${"in 30m"}          | ${"style narrow"}
    ${"11:59:15"} | ${{ reference: REF }}                                                             | ${"45 seconds ago"}  | ${"default options"}
    ${"12:00:45"} | ${{ reference: REF }}                                                             | ${"in 45 seconds"}   | ${"default options"}
    ${"10:00:00"} | ${{ reference: REF }}                                                             | ${"2 hours ago"}     | ${"default options"}
    ${"14:00:00"} | ${{ reference: REF }}                                                             | ${"in 2 hours"}      | ${"default options"}
    ${"11:58:30"} | ${{ reference: REF, largestUnit: "second" as const, numeric: "always" as const }} | ${"90 seconds ago"}  | ${"largestUnit second, numeric always"}
    ${"10:00:00"} | ${{ reference: REF, largestUnit: "minute" as const, numeric: "always" as const }} | ${"120 minutes ago"} | ${"largestUnit minute, numeric always"}
  `(
    "formats $value for en-US with $label as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeTime(value, MustTestLocales.enUS, options)).toBe(
        expected,
      );
    },
  );

  // en-GB
  it.each`
    value         | options                                                                           | expected             | label
    ${"11:30:00"} | ${{ reference: REF }}                                                             | ${"30 minutes ago"}  | ${"default options"}
    ${"12:30:00"} | ${{ reference: REF }}                                                             | ${"in 30 minutes"}   | ${"default options"}
    ${"11:30:00"} | ${{ reference: REF, style: "short" as const }}                                    | ${"30 min ago"}      | ${"style short"}
    ${"11:30:00"} | ${{ reference: REF, style: "narrow" as const }}                                   | ${"30 min ago"}      | ${"style narrow"}
    ${"12:30:00"} | ${{ reference: REF, style: "narrow" as const }}                                   | ${"in 30 min"}       | ${"style narrow"}
    ${"11:59:15"} | ${{ reference: REF }}                                                             | ${"45 seconds ago"}  | ${"default options"}
    ${"12:00:45"} | ${{ reference: REF }}                                                             | ${"in 45 seconds"}   | ${"default options"}
    ${"10:00:00"} | ${{ reference: REF }}                                                             | ${"2 hours ago"}     | ${"default options"}
    ${"14:00:00"} | ${{ reference: REF }}                                                             | ${"in 2 hours"}      | ${"default options"}
    ${"11:58:30"} | ${{ reference: REF, largestUnit: "second" as const, numeric: "always" as const }} | ${"90 seconds ago"}  | ${"largestUnit second, numeric always"}
    ${"10:00:00"} | ${{ reference: REF, largestUnit: "minute" as const, numeric: "always" as const }} | ${"120 minutes ago"} | ${"largestUnit minute, numeric always"}
  `(
    "formats $value for en-GB with $label as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeTime(value, MustTestLocales.enGB, options)).toBe(
        expected,
      );
    },
  );

  // de-DE
  it.each`
    value         | options                                                                           | expected             | label
    ${"11:30:00"} | ${{ reference: REF }}                                                             | ${"vor 30 Minuten"}  | ${"default options"}
    ${"12:30:00"} | ${{ reference: REF }}                                                             | ${"in 30 Minuten"}   | ${"default options"}
    ${"11:30:00"} | ${{ reference: REF, style: "short" as const }}                                    | ${"vor 30 Min."}     | ${"style short"}
    ${"11:30:00"} | ${{ reference: REF, style: "narrow" as const }}                                   | ${"vor 30 m"}        | ${"style narrow"}
    ${"12:30:00"} | ${{ reference: REF, style: "narrow" as const }}                                   | ${"in 30 m"}         | ${"style narrow"}
    ${"11:59:15"} | ${{ reference: REF }}                                                             | ${"vor 45 Sekunden"} | ${"default options"}
    ${"12:00:45"} | ${{ reference: REF }}                                                             | ${"in 45 Sekunden"}  | ${"default options"}
    ${"10:00:00"} | ${{ reference: REF }}                                                             | ${"vor 2 Stunden"}   | ${"default options"}
    ${"14:00:00"} | ${{ reference: REF }}                                                             | ${"in 2 Stunden"}    | ${"default options"}
    ${"11:58:30"} | ${{ reference: REF, largestUnit: "second" as const, numeric: "always" as const }} | ${"vor 90 Sekunden"} | ${"largestUnit second, numeric always"}
    ${"10:00:00"} | ${{ reference: REF, largestUnit: "minute" as const, numeric: "always" as const }} | ${"vor 120 Minuten"} | ${"largestUnit minute, numeric always"}
  `(
    "formats $value for de-DE with $label as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeTime(value, MustTestLocales.deDE, options)).toBe(
        expected,
      );
    },
  );

  // fr-FR
  it.each`
    value         | options                                                                           | expected                | label
    ${"11:30:00"} | ${{ reference: REF }}                                                             | ${"il y a 30 minutes"}  | ${"default options"}
    ${"12:30:00"} | ${{ reference: REF }}                                                             | ${"dans 30 minutes"}    | ${"default options"}
    ${"11:30:00"} | ${{ reference: REF, style: "short" as const }}                                    | ${"il y a 30 min"}      | ${"style short"}
    ${"11:30:00"} | ${{ reference: REF, style: "narrow" as const }}                                   | ${"-30 min"}            | ${"style narrow"}
    ${"12:30:00"} | ${{ reference: REF, style: "narrow" as const }}                                   | ${"+30 min"}            | ${"style narrow"}
    ${"11:59:15"} | ${{ reference: REF }}                                                             | ${"il y a 45 secondes"} | ${"default options"}
    ${"12:00:45"} | ${{ reference: REF }}                                                             | ${"dans 45 secondes"}   | ${"default options"}
    ${"10:00:00"} | ${{ reference: REF }}                                                             | ${"il y a 2 heures"}    | ${"default options"}
    ${"14:00:00"} | ${{ reference: REF }}                                                             | ${"dans 2 heures"}      | ${"default options"}
    ${"11:58:30"} | ${{ reference: REF, largestUnit: "second" as const, numeric: "always" as const }} | ${"il y a 90 secondes"} | ${"largestUnit second, numeric always"}
    ${"10:00:00"} | ${{ reference: REF, largestUnit: "minute" as const, numeric: "always" as const }} | ${"il y a 120 minutes"} | ${"largestUnit minute, numeric always"}
  `(
    "formats $value for fr-FR with $label as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeTime(value, MustTestLocales.frFR, options)).toBe(
        expected,
      );
    },
  );

  // es-ES
  it.each`
    value         | options                                                                           | expected                   | label
    ${"11:30:00"} | ${{ reference: REF }}                                                             | ${"hace 30 minutos"}       | ${"default options"}
    ${"12:30:00"} | ${{ reference: REF }}                                                             | ${"dentro de 30 minutos"}  | ${"default options"}
    ${"11:30:00"} | ${{ reference: REF, style: "short" as const }}                                    | ${"hace 30 min"}           | ${"style short"}
    ${"11:30:00"} | ${{ reference: REF, style: "narrow" as const }}                                   | ${"hace 30 min"}           | ${"style narrow"}
    ${"12:30:00"} | ${{ reference: REF, style: "narrow" as const }}                                   | ${"dentro de 30 min"}      | ${"style narrow"}
    ${"11:59:15"} | ${{ reference: REF }}                                                             | ${"hace 45 segundos"}      | ${"default options"}
    ${"12:00:45"} | ${{ reference: REF }}                                                             | ${"dentro de 45 segundos"} | ${"default options"}
    ${"10:00:00"} | ${{ reference: REF }}                                                             | ${"hace 2 horas"}          | ${"default options"}
    ${"14:00:00"} | ${{ reference: REF }}                                                             | ${"dentro de 2 horas"}     | ${"default options"}
    ${"11:58:30"} | ${{ reference: REF, largestUnit: "second" as const, numeric: "always" as const }} | ${"hace 90 segundos"}      | ${"largestUnit second, numeric always"}
    ${"10:00:00"} | ${{ reference: REF, largestUnit: "minute" as const, numeric: "always" as const }} | ${"hace 120 minutos"}      | ${"largestUnit minute, numeric always"}
  `(
    "formats $value for es-ES with $label as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeTime(value, MustTestLocales.esES, options)).toBe(
        expected,
      );
    },
  );

  // it-IT
  it.each`
    value         | options                                                                           | expected            | label
    ${"11:30:00"} | ${{ reference: REF }}                                                             | ${"30 minuti fa"}   | ${"default options"}
    ${"12:30:00"} | ${{ reference: REF }}                                                             | ${"tra 30 minuti"}  | ${"default options"}
    ${"11:30:00"} | ${{ reference: REF, style: "short" as const }}                                    | ${"30 min fa"}      | ${"style short"}
    ${"11:30:00"} | ${{ reference: REF, style: "narrow" as const }}                                   | ${"30 min fa"}      | ${"style narrow"}
    ${"12:30:00"} | ${{ reference: REF, style: "narrow" as const }}                                   | ${"tra 30 min"}     | ${"style narrow"}
    ${"11:59:15"} | ${{ reference: REF }}                                                             | ${"45 secondi fa"}  | ${"default options"}
    ${"12:00:45"} | ${{ reference: REF }}                                                             | ${"tra 45 secondi"} | ${"default options"}
    ${"10:00:00"} | ${{ reference: REF }}                                                             | ${"2 ore fa"}       | ${"default options"}
    ${"14:00:00"} | ${{ reference: REF }}                                                             | ${"tra 2 ore"}      | ${"default options"}
    ${"11:58:30"} | ${{ reference: REF, largestUnit: "second" as const, numeric: "always" as const }} | ${"90 secondi fa"}  | ${"largestUnit second, numeric always"}
    ${"10:00:00"} | ${{ reference: REF, largestUnit: "minute" as const, numeric: "always" as const }} | ${"120 minuti fa"}  | ${"largestUnit minute, numeric always"}
  `(
    "formats $value for it-IT with $label as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeTime(value, MustTestLocales.itIT, options)).toBe(
        expected,
      );
    },
  );

  // pt-PT
  it.each`
    value         | options                                                                           | expected                   | label
    ${"11:30:00"} | ${{ reference: REF }}                                                             | ${"há 30 minutos"}         | ${"default options"}
    ${"12:30:00"} | ${{ reference: REF }}                                                             | ${"dentro de 30 minutos"}  | ${"default options"}
    ${"11:30:00"} | ${{ reference: REF, style: "short" as const }}                                    | ${"há 30 min"}             | ${"style short"}
    ${"11:30:00"} | ${{ reference: REF, style: "narrow" as const }}                                   | ${"-30 min"}               | ${"style narrow"}
    ${"12:30:00"} | ${{ reference: REF, style: "narrow" as const }}                                   | ${"+30 min"}               | ${"style narrow"}
    ${"11:59:15"} | ${{ reference: REF }}                                                             | ${"há 45 segundos"}        | ${"default options"}
    ${"12:00:45"} | ${{ reference: REF }}                                                             | ${"dentro de 45 segundos"} | ${"default options"}
    ${"10:00:00"} | ${{ reference: REF }}                                                             | ${"há 2 horas"}            | ${"default options"}
    ${"14:00:00"} | ${{ reference: REF }}                                                             | ${"dentro de 2 horas"}     | ${"default options"}
    ${"11:58:30"} | ${{ reference: REF, largestUnit: "second" as const, numeric: "always" as const }} | ${"há 90 segundos"}        | ${"largestUnit second, numeric always"}
    ${"10:00:00"} | ${{ reference: REF, largestUnit: "minute" as const, numeric: "always" as const }} | ${"há 120 minutos"}        | ${"largestUnit minute, numeric always"}
  `(
    "formats $value for pt-PT with $label as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeTime(value, MustTestLocales.ptPT, options)).toBe(
        expected,
      );
    },
  );

  // sv-SE
  it.each`
    value         | options                                                                           | expected                   | label
    ${"11:30:00"} | ${{ reference: REF }}                                                             | ${"för 30 minuter sedan"}  | ${"default options"}
    ${"12:30:00"} | ${{ reference: REF }}                                                             | ${"om 30 minuter"}         | ${"default options"}
    ${"11:30:00"} | ${{ reference: REF, style: "short" as const }}                                    | ${"för 30 min sen"}        | ${"style short"}
    ${"11:30:00"} | ${{ reference: REF, style: "narrow" as const }}                                   | ${"- 30 min"}              | ${"style narrow"}
    ${"12:30:00"} | ${{ reference: REF, style: "narrow" as const }}                                   | ${"+30 min"}               | ${"style narrow"}
    ${"11:59:15"} | ${{ reference: REF }}                                                             | ${"för 45 sekunder sedan"} | ${"default options"}
    ${"12:00:45"} | ${{ reference: REF }}                                                             | ${"om 45 sekunder"}        | ${"default options"}
    ${"10:00:00"} | ${{ reference: REF }}                                                             | ${"för 2 timmar sedan"}    | ${"default options"}
    ${"14:00:00"} | ${{ reference: REF }}                                                             | ${"om 2 timmar"}           | ${"default options"}
    ${"11:58:30"} | ${{ reference: REF, largestUnit: "second" as const, numeric: "always" as const }} | ${"för 90 sekunder sedan"} | ${"largestUnit second, numeric always"}
    ${"10:00:00"} | ${{ reference: REF, largestUnit: "minute" as const, numeric: "always" as const }} | ${"för 120 minuter sedan"} | ${"largestUnit minute, numeric always"}
  `(
    "formats $value for sv-SE with $label as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeTime(value, MustTestLocales.svSE, options)).toBe(
        expected,
      );
    },
  );

  // is-IS
  it.each`
    value         | options                                                                           | expected                   | label
    ${"11:30:00"} | ${{ reference: REF }}                                                             | ${"fyrir 30 mínútum"}      | ${"default options"}
    ${"12:30:00"} | ${{ reference: REF }}                                                             | ${"eftir 30 mínútur"}      | ${"default options"}
    ${"11:30:00"} | ${{ reference: REF, style: "short" as const }}                                    | ${"fyrir 30 mín."}         | ${"style short"}
    ${"11:30:00"} | ${{ reference: REF, style: "narrow" as const }}                                   | ${"-30 mín."}              | ${"style narrow"}
    ${"12:30:00"} | ${{ reference: REF, style: "narrow" as const }}                                   | ${"+30 mín."}              | ${"style narrow"}
    ${"11:59:15"} | ${{ reference: REF }}                                                             | ${"fyrir 45 sekúndum"}     | ${"default options"}
    ${"12:00:45"} | ${{ reference: REF }}                                                             | ${"eftir 45 sekúndur"}     | ${"default options"}
    ${"10:00:00"} | ${{ reference: REF }}                                                             | ${"fyrir 2 klukkustundum"} | ${"default options"}
    ${"14:00:00"} | ${{ reference: REF }}                                                             | ${"eftir 2 klukkustundir"} | ${"default options"}
    ${"11:58:30"} | ${{ reference: REF, largestUnit: "second" as const, numeric: "always" as const }} | ${"fyrir 90 sekúndum"}     | ${"largestUnit second, numeric always"}
    ${"10:00:00"} | ${{ reference: REF, largestUnit: "minute" as const, numeric: "always" as const }} | ${"fyrir 120 mínútum"}     | ${"largestUnit minute, numeric always"}
  `(
    "formats $value for is-IS with $label as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeTime(value, MustTestLocales.isIS, options)).toBe(
        expected,
      );
    },
  );

  // zh-CN
  it.each`
    value         | options                                                                           | expected       | label
    ${"11:30:00"} | ${{ reference: REF }}                                                             | ${"30分钟前"}  | ${"default options"}
    ${"12:30:00"} | ${{ reference: REF }}                                                             | ${"30分钟后"}  | ${"default options"}
    ${"11:30:00"} | ${{ reference: REF, style: "short" as const }}                                    | ${"30分钟前"}  | ${"style short"}
    ${"11:30:00"} | ${{ reference: REF, style: "narrow" as const }}                                   | ${"30分钟前"}  | ${"style narrow"}
    ${"12:30:00"} | ${{ reference: REF, style: "narrow" as const }}                                   | ${"30分钟后"}  | ${"style narrow"}
    ${"11:59:15"} | ${{ reference: REF }}                                                             | ${"45秒钟前"}  | ${"default options"}
    ${"12:00:45"} | ${{ reference: REF }}                                                             | ${"45秒钟后"}  | ${"default options"}
    ${"10:00:00"} | ${{ reference: REF }}                                                             | ${"2小时前"}   | ${"default options"}
    ${"14:00:00"} | ${{ reference: REF }}                                                             | ${"2小时后"}   | ${"default options"}
    ${"11:58:30"} | ${{ reference: REF, largestUnit: "second" as const, numeric: "always" as const }} | ${"90秒钟前"}  | ${"largestUnit second, numeric always"}
    ${"10:00:00"} | ${{ reference: REF, largestUnit: "minute" as const, numeric: "always" as const }} | ${"120分钟前"} | ${"largestUnit minute, numeric always"}
  `(
    "formats $value for zh-CN with $label as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeTime(value, MustTestLocales.zhCN, options)).toBe(
        expected,
      );
    },
  );

  // zh-TW
  it.each`
    value         | options                                                                           | expected        | label
    ${"11:30:00"} | ${{ reference: REF }}                                                             | ${"30 分鐘前"}  | ${"default options"}
    ${"12:30:00"} | ${{ reference: REF }}                                                             | ${"30 分鐘後"}  | ${"default options"}
    ${"11:30:00"} | ${{ reference: REF, style: "short" as const }}                                    | ${"30 分鐘前"}  | ${"style short"}
    ${"11:30:00"} | ${{ reference: REF, style: "narrow" as const }}                                   | ${"30 分鐘前"}  | ${"style narrow"}
    ${"12:30:00"} | ${{ reference: REF, style: "narrow" as const }}                                   | ${"30 分鐘後"}  | ${"style narrow"}
    ${"11:59:15"} | ${{ reference: REF }}                                                             | ${"45 秒前"}    | ${"default options"}
    ${"12:00:45"} | ${{ reference: REF }}                                                             | ${"45 秒後"}    | ${"default options"}
    ${"10:00:00"} | ${{ reference: REF }}                                                             | ${"2 小時前"}   | ${"default options"}
    ${"14:00:00"} | ${{ reference: REF }}                                                             | ${"2 小時後"}   | ${"default options"}
    ${"11:58:30"} | ${{ reference: REF, largestUnit: "second" as const, numeric: "always" as const }} | ${"90 秒前"}    | ${"largestUnit second, numeric always"}
    ${"10:00:00"} | ${{ reference: REF, largestUnit: "minute" as const, numeric: "always" as const }} | ${"120 分鐘前"} | ${"largestUnit minute, numeric always"}
  `(
    "formats $value for zh-TW with $label as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeTime(value, MustTestLocales.zhTW, options)).toBe(
        expected,
      );
    },
  );

  // ja-JP
  it.each`
    value         | options                                                                           | expected      | label
    ${"11:30:00"} | ${{ reference: REF }}                                                             | ${"30 分前"}  | ${"default options"}
    ${"12:30:00"} | ${{ reference: REF }}                                                             | ${"30 分後"}  | ${"default options"}
    ${"11:30:00"} | ${{ reference: REF, style: "short" as const }}                                    | ${"30 分前"}  | ${"style short"}
    ${"11:30:00"} | ${{ reference: REF, style: "narrow" as const }}                                   | ${"30分前"}   | ${"style narrow"}
    ${"12:30:00"} | ${{ reference: REF, style: "narrow" as const }}                                   | ${"30分後"}   | ${"style narrow"}
    ${"11:59:15"} | ${{ reference: REF }}                                                             | ${"45 秒前"}  | ${"default options"}
    ${"12:00:45"} | ${{ reference: REF }}                                                             | ${"45 秒後"}  | ${"default options"}
    ${"10:00:00"} | ${{ reference: REF }}                                                             | ${"2 時間前"} | ${"default options"}
    ${"14:00:00"} | ${{ reference: REF }}                                                             | ${"2 時間後"} | ${"default options"}
    ${"11:58:30"} | ${{ reference: REF, largestUnit: "second" as const, numeric: "always" as const }} | ${"90 秒前"}  | ${"largestUnit second, numeric always"}
    ${"10:00:00"} | ${{ reference: REF, largestUnit: "minute" as const, numeric: "always" as const }} | ${"120 分前"} | ${"largestUnit minute, numeric always"}
  `(
    "formats $value for ja-JP with $label as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeTime(value, MustTestLocales.jaJP, options)).toBe(
        expected,
      );
    },
  );

  // ko-KR
  it.each`
    value         | options                                                                           | expected      | label
    ${"11:30:00"} | ${{ reference: REF }}                                                             | ${"30분 전"}  | ${"default options"}
    ${"12:30:00"} | ${{ reference: REF }}                                                             | ${"30분 후"}  | ${"default options"}
    ${"11:30:00"} | ${{ reference: REF, style: "short" as const }}                                    | ${"30분 전"}  | ${"style short"}
    ${"11:30:00"} | ${{ reference: REF, style: "narrow" as const }}                                   | ${"30분 전"}  | ${"style narrow"}
    ${"12:30:00"} | ${{ reference: REF, style: "narrow" as const }}                                   | ${"30분 후"}  | ${"style narrow"}
    ${"11:59:15"} | ${{ reference: REF }}                                                             | ${"45초 전"}  | ${"default options"}
    ${"12:00:45"} | ${{ reference: REF }}                                                             | ${"45초 후"}  | ${"default options"}
    ${"10:00:00"} | ${{ reference: REF }}                                                             | ${"2시간 전"} | ${"default options"}
    ${"14:00:00"} | ${{ reference: REF }}                                                             | ${"2시간 후"} | ${"default options"}
    ${"11:58:30"} | ${{ reference: REF, largestUnit: "second" as const, numeric: "always" as const }} | ${"90초 전"}  | ${"largestUnit second, numeric always"}
    ${"10:00:00"} | ${{ reference: REF, largestUnit: "minute" as const, numeric: "always" as const }} | ${"120분 전"} | ${"largestUnit minute, numeric always"}
  `(
    "formats $value for ko-KR with $label as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeTime(value, MustTestLocales.koKR, options)).toBe(
        expected,
      );
    },
  );

  // ar-SA
  it.each`
    value         | options                                                                           | expected           | label
    ${"11:30:00"} | ${{ reference: REF }}                                                             | ${"قبل ٣٠ دقيقة"}  | ${"default options"}
    ${"12:30:00"} | ${{ reference: REF }}                                                             | ${"خلال ٣٠ دقيقة"}  | ${"default options"}
    ${"11:30:00"} | ${{ reference: REF, style: "short" as const }}                                    | ${"قبل ٣٠ دقيقة"}  | ${"style short"}
    ${"11:30:00"} | ${{ reference: REF, style: "narrow" as const }}                                   | ${"قبل ٣٠ دقيقة"}  | ${"style narrow"}
    ${"12:30:00"} | ${{ reference: REF, style: "narrow" as const }}                                   | ${"خلال ٣٠ دقيقة"}  | ${"style narrow"}
    ${"11:59:15"} | ${{ reference: REF }}                                                             | ${"قبل ٤٥ ثانية"}  | ${"default options"}
    ${"12:00:45"} | ${{ reference: REF }}                                                             | ${"خلال ٤٥ ثانية"}  | ${"default options"}
    ${"10:00:00"} | ${{ reference: REF }}                                                             | ${"قبل ساعتين"}    | ${"default options"}
    ${"14:00:00"} | ${{ reference: REF }}                                                             | ${"خلال ساعتين"}    | ${"default options"}
    ${"11:58:30"} | ${{ reference: REF, largestUnit: "second" as const, numeric: "always" as const }} | ${"قبل ٩٠ ثانية"}  | ${"largestUnit second, numeric always"}
    ${"10:00:00"} | ${{ reference: REF, largestUnit: "minute" as const, numeric: "always" as const }} | ${"قبل ١٢٠ دقيقة"} | ${"largestUnit minute, numeric always"}
  `(
    "formats $value for ar-SA with $label as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeTime(value, MustTestLocales.arSA, options)).toBe(
        expected,
      );
    },
  );

  // he-IL
  it.each`
    value         | options                                                                           | expected           | label
    ${"11:30:00"} | ${{ reference: REF }}                                                             | ${"לפני 30 דקות"}  | ${"default options"}
    ${"12:30:00"} | ${{ reference: REF }}                                                             | ${"בעוד 30 דקות"}  | ${"default options"}
    ${"11:30:00"} | ${{ reference: REF, style: "short" as const }}                                    | ${"לפני 30 דק׳"}   | ${"style short"}
    ${"11:30:00"} | ${{ reference: REF, style: "narrow" as const }}                                   | ${"לפני 30 דק׳"}   | ${"style narrow"}
    ${"12:30:00"} | ${{ reference: REF, style: "narrow" as const }}                                   | ${"בעוד 30 דק׳"}   | ${"style narrow"}
    ${"11:59:15"} | ${{ reference: REF }}                                                             | ${"לפני 45 שניות"} | ${"default options"}
    ${"12:00:45"} | ${{ reference: REF }}                                                             | ${"בעוד 45 שניות"} | ${"default options"}
    ${"11:58:30"} | ${{ reference: REF, largestUnit: "second" as const, numeric: "always" as const }} | ${"לפני 90 שניות"} | ${"largestUnit second, numeric always"}
    ${"10:00:00"} | ${{ reference: REF, largestUnit: "minute" as const, numeric: "always" as const }} | ${"לפני 120 דקות"} | ${"largestUnit minute, numeric always"}
  `(
    "formats $value for he-IL with $label as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeTime(value, MustTestLocales.heIL, options)).toBe(
        expected,
      );
    },
  );

  // he-IL dual-form hour pluralization — CLDR started appending the
  // numeral in parentheses to the dual form ("שעתיים") starting ICU 78
  // (Node 22.23+, 24, 26); ICU 77 (Node 22.16–22.22) omits it.
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
    value         | options                                                                           | expected             | label
    ${"11:30:00"} | ${{ reference: REF }}                                                             | ${"30 минут назад"}  | ${"default options"}
    ${"12:30:00"} | ${{ reference: REF }}                                                             | ${"через 30 минут"}  | ${"default options"}
    ${"11:30:00"} | ${{ reference: REF, style: "short" as const }}                                    | ${"30 мин. назад"}   | ${"style short"}
    ${"11:30:00"} | ${{ reference: REF, style: "narrow" as const }}                                   | ${"-30 мин"}         | ${"style narrow"}
    ${"12:30:00"} | ${{ reference: REF, style: "narrow" as const }}                                   | ${"+30 мин"}         | ${"style narrow"}
    ${"11:59:15"} | ${{ reference: REF }}                                                             | ${"45 секунд назад"} | ${"default options"}
    ${"12:00:45"} | ${{ reference: REF }}                                                             | ${"через 45 секунд"} | ${"default options"}
    ${"10:00:00"} | ${{ reference: REF }}                                                             | ${"2 часа назад"}    | ${"default options"}
    ${"14:00:00"} | ${{ reference: REF }}                                                             | ${"через 2 часа"}    | ${"default options"}
    ${"11:58:30"} | ${{ reference: REF, largestUnit: "second" as const, numeric: "always" as const }} | ${"90 секунд назад"} | ${"largestUnit second, numeric always"}
    ${"10:00:00"} | ${{ reference: REF, largestUnit: "minute" as const, numeric: "always" as const }} | ${"120 минут назад"} | ${"largestUnit minute, numeric always"}
  `(
    "formats $value for ru-RU with $label as $expected",
    ({ value, options, expected }) => {
      expect(formatRelativeTime(value, MustTestLocales.ruRU, options)).toBe(
        expected,
      );
    },
  );

  // tr-TR
  it.each`
    value         | options                                                                           | expected             | label
    ${"11:30:00"} | ${{ reference: REF }}                                                             | ${"30 dakika önce"}  | ${"default options"}
    ${"12:30:00"} | ${{ reference: REF }}                                                             | ${"30 dakika sonra"} | ${"default options"}
    ${"11:30:00"} | ${{ reference: REF, style: "short" as const }}                                    | ${"30 dk. önce"}     | ${"style short"}
    ${"11:30:00"} | ${{ reference: REF, style: "narrow" as const }}                                   | ${"30 dk. önce"}     | ${"style narrow"}
    ${"12:30:00"} | ${{ reference: REF, style: "narrow" as const }}                                   | ${"30 dk. sonra"}    | ${"style narrow"}
    ${"11:59:15"} | ${{ reference: REF }}                                                             | ${"45 saniye önce"}  | ${"default options"}
    ${"12:00:45"} | ${{ reference: REF }}                                                             | ${"45 saniye sonra"} | ${"default options"}
    ${"10:00:00"} | ${{ reference: REF }}                                                             | ${"2 saat önce"}     | ${"default options"}
    ${"14:00:00"} | ${{ reference: REF }}                                                             | ${"2 saat sonra"}    | ${"default options"}
    ${"11:58:30"} | ${{ reference: REF, largestUnit: "second" as const, numeric: "always" as const }} | ${"90 saniye önce"}  | ${"largestUnit second, numeric always"}
    ${"10:00:00"} | ${{ reference: REF, largestUnit: "minute" as const, numeric: "always" as const }} | ${"120 dakika önce"} | ${"largestUnit minute, numeric always"}
  `(
    "formats $value for tr-TR with $label as $expected",
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
  // roundingMethod option
  // Controls how the fractional distance rounds to the display unit.
  // "round" (default) matches current Math.round behavior; "floor"/"ceil"
  // apply directly to the signed value, so they respect past vs. future.
  // No calendrical branch exists for PlainTime (only hour/minute/second).
  // ---------------------------------------------------------------------------
  describe("roundingMethod option", () => {
    it.each`
      value         | roundingMethod | expected
      ${"09:42:00"} | ${"floor"}     | ${"3 hours ago"}
      ${"09:42:00"} | ${"ceil"}      | ${"2 hours ago"}
      ${"09:42:00"} | ${"round"}     | ${"2 hours ago"}
      ${"14:18:00"} | ${"floor"}     | ${"in 2 hours"}
      ${"14:18:00"} | ${"ceil"}      | ${"in 3 hours"}
      ${"14:18:00"} | ${"round"}     | ${"in 2 hours"}
      ${"09:30:00"} | ${"floor"}     | ${"3 hours ago"}
      ${"09:30:00"} | ${"ceil"}      | ${"2 hours ago"}
      ${"09:30:00"} | ${"round"}     | ${"2 hours ago"}
      ${"09:00:00"} | ${"floor"}     | ${"3 hours ago"}
      ${"09:00:00"} | ${"ceil"}      | ${"3 hours ago"}
      ${"09:00:00"} | ${"round"}     | ${"3 hours ago"}
    `(
      "roundingMethod:$roundingMethod for $value → $expected",
      ({ value, roundingMethod, expected }) => {
        expect(
          formatRelativeTime(value, MustTestLocales.enUS, {
            reference: REF,
            largestUnit: "hour",
            numeric: "always",
            roundingMethod,
          }),
        ).toBe(expected);
      },
    );

    it("defaults to 'round' when roundingMethod is omitted (matches explicit 'round')", () => {
      const value = "09:00:00";
      const omitted = formatRelativeTime(value, MustTestLocales.enUS, {
        reference: REF,
      });
      const explicit = formatRelativeTime(value, MustTestLocales.enUS, {
        reference: REF,
        roundingMethod: "round",
      });
      expect(omitted).toBe("3 hours ago");
      expect(explicit).toBe(omitted);
    });

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
          formatRelativeTime("09:42:00", MustTestLocales.enUS, {
            reference: REF,
            roundingMethod,
          }),
        ).toBe("");
      },
    );

    // ECMA-402 GetOption (the Temporal specification defines the same operation): an option whose
    // value is undefined is absent, so the default applies.
    it("reads roundingMethod: undefined as the omitted option (default 'round')", () => {
      const omitted = formatRelativeTime("09:42:00", MustTestLocales.enUS, {
        reference: REF,
      });
      const explicitUndefined = formatRelativeTime(
        "09:42:00",
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
      ${"not-a-time"}          | ${"'not-a-time'"}
      ${"25:00:00"}            | ${"'25:00:00'"}
      ${"12:60:00"}            | ${"'12:60:00'"}
      ${"2024-03-15"}          | ${"'2024-03-15'"}
      ${"2024-03-15T12:00:00"} | ${"'2024-03-15T12:00:00'"}
      ${null}                  | ${"null"}
      ${undefined}             | ${"undefined"}
      ${42}                    | ${"42"}
      ${true}                  | ${"true"}
    `("returns '' for invalid value $label", ({ value }) => {
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
    it("returns '' when Temporal.Now.zonedDateTimeISO throws (no reference provided)", () => {
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

  // ECMA-402 CanonicalizeLocaleList: `locale` may be a preference list; the first tag with locale data
  // is used, and a malformed tag anywhere in the list is invalid input. Expected strings from native
  // Intl with the same list.
  it.each`
    locale                                          | expected
    ${[MustTestLocales.frFR, MustTestLocales.enUS]} | ${"il y a 2 heures"}
    ${[MustTestLocales.frFR, "not a locale!!"]}     | ${""}
  `("returns '$expected' for locale list $locale", ({ locale, expected }) => {
    expect(
      formatRelativeTime("10:00:00", locale, { reference: "12:00:00" }),
    ).toBe(expected);
  });
});

// Plan #14: options must be an object or omitted, as Temporal's GetOptionsObject requires (native
// Chromium 153 `Temporal.PlainDate.from("2024-02-03", null)`, `"x"` and `1` all throw TypeError), so
// null and every other non-object is invalid input.
describe("formatRelativeTime with non-object options", () => {
  it.each`
    options
    ${null}
    ${"long"}
    ${1}
  `("returns an empty string for options $options", ({ options }) => {
    expect(
      formatRelativeTime("10:00:00", MustTestLocales.enUS, options as never),
    ).toBe("");
  });
});

// The allowed units of `largestUnit` are the ones the option's type lists: "hour", "minute", "second", each
// singular or plural. Temporal reads a unit option with GetTemporalUnitValuedOption (a plural name
// is its singular) and then ValidateTemporalUnitValue against the unit group of the type — here
// time — which throws RangeError for a unit outside it (test262 largestunit-invalid-string.js
// for PlainDate, PlainTime, PlainDateTime, Instant and ZonedDateTime `until`). A RangeError is "".
describe("formatRelativeTime largestUnit", () => {
  // Every value is checked against the option's own type, so `tsc` fails this file if a singular
  // or a plural name leaves the `largestUnit` type. The table below takes its units from here.
  const UNIT = {
    hour: "hour",
    hours: "hours",
    minute: "minute",
    minutes: "minutes",
    second: "second",
    seconds: "seconds",
  } satisfies Record<
    string,
    NonNullable<FormatRelativeTimeOptions["largestUnit"]>
  >;

  // 10:00 is 2 hours, 120 minutes or 7,200 seconds before 12:00.
  // A plural names the same unit as its singular, so both rows of a unit expect the same text.
  it.each`
    largestUnit     | expected
    ${UNIT.hour}    | ${"2 hours ago"}
    ${UNIT.hours}   | ${"2 hours ago"}
    ${UNIT.minute}  | ${"120 minutes ago"}
    ${UNIT.minutes} | ${"120 minutes ago"}
    ${UNIT.second}  | ${"7,200 seconds ago"}
    ${UNIT.seconds} | ${"7,200 seconds ago"}
  `(
    "returns $expected for the listed unit largestUnit: $largestUnit",
    ({ largestUnit, expected }) => {
      const options: FormatRelativeTimeOptions = {
        reference: "12:00:00",
        largestUnit,
      };

      expect(
        formatRelativeTime("10:00:00", MustTestLocales.enUS, options),
      ).toBe(expected);
    },
  );

  it.each`
    label                           | largestUnit                   | why
    ${"'day'"}                      | ${"day"}                      | ${"a date unit; a time has none"}
    ${"'days'"}                     | ${"days"}                     | ${"a date unit; a time has none"}
    ${"'week'"}                     | ${"week"}                     | ${"a date unit; a time has none"}
    ${"'weeks'"}                    | ${"weeks"}                    | ${"a date unit; a time has none"}
    ${"'month'"}                    | ${"month"}                    | ${"a date unit; a time has none"}
    ${"'months'"}                   | ${"months"}                   | ${"a date unit; a time has none"}
    ${"'year'"}                     | ${"year"}                     | ${"a date unit; a time has none"}
    ${"'years'"}                    | ${"years"}                    | ${"a date unit; a time has none"}
    ${"'quarter'"}                  | ${"quarter"}                  | ${"not a unit of the function"}
    ${"'quarters'"}                 | ${"quarters"}                 | ${"not a unit of the function"}
    ${"'millisecond'"}              | ${"millisecond"}              | ${"not a unit of the function"}
    ${"'nanoseconds'"}              | ${"nanoseconds"}              | ${"not a unit of the function"}
    ${"'auto'"}                     | ${"auto"}                     | ${"not a unit of the function"}
    ${"'HOUR'"}                     | ${"HOUR"}                     | ${"unit names are lower case"}
    ${"'Hours'"}                    | ${"Hours"}                    | ${"unit names are lower case"}
    ${"''"}                         | ${""}                         | ${"an empty string"}
    ${"'x'"}                        | ${"x"}                        | ${"not a unit"}
    ${"null"}                       | ${null}                       | ${"null is a value, not an omission"}
    ${"1"}                          | ${1}                          | ${"a number"}
    ${"true"}                       | ${true}                       | ${"a boolean"}
    ${"['hour']"}                   | ${["hour"]}                   | ${"an array, not a string"}
    ${"{ toString: () => 'hour' }"} | ${{ toString: () => "hour" }} | ${"an object, not a string"}
  `(
    "returns '' for largestUnit $label outside the listed units ($why)",
    ({ largestUnit }) => {
      expect(
        formatRelativeTime("10:00:00", MustTestLocales.enUS, {
          reference: "12:00:00",
          largestUnit: largestUnit as never,
        }),
      ).toBe("");
    },
  );

  // An explicit undefined is the omitted option (GetOption), so the unit is picked from the
  // distance exactly as it is with no largestUnit at all.
  it("picks the unit from the distance for largestUnit: undefined, as when it is omitted", () => {
    const picked = formatRelativeTime("10:00:00", MustTestLocales.enUS, {
      reference: "12:00:00",
    });

    expect(picked).toBe("2 hours ago");
    expect(
      formatRelativeTime("10:00:00", MustTestLocales.enUS, {
        reference: "12:00:00",
        largestUnit: undefined,
      }),
    ).toBe(picked);
  });
});
