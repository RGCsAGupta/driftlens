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

  it("accepts the allowlisted HTTP event and failure outcome", () => {
    expect(
      serializeOperationalLog({
        component: "http",
        event: "request.completed",
        level: "warn",
        outcome: "failure",
      }),
    ).toBe(
      '{"component":"http","event":"request.completed","level":"warn","outcome":"failure"}',
    );
  });

  it("rejects caller-controlled events", () => {
    expect(() =>
      serializeOperationalLog({
        component: "runtime",
        event: "credential.received",
        level: "info",
      } as never),
    ).toThrowError("Invalid operational log record.");
  });

  it("rejects extra fields before serialization", () => {
    expect(() =>
      serializeOperationalLog({
        component: "runtime",
        event: "configuration.checked",
        level: "info",
        requestId: "password-do-not-log",
      } as never),
    ).toThrowError("Invalid operational log record.");
  });

  it("serializes the validated snapshot instead of rereading caller properties", () => {
    let componentReads = 0;
    const changingRecord = {
      get component() {
        componentReads += 1;
        return componentReads === 1 ? "runtime" : "unsafe-caller-value";
      },
      event: "configuration.checked",
      level: "info",
    } as never;

    expect(serializeOperationalLog(changingRecord)).toBe(
      '{"component":"runtime","event":"configuration.checked","level":"info"}',
    );
    expect(componentReads).toBe(1);
  });
});
