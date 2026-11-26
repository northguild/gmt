import { findModelContext } from "./model-context";

const context = () => ({ registerTool: () => undefined });
const as = <T>(value: unknown): T => value as T;

describe("findModelContext", () => {
  it("prefers the document's model context", () => {
    const fromDoc = context();
    const found = findModelContext(
      as<Document>({ modelContext: fromDoc }),
      as<Navigator>({ modelContext: context() }),
    );
    expect(found).toBe(fromDoc);
  });

  it("falls back to the navigator's", () => {
    const fromNav = context();
    const found = findModelContext(
      as<Document>({}),
      as<Navigator>({ modelContext: fromNav }),
    );
    expect(found).toBe(fromNav);
  });

  it("skips one whose registerTool is not a function", () => {
    const fromNav = context();
    const found = findModelContext(
      as<Document>({ modelContext: { registerTool: "no" } }),
      as<Navigator>({ modelContext: fromNav }),
    );
    expect(found).toBe(fromNav);
  });

  it("finds none when neither has a usable one", () => {
    expect(
      findModelContext(
        as<Document>({ modelContext: null }),
        as<Navigator>({ modelContext: {} }),
      ),
    ).toBeNull();
  });

  it("treats a getter that throws as absent", () => {
    const fromNav = context();
    const doc = {};
    Object.defineProperty(doc, "modelContext", {
      get() {
        throw new Error("blocked by policy");
      },
    });
    expect(findModelContext(as<Document>(doc), as<Navigator>({}))).toBeNull();
    expect(
      findModelContext(
        as<Document>(doc),
        as<Navigator>({ modelContext: fromNav }),
      ),
    ).toBe(fromNav);
  });
});
