import { createDeck, formatHash, parseHash, type DeckSlide } from "./deck";

const SLIDES: DeckSlide[] = [
  { id: "title", builds: 0 },
  { id: "manila", builds: 2 },
  { id: "thanks", builds: 1 },
];

const at = (slide: number, build: number) => ({ slide, build });

describe("createDeck", () => {
  it("starts on the first slide with no build shown", () => {
    expect(createDeck(SLIDES).state).toEqual(at(0, 0));
  });

  it("refuses a deck with no slides", () => {
    expect(() => createDeck([])).toThrow("at least one slide");
  });

  it("steps forward through every build, then every slide, and stops at the end", () => {
    const deck = createDeck(SLIDES);
    const seen = [deck.state];
    while (deck.next()) seen.push(deck.state);
    expect(seen).toEqual([
      at(0, 0),
      at(1, 0),
      at(1, 1),
      at(1, 2),
      at(2, 0),
      at(2, 1),
    ]);
    expect(deck.next()).toBe(false);
    expect(deck.state).toEqual(at(2, 1));
  });

  it("steps back through every build and lands on the previous slide with all its builds shown", () => {
    const deck = createDeck(SLIDES, at(2, 1));
    const seen = [deck.state];
    while (deck.prev()) seen.push(deck.state);
    expect(seen).toEqual([
      at(2, 1),
      at(2, 0),
      at(1, 2),
      at(1, 1),
      at(1, 0),
      at(0, 0),
    ]);
    expect(deck.prev()).toBe(false);
    expect(deck.state).toEqual(at(0, 0));
  });

  it.each([
    ["nextSlide", at(1, 1), at(2, 0)],
    ["nextSlide", at(2, 0), at(2, 0)],
    ["prevSlide", at(1, 1), at(0, 0)],
    ["prevSlide", at(2, 1), at(1, 0)],
    ["prevSlide", at(0, 0), at(0, 0)],
    ["first", at(2, 1), at(0, 0)],
    ["last", at(0, 0), at(2, 0)],
  ] as const)("%s from %j gives %j", (move, from, to) => {
    const deck = createDeck(SLIDES, from);
    deck[move]();
    expect(deck.state).toEqual(to);
  });

  it("reports whether a move changed anything", () => {
    const deck = createDeck(SLIDES);
    expect(deck.prev()).toBe(false);
    expect(deck.prevSlide()).toBe(false);
    expect(deck.first()).toBe(false);
    expect(deck.next()).toBe(true);
    expect(deck.last()).toBe(true);
    expect(deck.last()).toBe(false);
  });

  it("moves a build without leaving the slide", () => {
    const deck = createDeck(SLIDES, at(1, 0));
    expect(deck.stepBuild(-1)).toBe(false);
    expect(deck.stepBuild(1)).toBe(true);
    expect(deck.stepBuild(1)).toBe(true);
    expect(deck.stepBuild(1)).toBe(false);
    expect(deck.state).toEqual(at(1, 2));
  });

  it("goTo clamps the slide and the build", () => {
    const deck = createDeck(SLIDES);
    deck.goTo(99, 9);
    expect(deck.state).toEqual(at(2, 1));
    deck.goTo(-4);
    expect(deck.state).toEqual(at(0, 0));
    deck.goTo(1, "all");
    expect(deck.state).toEqual(at(1, 2));
    deck.goTo(Number.NaN, Number.NaN);
    expect(deck.state).toEqual(at(0, 0));
  });

  it("goToId finds a slide by id and ignores an unknown one", () => {
    const deck = createDeck(SLIDES);
    expect(deck.goToId("manila", 1)).toBe(true);
    expect(deck.state).toEqual(at(1, 1));
    expect(deck.goToId("nope")).toBe(false);
    expect(deck.state).toEqual(at(1, 1));
  });

  it("returns a copy of the state", () => {
    const deck = createDeck(SLIDES);
    const copy = deck.state;
    copy.slide = 2;
    expect(deck.state).toEqual(at(0, 0));
  });
});

describe("parseHash and formatHash", () => {
  it.each([
    ["", at(0, 0)],
    ["#", at(0, 0)],
    ["#title", at(0, 0)],
    ["#manila", at(1, 0)],
    ["#manila/0", at(1, 0)],
    ["#manila/1", at(1, 1)],
    ["#manila/9", at(1, 2)],
    ["#manila/x", at(1, 0)],
    ["#manila/-1", at(1, 0)],
    ["#thanks/1", at(2, 1)],
    ["#title/3", at(0, 0)],
    ["#nope", at(0, 0)],
    ["#nope/2", at(0, 0)],
    ["#%E0%A4%A", at(0, 0)],
  ])("reads %j as %j", (hash, state) => {
    expect(parseHash(hash, SLIDES)).toEqual(state);
  });

  it.each([
    [at(0, 0), "#title"],
    [at(1, 0), "#manila"],
    [at(1, 2), "#manila/2"],
    [at(2, 1), "#thanks/1"],
    [at(1, 9), "#manila/2"],
    [at(9, 0), "#thanks"],
  ])("writes %j as %s", (state, hash) => {
    expect(formatHash(state, SLIDES)).toBe(hash);
  });

  it("round-trips every state the deck can reach", () => {
    const deck = createDeck(SLIDES);
    do {
      expect(parseHash(formatHash(deck.state, SLIDES), SLIDES)).toEqual(
        deck.state,
      );
    } while (deck.next());
  });
});

