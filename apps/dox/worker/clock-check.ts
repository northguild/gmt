/**
 * The Worker half of a clock-change checker, shared by every checker's endpoint: the probe and
 * transition tables, the last and next change of a zone, the stored-times check, and the request
 * handler that owns the method, size, rate-limit and zone rules. A checker's own module supplies
 * its facts and the one function that builds its answer.
 *
 * Imports `facts.ts` and the stored-times logic only: never a template, never anything with HTML.
 */
import { convertUtcToPlainDateTime } from "@northguild/gmt/utc/convert";
import { isAfterUtc } from "@northguild/gmt/utc/compare";
import { getUtcNow } from "@northguild/gmt/utc/get";
import { classifyStoredZoned } from "@northguild/gmt/zoned/classify";
import {
  getDstTransitions,
  getTimeZoneOffset,
} from "@northguild/gmt/zoned/get";
import type {
  Change,
  ClockCheckFacts,
  ProbeRow,
  StoredCheck,
  StoredRow,
  TransitionRow,
  ZoneNow,
} from "../src/lib/clock-check/facts";
import {
  capStoredInput,
  completeStoredLine,
} from "../src/lib/clock-check/stored-times";
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
 * The zone's offset at `now`, and the last and next change around it. The UTC year comes from
 * the string the library returned, not from `Date`.
 *
 * `getDstTransitions` groups by the zone's LOCAL year, so a change within ~14 h of local New Year
 * can sit outside the UTC year's own list. Three years, in order, cover it; the pick is then made
 * on instants alone.
 */
export function zoneNow(zone: string, now: string): ZoneNow {
  const year = Number(now.slice(0, 4));
  const window = [year - 1, year, year + 1].flatMap((y) =>
    transitionsFor(zone, y),
  );
  return {
    zone,
    offset: getTimeZoneOffset(zone, now),
    last: window.findLast((change) => !isAfterUtc(change.instant, now)) ?? null,
    next: window.find((change) => isAfterUtc(change.instant, now)) ?? null,
  };
}

const probeCache = new Map<string, ProbeRow[]>();

/** The probe zones' offsets at the probe instant, built on first use, then reused for the isolate. */
export function probeRows(facts: ClockCheckFacts): ProbeRow[] {
  let rows = probeCache.get(facts.id);
  if (!rows) {
    rows = facts.probe.map(({ zone }) => ({
      zone,
      offset: getTimeZoneOffset(zone, facts.probeInstant),
    }));
    probeCache.set(facts.id, rows);
  }
  return rows;
}

const transitionRowCache = new Map<string, TransitionRow[]>();

/** Every change of each zone in each year, with the wall time just before it. Memoised per isolate. */
export function transitionRows(
  zones: readonly string[],
  years: readonly number[],
): TransitionRow[] {
  const key = `${zones.join(",")}|${years.join(",")}`;
  let rows = transitionRowCache.get(key);
  if (rows) return rows;
  rows = [];
  for (const zone of zones) {
    for (const year of years) {
      for (const change of transitionsFor(zone, year)) {
        rows.push({
          zone,
          year,
          ...change,
          wallBefore: convertUtcToPlainDateTime(change.instant, {
            timeZone: change.offsetBefore,
          }),
        });
      }
    }
  }
  transitionRowCache.set(key, rows);
  return rows;
}

/**
 * The most bytes of body the POST reads: 20,000 bytes of lines plus form overhead. A body
 * longer than this is read no further and answers 413.
 */
const MAX_BODY_BYTES = 65_536;

/** A form field as a string. Anything else (a `File`) counts as `""`; nothing is coerced. */
export function field(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}

/** The checker's bucket answer: `null` when the request may go on. */
function rateLimited(
  request: Request,
  id: string,
  limit: { max: number; windowSeconds: number },
): Response | null {
  const result = checkRateLimit(
    `${id}:${clientIdFromRequest(request)}`,
    getUnixNowMs(),
    { max: limit.max, windowSeconds: limit.windowSeconds },
  );
  if (result.allowed) return null;
  return json(
    { error: "Too many requests. Please slow down.", retryable: true },
    429,
    { "retry-after": String(result.retryAfterSeconds ?? 60) },
  );
}

/** Every kept line, classified with this runtime's tz data. `zone` completes a line with none. */
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
export async function readBody(
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

interface HandlerSpec<A> {
  facts: ClockCheckFacts;
  limit: { max: number; windowSeconds: number };
  /** The checker's answer for `now`, a UTC instant. */
  compute(now: string): A;
}

/**
 * The handler for `GET /api/<facts.id>-clock-change`. Computed per request on workerd, whose ICU carries the tz
 * data this Worker answers from; nothing is built ahead.
 *
 * `HEAD` answers as `GET` with no body. `POST` reads posted stored zoned times (`lines`, `zone`)
 * with the same tz data and answers `StoredCheck`: each kept line is completed with a zone only
 * from what the reader typed or picked, then classified by `classifyStoredZoned`. POST checks run
 * in the order size (413), bucket (429), zone (400). Other methods answer 405 with
 * `Allow: GET, HEAD, POST`.
 *
 * Rate limited at `spec.limit` under its own `<id>:` key, shared by GET and POST, so the chat's
 * bucket and this one never share a count. Per isolate: blunt protection, not a global limit.
 */
export function clockCheckHandler<A>(
  spec: HandlerSpec<A>,
): (request: Request, env: unknown, now?: () => string) => Promise<Response> {
  const { facts, limit } = spec;

  async function handleStoredTimes(request: Request): Promise<Response> {
    const bytes = await readBody(request);
    if (bytes === null) {
      return json(
        { error: "The request body is too large.", retryable: false },
        413,
      );
    }
    const blocked = rateLimited(request, facts.id, limit);
    if (blocked) return blocked;

    let form: FormData;
    try {
      if (bytes.byteLength === 0) throw new Error("empty body");
      form = await new Response(bytes, {
        headers: { "content-type": request.headers.get("content-type") ?? "" },
      }).formData();
    } catch {
      return json(
        {
          error: "Send the form as multipart or url-encoded.",
          retryable: false,
        },
        400,
      );
    }
    const zone = field(form, "zone");
    if (!facts.storedZones.includes(zone)) {
      return json(
        { error: "Pick one of the listed zones.", retryable: false },
        400,
      );
    }
    return json(computeStoredCheck(field(form, "lines"), zone));
  }

  return async (request, _env, now = getUtcNow) => {
    if (request.method === "POST") return handleStoredTimes(request);
    if (request.method !== "GET" && request.method !== "HEAD") {
      return json({ error: "Method not allowed.", retryable: false }, 405, {
        allow: "GET, HEAD, POST",
      });
    }

    const blocked = rateLimited(request, facts.id, limit);
    const answer = blocked ?? json(spec.compute(now()));
    // HEAD (RFC 9110 9.1): the GET answer's status and headers, no body; the same bucket.
    if (request.method === "HEAD") {
      return new Response(null, {
        status: answer.status,
        headers: answer.headers,
      });
    }
    return answer;
  };
}
