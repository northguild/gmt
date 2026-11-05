import { firefoxEndpoint, launchBrowser } from "./browser-launch.mjs";

const LOOPBACK = "<loopback>";

type Engines = NonNullable<
  NonNullable<Parameters<typeof launchBrowser>[2]>["engines"]
>;

function fakeEngines() {
  const make = (name: string) => ({
    launch: vi.fn(async () => ({ name, version: () => "1.0" })),
    connect: vi.fn(async () => ({ name, version: () => "155.0" })),
  });
  const engines = {
    chromium: make("chromium"),
    firefox: make("firefox"),
    webkit: make("webkit"),
  };
  // The mocks stand in for Playwright's BrowserType; only launch and connect are used.
  return engines as typeof engines & Engines;
}

describe("firefoxEndpoint", () => {
  it("returns null when the variable is unset or empty", () => {
    expect(firefoxEndpoint({})).toBeNull();
    expect(firefoxEndpoint({ GMT_PW_FIREFOX_WS: "" })).toBeNull();
    expect(firefoxEndpoint({ GMT_PW_FIREFOX_WS: "   " })).toBeNull();
  });

  it("returns the trimmed ws or wss URL", () => {
    expect(
      firefoxEndpoint({ GMT_PW_FIREFOX_WS: " ws://127.0.0.1:3555/ " }),
    ).toBe("ws://127.0.0.1:3555/");
    expect(firefoxEndpoint({ GMT_PW_FIREFOX_WS: "wss://x.test/" })).toBe(
      "wss://x.test/",
    );
  });

  it("throws on a value that is not a ws URL", () => {
    expect(() => firefoxEndpoint({ GMT_PW_FIREFOX_WS: "http://x" })).toThrow(
      /ws:\/\//,
    );
  });
});

describe("launchBrowser", () => {
  it("launches Firefox itself when the variable is unset", async () => {
    const engines = fakeEngines();
    const options = { args: ["--x"] };
    await launchBrowser("firefox", options, { engines, env: {} });
    expect(engines.firefox.launch).toHaveBeenCalledTimes(1);
    expect(engines.firefox.launch).toHaveBeenCalledWith(options);
    expect(engines.firefox.connect).not.toHaveBeenCalled();
  });

  it("connects Firefox to the endpoint when the variable is set", async () => {
    const engines = fakeEngines();
    await launchBrowser(
      "firefox",
      {},
      {
        engines,
        env: { GMT_PW_FIREFOX_WS: "ws://127.0.0.1:3555/" },
      },
    );
    expect(engines.firefox.connect).toHaveBeenCalledWith(
      "ws://127.0.0.1:3555/",
      {
        exposeNetwork: LOOPBACK,
        timeout: 30000,
      },
    );
    expect(engines.firefox.launch).not.toHaveBeenCalled();
  });

  it("treats an empty value as unset", async () => {
    const engines = fakeEngines();
    await launchBrowser(
      "firefox",
      {},
      { engines, env: { GMT_PW_FIREFOX_WS: "" } },
    );
    expect(engines.firefox.launch).toHaveBeenCalledTimes(1);
    expect(engines.firefox.connect).not.toHaveBeenCalled();
  });

  it.each(["chromium", "webkit"] as const)(
    "launches %s whether or not the variable is set",
    async (name) => {
      for (const env of [{}, { GMT_PW_FIREFOX_WS: "ws://127.0.0.1:3555/" }]) {
        const engines = fakeEngines();
        await launchBrowser(name, {}, { engines, env });
        expect(engines[name].launch).toHaveBeenCalledTimes(1);
        expect(engines[name].connect).not.toHaveBeenCalled();
      }
    },
  );

  it("throws on a value that is not a ws URL", async () => {
    await expect(
      launchBrowser(
        "firefox",
        {},
        {
          engines: fakeEngines(),
          env: { GMT_PW_FIREFOX_WS: "http://x" },
        },
      ),
    ).rejects.toThrow(/ws:\/\//);
  });

  it("throws on an unknown engine, naming the three", async () => {
    await expect(
      launchBrowser("edge" as never, {}, { engines: fakeEngines(), env: {} }),
    ).rejects.toThrow(/chromium.*firefox.*webkit/);
  });
});
