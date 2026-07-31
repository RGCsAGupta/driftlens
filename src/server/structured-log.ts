export type LogLevel = "debug" | "info" | "warn" | "error";
export type OperationalEvent = "configuration.checked" | "request.completed";

export interface OperationalLog {
  component: "http" | "runtime";
  event: OperationalEvent;
  level: LogLevel;
  outcome?: "success" | "failure";
}

const ALLOWED_FIELDS = new Set(["component", "event", "level", "outcome"]);

function normalizeOperationalLog(record: unknown): OperationalLog | null {
  if (typeof record !== "object" || record === null) {
    return null;
  }

  const candidate = record as Record<string, unknown>;
  if (Object.keys(candidate).some((field) => !ALLOWED_FIELDS.has(field))) {
    return null;
  }

  const component = candidate.component;
  const event = candidate.event;
  const level = candidate.level;
  const outcome = candidate.outcome;
  const eventMatchesComponent =
    (component === "runtime" && event === "configuration.checked") ||
    (component === "http" && event === "request.completed");

  const levelAllowed =
    level === "debug" ||
    level === "info" ||
    level === "warn" ||
    level === "error";
  const outcomeAllowed =
    outcome === undefined || outcome === "success" || outcome === "failure";

  if (!eventMatchesComponent || !levelAllowed || !outcomeAllowed) {
    return null;
  }

  return {
    component,
    event,
    level,
    ...(outcome === undefined ? {} : { outcome }),
  };
}

export function serializeOperationalLog(record: OperationalLog): string {
  const normalizedRecord = normalizeOperationalLog(record);
  if (normalizedRecord === null) {
    throw new TypeError("Invalid operational log record.");
  }

  return JSON.stringify(normalizedRecord);
}
