import {
  expectDateTimeEqual,
  expectOneOfIcu,
  MustTestLocales,
  oneOfIcu,
} from "../../test";
import { mockTemporalPlainTimeFromThrow } from "../../test/mocks";
import { formatTime } from "./formatTime";

describe("formatTime", () => {
  // en-US
  it.each`
    value         | options                                                                     | expected
    ${"14:30:45"} | ${{ timeStyle: "full" }}                                                    | ${"2:30:45 PM"}
    ${"14:30:45"} | ${{ timeStyle: "long" }}                                                    | ${"2:30:45 PM"}
    ${"14:30:45"} | ${{ timeStyle: "medium" }}                                                  | ${"2:30:45 PM"}
    ${"14:30:45"} | ${{ timeStyle: "short" }}                                                   | ${"2:30 PM"}
    ${"14:30:45"} | ${{ hour: "numeric", minute: "numeric", second: "numeric" }}                | ${"2:30:45 PM"}
    ${"14:30:45"} | ${{ hour: "numeric", minute: "numeric" }}                                   | ${"2:30 PM"}
    ${"14:30:45"} | ${{ hour: "2-digit", minute: "2-digit", second: "2-digit" }}                | ${"02:30:45 PM"}
    ${"14:30:45"} | ${{ hour: "2-digit", minute: "2-digit" }}                                   | ${"02:30 PM"}
    ${"14:30:45"} | ${{ hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }}  | ${"02:30:45 PM"}
    ${"14:30:45"} | ${{ hour: "numeric", minute: "numeric", second: "numeric", hour12: false }} | ${"14:30:45"}
  `(
    "formats valid time $value for en-US with options $options to $expected",
    ({ value, options, expected }) => {
      expect(formatTime(value, MustTestLocales.enUS, options)).toEqual(
        expected,
      );
    },
  );

  // en-GB
  it.each`
    value         | options                                                                     | expected
    ${"14:30:45"} | ${{ timeStyle: "full" }}                                                    | ${"14:30:45"}
    ${"14:30:45"} | ${{ timeStyle: "long" }}                                                    | ${"14:30:45"}
    ${"14:30:45"} | ${{ timeStyle: "medium" }}                                                  | ${"14:30:45"}
    ${"14:30:45"} | ${{ timeStyle: "short" }}                                                   | ${"14:30"}
    ${"14:30:45"} | ${{ hour: "numeric", minute: "numeric", second: "numeric" }}                | ${"14:30:45"}
    ${"14:30:45"} | ${{ hour: "numeric", minute: "numeric" }}                                   | ${"14:30"}
    ${"14:30:45"} | ${{ hour: "2-digit", minute: "2-digit", second: "2-digit" }}                | ${"14:30:45"}
    ${"14:30:45"} | ${{ hour: "2-digit", minute: "2-digit" }}                                   | ${"14:30"}
    ${"14:30:45"} | ${{ hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }}  | ${"02:30:45 pm"}
    ${"14:30:45"} | ${{ hour: "numeric", minute: "numeric", second: "numeric", hour12: false }} | ${"14:30:45"}
  `(
    "formats valid time $value for en-GB with options $options to $expected",
    ({ value, options, expected }) => {
      expect(formatTime(value, MustTestLocales.enGB, options)).toEqual(
        expected,
      );
    },
  );

  // de-DE
  it.each`
    value         | options                                                                     | expected
    ${"14:30:45"} | ${{ timeStyle: "full" }}                                                    | ${"14:30:45"}
    ${"14:30:45"} | ${{ timeStyle: "long" }}                                                    | ${"14:30:45"}
    ${"14:30:45"} | ${{ timeStyle: "medium" }}                                                  | ${"14:30:45"}
    ${"14:30:45"} | ${{ timeStyle: "short" }}                                                   | ${"14:30"}
    ${"14:30:45"} | ${{ hour: "numeric", minute: "numeric", second: "numeric" }}                | ${"14:30:45"}
    ${"14:30:45"} | ${{ hour: "numeric", minute: "numeric" }}                                   | ${"14:30"}
    ${"14:30:45"} | ${{ hour: "2-digit", minute: "2-digit", second: "2-digit" }}                | ${"14:30:45"}
    ${"14:30:45"} | ${{ hour: "2-digit", minute: "2-digit" }}                                   | ${"14:30"}
    ${"14:30:45"} | ${{ hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }}  | ${"02:30:45 PM"}
    ${"14:30:45"} | ${{ hour: "numeric", minute: "numeric", second: "numeric", hour12: false }} | ${"14:30:45"}
  `(
    "formats valid time $value for de-DE with options $options to $expected",
    ({ value, options, expected }) => {
      expect(formatTime(value, MustTestLocales.deDE, options)).toEqual(
        expected,
      );
    },
  );

  // fr-FR
  it.each`
    value         | options                                                                     | expected
    ${"14:30:45"} | ${{ timeStyle: "full" }}                                                    | ${"14:30:45"}
    ${"14:30:45"} | ${{ timeStyle: "long" }}                                                    | ${"14:30:45"}
    ${"14:30:45"} | ${{ timeStyle: "medium" }}                                                  | ${"14:30:45"}
    ${"14:30:45"} | ${{ timeStyle: "short" }}                                                   | ${"14:30"}
    ${"14:30:45"} | ${{ hour: "numeric", minute: "numeric", second: "numeric" }}                | ${"14:30:45"}
    ${"14:30:45"} | ${{ hour: "numeric", minute: "numeric" }}                                   | ${"14:30"}
    ${"14:30:45"} | ${{ hour: "2-digit", minute: "2-digit", second: "2-digit" }}                | ${"14:30:45"}
    ${"14:30:45"} | ${{ hour: "2-digit", minute: "2-digit" }}                                   | ${"14:30"}
    ${"14:30:45"} | ${{ hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }}  | ${"02:30:45 PM"}
    ${"14:30:45"} | ${{ hour: "numeric", minute: "numeric", second: "numeric", hour12: false }} | ${"14:30:45"}
  `(
    "formats valid time $value for fr-FR with options $options to $expected",
    ({ value, options, expected }) => {
      expect(formatTime(value, MustTestLocales.frFR, options)).toEqual(
        expected,
      );
    },
  );

  // es-ES
  it.each`
    value         | options                                                                     | expected
    ${"14:30:45"} | ${{ timeStyle: "full" }}                                                    | ${"14:30:45"}
    ${"14:30:45"} | ${{ timeStyle: "long" }}                                                    | ${"14:30:45"}
    ${"14:30:45"} | ${{ timeStyle: "medium" }}                                                  | ${"14:30:45"}
    ${"14:30:45"} | ${{ timeStyle: "short" }}                                                   | ${"14:30"}
    ${"14:30:45"} | ${{ hour: "numeric", minute: "numeric", second: "numeric" }}                | ${"14:30:45"}
    ${"14:30:45"} | ${{ hour: "numeric", minute: "numeric" }}                                   | ${"14:30"}
    ${"14:30:45"} | ${{ hour: "2-digit", minute: "2-digit", second: "2-digit" }}                | ${"14:30:45"}
    ${"14:30:45"} | ${{ hour: "2-digit", minute: "2-digit" }}                                   | ${"14:30"}
    ${"14:30:45"} | ${{ hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }}  | ${"02:30:45 p. m."}
    ${"14:30:45"} | ${{ hour: "numeric", minute: "numeric", second: "numeric", hour12: false }} | ${"14:30:45"}
  `(
    "formats valid time $value for es-ES with options $options to $expected",
    ({ value, options, expected }) => {
      expect(formatTime(value, MustTestLocales.esES, options)).toEqual(
        expected,
      );
    },
  );

  // it-IT
  it.each`
    value         | options                                                                     | expected
    ${"14:30:45"} | ${{ timeStyle: "full" }}                                                    | ${"14:30:45"}
    ${"14:30:45"} | ${{ timeStyle: "long" }}                                                    | ${"14:30:45"}
    ${"14:30:45"} | ${{ timeStyle: "medium" }}                                                  | ${"14:30:45"}
    ${"14:30:45"} | ${{ timeStyle: "short" }}                                                   | ${"14:30"}
    ${"14:30:45"} | ${{ hour: "numeric", minute: "numeric", second: "numeric" }}                | ${"14:30:45"}
    ${"14:30:45"} | ${{ hour: "numeric", minute: "numeric" }}                                   | ${"14:30"}
    ${"14:30:45"} | ${{ hour: "2-digit", minute: "2-digit", second: "2-digit" }}                | ${"14:30:45"}
    ${"14:30:45"} | ${{ hour: "2-digit", minute: "2-digit" }}                                   | ${"14:30"}
    ${"14:30:45"} | ${{ hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }}  | ${"02:30:45 PM"}
    ${"14:30:45"} | ${{ hour: "numeric", minute: "numeric", second: "numeric", hour12: false }} | ${"14:30:45"}
  `(
    "formats valid time $value for it-IT with options $options to $expected",
    ({ value, options, expected }) => {
      expect(formatTime(value, MustTestLocales.itIT, options)).toEqual(
        expected,
      );
    },
  );

  // pt-PT
  it.each`
    value         | options                                                                     | expected
    ${"14:30:45"} | ${{ timeStyle: "full" }}                                                    | ${"14:30:45"}
    ${"14:30:45"} | ${{ timeStyle: "long" }}                                                    | ${"14:30:45"}
    ${"14:30:45"} | ${{ timeStyle: "medium" }}                                                  | ${"14:30:45"}
    ${"14:30:45"} | ${{ timeStyle: "short" }}                                                   | ${"14:30"}
    ${"14:30:45"} | ${{ hour: "numeric", minute: "numeric", second: "numeric" }}                | ${"14:30:45"}
    ${"14:30:45"} | ${{ hour: "numeric", minute: "numeric" }}                                   | ${"14:30"}
    ${"14:30:45"} | ${{ hour: "2-digit", minute: "2-digit", second: "2-digit" }}                | ${"14:30:45"}
    ${"14:30:45"} | ${{ hour: "2-digit", minute: "2-digit" }}                                   | ${"14:30"}
    ${"14:30:45"} | ${{ hour: "numeric", minute: "numeric", second: "numeric", hour12: false }} | ${"14:30:45"}
  `(
    "formats valid time $value for pt-PT with options $options to $expected",
    ({ value, options, expected }) => {
      expect(formatTime(value, MustTestLocales.ptPT, options)).toEqual(
        expected,
      );
    },
  );

  // pt-PT 12-hour day period — CLDR changed the wording from "da tarde"
  // (ICU 77 / Node 22.16–22.22) to "p.m." (ICU 78 / Node 22.23+, 24, 26).
  it("formats valid time 14:30:45 for pt-PT with 12-hour day period (CLDR wording varies by ICU version)", () => {
    expectOneOfIcu(
      formatTime("14:30:45", MustTestLocales.ptPT, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      }),
      oneOfIcu("02:30:45 da tarde", "02:30:45 p.m."),
    );
  });

  // sv-SE
  it.each`
    value         | options                                                                     | expected
    ${"14:30:45"} | ${{ timeStyle: "full" }}                                                    | ${"14:30:45"}
    ${"14:30:45"} | ${{ timeStyle: "long" }}                                                    | ${"14:30:45"}
    ${"14:30:45"} | ${{ timeStyle: "medium" }}                                                  | ${"14:30:45"}
    ${"14:30:45"} | ${{ timeStyle: "short" }}                                                   | ${"14:30"}
    ${"14:30:45"} | ${{ hour: "numeric", minute: "numeric", second: "numeric" }}                | ${"14:30:45"}
    ${"14:30:45"} | ${{ hour: "numeric", minute: "numeric" }}                                   | ${"14:30"}
    ${"14:30:45"} | ${{ hour: "2-digit", minute: "2-digit", second: "2-digit" }}                | ${"14:30:45"}
    ${"14:30:45"} | ${{ hour: "2-digit", minute: "2-digit" }}                                   | ${"14:30"}
    ${"14:30:45"} | ${{ hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }}  | ${"02:30:45 em"}
    ${"14:30:45"} | ${{ hour: "numeric", minute: "numeric", second: "numeric", hour12: false }} | ${"14:30:45"}
  `(
    "formats valid time $value for sv-SE with options $options to $expected",
    ({ value, options, expected }) => {
      expect(formatTime(value, MustTestLocales.svSE, options)).toEqual(
        expected,
      );
    },
  );

  // is-IS
  it.each`
    value         | options                                                                     | expected
    ${"14:30:45"} | ${{ timeStyle: "full" }}                                                    | ${"14:30:45"}
    ${"14:30:45"} | ${{ timeStyle: "long" }}                                                    | ${"14:30:45"}
    ${"14:30:45"} | ${{ timeStyle: "medium" }}                                                  | ${"14:30:45"}
    ${"14:30:45"} | ${{ timeStyle: "short" }}                                                   | ${"14:30"}
    ${"14:30:45"} | ${{ hour: "numeric", minute: "numeric", second: "numeric" }}                | ${"14:30:45"}
    ${"14:30:45"} | ${{ hour: "numeric", minute: "numeric" }}                                   | ${"14:30"}
    ${"14:30:45"} | ${{ hour: "2-digit", minute: "2-digit", second: "2-digit" }}                | ${"14:30:45"}
    ${"14:30:45"} | ${{ hour: "2-digit", minute: "2-digit" }}                                   | ${"14:30"}
    ${"14:30:45"} | ${{ hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }}  | ${"02:30:45 e.h."}
    ${"14:30:45"} | ${{ hour: "numeric", minute: "numeric", second: "numeric", hour12: false }} | ${"14:30:45"}
  `(
    "formats valid time $value for is-IS with options $options to $expected",
    ({ value, options, expected }) => {
      expect(formatTime(value, MustTestLocales.isIS, options)).toEqual(
        expected,
      );
    },
  );

  // zh-CN
  it.each`
    value         | options                                                                     | expected
    ${"14:30:45"} | ${{ timeStyle: "full" }}                                                    | ${"14:30:45"}
    ${"14:30:45"} | ${{ timeStyle: "long" }}                                                    | ${"14:30:45"}
    ${"14:30:45"} | ${{ timeStyle: "medium" }}                                                  | ${"14:30:45"}
    ${"14:30:45"} | ${{ timeStyle: "short" }}                                                   | ${"14:30"}
    ${"14:30:45"} | ${{ hour: "numeric", minute: "numeric", second: "numeric" }}                | ${"14:30:45"}
    ${"14:30:45"} | ${{ hour: "numeric", minute: "numeric" }}                                   | ${"14:30"}
    ${"14:30:45"} | ${{ hour: "2-digit", minute: "2-digit", second: "2-digit" }}                | ${"14:30:45"}
    ${"14:30:45"} | ${{ hour: "2-digit", minute: "2-digit" }}                                   | ${"14:30"}
    ${"14:30:45"} | ${{ hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }}  | ${"下午02:30:45"}
    ${"14:30:45"} | ${{ hour: "numeric", minute: "numeric", second: "numeric", hour12: false }} | ${"14:30:45"}
  `(
    "formats valid time $value for zh-CN with options $options to $expected",
    ({ value, options, expected }) => {
      expectDateTimeEqual(
        formatTime(value, MustTestLocales.zhCN, options),
        expected,
      );
    },
  );

  // zh-TW
  it.each`
    value         | options                                                                     | expected
    ${"14:30:45"} | ${{ timeStyle: "full" }}                                                    | ${"下午2:30:45"}
    ${"14:30:45"} | ${{ timeStyle: "long" }}                                                    | ${"下午2:30:45"}
    ${"14:30:45"} | ${{ timeStyle: "medium" }}                                                  | ${"下午2:30:45"}
    ${"14:30:45"} | ${{ timeStyle: "short" }}                                                   | ${"下午2:30"}
    ${"14:30:45"} | ${{ hour: "numeric", minute: "numeric", second: "numeric" }}                | ${"下午2:30:45"}
    ${"14:30:45"} | ${{ hour: "numeric", minute: "numeric" }}                                   | ${"下午2:30"}
    ${"14:30:45"} | ${{ hour: "2-digit", minute: "2-digit", second: "2-digit" }}                | ${"下午02:30:45"}
    ${"14:30:45"} | ${{ hour: "2-digit", minute: "2-digit" }}                                   | ${"下午02:30"}
    ${"14:30:45"} | ${{ hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }}  | ${"下午02:30:45"}
    ${"14:30:45"} | ${{ hour: "numeric", minute: "numeric", second: "numeric", hour12: false }} | ${"14:30:45"}
  `(
    "formats valid time $value for zh-TW with options $options to $expected",
    ({ value, options, expected }) => {
      expectDateTimeEqual(
        formatTime(value, MustTestLocales.zhTW, options),
        expected,
      );
    },
  );

  // ja-JP
  it.each`
    value         | options                                                                     | expected
    ${"14:30:45"} | ${{ timeStyle: "full" }}                                                    | ${"14:30:45"}
    ${"14:30:45"} | ${{ timeStyle: "long" }}                                                    | ${"14:30:45"}
    ${"14:30:45"} | ${{ timeStyle: "medium" }}                                                  | ${"14:30:45"}
    ${"14:30:45"} | ${{ timeStyle: "short" }}                                                   | ${"14:30"}
    ${"14:30:45"} | ${{ hour: "numeric", minute: "numeric", second: "numeric" }}                | ${"14:30:45"}
    ${"14:30:45"} | ${{ hour: "numeric", minute: "numeric" }}                                   | ${"14:30"}
    ${"14:30:45"} | ${{ hour: "2-digit", minute: "2-digit", second: "2-digit" }}                | ${"14:30:45"}
    ${"14:30:45"} | ${{ hour: "2-digit", minute: "2-digit" }}                                   | ${"14:30"}
    ${"14:30:45"} | ${{ hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }}  | ${"午後02:30:45"}
    ${"14:30:45"} | ${{ hour: "numeric", minute: "numeric", second: "numeric", hour12: false }} | ${"14:30:45"}
  `(
    "formats valid time $value for ja-JP with options $options to $expected",
    ({ value, options, expected }) => {
      expectDateTimeEqual(
        formatTime(value, MustTestLocales.jaJP, options),
        expected,
      );
    },
  );

  // ko-KR
  it.each`
    value         | options                                                                     | expected
    ${"14:30:45"} | ${{ timeStyle: "full" }}                                                    | ${"오후 2:30:45"}
    ${"14:30:45"} | ${{ timeStyle: "long" }}                                                    | ${"오후 2:30:45"}
    ${"14:30:45"} | ${{ timeStyle: "medium" }}                                                  | ${"오후 2:30:45"}
    ${"14:30:45"} | ${{ timeStyle: "short" }}                                                   | ${"오후 2:30"}
    ${"14:30:45"} | ${{ hour: "numeric", minute: "numeric", second: "numeric" }}                | ${"오후 2:30:45"}
    ${"14:30:45"} | ${{ hour: "numeric", minute: "numeric" }}                                   | ${"오후 2:30"}
    ${"14:30:45"} | ${{ hour: "2-digit", minute: "2-digit", second: "2-digit" }}                | ${"오후 02:30:45"}
    ${"14:30:45"} | ${{ hour: "2-digit", minute: "2-digit" }}                                   | ${"오후 02:30"}
    ${"14:30:45"} | ${{ hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }}  | ${"오후 02:30:45"}
    ${"14:30:45"} | ${{ hour: "numeric", minute: "numeric", second: "numeric", hour12: false }} | ${"14시 30분 45초"}
  `(
    "formats valid time $value for ko-KR with options $options to $expected",
    ({ value, options, expected }) => {
      expectDateTimeEqual(
        formatTime(value, MustTestLocales.koKR, options),
        expected,
      );
    },
  );

  // ar-SA
  it.each`
    value         | options                                                                     | expected
    ${"14:30:45"} | ${{ timeStyle: "full" }}                                                    | ${"٢:٣٠:٤٥ م"}
    ${"14:30:45"} | ${{ timeStyle: "long" }}                                                    | ${"٢:٣٠:٤٥ م"}
    ${"14:30:45"} | ${{ timeStyle: "medium" }}                                                  | ${"٢:٣٠:٤٥ م"}
    ${"14:30:45"} | ${{ timeStyle: "short" }}                                                   | ${"٢:٣٠ م"}
    ${"14:30:45"} | ${{ hour: "numeric", minute: "numeric", second: "numeric" }}                | ${"٢:٣٠:٤٥ م"}
    ${"14:30:45"} | ${{ hour: "numeric", minute: "numeric" }}                                   | ${"٢:٣٠ م"}
    ${"14:30:45"} | ${{ hour: "2-digit", minute: "2-digit", second: "2-digit" }}                | ${"٠٢:٣٠:٤٥ م"}
    ${"14:30:45"} | ${{ hour: "2-digit", minute: "2-digit" }}                                   | ${"٠٢:٣٠ م"}
    ${"14:30:45"} | ${{ hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }}  | ${"٠٢:٣٠:٤٥ م"}
    ${"14:30:45"} | ${{ hour: "numeric", minute: "numeric", second: "numeric", hour12: false }} | ${"١٤:٣٠:٤٥"}
  `(
    "formats valid time $value for ar-SA with options $options to $expected",
    ({ value, options, expected }) => {
      expect(formatTime(value, MustTestLocales.arSA, options)).toEqual(
        expected,
      );
    },
  );

  // he-IL
  it.each`
    value         | options                                                                     | expected
    ${"14:30:45"} | ${{ timeStyle: "full" }}                                                    | ${"14:30:45"}
    ${"14:30:45"} | ${{ timeStyle: "long" }}                                                    | ${"14:30:45"}
    ${"14:30:45"} | ${{ timeStyle: "medium" }}                                                  | ${"14:30:45"}
    ${"14:30:45"} | ${{ timeStyle: "short" }}                                                   | ${"14:30"}
    ${"14:30:45"} | ${{ hour: "numeric", minute: "numeric", second: "numeric" }}                | ${"14:30:45"}
    ${"14:30:45"} | ${{ hour: "numeric", minute: "numeric" }}                                   | ${"14:30"}
    ${"14:30:45"} | ${{ hour: "2-digit", minute: "2-digit", second: "2-digit" }}                | ${"14:30:45"}
    ${"14:30:45"} | ${{ hour: "2-digit", minute: "2-digit" }}                                   | ${"14:30"}
    ${"14:30:45"} | ${{ hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }}  | ${"02:30:45 PM"}
    ${"14:30:45"} | ${{ hour: "numeric", minute: "numeric", second: "numeric", hour12: false }} | ${"14:30:45"}
  `(
    "formats valid time $value for he-IL with options $options to $expected",
    ({ value, options, expected }) => {
      expect(formatTime(value, MustTestLocales.heIL, options)).toEqual(
        expected,
      );
    },
  );

  // ru-RU
  it.each`
    value         | options                                                                     | expected
    ${"14:30:45"} | ${{ timeStyle: "full" }}                                                    | ${"14:30:45"}
    ${"14:30:45"} | ${{ timeStyle: "long" }}                                                    | ${"14:30:45"}
    ${"14:30:45"} | ${{ timeStyle: "medium" }}                                                  | ${"14:30:45"}
    ${"14:30:45"} | ${{ timeStyle: "short" }}                                                   | ${"14:30"}
    ${"14:30:45"} | ${{ hour: "numeric", minute: "numeric", second: "numeric" }}                | ${"14:30:45"}
    ${"14:30:45"} | ${{ hour: "numeric", minute: "numeric" }}                                   | ${"14:30"}
    ${"14:30:45"} | ${{ hour: "2-digit", minute: "2-digit", second: "2-digit" }}                | ${"14:30:45"}
    ${"14:30:45"} | ${{ hour: "2-digit", minute: "2-digit" }}                                   | ${"14:30"}
    ${"14:30:45"} | ${{ hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }}  | ${"02:30:45 PM"}
    ${"14:30:45"} | ${{ hour: "numeric", minute: "numeric", second: "numeric", hour12: false }} | ${"14:30:45"}
  `(
    "formats valid time $value for ru-RU with options $options to $expected",
    ({ value, options, expected }) => {
      expect(formatTime(value, MustTestLocales.ruRU, options)).toEqual(
        expected,
      );
    },
  );

  // tr-TR
  it.each`
    value         | options                                                                     | expected
    ${"14:30:45"} | ${{ timeStyle: "full" }}                                                    | ${"14:30:45"}
    ${"14:30:45"} | ${{ timeStyle: "long" }}                                                    | ${"14:30:45"}
    ${"14:30:45"} | ${{ timeStyle: "medium" }}                                                  | ${"14:30:45"}
    ${"14:30:45"} | ${{ timeStyle: "short" }}                                                   | ${"14:30"}
    ${"14:30:45"} | ${{ hour: "numeric", minute: "numeric", second: "numeric" }}                | ${"14:30:45"}
    ${"14:30:45"} | ${{ hour: "numeric", minute: "numeric" }}                                   | ${"14:30"}
    ${"14:30:45"} | ${{ hour: "2-digit", minute: "2-digit", second: "2-digit" }}                | ${"14:30:45"}
    ${"14:30:45"} | ${{ hour: "2-digit", minute: "2-digit" }}                                   | ${"14:30"}
    ${"14:30:45"} | ${{ hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }}  | ${"ÖS 02:30:45"}
    ${"14:30:45"} | ${{ hour: "numeric", minute: "numeric", second: "numeric", hour12: false }} | ${"14:30:45"}
  `(
    "formats valid time $value for tr-TR with options $options to $expected",
    ({ value, options, expected }) => {
      expect(formatTime(value, MustTestLocales.trTR, options)).toEqual(
        expected,
      );
    },
  );

  it.each`
    value             | locale     | options
    ${"14:30:45.123"} | ${"en-GB"} | ${{ hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }}
  `("formats edge case time $value", ({ value, locale, options }) => {
    expect(formatTime(value, locale, options)).not.toBe("");
  });

  // Temporal ECMA-402 PlainTime format (CreateDateTimeFormat ~time~, ~time~;
  // GetDateTimeFormat inherit ~relevant~): `era` and `timeZoneName` are not
  // inherited, so the hour/minute/second defaults apply (test262
  // intl402/Temporal/PlainTime/prototype/toLocaleString/era.js), and a
  // `dateStyle` is a TypeError (…/datestyle-and-timestyle.js). Expected
  // values: native Intl.DateTimeFormat at UTC with the adjusted options.
  it.each`
    options                                       | expected        | reason
    ${{ era: "long" }}                            | ${"2:30:45 PM"} | ${"era is not inherited, defaults apply"}
    ${{ timeZoneName: "long" }}                   | ${"2:30:45 PM"} | ${"timeZoneName is not inherited, defaults apply"}
    ${{ hour: "numeric", era: "long" }}           | ${"2 PM"}       | ${"era dropped beside a time field"}
    ${{ dateStyle: "short", timeStyle: "short" }} | ${""}           | ${"dateStyle on a PlainTime is a TypeError"}
    ${{ dateStyle: "short" }}                     | ${""}           | ${"dateStyle on a PlainTime is a TypeError"}
    ${{ timeStyle: "short" }}                     | ${"2:30 PM"}    | ${"only the style that applies gives the pre-1.16.0 text"}
    ${{ timeStyle: "full" }}                      | ${"2:30:45 PM"} | ${"zone field removed from the full time style"}
    ${{ year: "numeric" }}                        | ${""}           | ${"only date fields: no PlainTime format"}
  `(
    "formats 14:30:45.123 in en-US with $options to $expected ($reason)",
    ({ options, expected }) => {
      expect(formatTime("14:30:45.123", MustTestLocales.enUS, options)).toBe(
        expected,
      );
    },
  );

  it.each`
    invalidValue
    ${"not-a-time"}
    ${"24:00:00"}
    ${"2024-02-29T14:30:45"}
    ${""}
    ${null}
    ${undefined}
    ${true}
  `(
    "returns an empty string for invalid time $invalidValue",
    ({ invalidValue }) => {
      expect(formatTime(invalidValue as never)).toBe("");
    },
  );

  it("returns empty string on failure", () => {
    mockTemporalPlainTimeFromThrow();
    const result = formatTime("00:00:00");
    expect(result).toBe("");
  });

  // ECMA-402 CanonicalizeLocaleList: `locale` may be a preference list; the first tag with locale data
  // is used, and a malformed tag anywhere in the list is invalid input. Expected strings from native
  // Intl with the same list.
  it.each`
    locale                                          | expected
    ${[MustTestLocales.frFR, MustTestLocales.enUS]} | ${"14:30"}
    ${[MustTestLocales.frFR, "not a locale!!"]}     | ${""}
  `("returns $expected for locale list $locale", ({ locale, expected }) => {
    expect(
      formatTime("14:30:45", locale, { hour: "2-digit", minute: "2-digit" }),
    ).toBe(expected);
  });
});

