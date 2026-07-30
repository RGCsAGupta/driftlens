import { describe, expect, it } from "vitest";

import { serializeOperationalLog } from "./structured-log";

describe("serializeOperationalLog", () => {
  it("serializes only the narrow operational record", () => {
    expect(
      serializeOperationalLog({
        component: "runtime",
        event: "configuration.checked",
        level: "info",
        outcome: "success",
      }),
    ).toBe(
      '{"component":"runtime","event":"configuration.checked","level":"info","outcome":"success"}',
    );
  });
});
