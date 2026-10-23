/**
 * The Worker half every dated clock-change checker shares: the JSON answers, the per-isolate
 * transition cache, the row builder, the saved-events classifier and the request handler with its
 * methods, `HEAD`, `POST` order and caps. A checker passes a `CheckEndpoint` (its rate-limit
 * bucket, its zone allowlist and its `GET` body); nothing here names a checker.
 */
import { isAfterUtc } from "@northguild/gmt/utc/compare";
import { classifyStoredZoned } from "@northguild/gmt/zoned/classify";
import {
  getDstTransitions,
  getTimeZoneOffset,
} from "@northguild/gmt/zoned/get";
import type { Change } from "../src/lib/clock-change-common";
import type { ProbeInstant } from "../src/lib/clock-change-probe";
import {
  capStoredInput,
  completeStoredLine,
} from "../src/lib/clock-change-stored-lines";
import type {
  StoredCheck,
  StoredRow,
} from "../src/lib/clock-change-stored-lines";
import type { MapZone } from "../src/lib/zone-map";
import { getUnixNowMs } from "./clock";
import { checkRateLimit, clientIdFromRequest } from "./rate-limit";

/**
 * A cached answer would hide the live tz data the page exists to show, so every response is
 * `no-store`.
 */
const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

export function json(
  body: unknown,
  status = 200,
  extra?: HeadersInit,
): Response {
  const headers = new Headers(JSON_HEADERS);
  new Headers(extra).forEach((value, key) => headers.set(key, value));
  return new Response(JSON.stringify(body), { status, headers });
}

/**
 * Tz data cannot change inside an isolate, so each year scan runs once per zone and year, and
 * the probe and transition tables are built once. Without this a GET costs ~80 year scans,
 * more than a Workers Free request's CPU budget allows.
 */
const transitionCache = new Map<string, Change[]>();
export function transitionsFor(zone: string, year: number): Change[] {
  const key = `${zone}|${year}`;
  let list = transitionCache.get(key);
  if (!list) {
    list = getDstTransitions(zone, year);
    transitionCache.set(key, list);
  }
  return list;
}

/**
 * One zone's row: its offset now, its last and next change, and its class. The class is read
 * from the year the checker's story is about (`stopYear`) and the year after: a change after it
 * is `changes-after`, a change in it alone is `stopped`, neither is `none`.
 */
export function mapZone(zone: string, now: string, stopYear: number): MapZone {
  // The UTC year of `now`, from the string the library returned — not from `Date`.
  const year = Number(now.slice(0, 4));

  let kind: MapZone["kind"] = "none";
  if (transitionsFor(zone, stopYear + 1).length > 0) kind = "changes-after";
  else if (transitionsFor(zone, stopYear).length > 0) kind = "stopped";

  // `getDstTransitions` groups by the zone's LOCAL year, so a change within ~14 h of local New
  // Year can sit outside the UTC year's own list. Three years, in order, cover it; the pick is
  // then made on instants alone.
  const window = [year - 1, year, year + 1].flatMap((y) =>
    transitionsFor(zone, y),
  );

  return {
    zone,
    offset: getTimeZoneOffset(zone, now),
    last: window.findLast((change) => !isAfterUtc(change.instant, now)) ?? null,
    next: window.find((change) => isAfterUtc(change.instant, now)) ?? null,
    kind,
  };
}

/**
 * The most bytes of body the POST reads: 20,000 bytes of lines plus form overhead. A body
 * longer than this is read no further and answers 413.
 */
const MAX_BODY_BYTES = 65_536;

/** One zone read at one probe instant. */
export interface ProbeOffset {
  zone: string;
  instant: string;
  role: ProbeInstant["role"];
  offset: string;
}

/**
 * The offset of each zone at each probe instant, zone by zone and instant by instant, read with
 * this runtime's tz data. A checker's own rows are built from these.
 */
export function probeRows(
  probe: { readonly instants: readonly ProbeInstant[] },
  zones: readonly string[],
): ProbeOffset[] {
  return zones.flatMap((zone) =>
    probe.instants.map(({ iso, role }) => ({
      zone,
      instant: iso,
      role,
      offset: getTimeZoneOffset(zone, iso),
    })),
  );
}

/** One zone's clock changes in one year. */
export interface ZoneYearChanges {
  zone: string;
  year: number;
  changes: Change[];
}

/** The clock changes of each zone in each year, zone by zone and year by year. */
export function transitionRows(
  years: readonly number[],
  zones: readonly string[],
): ZoneYearChanges[] {
  return zones.flatMap((zone) =>
    years.map((year) => ({ zone, year, changes: transitionsFor(zone, year) })),
  );
}

/** A form field as a string. Anything else (a `File`) counts as `""`; nothing is coerced. */
export function field(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}

/** A checker's rate-limit policy: `max` requests in `windowSeconds`. */
export interface RatePolicy {
  max: number;
  windowSeconds: number;
}

