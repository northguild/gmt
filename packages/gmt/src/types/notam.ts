/**
 * A NOTAM validity value: item B) (when the NOTAM comes into force) or item C) (when it ceases),
 * as read by `parseNotamValidity`. EUROCONTROL-GUID-121, _OPADD_ Ed. 4.1, §2.3.16 and §2.3.17.
 *
 * `EST` and `PERM` are item C) only (§2.3.16 allows only the ten digits in B)). A caller reading
 * item B) treats `{ kind: "permanent" }` or `estimated: true` as malformed.
 */
export type NotamValidity =
  /** A ten-digit date-time group `YYMMDDHHMM`, with or without `EST`. */
  | {
      /** Always `"instant"`. */
      kind: "instant";
      /** The group as UTC, ISO 8601 ending in `Z`, seconds written (`2025-06-15T12:00:00Z`). */
      instant: string;
      /**
       * `true` when item C) carried `EST`. OPADD 4.1 §2.3.17: "For NOTAM of uncertain duration
       * of validity, the date-time group shall be followed by 'EST' (estimate)"; §2.2: such a
       * NOTAM "requires the later issue of a NOTAMR or NOTAMC". The time is an estimate, not an end.
       */
      estimated: boolean;
    }
  /**
   * Item C) `PERM`: "information of permanent validity that will be incorporated in the AIP"
   * (OPADD 4.1 §2.3.17). It carries no instant, on purpose: it has no end to compare against.
   */
  | {
      /** Always `"permanent"`. */
      kind: "permanent";
    };
