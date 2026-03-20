import { MustTestLocales } from "../../test/localeMatrix";
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
    ${"14:30:45"} | ${{ hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }}  | ${"02:30:45 p.m."}
    ${"14:30:45"} | ${{ hour: "numeric", minute: "numeric", second: "numeric", hour12: false }} | ${"14:30:45"}
  `(
    "formats valid time $value for pt-PT with options $options to $expected",
    ({ value, options, expected }) => {
      expect(formatTime(value, MustTestLocales.ptPT, options)).toEqual(
        expected,
      );
    },
  );

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
      expect(formatTime(value, MustTestLocales.zhCN, options)).toEqual(
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
      expect(formatTime(value, MustTestLocales.zhTW, options)).toEqual(
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
      expect(formatTime(value, MustTestLocales.jaJP, options)).toEqual(
        expected,
      );
    },
  );

  // ko-KR
  it.each`
    value         | options                                                                     | expected
    ${"14:30:45"} | ${{ timeStyle: "full" }}                                                    | ${"PM 2:30:45"}
    ${"14:30:45"} | ${{ timeStyle: "long" }}                                                    | ${"PM 2:30:45"}
    ${"14:30:45"} | ${{ timeStyle: "medium" }}                                                  | ${"PM 2:30:45"}
    ${"14:30:45"} | ${{ timeStyle: "short" }}                                                   | ${"PM 2:30"}
    ${"14:30:45"} | ${{ hour: "numeric", minute: "numeric", second: "numeric" }}                | ${"PM 2:30:45"}
    ${"14:30:45"} | ${{ hour: "numeric", minute: "numeric" }}                                   | ${"PM 2:30"}
    ${"14:30:45"} | ${{ hour: "2-digit", minute: "2-digit", second: "2-digit" }}                | ${"PM 02:30:45"}
    ${"14:30:45"} | ${{ hour: "2-digit", minute: "2-digit" }}                                   | ${"PM 02:30"}
    ${"14:30:45"} | ${{ hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }}  | ${"PM 02:30:45"}
    ${"14:30:45"} | ${{ hour: "numeric", minute: "numeric", second: "numeric", hour12: false }} | ${"14시 30분 45초"}
  `(
    "formats valid time $value for ko-KR with options $options to $expected",
    ({ value, options, expected }) => {
      expect(formatTime(value, MustTestLocales.koKR, options)).toEqual(
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
});
