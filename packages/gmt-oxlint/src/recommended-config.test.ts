import { readFileSync } from "node:fs";
import plugin from "./index";

describe("recommended config artifact", () => {
  it("matches plugin.configs.recommended.rules", () => {
    const raw = readFileSync(
      new URL("../config/recommended.json", import.meta.url),
      "utf-8",
    );
    const json = JSON.parse(raw) as {
      rules?: Record<string, string>;
    };

    expect(json.rules).toEqual(plugin.configs?.recommended?.rules);
  });
});
