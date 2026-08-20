import { describe, expect, it } from "vitest";
import { MustTestLocales } from "../../test";
import { getLocaleMonthNames } from "./getLocaleMonthNames";

describe("getLocaleMonthNames", () => {
  it.each`
    locale                  | long                                                                                                                                  | short                                                                                                              | narrow
    ${MustTestLocales.enUS} | ${["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]}         | ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]}                            | ${["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"]}
    ${MustTestLocales.enGB} | ${["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]}         | ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"]}                           | ${["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"]}
    ${MustTestLocales.deDE} | ${["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"]}            | ${["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"]}                            | ${["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"]}
    ${MustTestLocales.frFR} | ${["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"]}          | ${["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."]}             | ${["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"]}
    ${MustTestLocales.esES} | ${["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]}      | ${["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"]}                           | ${["E", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"]}
    ${MustTestLocales.itIT} | ${["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"]} | ${["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"]}                            | ${["G", "F", "M", "A", "M", "G", "L", "A", "S", "O", "N", "D"]}
    ${MustTestLocales.ptPT} | ${["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"]}      | ${["jan.", "fev.", "mar.", "abr.", "mai.", "jun.", "jul.", "ago.", "set.", "out.", "nov.", "dez."]}                | ${["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"]}
    ${MustTestLocales.svSE} | ${["januari", "februari", "mars", "april", "maj", "juni", "juli", "augusti", "september", "oktober", "november", "december"]}         | ${["jan.", "feb.", "mars", "apr.", "maj", "juni", "juli", "aug.", "sep.", "okt.", "nov.", "dec."]}                 | ${["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"]}
    ${MustTestLocales.isIS} | ${["janúar", "febrúar", "mars", "apríl", "maí", "júní", "júlí", "ágúst", "september", "október", "nóvember", "desember"]}             | ${["jan.", "feb.", "mar.", "apr.", "maí", "jún.", "júl.", "ágú.", "sep.", "okt.", "nóv.", "des."]}                 | ${["J", "F", "M", "A", "M", "J", "J", "Á", "S", "O", "N", "D"]}
    ${MustTestLocales.zhCN} | ${["一月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"]}                               | ${["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"]}                         | ${["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"]}
    ${MustTestLocales.zhTW} | ${["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"]}                                            | ${["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"]}                         | ${["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"]}
    ${MustTestLocales.jaJP} | ${["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"]}                                            | ${["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"]}                         | ${["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"]}
    ${MustTestLocales.koKR} | ${["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"]}                                            | ${["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"]}                         | ${["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"]}
    ${MustTestLocales.arSA} | ${["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"]}                    | ${["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"]} | ${["ي", "ف", "م", "أ", "و", "ن", "ل", "غ", "س", "ك", "ب", "د"]}
    ${MustTestLocales.heIL} | ${["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"]}                       | ${["ינו׳", "פבר׳", "מרץ", "אפר׳", "מאי", "יוני", "יולי", "אוג׳", "ספט׳", "אוק׳", "נוב׳", "דצמ׳"]}                  | ${["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"]}
    ${MustTestLocales.ruRU} | ${["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"]}               | ${["янв.", "февр.", "март", "апр.", "май", "июнь", "июль", "авг.", "сент.", "окт.", "нояб.", "дек."]}              | ${["Я", "Ф", "М", "А", "М", "И", "И", "А", "С", "О", "Н", "Д"]}
    ${MustTestLocales.trTR} | ${["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"]}                    | ${["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"]}                            | ${["O", "Ş", "M", "N", "M", "H", "T", "A", "E", "E", "K", "A"]}
  `(
    "returns 12 Gregorian month names (long/short/narrow) for $locale",
    ({ locale, long, short, narrow }) => {
      expect(getLocaleMonthNames(locale)).toEqual(long);
      expect(getLocaleMonthNames(locale, "long")).toEqual(long);
      expect(getLocaleMonthNames(locale, "short")).toEqual(short);
      expect(getLocaleMonthNames(locale, "narrow")).toEqual(narrow);
    },
  );

  it("returns long names when style is omitted for fr-FR", () => {
    expect(getLocaleMonthNames(MustTestLocales.frFR)).toEqual([
      "janvier",
      "février",
      "mars",
      "avril",
      "mai",
      "juin",
      "juillet",
      "août",
      "septembre",
      "octobre",
      "novembre",
      "décembre",
    ]);
  });

  it("returns an empty array for invalid locales", () => {
    expect(getLocaleMonthNames("")).toEqual([]);
    expect(getLocaleMonthNames("!!!")).toEqual([]);
    expect(getLocaleMonthNames(123 as unknown as string)).toEqual([]);
    expect(getLocaleMonthNames(undefined as unknown as string)).toEqual([]);
  });

  it("always returns exactly 12 names", () => {
    for (const locale of Object.values(MustTestLocales)) {
      expect(getLocaleMonthNames(locale)).toHaveLength(12);
    }
  });
});
