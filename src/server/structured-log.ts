export type LogLevel = "debug" | "info" | "warn" | "error";

export interface OperationalLog {
  component: "http" | "runtime";
  event: string;
  level: LogLevel;
  outcome?: "success" | "failure";
  requestId?: string;
}

export function serializeOperationalLog(record: OperationalLog): string {
  return JSON.stringify(record);
}
