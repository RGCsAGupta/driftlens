import { expect, test, type Page } from "@playwright/test";

const SHA = "0123456789abcdef0123456789abcdef01234567";
const ID = "196cdf62-4da8-49cb-a47c-6e717523af48";

function scan(overrides: Record<string, unknown> = {}) {
  return {
    completedAt: null,
    createdAt: "2026-07-31T12:00:00.000Z",
    desired: null,
    differences: [],
    durable: true,
    error: null,
    explanation: {
      analysis: null,
      error: null,
      requestedAt: null,
      savedAt: null,
      state: "NOT_REQUESTED",
    },
    id: ID,
    live: null,
    outcome: null,
    requestedRef: "main",
    resolvedSha: null,
    stage: "QUEUED",
    stages: [{ at: "2026-07-31T12:00:00.000Z", stage: "QUEUED" }],
    status: "QUEUED",
    target: null,
    updatedAt: "2026-07-31T12:00:00.000Z",
    ...overrides,
  };
}

async function controlledApi(page: Page) {
  let detailIndex = 0;
  let completed = false;
  const stages = [
    "LOADING_DESIRED",
    "READING_LIVE",
    "COMPARING",
    "SAVING_RESULT",
  ];
  const final = scan({
    completedAt: "2026-07-31T12:00:04.000Z",
    differences: [
      { desired: 2, field: "spec.replicas", live: 1 },
      {
        desired: "app:2",
        field: "spec.template.spec.containers[name=app].image",
        live: "app:1",
      },
    ],
    outcome: "DRIFTED",
    resolvedSha: SHA,
    stage: "COMPLETED",
    status: "COMPLETED",
    target: {
      apiVersion: "apps/v1",
      kind: "Deployment",
      name: "app",
      namespace: "demo",
    },
  });

  await page.route("**/api/source", (route) =>
    route.fulfill({
      json: {
        source: { manifestPath: "deploy/app.yaml", repository: "owner/repo" },
      },
    }),
  );
  await page.route("**/api/scans?limit=20", (route) =>
    route.fulfill({ json: { scans: completed ? [final] : [] } }),
  );
  await page.route(`**/api/scans/${ID}`, (route) => {
    const stage = stages[detailIndex++];
    if (!stage) {
      completed = true;
      return route.fulfill({ json: { scan: final } });
    }
    return route.fulfill({
      json: { scan: scan({ stage, status: "RUNNING" }) },
    });
  });
  await page.route("**/api/scans", async (route) => {
    if (route.request().method() === "POST")
      return route.fulfill({ json: { scan: scan() }, status: 202 });
    return route.fallback();
  });
}

test("operator starts, follows, reviews, and reloads a scan accessibly", async ({
  page,
}) => {
  await controlledApi(page);
  await page.goto("/");

  await expect(page.getByText("owner/repo")).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Branch or commit SHA")).toBeFocused();
  await page.getByLabel("Branch or commit SHA").fill("main");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Run scan" })).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(
    page.getByRole("button", { name: "Scan in progress…" }),
  ).toBeDisabled();
  for (const stage of [
    "Loading desired manifest",
    "Reading live Deployment",
    "Comparing supported fields",
    "Saving result",
    "Completed",
  ]) {
    await expect(page.getByRole("status")).toContainText(stage);
  }
  await expect(page.getByText("DRIFTED", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("table", { name: "Supported field differences" }),
  ).toContainText("Container app image");
  await expect(page.getByText("demo/app", { exact: true })).toBeVisible();
  await expect(page.getByText(SHA)).toBeVisible();
  await expect(
    page.getByRole("button", { name: /main.*COMPLETED.*DRIFTED/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Target: demo\/app/i }),
  ).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`\\?scan=${ID}$`));

  await page.reload();
  await expect(page.getByText("DRIFTED", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Run scan" })).toBeEnabled();
});
