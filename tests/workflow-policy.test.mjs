import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { validateWorkflowPolicy } from "../scripts/workflow-policy.mjs";

const workflowPath = new URL(
  "../.github/workflows/trusted-delivery.yml",
  import.meta.url,
);

test("trusted workflow satisfies the canonical push and release contract", async () => {
  const workflow = await readFile(workflowPath, "utf8");

  assert.doesNotThrow(() => validateWorkflowPolicy(workflow));
});

test("running deployment remains non-cancellable when a newer revision arrives", async () => {
  const workflow = await readFile(workflowPath, "utf8");

  assert.match(
    workflow,
    /group: driftlens-private-deployment\n      cancel-in-progress: false/,
  );
});

test("mutable image tags fail the policy", async () => {
  const workflow = await readFile(workflowPath, "utf8");
  const unsafeWorkflow = workflow.replace(
    "driftlens:${GITHUB_SHA}",
    "driftlens:latest",
  );

  assert.throws(() => validateWorkflowPolicy(unsafeWorkflow));
});

test("an unapproved action fails even when pinned to a full SHA", async () => {
  const workflow = await readFile(workflowPath, "utf8");
  const unsafeWorkflow = workflow.replace("actions/cache@", "example/cache@");

  assert.throws(() => validateWorkflowPolicy(unsafeWorkflow));
});

test("a build-version mismatch fails the smoke policy", async () => {
  const workflow = await readFile(workflowPath, "utf8");
  const unsafeWorkflow = workflow.replace(
    'driftlens-smoke \\\n              "$GITHUB_SHA"',
    'driftlens-smoke \\\n              "$GITHUB_REF_NAME"',
  );

  assert.throws(() => validateWorkflowPolicy(unsafeWorkflow));
});
