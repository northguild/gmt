// RFC 7231 §7.1.1.1 IMF-fixdate — the only form GMT's `formatHttp` emits, and
// the only form `parseHttp` accepts. Day, year, and time-of-day fields are
// all fixed-width per the grammar (unlike RFC 2822's leniently-sized day);
// the trailing "GMT" literal is mandatory, never a numeric offset. The
// obsolete RFC 850 and asctime HTTP-date forms are a documented limitation
// (see `parseHttp`'s JSDoc), not supported here.
export const httpDate: RegExp =
  /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), (\d{2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{4}) (\d{2}):(\d{2}):(\d{2}) GMT$/;
