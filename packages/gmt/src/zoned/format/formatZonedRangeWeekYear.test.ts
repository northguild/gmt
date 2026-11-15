import { runInBoundedChild } from "../../test/boundedChild";

/*
 * CORE-112 (D23): V8 without commit 0426b0d1045d aborts the whole process (SIGTRAP, exit 133,
 * nodejs/node#67076) on a `formatRangeToParts` call whose range pattern holds the week-of-year year
 * field. The D16 zone-name repair used that call, so this range aborted Node. The call runs in a
 * child process: the red state is the child crashing, never the Vitest worker.
 *
 * The expected zone names are the requested `long` ones from the single-date parts at each
 * endpoint (ECMA-402 FormatDateTimePattern: the `timeZoneName` part), read from the same child.
 */
describe("formatZonedRange — no abort on a Burmese Buddhist-calendar range (D23)", () => {
  const from = "2026-07-01T09:30:00+06:30[Asia/Yangon]";
  const to = "2026-07-04T09:30:00+06:30[Asia/Yangon]";
  const options =
    '{ hour: "numeric", minute: "numeric", timeZoneName: "long" }';

  it("returns a range holding the long zone name of each endpoint, in a child process", async () => {
    const run = await runInBoundedChild([
      `gmt.formatZonedRange("${from}", "${to}", "my-u-ca-buddhist", ${options})`,
      `gmt.formatZonedToParts("${from}", "my-u-ca-buddhist", ${options}).find((part) => part.type === "timeZoneName")?.value`,
      `gmt.formatZonedToParts("${to}", "my-u-ca-buddhist", ${options}).find((part) => part.type === "timeZoneName")?.value`,
    ]);
    expect(
      { timedOut: run.timedOut, crashed: run.crashed },
      run.stderr,
    ).toEqual({ timedOut: false, crashed: false });
    const [range, startName, endName] = run.calls.map((call) => call.value);
    expect(startName).toEqual(expect.any(String));
    expect(endName).toEqual(expect.any(String));
    expect(range).toEqual(expect.any(String));
    expect(range).toContain(startName);
    expect(range).toContain(endName);
  });
});
