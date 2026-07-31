#!/usr/bin/env node

import {
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, resolve } from "node:path";

const SESSION_ID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
const SENSITIVE_KEY_CATEGORIES = new Map(
  [
    ["accesskey", "CREDENTIAL"],
    ["accesskeyid", "CREDENTIAL"],
    ["accesstoken", "CREDENTIAL"],
    ["apikey", "CREDENTIAL"],
    ["authorization", "CREDENTIAL"],
    ["authtoken", "CREDENTIAL"],
    ["certificateauthoritydata", "KUBECONFIG MATERIAL"],
    ["clientcertificatedata", "KUBECONFIG MATERIAL"],
    ["clientkeydata", "KUBECONFIG MATERIAL"],
    ["clientsecret", "CREDENTIAL"],
    ["credential", "CREDENTIAL"],
    ["credentials", "CREDENTIAL"],
    ["password", "CREDENTIAL"],
    ["privatekey", "PRIVATE KEY"],
    ["refreshtoken", "CREDENTIAL"],
    ["secret", "CREDENTIAL"],
    ["secretaccesskey", "CREDENTIAL"],
    ["secretkey", "CREDENTIAL"],
    ["token", "CREDENTIAL"],
  ].map(([key, category]) => [key, category]),
);
const REDACTION_MARKERS = {
  CREDENTIAL: "[REDACTED: CREDENTIAL]",
  "KUBECONFIG MATERIAL": "[REDACTED: KUBECONFIG MATERIAL]",
  "PRIVATE KEY": "[REDACTED: PRIVATE KEY]",
};
const REDACTION_RULES = [
  {
    category: "CREDENTIAL",
    marker: "[REDACTED: CREDENTIAL]",
    pattern:
      /github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9_]{20,}|sk-proj-[A-Za-z0-9_-]{20,}|sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}/g,
  },
  {
    category: "CREDENTIAL",
    marker: "[REDACTED: CREDENTIAL]",
    pattern: /\b(?:Authorization:\s*)?(?:Bearer|Basic)\s+[^\s"']+/gi,
  },
  {
    category: "CREDENTIAL",
    marker: "[REDACTED: CREDENTIAL]",
    pattern:
      /\b(?:[A-Z][A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|API_KEY|PRIVATE_KEY))=[^\s"']+/g,
  },
  {
    category: "PRIVATE KEY",
    marker: "[REDACTED: PRIVATE KEY]",
    pattern:
      /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
  },
  {
    category: "KUBECONFIG MATERIAL",
    marker: "[REDACTED: KUBECONFIG MATERIAL]",
    pattern:
      /\b(?:token|client-key-data|client-certificate-data|certificate-authority-data):\s*[^\s"']+/gi,
  },
  {
    category: "PERSONAL DATA",
    marker: "[REDACTED: PERSONAL DATA]",
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
  },
  {
    category: "PRIVATE TOPOLOGY",
    marker: "[REDACTED: PRIVATE TOPOLOGY]",
    pattern: /\bssh:[^@\s"']+@[^:\s"']+(?::\d+)?/gi,
  },
  {
    category: "PRIVATE NETWORK",
    marker: "[REDACTED: PRIVATE NETWORK]",
    pattern:
      /\b(?:10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2})\b/g,
  },
  {
    category: "LOCAL PATH",
    marker: "[REDACTED: LOCAL PATH]",
    pattern: /\/(?:root|home|Users)\/[^\s"'`<>]+/g,
  },
];

function fail(message) {
  process.stderr.write(`AI session export: ${message}\n`);
  process.exit(2);
}

function jsonPath(parent, key) {
  return Array.isArray(parent) ? `[${key}]` : `.${key}`;
}

function sensitiveKeyCategory(key) {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "");
  const exactCategory = SENSITIVE_KEY_CATEGORIES.get(normalized);
  if (exactCategory) {
    return exactCategory;
  }

  const segments = key
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  if (segments.length < 2) {
    return undefined;
  }
  return SENSITIVE_KEY_CATEGORIES.get(segments.at(-1));
}

function redactSensitiveValue(category, locator, lineNumber, redactions) {
  const marker = REDACTION_MARKERS[category];
  redactions.push({ category, jsonPath: locator, line: lineNumber, marker });
  return marker;
}

function uniqueRedactedKey(key, output) {
  if (!Object.hasOwn(output, key)) {
    return key;
  }
  let suffix = 2;
  while (Object.hasOwn(output, `${key}#${suffix}`)) {
    suffix += 1;
  }
  return `${key}#${suffix}`;
}

function redactString(value, locator, lineNumber, redactions) {
  let sanitized = value;
  for (const rule of REDACTION_RULES) {
    sanitized = sanitized.replace(rule.pattern, () => {
      redactions.push({
        category: rule.category,
        jsonPath: locator,
        line: lineNumber,
        marker: rule.marker,
      });
      return rule.marker;
    });
  }
  return sanitized;
}

function redactValue(value, locator, lineNumber, redactions) {
  if (typeof value === "string") {
    return redactString(value, locator, lineNumber, redactions);
  }
  if (Array.isArray(value)) {
    return value.map((entry, index) =>
      redactValue(
        entry,
        `${locator}${jsonPath(value, index)}`,
        lineNumber,
        redactions,
      ),
    );
  }
  if (value && typeof value === "object") {
    const output = {};
    for (const [key, entry] of Object.entries(value)) {
      const redactedKey = uniqueRedactedKey(
        redactString(key, `${locator}.[KEY]`, lineNumber, redactions),
        output,
      );
      const entryLocator = `${locator}${jsonPath(value, redactedKey)}`;
      const category = sensitiveKeyCategory(key);
      output[redactedKey] = category
        ? redactSensitiveValue(category, entryLocator, lineNumber, redactions)
        : redactValue(entry, entryLocator, lineNumber, redactions);
    }
    return output;
  }
  return value;
}

function parseJsonLines(raw) {
  const lines = raw.split(/\r?\n/);
  if (lines.at(-1) === "") {
    lines.pop();
  }
  if (lines.length === 0) {
    fail("source is empty");
  }

  return lines.map((line, index) => {
    try {
      return JSON.parse(line);
    } catch {
      fail(`source line ${index + 1} is not valid JSON`);
    }
  });
}

function categoryCounts(redactions) {
  const counts = {};
  for (const { category } of redactions) {
    counts[category] = (counts[category] ?? 0) + 1;
  }
  return counts;
}

const [sourceArgument, expectedId, destinationArgument, reportArgument] =
  process.argv.slice(2);
if (
  !sourceArgument ||
  !SESSION_ID.test(expectedId ?? "") ||
  !destinationArgument ||
  !reportArgument
) {
  fail(
    "usage: node scripts/export-ai-session.mjs SOURCE.jsonl SESSION_ID DESTINATION.jsonl REPORT.json",
  );
}

const source = resolve(sourceArgument);
const destination = resolve(destinationArgument);
const report = resolve(reportArgument);
if (source === destination || source === report || destination === report) {
  fail("source, destination, and report must be different files");
}

let records;
try {
  records = parseJsonLines(readFileSync(source, "utf8"));
} catch (error) {
  if (error?.code === "ENOENT") {
    fail("source is not readable");
  }
  throw error;
}

const sourceSessionId = records.find(
  (record) => record?.type === "session_meta",
)?.payload?.id;
if (sourceSessionId !== expectedId) {
  fail("source session ID does not match the expected inventory ID");
}

const redactions = [];
const sanitizedRecords = records.map((record, index) =>
  redactValue(record, "$", index + 1, redactions),
);
const output = `${sanitizedRecords.map((record) => JSON.stringify(record)).join("\n")}\n`;

for (const line of output.trimEnd().split("\n")) {
  JSON.parse(line);
}

const exportReport = {
  categoryCounts: categoryCounts(redactions),
  inputLines: records.length,
  outputLines: sanitizedRecords.length,
  redactions,
  sourceSessionId,
  submittedFile: basename(destination),
};

mkdirSync(dirname(destination), { recursive: true });
mkdirSync(dirname(report), { recursive: true });
const temporaryDestination = `${destination}.tmp`;
const temporaryReport = `${report}.tmp`;
try {
  writeFileSync(temporaryDestination, output, { mode: 0o600 });
  writeFileSync(temporaryReport, `${JSON.stringify(exportReport, null, 2)}\n`, {
    mode: 0o600,
  });
  renameSync(temporaryDestination, destination);
  renameSync(temporaryReport, report);
} finally {
  rmSync(temporaryDestination, { force: true });
  rmSync(temporaryReport, { force: true });
}

process.stdout.write(
  `AI session export complete: ${records.length} JSONL lines, ${redactions.length} redactions.\n`,
);
