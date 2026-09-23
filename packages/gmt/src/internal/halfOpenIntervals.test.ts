import {
  halfOpenAbuts,
  halfOpenContainsPoint,
  halfOpenContainsSpan,
  halfOpenDifference,
  halfOpenIntersection,
  halfOpenMerge,
  halfOpenOverlap,
  halfOpenUnion,
  halfOpenXor,
} from "./halfOpenIntervals";

// Plain numbers stand in for any ordered value type; the helpers only ever call `compare`.
const compare = (left: number, right: number) => left - right;
const span = (start: number, end: number) => ({ start, end });

describe("halfOpenOverlap", () => {
  // CORE-6 §3 intervalsOverlap: A.start < B.end && B.start < A.end.
  it.each`
    a             | b             | expected | reason
    ${span(1, 5)} | ${span(3, 8)} | ${true}  | ${"partial overlap"}
    ${span(1, 3)} | ${span(3, 5)} | ${false} | ${"touching shares no value"}
    ${span(3, 5)} | ${span(1, 3)} | ${false} | ${"touching, reversed order"}
    ${span(3, 3)} | ${span(3, 8)} | ${false} | ${"empty at the start edge"}
    ${span(8, 8)} | ${span(3, 8)} | ${false} | ${"empty at the end edge"}
    ${span(5, 5)} | ${span(3, 8)} | ${true}  | ${"empty strictly inside"}
    ${span(5, 5)} | ${span(5, 5)} | ${false} | ${"identical empties"}
  `("returns $expected for $reason", ({ a, b, expected }) => {
    expect(halfOpenOverlap(a, b, compare)).toBe(expected);
  });
});

describe("halfOpenContainsPoint", () => {
  it.each`
    interval      | point | expected | reason
    ${span(1, 5)} | ${1}  | ${true}  | ${"start is inside"}
    ${span(1, 5)} | ${5}  | ${false} | ${"end is outside"}
    ${span(1, 5)} | ${4}  | ${true}  | ${"last value before end"}
    ${span(3, 3)} | ${3}  | ${false} | ${"empty interval contains nothing"}
  `("returns $expected for $reason", ({ interval, point, expected }) => {
    expect(halfOpenContainsPoint(interval, point, compare)).toBe(expected);
  });
});

describe("halfOpenContainsSpan", () => {
  // Inner ⊆ outer and the two overlap, so an empty inner counts only strictly inside
  // (CORE-6 §3 clampInterval: an empty interval at an edge clamps to null).
  it.each`
    outer         | inner         | expected | reason
    ${span(1, 9)} | ${span(3, 9)} | ${true}  | ${"same end"}
    ${span(1, 9)} | ${span(1, 9)} | ${true}  | ${"equal"}
    ${span(1, 9)} | ${span(0, 9)} | ${false} | ${"starts before"}
    ${span(1, 9)} | ${span(5, 5)} | ${true}  | ${"empty strictly inside"}
    ${span(1, 9)} | ${span(1, 1)} | ${false} | ${"empty at the start edge"}
    ${span(1, 9)} | ${span(9, 9)} | ${false} | ${"empty at the end edge"}
    ${span(5, 5)} | ${span(5, 5)} | ${false} | ${"empty in empty"}
  `("returns $expected for $reason", ({ outer, inner, expected }) => {
    expect(halfOpenContainsSpan(outer, inner, compare)).toBe(expected);
  });
});

describe("halfOpenIntersection", () => {
  it.each`
    a             | b             | expected      | reason
    ${span(1, 5)} | ${span(3, 8)} | ${span(3, 5)} | ${"partial overlap"}
    ${span(1, 3)} | ${span(3, 5)} | ${null}       | ${"touching"}
    ${span(5, 5)} | ${span(3, 8)} | ${span(5, 5)} | ${"empty strictly inside"}
    ${span(3, 3)} | ${span(3, 8)} | ${null}       | ${"empty at an edge"}
  `("returns $expected for $reason", ({ a, b, expected }) => {
    expect(halfOpenIntersection(a, b, compare)).toEqual(expected);
  });
});

