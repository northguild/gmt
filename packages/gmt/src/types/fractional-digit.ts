/**
 * How many fractional-second digits an ISO string is written with, as Temporal's
 * `fractionalSecondDigits` option of `toString()`. `0` to `9` writes exactly that many digits,
 * and `"auto"` writes as many as the value needs, with no trailing zeros.
 */
export type FractionalDigit = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | "auto";
