/** @vitest-environment jsdom */
import { useEffect } from "react";
import { render } from "@testing-library/react";

// `@testing-library/react` registers its `afterEach(cleanup)` when the module is first
// evaluated. In the shared project the module is evaluated once per worker, so only the first
// file in each worker would get it; `setup-dom.ts` registers it for every file. These two tests
// run in order: the second checks that the first one's component was unmounted.
let unmounted = false;

function ListensToResize() {
  useEffect(() => {
    const onResize = () => undefined;
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      unmounted = true;
    };
  }, []);
  return <p>listening</p>;
}

describe("React cleanup between tests", () => {
  it("mounts a component that listens to the window", () => {
    render(<ListensToResize />);
    expect(unmounted).toBe(false);
  });

  it("unmounted the previous test's component, whatever file ran first in the worker", () => {
    expect(unmounted).toBe(true);
  });
});
