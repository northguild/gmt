import { namespaceFromPageContext } from "../../worker/namespace-from-page";
import { MAX_PAGE_CONTEXT_LENGTH } from "./chat-sanitize";
import { pageContextFromReferrer } from "./page-context";

const ORIGIN = "https://northguild.dev";

describe("pageContextFromReferrer", () => {
  it("returns the path of the same-origin page the reader came from", () => {
    expect(
      pageContextFromReferrer(
        `${ORIGIN}/gmt/reference/zoned/add/addZoned/`,
        ORIGIN,
      ),
    ).toBe("/reference/zoned/add/addZoned/");
  });

  it("drops the query string and fragment", () => {
    expect(
      pageContextFromReferrer(
        `${ORIGIN}/gmt/guides/timezones/?tab=1#dst`,
        ORIGIN,
      ),
    ).toBe("/guides/timezones/");
  });

  it("ignores another site's URL", () => {
    expect(
      pageContextFromReferrer(
        "https://example.com/gmt/reference/zoned/",
        ORIGIN,
      ),
    ).toBeUndefined();
  });

  it("ignores /dox itself — a reload or a conversation started there", () => {
    expect(
      pageContextFromReferrer(`${ORIGIN}/gmt/dox/`, ORIGIN),
    ).toBeUndefined();
    expect(
      pageContextFromReferrer(`${ORIGIN}/gmt/dox`, ORIGIN),
    ).toBeUndefined();
    // Only the route, not every path that happens to start with the letters.
    expect(pageContextFromReferrer(`${ORIGIN}/gmt/doxology/`, ORIGIN)).toBe(
      "/doxology/",
    );
  });

  it("ignores a page outside the base — the landing page, or /gmtx", () => {
    expect(pageContextFromReferrer(`${ORIGIN}/`, ORIGIN)).toBeUndefined();
    expect(pageContextFromReferrer(`${ORIGIN}/gmtx/`, ORIGIN)).toBeUndefined();
    expect(
      pageContextFromReferrer(`${ORIGIN}/reference/zoned/`, ORIGIN),
    ).toBeUndefined();
  });

  it("returns nothing when there is no usable referrer", () => {
    expect(pageContextFromReferrer("", ORIGIN)).toBeUndefined();
    expect(pageContextFromReferrer("not a url", ORIGIN)).toBeUndefined();
  });

  it("sends nothing rather than a path the Worker would reject as too long", () => {
    const long = `/gmt/reference/${"a".repeat(MAX_PAGE_CONTEXT_LENGTH)}/`;
    expect(pageContextFromReferrer(`${ORIGIN}${long}`, ORIGIN)).toBeUndefined();
  });

  it("lands on the namespace retrieval biases toward", () => {
    // The two halves meet at the Worker: this is the whole point of sending it.
    const context = pageContextFromReferrer(
      `${ORIGIN}/gmt/reference/zoned/add/addZoned/`,
      ORIGIN,
    );
    expect(namespaceFromPageContext(context)).toBe("zoned");
  });
});
