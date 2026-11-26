import { HOME_LOCKED_QUERY } from "../../src/lib/home-carousel";
import { LOCKED_QUERY } from "./home-locked.mjs";

it("is the landing's own query, so a gate and the page agree on which layout they see", () => {
  expect(LOCKED_QUERY).toBe(HOME_LOCKED_QUERY);
});
