export function isValidAmount(value: number): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
