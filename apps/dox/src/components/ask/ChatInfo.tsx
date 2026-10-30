/**
 * The `/dox` fine print: the note that AI writes the answers, and the site's licence note.
 *
 * On a wide screen both show inline: `AccuracyNote` under the composer and the licence in the
 * shell's footer (`DoxPage`). On a phone they took about 170px of a 600px screen, so there both
 * are hidden and `ChatInfo`, an info button at the start of the composer's control bar, opens
 * them together in a popup. CSS picks the form (gmt-hive.css, "Fine print"), so the
 * server-rendered page is already right. Native `popover` gives Escape, outside click and focus
 * return with no script, as the data credits do.
 */
import { useId } from "react";
import { InfoIcon } from "lucide-react";
import { gmtStats } from "~/data/gmt-stats";
import { LICENCE_LEAD, LICENCE_LINK_TEXT, LICENCE_URL } from "~/lib/licence";

/** A fixed locale, so the server render and the browser agree on the digits. */
const GMT_TEST_COUNT = new Intl.NumberFormat("en-US").format(gmtStats.tests);

/** The prose comes from a free model and can be wrong; a widget runs the library itself. */
export function AccuracyNote({ className }: { className?: string }) {
  return (
    <p className={className}>
      Free AI models write Dox&rsquo;s answers and can get things wrong, so
      check them before you rely on them. The widgets and tools run{" "}
      <code>@northguild/gmt</code> itself, checked by {GMT_TEST_COUNT} tests.
    </p>
  );
}

export function LicenceNote({ className }: { className?: string }) {
  return (
    <p className={className}>
      {LICENCE_LEAD} <a href={LICENCE_URL}>{LICENCE_LINK_TEXT}</a>.
    </p>
  );
}

export function ChatInfo() {
  const panelId = useId();
  return (
    <>
      <button
        type="button"
        className="gmt-hive-info gmt-sonar-focus"
        popoverTarget={panelId}
        aria-label="About Dox's answers and licences"
      >
        <InfoIcon aria-hidden="true" />
      </button>
      <section
        id={panelId}
        popover="auto"
        aria-label="Fine print"
        className="gmt-hive-info-panel gmt-popover"
      >
        <AccuracyNote />
        <LicenceNote />
      </section>
    </>
  );
}
