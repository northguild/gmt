/**
 * Two small text animations for the slides' visuals: typing a line out, and rolling a counter's
 * digits until they land. Each reads the browser's frame stamp for elapsed time and nothing else,
 * returns a function that stops it, and under `reduced` writes the end state at once.
 *
 * Markup that animates text keeps the whole text in a `.gmt-sr-only` copy and marks the animated
 * copy `aria-hidden`, so a screen reader never hears half a line.
 */

export interface Frames {
  requestAnimationFrame(callback: (stamp: number) => void): number;
  cancelAnimationFrame(handle: number): void;
}

/** Milliseconds per typed character. */
export const CHAR_MS = 38;
/** How long a counter spins before it lands. */
export const ROLL_MS = 1400;

function play(
  win: Frames,
  durationMs: number,
  draw: (t: number) => void,
  done: () => void,
): () => void {
  let handle = 0;
  let start: number | null = null;
  let stopped = false;
  const step = (stamp: number): void => {
    if (stopped) return;
    start ??= stamp;
    const t = Math.min(1, (stamp - start) / durationMs);
    draw(t);
    if (t < 1) handle = win.requestAnimationFrame(step);
    else done();
  };
  draw(0);
  handle = win.requestAnimationFrame(step);
  return () => {
    stopped = true;
    win.cancelAnimationFrame(handle);
  };
}

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
  return play(
    o.win,
    ROLL_MS,
    (t) => {
      showText(o.el, rolled(o.end, t));
    },
    () => {
      showText(o.el, o.end);
      done();
    },
  );
}
