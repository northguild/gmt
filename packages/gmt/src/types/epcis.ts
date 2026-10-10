/**
 * The two time fields every GS1 EPCIS 2.0 (ISO/IEC 19987) event must carry.
 *
 * The EPCIS JSON schema lists both under `required`. `eventTime` says when the event happened;
 * `eventTimeZoneOffset` says what the local clock was offset by where it happened. Neither
 * derives from the other, so a system that keeps only `eventTime` cannot show the event in local
 * time again. Read a pair with `parseEpcisEvent`, write one with `formatEpcisEvent` and check one
 * with `isValidEpcisEvent`.
 */
export interface EpcisEventTime {
  /**
   * When the event happened, in the `DateTimeStamp` grammar of the EPCIS XSD, the XML binding
   * (`epcisEventTime`): `YYYY-MM-DDTHH:MM:SS`, an optional fraction, then `Z` or a `±HH:MM`
   * offset. It fixes the instant and nothing else: an offset written here is not the event's
   * local offset, and it does not have to equal `eventTimeZoneOffset` (EPCIS 2.0 §7.4.1.1).
   */
  eventTime: string;
  /**
   * The UTC offset in force where the event happened, in the pattern the EPCIS JSON schema gives
   * (`epcisTimeZoneOffset`), which is the rule of EPCIS 2.0 §7.4.1: `±HH:MM` from `-14:00` to
   * `+14:00`, never `Z`. It sets the local clock the event is shown on and does not move the
   * instant. It cannot be worked out from `eventTime`.
   */
  eventTimeZoneOffset: string;
}
