/**
 * The empty-screen pills.
 *
 * These assert the *contract*, not the model's behaviour. Whether a given
 * question actually produces a tool call is the model's decision and cannot be
 * pinned in a unit test — what can be pinned is that every shippable widget has
 * a way for a reader to discover it, and that no starter points at a widget
 * that is not enabled.
 */
import { describe, expect, it } from "vitest";
import { CHAT_STARTERS } from "./chat-constants";
import { DOX_TOOL_DOCS, ENABLED_TOOL_NAMES } from "./dox-tools";

describe("CHAT_STARTERS", () => {
  it("gives every enabled widget exactly one starter", () => {
    /* The parity contract. Enabling a tool without a starter ships a widget no
       reader can find from the empty screen, which is the same failure mode
       `widget-registry.test.ts` guards between the tools and the registry. */
    const covered = CHAT_STARTERS.map((s) => s.widget).sort();
    expect(covered).toEqual([...ENABLED_TOOL_NAMES].sort());
  });

  it("points every starter at a widget that is actually enabled", () => {
    for (const starter of CHAT_STARTERS) {
      expect(
        (ENABLED_TOOL_NAMES as readonly string[]).includes(starter.widget),
        `${starter.widget} is not enabled`,
      ).toBe(true);
    }
  });

  it("asks a real question rather than naming a tool", () => {
    /* A pill that reads "showDstInspector" would trigger reliably and teach
       nothing. These have to survive being read aloud by someone who has never
       heard of the widget. */
    for (const starter of CHAT_STARTERS) {
      expect(starter.text.length, starter.widget).toBeGreaterThan(20);
      for (const doc of DOX_TOOL_DOCS) {
        expect(starter.text, starter.widget).not.toContain(doc.name);
      }
    }
  });

  it("names a concrete zone or time, which is what the tools need for arguments", () => {
    /* Every tool's arguments are zones and instants. A starter that says
       "convert between two zones" gives the model nothing to pass, so it
       answers in prose — which is exactly what the vaguer wording did. */
    for (const starter of CHAT_STARTERS) {
      expect(
        /Tokyo|New York|London|\d/.test(starter.text),
        `${starter.widget} has nothing concrete to pass as an argument`,
      ).toBe(true);
    }
  });

  it("keeps each pill short enough to read as a button", () => {
    for (const starter of CHAT_STARTERS) {
      expect(starter.text.length, starter.widget).toBeLessThan(110);
    }
  });
});