describe("goToHash", () => {
  it("opens the slide and build a fragment names", () => {
    const deck = createDeck(SLIDES);
    expect(deck.goToHash("#manila/2")).toBe(true);
    expect(deck.state).toEqual(at(1, 2));
  });

  it("leaves the deck alone for a fragment that names no slide", () => {
    const deck = createDeck(SLIDES, at(1, 1));
    expect(deck.goToHash("#nope")).toBe(false);
    expect(deck.goToHash("#")).toBe(false);
    expect(deck.goToHash("")).toBe(false);
    expect(deck.goToHash("#%E0%A4%A")).toBe(false);
    expect(deck.state).toEqual(at(1, 1));
  });

  it("is false when the fragment names the state already shown", () => {
    const deck = createDeck(SLIDES, at(1, 1));
    expect(deck.goToHash("#manila/1")).toBe(false);
  });
});

describe("reach", () => {
  const MANY: DeckSlide[] = [
    { id: "title", builds: 2 },
    { id: "manila", builds: 1 },
    { id: "thanks", builds: 0 },
  ];

  it("reaches every slide unless told otherwise", () => {
    expect(createDeck(MANY).reach).toBe(3);
  });

  it("walks the first slide's builds and stops there when only it is reachable", () => {
    const deck = createDeck(MANY, undefined, 1);
    const seen = [deck.state];
    while (deck.next()) seen.push(deck.state);
    expect(seen).toEqual([at(0, 0), at(0, 1), at(0, 2)]);
    expect(deck.nextSlide()).toBe(false);
    expect(deck.state).toEqual(at(0, 2));
  });

  it("changes nothing for a move to a slide out of reach", () => {
    const deck = createDeck(MANY, at(0, 1), 1);
    expect(deck.goTo(2)).toBe(false);
    expect(deck.goTo(99)).toBe(false);
    expect(deck.goToId("manila")).toBe(false);
    expect(deck.goToHash("#manila/1")).toBe(false);
    expect(deck.last()).toBe(true);
    expect(deck.state).toEqual(at(0, 0));
  });

  it("opens on the first slide when the start is out of reach", () => {
    expect(createDeck(MANY, at(2, 0), 1).state).toEqual(at(0, 0));
  });

  it("clamps the reach to the deck and opens the rest on a wider reach", () => {
    const deck = createDeck(MANY, at(0, 2), 0);
    expect(deck.reach).toBe(1);
    deck.setReach(99);
    expect(deck.reach).toBe(3);
    expect(deck.next()).toBe(true);
    expect(deck.state).toEqual(at(1, 0));
    expect(deck.last()).toBe(true);
    expect(deck.state).toEqual(at(2, 0));
  });

  it("brings the deck back within a narrower reach", () => {
    const deck = createDeck(MANY, at(2, 0));
    deck.setReach(1);
    expect(deck.state).toEqual(at(0, 0));
  });
});

describe("spare slides", () => {
  const WITH_SPARES: DeckSlide[] = [
    { id: "title", builds: 0 },
    { id: "qa", builds: 0 },
    { id: "thanks", builds: 1 },
    { id: "spare-a", builds: 0, spare: true },
    { id: "spare-b", builds: 2, spare: true },
  ];

  it("ends on the last main slide, not on a spare", () => {
    const deck = createDeck(WITH_SPARES);
    expect(deck.last()).toBe(true);
    expect(deck.state).toEqual(at(2, 0));
    expect(deck.last()).toBe(false);
  });

  it("never lands on a spare by next: the last main slide is the end", () => {
    const deck = createDeck(WITH_SPARES, at(2, 1));
    expect(deck.next()).toBe(false);
    expect(deck.nextSlide()).toBe(false);
    expect(deck.state).toEqual(at(2, 1));
  });

  it("opens a spare by id and by address", () => {
    const deck = createDeck(WITH_SPARES);
    expect(deck.goToId("spare-b")).toBe(true);
    expect(deck.state).toEqual(at(4, 0));
    expect(deck.goToHash("#spare-a")).toBe(true);
    expect(deck.state).toEqual(at(3, 0));
  });

  it("steps a spare's builds, then next returns to the questions", () => {
    const deck = createDeck(WITH_SPARES, at(4, 0));
    expect(deck.next()).toBe(true);
    expect(deck.next()).toBe(true);
    expect(deck.state).toEqual(at(4, 2));
    expect(deck.next()).toBe(true);
    expect(deck.state).toEqual(at(1, 0));
  });

  it("goes back from a spare to the one before it, and from the first spare to the questions", () => {
    const deck = createDeck(WITH_SPARES, at(4, 0));
    expect(deck.prev()).toBe(true);
    expect(deck.state).toEqual(at(3, 0));
    expect(deck.prev()).toBe(true);
    expect(deck.state).toEqual(at(1, 0));
  });
});