// Plan #14: ECMA-402 CoerceOptionsToObject throws TypeError for null options and wraps any other
// primitive with ToObject, which carries no formatting fields, so a string or number formats with
// the defaults. Expected strings from native Chromium 153 (`toLocaleString("en-US", 1)` and
// `new Intl.DateTimeFormat("en-US", null)`, which throws).
describe("formatTime with primitive options", () => {
  it.each`
    options   | expected
    ${null}   | ${""}
    ${"long"} | ${"2:30:00 PM"}
    ${1}      | ${"2:30:00 PM"}
  `("returns $expected for options $options", ({ options, expected }) => {
    expect(formatTime("14:30:00", MustTestLocales.enUS, options as never)).toBe(
      expected,
    );
  });
});

// ECMA-402 GetOption step 1 is Get(options, property), which follows the prototype chain, so an
// inherited option is read exactly as the same option held as an own property. Here 20:05:00 with a
// 2-digit hour and minute on the 24-hour cycle is 20:05.
describe("formatTime with inherited options", () => {
  it.each`
    label          | options
    ${"own"}       | ${{ hour: "2-digit", minute: "2-digit", hourCycle: "h23" }}
    ${"inherited"} | ${Object.create({ hour: "2-digit", minute: "2-digit", hourCycle: "h23" })}
  `(
    "formats with $label options { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }, an inherited option being read like an own one",
    ({ options }) => {
      expect(formatTime("20:05:00", "en-US", options)).toBe("20:05");
    },
  );
});