/** The shared `<prefix>:` bucket answer: `null` when the request may go on. */
export function rateLimited(
  request: Request,
  prefix: string,
  policy: RatePolicy,
): Response | null {
  const limit = checkRateLimit(
    `${prefix}:${clientIdFromRequest(request)}`,
    getUnixNowMs(),
    {
      max: policy.max,
      windowSeconds: policy.windowSeconds,
    },
  );
  if (limit.allowed) return null;
  return json(
    { error: "Too many requests. Please slow down.", retryable: true },
    429,
    { "retry-after": String(limit.retryAfterSeconds ?? 60) },
  );
}

/** Every kept line, classified with this runtime's tz data. */
export function computeStoredCheck(text: string, zone: string): StoredCheck {
  const { lines, truncated } = capStoredInput(text);
  const rows: StoredRow[] = lines.map(({ line, text: input }) => {
    const value = completeStoredLine(input, zone);
    return {
      line,
      input,
      value,
      result: value === null ? null : classifyStoredZoned(value),
    };
  });
  return { zone, truncated, rows };
}

/**
 * The body, read as a stream so `content-length` (absent on a chunked request, and not
 * trustworthy) does not matter. `null` when it is over `MAX_BODY_BYTES`. A body that ends early
 * (RFC 9112 section 8: an incomplete message) reads as empty, so it gets the 400 of a body that is
 * not a form, never a 500.
 */
async function readBody(
  request: Request,
): Promise<Uint8Array<ArrayBuffer> | null> {
  const empty = new Uint8Array(new ArrayBuffer(0));
  if (!request.body) return empty;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } catch {
    return empty;
  }
  const bytes = new Uint8Array(new ArrayBuffer(size));
  let at = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, at);
    at += chunk.byteLength;
  }
  return bytes;
}

/** What a checker gives the shared handler. */
export interface CheckEndpoint {
  /** The rate-limit bucket prefix: `canada` is the bucket `canada:<clientId>`. */
  prefix: string;
  policy: RatePolicy;
  /** The year the checker is about: its zones stop changing clocks in it. The year after is read too. */
  stopYear: number;
  /** The POST zone allowlist. */
  storedZones: readonly string[];
  /** The GET body, computed on this runtime's tz data. The handler passes `stopYear` along. */
  compute: (now: string, stopYear: number) => unknown;
}

async function handleStoredTimes(
  request: Request,
  endpoint: CheckEndpoint,
): Promise<Response> {
  const bytes = await readBody(request);
  if (bytes === null) {
    return json(
      { error: "The request body is too large.", retryable: false },
      413,
    );
  }
  const blocked = rateLimited(request, endpoint.prefix, endpoint.policy);
  if (blocked) return blocked;

  let form: FormData;
  try {
    if (bytes.byteLength === 0) throw new Error("empty body");
    form = await new Response(bytes, {
      headers: { "content-type": request.headers.get("content-type") ?? "" },
    }).formData();
  } catch {
    return json(
      { error: "Send the form as multipart or url-encoded.", retryable: false },
      400,
    );
  }
  const zone = field(form, "zone");
  if (!endpoint.storedZones.includes(zone)) {
    return json(
      { error: "Pick one of the listed zones.", retryable: false },
      400,
    );
  }
  return json(computeStoredCheck(field(form, "lines"), zone));
}

/**
 * The request handler of a checker's endpoint. Computed per request on workerd, whose ICU carries
 * the tz data this Worker answers from; nothing is built ahead.
 *
 * `HEAD` answers as `GET` with no body. `POST` reads posted stored zoned times (`lines`, `zone`) with
 * the same tz data and answers `StoredCheck`: each kept line is completed with a zone only from
 * what the reader typed or picked, then classified by `classifyStoredZoned`. Other methods answer
 * 405 with `Allow: GET, HEAD, POST`.
 *
 * Rate limited under the checker's own `<prefix>:` key, shared by GET and POST, so the chat's
 * bucket and this one never share a count. Per isolate: blunt protection, not a global limit.
 */
export async function handleClockChangeCheck(
  request: Request,
  endpoint: CheckEndpoint,
  now: () => string,
): Promise<Response> {
  if (request.method === "POST") return handleStoredTimes(request, endpoint);
  if (request.method !== "GET" && request.method !== "HEAD") {
    return json({ error: "Method not allowed.", retryable: false }, 405, {
      allow: "GET, HEAD, POST",
    });
  }

  const blocked = rateLimited(request, endpoint.prefix, endpoint.policy);
  const answer = blocked ?? json(endpoint.compute(now(), endpoint.stopYear));
  // HEAD (RFC 9110 9.1): the GET answer's status and headers, no body; the same bucket.
  if (request.method === "HEAD") {
    return new Response(null, {
      status: answer.status,
      headers: answer.headers,
    });
  }
  return answer;
}
