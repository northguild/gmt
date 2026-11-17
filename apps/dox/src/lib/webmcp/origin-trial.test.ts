import { ORIGIN_TRIAL_TOKENS, parseOriginTrialTokens } from "./origin-trial";

const VARIABLE = "WEBMCP_ORIGIN_TRIAL_TOKEN";

describe("parseOriginTrialTokens", () => {
  it.each([
    ["unset", undefined, []],
    ["empty", "", []],
    ["blank", " \n\t ", []],
    ["one token", "AqT0k3n==", ["AqT0k3n=="]],
    ["one token with a trailing newline", "AqT0k3n==\n", ["AqT0k3n=="]],
    ["two tokens on two lines", "0ld==\nN3w==", ["0ld==", "N3w=="]],
    ["two tokens on one line", "  0ld==   N3w==  ", ["0ld==", "N3w=="]],
    ["a repeat", "0ld==\nN3w==\n0ld==", ["0ld==", "N3w=="]],
  ])("reads %s", (_label, value, tokens) => {
    expect(parseOriginTrialTokens(value)).toEqual(tokens);
  });
});

describe("ORIGIN_TRIAL_TOKENS", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("holds what the build's variable holds, set or not", () => {
    expect(ORIGIN_TRIAL_TOKENS).toEqual(
      parseOriginTrialTokens(process.env[VARIABLE]),
    );
  });

  it.each([
    ["unset", undefined, []],
    ["blank", "  ", []],
    ["two tokens and a repeat", "0ld==\nN3w==\n0ld==", ["0ld==", "N3w=="]],
  ])(
    "is read from the variable when it is %s",
    async (_label, value, tokens) => {
      vi.stubEnv(VARIABLE, value);
      vi.resetModules();
      const fresh = await import("./origin-trial");
      expect(fresh.ORIGIN_TRIAL_TOKENS).toEqual(tokens);
    },
  );
});
