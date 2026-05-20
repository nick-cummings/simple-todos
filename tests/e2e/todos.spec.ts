import { test, expect, type Page } from "@playwright/test";

/**
 * Submit the todo form. There are two "Add" buttons in the new-todo
 * dialog — the label-create one inside NewLabelRow, and the form submit
 * at the bottom. The submit one has `form="todo-form"`, so we key off
 * that.
 */
async function submitTodoForm(page: Page) {
  await page.locator('button[form="todo-form"]').click();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  // Wait for hydration so subsequent `evaluate()` localStorage calls
  // don't get clobbered by a hydration-time read.
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload();
  await page.waitForLoadState("networkidle");
});

test.describe("todo CRUD", () => {
  test("creates a todo via the FAB and modal", async ({ page }) => {
    await expect(page.getByText("No todos yet")).toBeVisible();
    await page.getByRole("button", { name: /add todo/i }).click();
    const dialog = page.getByRole("dialog", { name: /new todo/i });
    await dialog.getByPlaceholder(/what needs doing/i).fill("Buy milk");
    await submitTodoForm(page);
    await expect(page.getByText("Buy milk")).toBeVisible();
    // Open count badge shows 1.
    await expect(page.getByText(/^1 open$/i)).toBeVisible();
  });

  test("toggles completion and respects the open/done filter", async ({
    page,
  }) => {
    await page.getByRole("button", { name: /add todo/i }).click();
    await page
      .getByRole("dialog")
      .getByPlaceholder(/what needs doing/i)
      .fill("Walk dog");
    await submitTodoForm(page);

    const card = page.getByText("Walk dog");
    await expect(card).toBeVisible();

    // Complete the todo via its checkbox.
    await page.getByRole("checkbox", { name: /mark as done/i }).click();
    // Default filter hides completed → card disappears.
    await expect(card).not.toBeVisible();

    // Toggle the Done status chip → completed todo reappears.
    await page.getByRole("button", { name: /^done /i }).click();
    await expect(card).toBeVisible();
  });

  test("edits an existing todo's title", async ({ page }) => {
    await page.getByRole("button", { name: /add todo/i }).click();
    await page
      .getByRole("dialog")
      .getByPlaceholder(/what needs doing/i)
      .fill("Read book");
    await submitTodoForm(page);

    // Open the todo card to view, then edit.
    await page.getByText("Read book").click();
    await page.getByRole("button", { name: /^edit$/i }).click();

    const titleField = page
      .getByRole("dialog")
      .getByPlaceholder(/what needs doing/i);
    await titleField.fill("Read book (revised)");
    await submitTodoForm(page);

    await expect(page.getByText("Read book (revised)")).toBeVisible();
    await expect(page.getByText(/^Read book$/)).not.toBeVisible();
  });

  test("deletes a todo from the edit modal", async ({ page }) => {
    await page.getByRole("button", { name: /add todo/i }).click();
    await page
      .getByRole("dialog")
      .getByPlaceholder(/what needs doing/i)
      .fill("Throwaway todo");
    await submitTodoForm(page);

    await page.getByText("Throwaway todo").click();
    await page.getByRole("button", { name: /^delete$/i }).click();
    // Modal exits with a ~220ms animation; wait for it to detach first.
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByText("Throwaway todo")).toHaveCount(0);
    await expect(page.getByText(/no todos yet/i)).toBeVisible();
  });

  test("persists todos across a page reload", async ({ page }) => {
    await page.getByRole("button", { name: /add todo/i }).click();
    await page
      .getByRole("dialog")
      .getByPlaceholder(/what needs doing/i)
      .fill("Persist me");
    await submitTodoForm(page);

    await expect(page.getByText("Persist me")).toBeVisible();
    await page.reload();
    await expect(page.getByText("Persist me")).toBeVisible();
  });
});

test.describe("search + sort + clear completed", () => {
  test("filters the visible list by search query", async ({ page }) => {
    // Seed two todos.
    for (const title of ["Buy milk", "Read book"]) {
      await page.getByRole("button", { name: /add todo/i }).click();
      await page
        .getByRole("dialog")
        .getByPlaceholder(/what needs doing/i)
        .fill(title);
      await submitTodoForm(page);
    }
    await expect(page.getByText("Buy milk")).toBeVisible();
    await expect(page.getByText("Read book")).toBeVisible();

    await page.getByPlaceholder(/search todos/i).fill("milk");
    await expect(page.getByText("Buy milk")).toBeVisible();
    await expect(page.getByText("Read book")).not.toBeVisible();

    await page.getByPlaceholder(/search todos/i).fill("");
    await expect(page.getByText("Read book")).toBeVisible();
  });

  test("clear completed removes only completed todos", async ({ page }) => {
    for (const title of ["Keep me", "Drop me"]) {
      await page.getByRole("button", { name: /add todo/i }).click();
      await page
        .getByRole("dialog")
        .getByPlaceholder(/what needs doing/i)
        .fill(title);
      await submitTodoForm(page);
    }
    // Toggle "Drop me" complete (the most recent add appears first).
    const dropCheckbox = page
      .getByRole("listitem")
      .filter({ hasText: "Drop me" })
      .getByRole("checkbox");
    await dropCheckbox.click();

    // Show completed; clear completed button appears.
    await page.getByRole("button", { name: /^done /i }).click();
    await page.getByRole("button", { name: /clear completed/i }).click();

    await expect(page.getByText("Drop me")).not.toBeVisible();
    await expect(page.getByText("Keep me")).toBeVisible();
  });
});

test.describe("keyboard shortcuts", () => {
  test("⌘K (or Ctrl+K) focuses the search input", async ({
    page,
    browserName,
  }) => {
    const meta = browserName === "webkit" ? "Meta" : "Control";
    await page.keyboard.press(`${meta}+KeyK`);
    await expect(page.getByPlaceholder(/search todos/i)).toBeFocused();
  });
});
