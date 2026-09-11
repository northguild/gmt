/// <reference types="vitest/globals" />

import { namespaceFromPageContext } from "./namespace-from-page";

describe("namespaceFromPageContext", () => {
  it("reads the namespace from a reference page", () => {
    expect(namespaceFromPageContext("/reference/zoned/add/addZoned/")).toBe(
      "zoned",
    );
  });

  it("reads the top-level directory of a guide page", () => {
    expect(
      namespaceFromPageContext("/guides/core-date-operations/adding/"),
    ).toBe("core-date-operations");
  });

  it("has nothing to bias toward on /dox, the homepage, or another route", () => {
    for (const path of ["/dox/", "/", "/tools/zoned-earth/"]) {
      expect(namespaceFromPageContext(path)).toBeUndefined();
    }
  });

  it("has nothing to bias toward without a page context", () => {
    expect(namespaceFromPageContext(undefined)).toBeUndefined();
    expect(namespaceFromPageContext("")).toBeUndefined();
  });
});
