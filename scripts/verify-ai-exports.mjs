#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const PROHIBITED_SUBMISSION_PATTERNS = [
  /github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9_]{20,}|sk-proj-[A-Za-z0-9_-]{20,}|sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}/i,
  /\b(?:Authorization:\s*)?(?:Bearer|Basic)\s+[^\s"']+/i,
  /\b(?:[A-Z][A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|API_KEY|PRIVATE_KEY))=[^\\\s"']{4,}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/,
  /\bssh:[^@\s"']+@[^:\s"']+(?::\d+)?/i,
  /\b(?:10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2})\b/,
  /\/(?:root|home|Users)\/[^\s"'`<>]+/,
  /\bpve(?:[-_]?(?:host[-_]?)?\d+)?(?:\.[a-z0-9-]+)*\b/i,
  /\bvm[-_ ]?\d+(?:\.[a-z0-9-]+)*\b/i,
  /\bdriftlens-(?:app|application)(?:-host)?(?:-\d+)?(?:\.[a-z0-9-]+)*\b/i,
  /\bdriftlens-(?:(?:ci|deploy)-)?runner(?:-host)?(?:-\d+)?(?:\.[a-z0-9-]+)*\b/i,
];

function fail(message) {
  process.stderr.write(`AI export verification: ${message}\n`);
  process.exit(2);
}

function parseJson(file, label) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    fail(`${label} is missing or invalid JSON`);
  }
}

function parseJsonLines(file) {
  let raw;
  try {
    raw = readFileSync(file, "utf8");
  } catch {
    fail("a submitted session is missing");
  }
  const lines = raw.trimEnd().split(/\r?\n/);
  const records = lines.map((line) => {
    try {
      return JSON.parse(line);
    } catch {
      fail("a submitted session contains invalid JSONL");
    }
  });
  return { lines, raw, records };
}

function containsProhibitedMaterial(value) {
  if (typeof value === "string") {
    return PROHIBITED_SUBMISSION_PATTERNS.some((pattern) =>
      pattern.test(value),
    );
  }
  if (Array.isArray(value)) {
    return value.some(containsProhibitedMaterial);
  }
  if (value && typeof value === "object") {
    return Object.entries(value).some(
      ([key, entry]) =>
        containsProhibitedMaterial(key) || containsProhibitedMaterial(entry),
    );
  }
  return false;
}

const indexPath = resolve(process.argv[2] ?? "docs/ai-interactions/index.json");
const index = parseJson(indexPath, "export index");
if (index.version !== 1 || !Array.isArray(index.exported)) {
  fail("export index schema is unsupported");
}

const directory = dirname(indexPath);
const sessionIds = new Set();
const submittedFiles = new Set();
for (const entry of index.exported) {
  if (
    entry?.status !== "completed" ||
    entry?.finalReview !== "pass" ||
    !Number.isSafeInteger(entry?.lines) ||
    entry.lines < 1
  ) {
    fail("an export index entry is invalid or not completed");
  }
  if (
    sessionIds.has(entry.sessionId) ||
    submittedFiles.has(entry.sessionFile)
  ) {
    fail("the export index contains a duplicate session or submitted file");
  }
  sessionIds.add(entry.sessionId);
  submittedFiles.add(entry.sessionFile);

  const sessionPath = resolve(directory, entry.sessionFile);
  const submitted = parseJsonLines(sessionPath);
  if (submitted.records.some(containsProhibitedMaterial)) {
    fail("a submitted session contains prohibited public-evidence material");
  }
  const sessionId = submitted.records.find(
    (record) => record?.type === "session_meta",
  )?.payload?.id;
  if (sessionId !== entry.sessionId) {
    fail("a submitted session ID does not match its index entry");
  }
  if (submitted.lines.length !== entry.lines) {
    fail("a submitted session line count does not match its index entry");
  }
  const checksum = createHash("sha256").update(submitted.raw).digest("hex");
  if (checksum !== entry.sha256) {
    fail("a submitted session checksum does not match its index entry");
  }

  const report = parseJson(
    resolve(directory, entry.redactionReport),
    "redaction report",
  );
  if (
    report.sourceSessionId !== entry.sessionId ||
    report.submittedFile !== entry.sessionFile.split("/").at(-1) ||
    report.inputLines !== entry.lines ||
    report.outputLines !== entry.lines ||
    !Array.isArray(report.redactions)
  ) {
    fail("a redaction report does not reconcile to its submitted session");
  }
}

process.stdout.write(
  `AI export verification passed: ${index.exported.length} completed session copies.\n`,
);
