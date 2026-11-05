import { chooseZone, type ZoneActionDeps } from "./zone-action";

function deps(known: readonly string[]) {
  const calls: string[] = [];
  const api: ZoneActionDeps<string> = {
    rotationFor: (id) => (known.includes(id) ? `at ${id}` : null),
    flyTo: (rotation) => calls.push(`fly ${rotation}`),
    select: (id) => calls.push(`select ${id}`),
  };
  return { api, calls };
}

describe("chooseZone", () => {
  it("centres on the zone, then selects it", () => {
    const { api, calls } = deps(["Europe/Lisbon"]);
    chooseZone(api, "Europe/Lisbon");
    expect(calls).toEqual(["fly at Europe/Lisbon", "select Europe/Lisbon"]);
  });

  it("selects a zone with no coordinate without moving the globe", () => {
    const { api, calls } = deps([]);
    chooseZone(api, "Etc/Nowhere");
    expect(calls).toEqual(["select Etc/Nowhere"]);
  });

  it("clears the selection without moving the globe", () => {
    const { api, calls } = deps(["Europe/Lisbon"]);
    chooseZone(api, null);
    expect(calls).toEqual(["select null"]);
  });
});
