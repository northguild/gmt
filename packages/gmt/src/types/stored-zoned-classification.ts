/**
 * What `classifyStoredZoned` finds when an RFC 9557 string carries both a UTC offset and a
 * bracketed IANA zone. Every reading is a `Z` instant string (`Temporal.Instant#toString`), and
 * every offset is `±HH:MM[:SS]`. Each kind carries enough readings to reproduce each of
 * Temporal's `offset` values (`use`, `ignore`, `prefer`, `reject`).
 *
 * @example
 * import type { StoredZonedClassification } from "@northguild/gmt/types";
 * const found: StoredZonedClassification = {
 *   kind: "offsetMismatch",
 *   storedOffset: "+02:00",
 *   zoneOffset: "+03:00",
 *   atStoredOffset: "2016-12-01T07:00:00Z",
 *   atZoneOffset: "2016-12-01T06:00:00Z",
 * };
 */
export type StoredZonedClassification =
  | {
      /**
       * The string names one instant. Either it ends in `Z`, which Temporal reads as exact
       * whatever the zone's wall clock does, or its offset matches the zone's offset at that
       * local time (to the minute, or exactly when written with seconds) and the local time
       * occurs once. `instant` is what `reject`, `prefer` and `ignore` give.
       */
      kind: "valid";
      /** The instant the string names. */
      instant: string;
      /** The instant `offset: "use"` gives: the written wall clock minus the written offset. */
      atStoredOffset: string;
    }
  | {
      /**
       * The local time occurs twice, and the stored offset picks one of the two: `instant`, which
       * is either `earlier` or `later`. `ignore` gives `earlier` or `later` by `disambiguation`.
       */
      kind: "validInOverlap";
      /** The occurrence the stored offset picks. `reject` and `prefer` give it. */
      instant: string;
      /** The first occurrence. */
      earlier: string;
      /** The second occurrence. */
      later: string;
      /** The instant `offset: "use"` gives. */
      atStoredOffset: string;
    }
  | {
      /**
       * The local time occurs once, but not at the stored offset. `reject` refuses it, and `ignore`
       * and `prefer` give `atZoneOffset`.
       */
      kind: "offsetMismatch";
      /** The offset as written in the string, `±HH:MM` or `±HH:MM:SS`. Seconds are kept when written. */
      storedOffset: string;
      /** The offset the zone has at that local time. */
      zoneOffset: string;
      /** The instant `offset: "use"` gives. */
      atStoredOffset: string;
      /** The instant the zone's own offset gives. */
      atZoneOffset: string;
    }
  | {
      /**
       * The local time occurs twice, and the stored offset picks neither occurrence. `reject`
       * refuses it, and `ignore` and `prefer` give `earlier` or `later` by `disambiguation`.
       */
      kind: "ambiguous";
      /** The first occurrence. */
      earlier: string;
      /** The second occurrence. */
      later: string;
      /** The instant `offset: "use"` gives. */
      atStoredOffset: string;
    }
  | {
      /**
       * The local time falls in a gap, so there is no occurrence to match. `reject` refuses it,
       * and `ignore` and `prefer` give `earlier` or `later` by `disambiguation`. `earlier` and
       * `later` are the wall time shifted back or forward by the size of the gap, as
       * `disambiguation` names them.
       */
      kind: "nonexistent";
      /** The reading `disambiguation: "earlier"` gives. */
      earlier: string;
      /** The reading `disambiguation: "later"` and `"compatible"` give. */
      later: string;
      /** The instant `offset: "use"` gives. */
      atStoredOffset: string;
    };
