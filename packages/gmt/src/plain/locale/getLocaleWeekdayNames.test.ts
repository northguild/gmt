import { describe, expect, it } from "vitest";
import { MustTestLocales } from "../../test";
import { getLocaleWeekdayNames } from "./getLocaleWeekdayNames";

describe("getLocaleWeekdayNames", () => {
  it.each`
    locale                  | long                                                                                                      | short                                                                     | narrow
    ${MustTestLocales.enUS} | ${["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]}                         | ${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]}                      | ${["S", "M", "T", "W", "T", "F", "S"]}
    ${MustTestLocales.enGB} | ${["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]}                         | ${["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]}                      | ${["M", "T", "W", "T", "F", "S", "S"]}
    ${MustTestLocales.deDE} | ${["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"]}                      | ${["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]}                             | ${["M", "D", "M", "D", "F", "S", "S"]}
    ${MustTestLocales.frFR} | ${["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"]}                              | ${["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."]}               | ${["L", "M", "M", "J", "V", "S", "D"]}
    ${MustTestLocales.esES} | ${["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]}                             | ${["lun", "mar", "mié", "jue", "vie", "sáb", "dom"]}                      | ${["L", "M", "X", "J", "V", "S", "D"]}
    ${MustTestLocales.itIT} | ${["lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato", "domenica"]}                         | ${["lun", "mar", "mer", "gio", "ven", "sab", "dom"]}                      | ${["L", "M", "M", "G", "V", "S", "D"]}
    ${MustTestLocales.ptPT} | ${["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"]}   | ${["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"]} | ${["D", "S", "T", "Q", "Q", "S", "S"]}
    ${MustTestLocales.svSE} | ${["måndag", "tisdag", "onsdag", "torsdag", "fredag", "lördag", "söndag"]}                                | ${["mån", "tis", "ons", "tors", "fre", "lör", "sön"]}                     | ${["M", "T", "O", "T", "F", "L", "S"]}
    ${MustTestLocales.isIS} | ${["sunnudagur", "mánudagur", "þriðjudagur", "miðvikudagur", "fimmtudagur", "föstudagur", "laugardagur"]} | ${["sun.", "mán.", "þri.", "mið.", "fim.", "fös.", "lau."]}               | ${["S", "M", "Þ", "M", "F", "F", "L"]}
    ${MustTestLocales.zhCN} | ${["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"]}                                 | ${["周一", "周二", "周三", "周四", "周五", "周六", "周日"]}               | ${["一", "二", "三", "四", "五", "六", "日"]}
    ${MustTestLocales.zhTW} | ${["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"]}                                 | ${["週日", "週一", "週二", "週三", "週四", "週五", "週六"]}               | ${["日", "一", "二", "三", "四", "五", "六"]}
    ${MustTestLocales.jaJP} | ${["日曜日", "月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日"]}                                 | ${["日", "月", "火", "水", "木", "金", "土"]}                             | ${["日", "月", "火", "水", "木", "金", "土"]}
    ${MustTestLocales.koKR} | ${["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"]}                                 | ${["일", "월", "화", "수", "목", "금", "토"]}                             | ${["일", "월", "화", "수", "목", "금", "토"]}
    ${MustTestLocales.arSA} | ${["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"]}                                  | ${["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"]}  | ${["ح", "ن", "ث", "ر", "خ", "ج", "س"]}
    ${MustTestLocales.heIL} | ${["יום ראשון", "יום שני", "יום שלישי", "יום רביעי", "יום חמישי", "יום שישי", "יום שבת"]}                 | ${["יום א׳", "יום ב׳", "יום ג׳", "יום ד׳", "יום ה׳", "יום ו׳", "שבת"]}    | ${["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"]}
    ${MustTestLocales.ruRU} | ${["понедельник", "вторник", "среда", "четверг", "пятница", "суббота", "воскресенье"]}                    | ${["пн", "вт", "ср", "чт", "пт", "сб", "вс"]}                             | ${["П", "В", "С", "Ч", "П", "С", "В"]}
    ${MustTestLocales.trTR} | ${["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"]}                            | ${["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"]}                      | ${["P", "S", "Ç", "P", "C", "C", "P"]}
  `(
    "returns 7 weekday names (long/short/narrow) for $locale in locale-first-day order",
    ({ locale, long, short, narrow }) => {
      expect(getLocaleWeekdayNames(locale)).toEqual(long);
      expect(getLocaleWeekdayNames(locale, "long")).toEqual(long);
      expect(getLocaleWeekdayNames(locale, "short")).toEqual(short);
      expect(getLocaleWeekdayNames(locale, "narrow")).toEqual(narrow);
    },
  );

  it("starts with the locale's first day of the week", () => {
    expect(getLocaleWeekdayNames(MustTestLocales.enUS)[0]).toBe("Sunday");
    expect(getLocaleWeekdayNames(MustTestLocales.frFR)[0]).toBe("lundi");
    expect(getLocaleWeekdayNames(MustTestLocales.arSA)[0]).toBe("الأحد");
  });

  it("returns an empty array for invalid locales", () => {
    expect(getLocaleWeekdayNames("")).toEqual([]);
    expect(getLocaleWeekdayNames("!!!")).toEqual([]);
    expect(getLocaleWeekdayNames(123 as unknown as string)).toEqual([]);
  });

  it("always returns exactly 7 names that are a permutation of the locale's ISO weekday set", () => {
    for (const locale of Object.values(MustTestLocales)) {
      const names = getLocaleWeekdayNames(locale);
      expect(names).toHaveLength(7);
      const iso = getLocaleWeekdayNames(locale, "long");
      expect(new Set(names)).toEqual(new Set(iso));
    }
  });
});
