/**
 * DOX-C0 (#171) — the foundation probe island.
 *
 * Proves the React + Tailwind v4 + AI Elements wiring end to end: the theme
 * bridge, the global-selector reset, and the Streamdown reading surface — with
 * NO network calls. Messages are hardcoded; there is no `useChat` and no
 * `/api/chat` here, on purpose. That wiring belongs to DOX-C1–DOX-C3a.
 *
 * `../../styles/gmt-ask-tailwind.css` and `../../styles/gmt-ask.css` are
 * imported here, not added to `astro.config.mjs`'s `customCss` — Vite
 * code-splits them into this island's own chunk, so a page that never opens
 * the chat loads neither. `.gmt-ask` on the root element is both the sheet's
 * scoping class and the anchor for shadcn's CSS variables (see
 * gmt-ask-tailwind.css's theme bridge).
 */
import "../../styles/gmt-ask-tailwind.css";
import "../../styles/gmt-ask.css";

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "../ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "../ai-elements/message";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "../ai-elements/prompt-input";

// A markdown-rich stub reply — h1–h3, a link, inline code, a fenced code
// block, a table, a blockquote, and a list — so the reading-surface theming
// in gmt-ask.css is actually exercised, not just declared.
const STUB_REPLY = `# Converting between zones

Use \`convertZonedToZoned\` to move a wall-clock time from one IANA zone to
another. See the [reference page](/reference/zoned/convert/convertZonedToZoned/)
for the full signature.

## Example

\`\`\`ts
convertZonedToZoned("2026-03-08T09:00:00", "America/New_York", "Asia/Tokyo");
// -> "2026-03-08T23:00:00"
\`\`\`

### Notes

| Input zone | DST active | Output zone | DST active |
| ---------- | ---------- | ----------- | ---------- |
| America/New_York | no | Asia/Tokyo | never |

> Tokyo does not observe daylight saving, so only the U.S. side of this
> conversion can land on a gap or an overlap.

- Always pass an ISO 8601 string, never a \`Date\`.
- Invalid zone names return \`""\`, not a thrown error.
`;

export default function AskDoxProbe() {
  return (
    <div className="gmt-ask flex w-full max-w-2xl flex-col rounded-lg border border-border bg-background text-foreground">
      {/*
        No fixed/max height here — `Conversation` wraps `use-stick-to-bottom`,
        which auto-scrolls to the newest content whenever its container is
        actually scrollable. That's correct for a real, growing chat; for
        this static single-message demo it only produces a confusing jump on
        load (the intro scrolls out of view before a reader can see it).
        Letting the panel grow to its natural content height means there's
        nothing to scroll, so nothing jumps.
      */}
      <Conversation>
        <ConversationContent>
          <Message from="user">
            <MessageContent>
              How do I convert a UTC timestamp to Tokyo time?
            </MessageContent>
          </Message>
          <Message from="assistant">
            <MessageContent>
              {/*
                `plugins={{}}` (no `code` plugin) — the default `code`
                plugin's Shiki highlighter fails to resolve its own default
                themes (`github-light`/`github-dark`) once bundled for the
                browser: verified 2026-09-09, the same call succeeds in plain
                Node against the identical package version, so this is a
                Vite/Rolldown client-bundling interaction with
                `@streamdown/code`'s pinned `shiki@^3.19.0` (separate from
                this repo's own `shiki@4.4.3`), not a bug in this file.
                Omitting the plugin falls back to plain, unhighlighted code
                blocks — no error, no broken render. DOX-C3a (which actually
                streams real code into this surface) should revisit.
              */}
              <MessageResponse className="gmt-ask-response" plugins={{}}>
                {STUB_REPLY}
              </MessageResponse>
            </MessageContent>
          </Message>
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <PromptInput
        onSubmit={(_message, event) => {
          // Static probe — no network. DOX-C1–DOX-C3a wire this to useChat.
          event.preventDefault();
        }}
      >
        <PromptInputBody>
          <PromptInputTextarea placeholder="Ask about @northguild/gmt…" />
        </PromptInputBody>
        <PromptInputFooter>
          <PromptInputSubmit status="ready" />
        </PromptInputFooter>
      </PromptInput>
    </div>
  );
}
