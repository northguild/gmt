import { convertUtcToPlainDateTime } from "@northguild/gmt/utc/convert";
import { isAfterUtc } from "@northguild/gmt/utc/compare";
import { getUtcNow } from "@northguild/gmt/utc/get";
import { classifyStoredZoned } from "@northguild/gmt/zoned/classify";
import {
  getDstTransitions,
  getTimeZoneOffset,
} from "@northguild/gmt/zoned/get";
import canadaZones from "../src/lib/canada-zones.json";
import {
  CANADA_RATE_LIMIT,
  PROBE_INSTANT,
  PROBE_ZONES,
  STORED_ZONES,
  TRANSITION_ZONES,
  type CanadaCheck,
  type Change,
  type MapZone,
  type ProbeRow,
  type StoredCheck,
  type StoredRow,
  type TransitionRow,
} from "../src/lib/canada-clock-change";
import {
  capStoredInput,
  completeStoredLine,
} from "../src/lib/canada-stored-times";
import { getUnixNowMs } from "./clock";
import { checkRateLimit, clientIdFromRequest } from "./rate-limit";

const TRANSITION_YEARS = [2026, 2027] as const;

/**
 * A cached answer would hide the live tz data the page exists to show, so every response is
 * `no-store`.
 */
const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

function json(body: unknown, status = 200, extra?: HeadersInit): Response {
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
function transitionsFor(zone: string, year: number): Change[] {
  const key = `${zone}|${year}`;
  let list = transitionCache.get(key);
  if (!list) {
    list = getDstTransitions(zone, year);
    transitionCache.set(key, list);
  }
  return list;
}

function mapZone(zone: string, now: string): MapZone {
  // The UTC year of `now`, from the string the library returned — not from `Date`.
  const year = Number(now.slice(0, 4));

  let kind: MapZone["kind"] = "none-2026-2027";
  if (transitionsFor(zone, 2027).length > 0) kind = "changes-2027";
  else if (transitionsFor(zone, 2026).length > 0) kind = "stopped-2026";

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

let fixed: Pick<CanadaCheck, "probe" | "transitions"> | undefined;

/** The `now`-free part: built on first use, then reused for the life of the isolate. */
function fixedTables(): Pick<CanadaCheck, "probe" | "transitions"> {
  if (fixed) return fixed;
  const probe: ProbeRow[] = PROBE_ZONES.map(({ zone }) => ({
    zone,
    offset: getTimeZoneOffset(zone, PROBE_INSTANT),
  }));

  const transitions: TransitionRow[] = [];
  for (const zone of TRANSITION_ZONES) {
    for (const year of TRANSITION_YEARS) {
      for (const change of transitionsFor(zone, year)) {
        transitions.push({
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
  fixed = { probe, transitions };
  return fixed;
}

/** Every value the checker shows, computed on this runtime's tz data. */
export function computeCanadaCheck(now: string): CanadaCheck {
  return {
    now,
    ...fixedTables(),
    zones: canadaZones.zones.map((zone) => mapZone(zone, now)),
  };
}

/**
 * The most bytes of body the POST reads: 20,000 bytes of lines plus form overhead. A body
 * longer than this is read no further and answers 413.
 */
const MAX_BODY_BYTES = 65_536;

/** A form field as a string. Anything else (a `File`) counts as `""`; nothing is coerced. */
function field(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}

/** The shared `canada:` bucket answer: `null` when the request may go on. */
function rateLimited(request: Request): Response | null {
  const limit = checkRateLimit(
    `canada:${clientIdFromRequest(request)}`,
    getUnixNowMs(),
    {
      max: CANADA_RATE_LIMIT.max,
      windowSeconds: CANADA_RATE_LIMIT.windowSeconds,
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

async function handleStoredTimes(request: Request): Promise<Response> {
  const bytes = await readBody(request);
  if (bytes === null) {
    return json(
      { error: "The request body is too large.", retryable: false },
      413,
    );
  }
  const blocked = rateLimited(request);
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
  if (!STORED_ZONES.includes(zone)) {
    return json(
      { error: "Pick one of the listed zones.", retryable: false },
      400,
    );
  }
  return json(computeStoredCheck(field(form, "lines"), zone));
}

/**
 * `GET /gmt/api/canada-clock-change`. Computed per request on workerd, whose ICU carries the
 * tz data this Worker answers from; nothing is built ahead.
 *
 * `HEAD` answers as `GET` with no body. `POST` reads posted stored zoned times (`lines`, `zone`) with the same tz data and answers
 * `StoredCheck`: each kept line is completed with a zone only from what the reader typed or
 * picked, then classified by `classifyStoredZoned`. Other methods answer 405 with `Allow: GET, HEAD, POST`.
 *
 * Rate limited at `CANADA_RATE_LIMIT` under its own `canada:` key, shared by GET and POST, so
 * the chat's bucket and this one never share a count. Per isolate: blunt protection, not a
 * global limit.
 */
export async function handleCanadaClockChange(
  request: Request,
  _env: unknown,
  now: () => string = getUtcNow,
): Promise<Response> {
  if (request.method === "POST") return handleStoredTimes(request);
  if (request.method !== "GET" && request.method !== "HEAD") {
    return json({ error: "Method not allowed.", retryable: false }, 405, {
      allow: "GET, HEAD, POST",
    });
  }

  const blocked = rateLimited(request);
  const answer = blocked ?? json(computeCanadaCheck(now()));
  // HEAD (RFC 9110 9.1): the GET answer's status and headers, no body; the same bucket.
  if (request.method === "HEAD") {
    return new Response(null, {
      status: answer.status,
      headers: answer.headers,
    });
  }
  return answer;
}