// ECMA-402 GetOption converts an option to a string once (ToString, step 2 after the one Get), so
// an object option is asked for its value once and that answer is both checked and used: 20:05:00
// with a 2-digit hour in en-US is "08:05 PM"; a second ToString would answer "numeric" and print
// "8:05 PM".
describe("formatTime with an option that is an object", () => {
  it("calls hour.toString() once and formats with its first answer, 2-digit", () => {
    let coercions = 0;
    const hour = {
      toString() {
        coercions += 1;
        return coercions === 1 ? "2-digit" : "numeric";
      },
    };
    const out = formatTime("20:05:00", "en-US", {
      hour,
      minute: "2-digit",
    } as never);
    expect({ out, coercions }).toEqual({ out: "08:05 PM", coercions: 1 });
  });
});

// A plain time has no zone, so a "long" timeStyle is written without one (AdjustDateTimeStyleFormat
// removes the zone field): 20:05:00 in en-US is "8:05:00 PM". The option is converted to the
// string "long" before it is looked at, so a String object is treated as the string it holds;
// 1.17 compared the object itself, missed, and wrote "8:05:00 PM UTC".
describe("formatTime with a timeStyle that is a String object", () => {
  it('formats 20:05:00 with timeStyle new String("long") as 8:05:00 PM, with no zone name', () => {
    expect(
      formatTime("20:05:00", "en-US", {
        timeStyle: new String("long"),
      } as never),
    ).toBe("8:05:00 PM");
  });
});
