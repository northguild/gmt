/**
 * Two small text animations for the slides' visuals: typing a line out, and rolling a counter's
 * digits until they land. Each reads the browser's frame stamp for elapsed time and nothing else,
 * returns a function that stops it, and under `reduced` writes the end state at once.
 *
 * Markup that animates text keeps the whole text in a `.gmt-sr-only` copy and marks the animated
 * copy `aria-hidden`, so a screen reader never hears half a line.
 */

import { play, type Frames } from "./frames";

/** Milliseconds per typed character: about 45 a second, quick enough that the stage never waits on it. */
export const CHAR_MS = 22;
/** How long a counter spins before it lands. */
export const ROLL_MS = 1400;

/** Types `text` into `el`, then calls `done`. */
export function typeOut(o: {
  el: HTMLElement;
  text: string;
  win: Frames;
  reduced: boolean;
  done?: () => void;
}): () => void {
  const done = o.done ?? (() => {});
  if (o.reduced || o.text === "") {
    o.el.textContent = o.text;
    done();
    return () => {};
  }
  return play(
    o.win,
    [...o.text].length * CHAR_MS,
    (t) => {
      o.el.textContent = [...o.text]
        .slice(0, Math.floor(t * [...o.text].length))
        .join("");
    },
    () => {
      o.el.textContent = o.text;
      done();
    },
  );
}

/** What a rolling counter shows at progress `t`: each digit spins down to its own value. */
export function rolled(end: string, t: number): string {
  if (t >= 1) return end;
  return [...end]
    .map((ch, i) => {
      if (!/\d/.test(ch)) return ch;
      // Later digits spin longer, so the counter settles from the left.
      const turns = Math.ceil((1 - t) * (i + 3) * 4);
      return String((Number(ch) + turns) % 10);
    })
    .join("");
}

/** Writes `text` into `el`: one character per `[data-tile]` child when it has tiles, else whole. */
export function showText(el: HTMLElement, text: string): void {
  const tiles = el.querySelectorAll<HTMLElement>("[data-tile]");
  if (tiles.length === 0) {
    el.textContent = text;
    return;
  }
  const chars = [...text];
  tiles.forEach((tile, i) => {
    tile.textContent = chars[i] ?? "";
  });
}

/**
 * What the roll spins through on the way to `end`: a blank flap (`[data-blank]`, padding before a
 * shorter value) spins a digit like the others and lands empty, so the whole row rolls.
 */
function spinning(el: HTMLElement, end: string): string {
  const tiles = el.querySelectorAll<HTMLElement>("[data-tile]");
  return [...end]
    .map((ch, i) => (tiles[i]?.hasAttribute("data-blank") ? "0" : ch))
    .join("");
}

/** Rolls `el`'s digits until they read `end` (tile by tile when it has tiles), then calls `done`. */
export function rollText(o: {
  el: HTMLElement;
  end: string;
  win: Frames;
  reduced: boolean;
  done?: () => void;
}): () => void {
  const done = o.done ?? (() => {});
  if (o.reduced) {
    showText(o.el, o.end);
    done();
    return () => {};
  }
  const spin = spinning(o.el, o.end);
  return play(
    o.win,
    ROLL_MS,
    (t) => {
      showText(o.el, t >= 1 ? o.end : rolled(spin, t));
    },
    () => {
      showText(o.el, o.end);
      done();
    },
  );
}
