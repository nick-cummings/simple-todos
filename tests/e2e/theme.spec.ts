import { expect, test } from "@playwright/test";

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

test("toggles to dark theme and persists across reload", async ({ page }) => {
  // Defensive: don't depend on the test runner's OS preference for the
  // initial assertion — the inline bootstrap script reads matchMedia,
  // and CI may run in either mode. We only assert what the toggle does.
  await page.getByRole("radio", { name: /dark theme/i }).click();
  await expect(page.locator("html")).toHaveClass(/(^|\s)dark(\s|$)/);

  await page.reload();
  await expect(page.locator("html")).toHaveClass(/(^|\s)dark(\s|$)/);
});

test("switching back to Light removes the dark class", async ({ page }) => {
  await page.getByRole("radio", { name: /dark theme/i }).click();
  await expect(page.locator("html")).toHaveClass(/(^|\s)dark(\s|$)/);

  await page.getByRole("radio", { name: /light theme/i }).click();
  await expect(page.locator("html")).not.toHaveClass(/(^|\s)dark(\s|$)/);
});
