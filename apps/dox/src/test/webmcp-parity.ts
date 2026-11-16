/**
 * The WebMCP parity harness.
 *
 * `fakeModelContext()` stands in for `document.modelContext`: it records each registered tool and
 * refuses a duplicate name the way the platform does. `expectParity` mounts the page's widget,
 * reads the facts its redraw computed, then calls the tool and expects the same facts back. The
 * test file wraps the pure facts function in `vi.fn` through `vi.mock` and passes that mock in, so
 * the harness never reaches into the widget.
 *
 * Import it only from a `@vitest-environment jsdom` file.
 */
import { expect } from "vitest";
import type { AnyWidgetEntry } from "~/components/ask/widget-registry";
import type {
  ModelContextLike,
  ModelContextToolInit,
  PageToolResult,
} from "~/lib/webmcp/model-context";
import {
  flushWidget,
  renderWidget,
  type RenderedWidget,
} from "./render-widget";

export interface FakeModelContext {
  context: ModelContextLike;
  /** The registered tools, by name. */
  tools: Map<string, ModelContextToolInit>;
}

export function fakeModelContext(): FakeModelContext {
  const tools = new Map<string, ModelContextToolInit>();
  const context: ModelContextLike = {
    registerTool(tool, options) {
      if (tools.has(tool.name)) {
        return Promise.reject(
          new DOMException(
            `Tool "${tool.name}" is registered`,
            "InvalidStateError",
          ),
        );
      }
      tools.set(tool.name, tool);
      options?.signal?.addEventListener(
        "abort",
        () => tools.delete(tool.name),
        {
          once: true,
        },
      );
      return Promise.resolve();
    },
  };
  return { context, tools };
}

const asJson = (value: unknown): unknown =>
  value === undefined ? undefined : JSON.parse(JSON.stringify(value));

export interface ParityOptions {
  entry: AnyWidgetEntry;
  /** The widget's args and the tool's input: the same object feeds both. */
  args: Record<string, unknown>;
  /** The pure facts function, wrapped in `vi.fn` by the test's `vi.mock`. */
  facts: {
    mockClear(): unknown;
    mock: { results: { type: string; value?: unknown }[] };
  };
  tool: ModelContextToolInit;
  /** Runs against the mounted page and the tool's result, before teardown. */
  inspect?: (
    page: RenderedWidget,
    result: PageToolResult<unknown>,
  ) => void | Promise<void>;
}

/**
 * Mounts the page for `args`, then calls the tool with the same `args`. The tool's `result` must
 * deep-equal what the page's redraw computed, as JSON carries it. Everything is torn down before it returns.
 */
export async function expectParity({
  entry,
  args,
  facts,
  tool,
  inspect,
}: ParityOptions): Promise<PageToolResult<unknown>> {
  facts.mockClear();
  const controller = new AbortController();
  const page = await renderWidget(entry, { args });
  try {
    await flushWidget();
    const onPage = facts.mock.results.at(-1);
    expect(onPage?.type, "the page computed its facts").toBe("return");
    const result = await tool.execute(args, { signal: controller.signal });
    expect(result.ok).toBe(true);
    // The page's value as JSON carries it: an `undefined` in an array is `null` on the wire.
    if (result.ok) expect(result.result).toEqual(asJson(onPage?.value));
    await inspect?.(page, result);
    return result;
  } finally {
    page.destroy();
    controller.abort();
  }
}
