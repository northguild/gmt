import { useId } from "react";

interface QuestionsProps {
  heading: string;
  items: readonly { id: string; text: string }[];
  onAsk: (id: string) => void;
}

/** The rail's idle content: the slide's ready questions, as the examples panel's own cards. */
export function DeckQuestions({ heading, items, onAsk }: QuestionsProps) {
  const headingId = useId();
  return (
    <div className="gmt-hive-examples not-content">
      <div className="gmt-hive-artifact-header gmt-hive-examples-header">
        <h2 className="gmt-hive-artifact-title" id={headingId}>
          {heading}
        </h2>
      </div>
      <div className="gmt-hive-examples-body">
        <ul className="gmt-hive-examples-list" aria-labelledby={headingId}>
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="gmt-hive-example gmt-sonar-focus"
                data-cue=""
                onClick={() => onAsk(item.id)}
              >
                <span className="gmt-hive-example-text">{item.text}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
