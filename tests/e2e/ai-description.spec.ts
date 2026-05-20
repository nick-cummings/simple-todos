import { test, expect } from "@playwright/test";

/**
 * E2E for the AI description generator.
 *
 * We intercept `/api/generate-description` so tests don't hit Anthropic
 * (saves money, makes them deterministic, removes the dependency on
 * ANTHROPIC_API_KEY being set in CI/local). The route handler itself is
 * already covered by route.test.ts.
 */

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload();
  await page.waitForLoadState("networkidle");
});

test("populates the description field from a mocked API success", async ({
  page,
}) => {
  await page.route("**/api/generate-description", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        description: "Mocked AI-generated description.",
      }),
    });
  });

  await page.getByRole("button", { name: /add todo/i }).click();
  const dialog = page.getByRole("dialog", { name: /new todo/i });
  await dialog.getByPlaceholder(/what needs doing/i).fill("find coffee");
  await dialog
    .getByRole("button", { name: /generate description with ai/i })
    .click();

  await expect(dialog.getByPlaceholder(/notes, links/i)).toHaveValue(
    "Mocked AI-generated description.",
  );
});

test("shows an inline error message when the API returns 429", async ({
  page,
}) => {
  await page.route("**/api/generate-description", async (route) => {
    await route.fulfill({
      status: 429,
      contentType: "application/json",
      body: JSON.stringify({
        error: "Rate limit reached. Try again in ~5 min.",
      }),
    });
  });

  await page.getByRole("button", { name: /add todo/i }).click();
  const dialog = page.getByRole("dialog", { name: /new todo/i });
  await dialog.getByPlaceholder(/what needs doing/i).fill("buy something");
  await dialog
    .getByRole("button", { name: /generate description with ai/i })
    .click();

  await expect(dialog.getByText(/rate limit reached/i)).toBeVisible();
  // Description stays empty.
  await expect(dialog.getByPlaceholder(/notes, links/i)).toHaveValue("");
});

test("AI button is disabled when the title is empty", async ({ page }) => {
  await page.getByRole("button", { name: /add todo/i }).click();
  const dialog = page.getByRole("dialog", { name: /new todo/i });
  const aiButton = dialog.getByRole("button", {
    name: /generate description with ai/i,
  });
  await expect(aiButton).toBeDisabled();
  await dialog.getByPlaceholder(/what needs doing/i).fill("x");
  await expect(aiButton).toBeEnabled();
});
