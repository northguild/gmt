/** Two animation frames, so a click's restyle (or a step's) has landed before the read. */
export const frames = (page) =>
  page.evaluate(
    () =>
      new Promise((done) =>
        requestAnimationFrame(() => requestAnimationFrame(done)),
      ),
  );
