/**
 * The examples rail — the starter questions, grouped by area, shown in the
 * widget rail while no widget is mounted.
 *
 * A card is a native `<button>`: its accessible name is exactly the question
 * (`aria-labelledby`), and the chip naming the widget it opens is the
 * description. Activating one is the host's `onPick` — it sends the question
 * and opens the seeded widget, exactly as the old pills did.
 */
import { useId } from "react";
import { CHAT_STARTERS, startersByArea } from "~/lib/chat-constants";
import { WIDGET_REGISTRY } from "./widget-registry";

type Starter = (typeof CHAT_STARTERS)[number];

export function ExamplesPanel({
  onPick,
}: {
  onPick: (starter: Starter) => void;
}) {
  const uid = useId();
  const headingId = `${uid}-examples`;

  return (
    <div className="gmt-hive-examples not-content">
      <div className="gmt-hive-artifact-header gmt-hive-examples-header">
        <h2 className="gmt-hive-artifact-title" id={headingId}>
          Examples
        </h2>
        <span className="gmt-hive-examples-count">{CHAT_STARTERS.length}</span>
      </div>
      <div className="gmt-hive-examples-body">
        {startersByArea().map((group) => {
          const groupId = `${uid}-area-${group.area}`;
          return (
            <section
              key={group.area}
              className="gmt-hive-examples-area"
              aria-labelledby={groupId}
            >
              <h3 className="gmt-hive-examples-area-title" id={groupId}>
                {group.label}
              </h3>
              <ul className="gmt-hive-examples-list">
                {group.starters.map((starter) => {
                  const questionId = `${uid}-q-${starter.widget}`;
                  const chipId = `${uid}-w-${starter.widget}`;
                  return (
                    <li key={starter.widget}>
                      <button
                        type="button"
                        className="gmt-hive-example gmt-sonar-focus"
                        data-widget={starter.widget}
                        aria-labelledby={questionId}
                        aria-describedby={chipId}
                        onClick={() => onPick(starter)}
                      >
                        <span className="gmt-hive-example-text" id={questionId}>
                          {starter.text}
                        </span>
                        <span className="gmt-hive-example-chip" id={chipId}>
                          {WIDGET_REGISTRY[starter.widget]?.title ??
                            starter.widget}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