describe("halfOpenMerge", () => {
  // CORE-6 §1.2 coalesce: touching coalesces, empties are absorbed or dropped.
  it.each`
    spans                                    | expected                    | reason
    ${[]}                                    | ${[]}                       | ${"empty list"}
    ${[span(3, 8), span(1, 3)]}              | ${[span(1, 8)]}             | ${"touching coalesces, sorted"}
    ${[span(1, 3), span(4, 8)]}              | ${[span(1, 3), span(4, 8)]} | ${"gap keeps both"}
    ${[span(5, 5)]}                          | ${[]}                       | ${"stranded empty dropped"}
    ${[span(3, 3), span(3, 8)]}              | ${[span(3, 8)]}             | ${"empty at a start is absorbed"}
    ${[span(1, 9), span(2, 3), span(4, 12)]} | ${[span(1, 12)]}            | ${"chain"}
  `("returns $expected for $reason", ({ spans, expected }) => {
    expect(halfOpenMerge(spans, compare)).toEqual(expected);
  });
});

describe("halfOpenUnion", () => {
  it.each`
    a             | b             | expected      | reason
    ${span(1, 3)} | ${span(3, 5)} | ${span(1, 5)} | ${"touching"}
    ${span(1, 3)} | ${span(4, 5)} | ${null}       | ${"gap"}
    ${span(9, 9)} | ${span(1, 5)} | ${span(1, 5)} | ${"stranded empty is the empty set"}
    ${span(5, 5)} | ${span(5, 5)} | ${null}       | ${"two empties have no non-empty union"}
  `("returns $expected for $reason", ({ a, b, expected }) => {
    expect(halfOpenUnion(a, b, compare)).toEqual(expected);
  });
});

describe("halfOpenDifference", () => {
  it.each`
    from          | remove                      | expected                                | reason
    ${span(1, 9)} | ${[span(3, 5)]}             | ${[span(1, 3), span(5, 9)]}             | ${"inside cuts at the removal's edges"}
    ${span(1, 9)} | ${[span(1, 9)]}             | ${[]}                                   | ${"fully covered"}
    ${span(1, 9)} | ${[span(9, 12)]}            | ${[span(1, 9)]}                         | ${"touching removal removes nothing"}
    ${span(1, 9)} | ${[span(5, 5)]}             | ${[span(1, 9)]}                         | ${"empty removal removes nothing"}
    ${span(4, 4)} | ${[span(1, 2)]}             | ${[]}                                   | ${"empty from"}
    ${span(1, 9)} | ${[span(6, 7), span(2, 3)]} | ${[span(1, 2), span(3, 6), span(7, 9)]} | ${"unsorted removals"}
  `("returns $expected for $reason", ({ from, remove, expected }) => {
    expect(halfOpenDifference(from, remove, compare)).toEqual(expected);
  });
});

describe("halfOpenXor", () => {
  it.each`
    spans                                   | expected                                | reason
    ${[span(1, 5), span(3, 8)]}             | ${[span(1, 3), span(5, 8)]}             | ${"partial overlap"}
    ${[span(1, 9), span(3, 5)]}             | ${[span(1, 3), span(5, 9)]}             | ${"nested"}
    ${[span(1, 3), span(3, 5)]}             | ${[span(1, 5)]}                         | ${"touching is one maximal run"}
    ${[span(6, 8), span(1, 3)]}             | ${[span(1, 3), span(6, 8)]}             | ${"disjoint, sorted"}
    ${[span(1, 3), span(1, 3)]}             | ${[]}                                   | ${"identical cancel"}
    ${[span(5, 5), span(1, 9)]}             | ${[span(1, 9)]}                         | ${"empty contributes nothing"}
    ${[span(1, 9), span(2, 6), span(4, 8)]} | ${[span(1, 2), span(4, 6), span(8, 9)]} | ${"odd coverage of three"}
  `("returns $expected for $reason", ({ spans, expected }) => {
    expect(halfOpenXor(spans, compare)).toEqual(expected);
  });
});

describe("halfOpenAbuts", () => {
  it.each`
    a             | b             | expected | reason
    ${span(1, 3)} | ${span(3, 5)} | ${true}  | ${"shared endpoint"}
    ${span(3, 5)} | ${span(1, 3)} | ${true}  | ${"shared endpoint, reversed"}
    ${span(1, 3)} | ${span(4, 5)} | ${false} | ${"gap"}
    ${span(1, 4)} | ${span(3, 5)} | ${false} | ${"overlap"}
    ${span(3, 3)} | ${span(3, 5)} | ${false} | ${"empty intervals abut nothing"}
    ${span(3, 3)} | ${span(3, 3)} | ${false} | ${"identical empties"}
  `("returns $expected for $reason", ({ a, b, expected }) => {
    expect(halfOpenAbuts(a, b, compare)).toBe(expected);
  });
});
