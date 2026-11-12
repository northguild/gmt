/**
 * A NOTAM validity value: item B) (when the NOTAM comes into force) or item C) (when it ceases),
 * as read by `parseNotamValidity`. ICAO PANS-AIM (Doc 10066), Appendix 3 §5 and §6;
 * EUROCONTROL-GUID-121, _OPADD_ Ed. 4.1, §2.3.16 and §2.3.17, as the multinational peer.
 *
 * `EST` and `PERM` are item C) only (PANS-AIM App 3 §5 gives item B) the ten-figure group alone).
 * A caller reading item B) treats `{ kind: "permanent" }` or `estimated: true` as malformed.
 */
export type NotamValidity =
  /** A ten-digit date-time group `YYMMDDHHMM`, with or without `EST`. */
  | {
      /** Always `"instant"`. */
      kind: "instant";
      /** The group as UTC, ISO 8601 ending in `Z`, seconds written (`2025-06-15T12:00:00Z`). */
      instant: string;
      /**
       * `true` when item C) carried `EST`. PANS-AIM App 3 §6: "If the information on timing is
       * uncertain, the approximate duration shall be indicated using a date-time group followed
       * by the abbreviation 'EST'. Any NOTAM which includes an 'EST' shall be cancelled or
       * replaced before the date-time specified in Item C)". The time is an estimate, not an end.
       */
      estimated: boolean;
    }
  /**
   * Item C) `PERM`: "the information is of a permanent nature" (PANS-AIM App 3 §6). It carries
   * no instant, on purpose: it has no end to compare against.
   */
  | {
      /** Always `"permanent"`. */
      kind: "permanent";
    };
