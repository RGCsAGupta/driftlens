import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

const exporter = resolve("scripts/export-ai-session.mjs");
const verifier = resolve("scripts/verify-ai-exports.mjs");
const sessionId = "019fb868-da36-7251-b5e5-bf2448d1c492";

function fixtureDirectory(): string {
  return mkdtempSync(join(tmpdir(), "driftlens-ai-export-"));
}

describe("AI session exporter", () => {
  it("retains complete JSONL while redacting sensitive categories", () => {
    const directory = fixtureDirectory();
    const source = join(directory, "source.jsonl");
    const destination = join(directory, "submitted.jsonl");
    const report = join(directory, "redactions.json");
    const token = `gh${"p_"}${"A".repeat(24)}`;
    try {
      writeFileSync(
        source,
        [
          JSON.stringify({ type: "session_meta", payload: { id: sessionId } }),
          JSON.stringify({
            type: "response_item",
            payload: {
              text: `credential ${token}; email person@example.test; host 192.168.10.5; target ssh:root@10.0.0.5:22; path /root/private/source`,
            },
          }),
        ].join("\n") + "\n",
      );

      execFileSync(
        process.execPath,
        [exporter, source, sessionId, destination, report],
        { encoding: "utf8" },
      );

      const submitted = readFileSync(destination, "utf8");
      const redactions = JSON.parse(readFileSync(report, "utf8"));
      expect(submitted.trimEnd().split("\n")).toHaveLength(2);
      expect(() =>
        submitted
          .trimEnd()
          .split("\n")
          .forEach((line) => JSON.parse(line)),
      ).not.toThrow();
      expect(submitted).not.toContain(token);
      expect(submitted).not.toContain("person@example.test");
      expect(submitted).not.toContain("192.168.10.5");
      expect(submitted).not.toContain("ssh:root@10.0.0.5:22");
      expect(submitted).not.toContain("/root/private/source");
      expect(redactions.categoryCounts).toEqual({
        CREDENTIAL: 1,
        "LOCAL PATH": 1,
        "PERSONAL DATA": 1,
        "PRIVATE NETWORK": 1,
        "PRIVATE TOPOLOGY": 1,
      });
      expect(redactions.redactions).toHaveLength(5);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("exports a safe session without inventing redactions", () => {
    const directory = fixtureDirectory();
    const source = join(directory, "source.jsonl");
    const destination = join(directory, "submitted.jsonl");
    const report = join(directory, "redactions.json");
    try {
      writeFileSync(
        source,
        `${JSON.stringify({ type: "session_meta", payload: { id: sessionId, deployment: "driftlens-demo" } })}\n`,
      );
      execFileSync(
        process.execPath,
        [exporter, source, sessionId, destination, report],
        { encoding: "utf8" },
      );

      expect(JSON.parse(readFileSync(report, "utf8")).redactions).toEqual([]);
      expect(readFileSync(destination, "utf8")).toContain("driftlens-demo");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("redacts synthetic internal host and VM labels as private topology", () => {
    const directory = fixtureDirectory();
    const source = join(directory, "source.jsonl");
    const destination = join(directory, "submitted.jsonl");
    const report = join(directory, "redactions.json");
    const privateLabels = [
      "pve-host-42",
      "vm-4242",
      "driftlens-app-host-42",
      "driftlens-runner-host-42",
    ];
    try {
      writeFileSync(
        source,
        [
          JSON.stringify({ type: "session_meta", payload: { id: sessionId } }),
          JSON.stringify({
            type: "response_item",
            payload: {
              deployment: "driftlens-demo",
              labels: privateLabels,
            },
          }),
        ].join("\n") + "\n",
      );

      execFileSync(
        process.execPath,
        [exporter, source, sessionId, destination, report],
        { encoding: "utf8" },
      );

      const submitted = readFileSync(destination, "utf8");
      for (const label of privateLabels) {
        expect(submitted).not.toContain(label);
      }
      expect(submitted).toContain("driftlens-demo");
      expect(JSON.parse(readFileSync(report, "utf8")).categoryCounts).toEqual({
        "PRIVATE TOPOLOGY": 4,
      });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("redacts entire nested values selected by normalized sensitive keys", () => {
    const directory = fixtureDirectory();
    const source = join(directory, "source.jsonl");
    const destination = join(directory, "submitted.jsonl");
    const report = join(directory, "redactions.json");
    try {
      writeFileSync(
        source,
        [
          JSON.stringify({ type: "session_meta", payload: { id: sessionId } }),
          JSON.stringify({
            type: "response_item",
            payload: {
              api_key: "short-safe-looking-value",
              database_password: "also-short",
              github_token: "tiny-prefixed-token",
              max_output_tokens: 1024,
              nested: [
                { token: "tiny" },
                { private_key: { material: "not-pattern-shaped" } },
                { "client-key-data": ["also", "not-pattern-shaped"] },
              ],
              pathMap: {
                "/root/private/first": "one",
                "/root/private/second": "two",
              },
              token_budget: 4096,
              user: "safe-user",
            },
          }),
        ].join("\n") + "\n",
      );

      execFileSync(
        process.execPath,
        [exporter, source, sessionId, destination, report],
        { encoding: "utf8" },
      );

      const records = readFileSync(destination, "utf8")
        .trimEnd()
        .split("\n")
        .map((line) => JSON.parse(line));
      expect(records[1].payload).toEqual({
        api_key: "[REDACTED: CREDENTIAL]",
        database_password: "[REDACTED: CREDENTIAL]",
        github_token: "[REDACTED: CREDENTIAL]",
        max_output_tokens: 1024,
        nested: [
          { token: "[REDACTED: CREDENTIAL]" },
          { private_key: "[REDACTED: PRIVATE KEY]" },
          { "client-key-data": "[REDACTED: KUBECONFIG MATERIAL]" },
        ],
        pathMap: {
          "[REDACTED: LOCAL PATH]": "one",
          "[REDACTED: LOCAL PATH]#2": "two",
        },
        token_budget: 4096,
        user: "safe-user",
      });
      expect(JSON.parse(readFileSync(report, "utf8")).categoryCounts).toEqual({
        CREDENTIAL: 4,
        "KUBECONFIG MATERIAL": 1,
        "LOCAL PATH": 2,
        "PRIVATE KEY": 1,
      });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("fails closed for invalid JSON or the wrong inventory ID", () => {
    const directory = fixtureDirectory();
    const source = join(directory, "source.jsonl");
    const destination = join(directory, "submitted.jsonl");
    const report = join(directory, "redactions.json");
    try {
      writeFileSync(source, "not-json\n");
      expect(
        spawnSync(process.execPath, [
          exporter,
          source,
          sessionId,
          destination,
          report,
        ]).status,
      ).toBe(2);
      expect(existsSync(destination)).toBe(false);

      writeFileSync(
        source,
        `${JSON.stringify({ type: "session_meta", payload: { id: sessionId } })}\n`,
      );
      expect(
        spawnSync(process.execPath, [
          exporter,
          source,
          "019fb869-0231-7f40-908f-3c9e12957e3d",
          destination,
          report,
        ]).status,
      ).toBe(2);
      expect(existsSync(destination)).toBe(false);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

describe("AI session export verifier", () => {
  it("reconciles session ID, line count, report, and checksum", () => {
    const directory = fixtureDirectory();
    const source = join(directory, "source.jsonl");
    const destination = join(directory, "submitted.jsonl");
    const report = join(directory, "redactions.json");
    const index = join(directory, "index.json");
    try {
      writeFileSync(
        source,
        `${JSON.stringify({ type: "session_meta", payload: { id: sessionId } })}\n`,
      );
      execFileSync(
        process.execPath,
        [exporter, source, sessionId, destination, report],
        { encoding: "utf8" },
      );
      const checksum = createHash("sha256")
        .update(readFileSync(destination))
        .digest("hex");
      writeFileSync(
        index,
        JSON.stringify({
          version: 1,
          exported: [
            {
              finalReview: "pass",
              lines: 1,
              purpose: "test",
              redactionReport: "redactions.json",
              sessionFile: "submitted.jsonl",
              sessionId,
              sha256: checksum,
              status: "completed",
            },
          ],
        }),
      );

      expect(() =>
        execFileSync(process.execPath, [verifier, index], {
          encoding: "utf8",
        }),
      ).not.toThrow();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("fails closed while final review is pending", () => {
    const directory = fixtureDirectory();
    const source = join(directory, "source.jsonl");
    const destination = join(directory, "submitted.jsonl");
    const report = join(directory, "redactions.json");
    const index = join(directory, "index.json");
    try {
      writeFileSync(
        source,
        `${JSON.stringify({ type: "session_meta", payload: { id: sessionId } })}\n`,
      );
      execFileSync(
        process.execPath,
        [exporter, source, sessionId, destination, report],
        { encoding: "utf8" },
      );
      const checksum = createHash("sha256")
        .update(readFileSync(destination))
        .digest("hex");
      writeFileSync(
        index,
        JSON.stringify({
          version: 1,
          exported: [
            {
              finalReview: "pending",
              lines: 1,
              purpose: "test",
              redactionReport: "redactions.json",
              sessionFile: "submitted.jsonl",
              sessionId,
              sha256: checksum,
              status: "completed",
            },
          ],
        }),
      );

      expect(spawnSync(process.execPath, [verifier, index]).status).toBe(2);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("fails closed when a checksum does not reconcile", () => {
    const directory = fixtureDirectory();
    const destination = join(directory, "submitted.jsonl");
    const report = join(directory, "redactions.json");
    const index = join(directory, "index.json");
    try {
      writeFileSync(
        destination,
        `${JSON.stringify({ type: "session_meta", payload: { id: sessionId } })}\n`,
      );
      writeFileSync(
        report,
        JSON.stringify({
          inputLines: 1,
          outputLines: 1,
          redactions: [],
          sourceSessionId: sessionId,
          submittedFile: "submitted.jsonl",
        }),
      );
      writeFileSync(
        index,
        JSON.stringify({
          version: 1,
          exported: [
            {
              finalReview: "pass",
              lines: 1,
              purpose: "test",
              redactionReport: "redactions.json",
              sessionFile: "submitted.jsonl",
              sessionId,
              sha256: "0".repeat(64),
              status: "completed",
            },
          ],
        }),
      );

      expect(spawnSync(process.execPath, [verifier, index]).status).toBe(2);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("fails closed when a submitted session retains internal labels", () => {
    const directory = fixtureDirectory();
    const destination = join(directory, "submitted.jsonl");
    const report = join(directory, "redactions.json");
    const index = join(directory, "index.json");
    try {
      const submitted = `${JSON.stringify({
        type: "session_meta",
        payload: {
          id: sessionId,
          deployment: "driftlens-demo",
          labels: [
            "pve-host-42",
            "vm-4242",
            "driftlens-app-host-42",
            "driftlens-deploy-runner-42",
          ],
        },
      })}\n`;
      writeFileSync(destination, submitted);
      writeFileSync(
        report,
        JSON.stringify({
          inputLines: 1,
          outputLines: 1,
          redactions: [],
          sourceSessionId: sessionId,
          submittedFile: "submitted.jsonl",
        }),
      );
      writeFileSync(
        index,
        JSON.stringify({
          version: 1,
          exported: [
            {
              finalReview: "pass",
              lines: 1,
              purpose: "test",
              redactionReport: "redactions.json",
              sessionFile: "submitted.jsonl",
              sessionId,
              sha256: createHash("sha256").update(submitted).digest("hex"),
              status: "completed",
            },
          ],
        }),
      );

      expect(spawnSync(process.execPath, [verifier, index]).status).toBe(2);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
