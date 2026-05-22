import { expect, type Page, test } from "@playwright/test";

async function submitTodoForm(page: Page) {
  await page.locator('button[form="todo-form"]').click();
}

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

test.describe("label management end-to-end", () => {
  test("creates a label from the Labels manager", async ({ page }) => {
    await page.getByRole("button", { name: /manage labels/i }).click();
    const manager = page.getByRole("dialog", { name: /manage labels/i });
    await manager.getByPlaceholder(/new label name/i).fill("home");
    await manager.getByRole("button", { name: /^add$/i }).click();
    // The label now appears in the manager as a pill.
    await expect(manager.getByText("home")).toBeVisible();
  });

  test("rename in the manager propagates to existing todos", async ({
    page,
  }) => {
    // Create a todo with a "work" label inline first.
    await page.getByRole("button", { name: /add todo/i }).click();
    const dialog = page.getByRole("dialog", { name: /new todo/i });
    await dialog.getByPlaceholder(/what needs doing/i).fill("Email Bob");
    await dialog.getByPlaceholder(/new label name/i).fill("work");
    // Click the label-create "Add" button (inside NewLabelRow — NOT the
    // form submit). Pick the one inside the dialog body, not the footer.
    await dialog
      .locator('button:not([form="todo-form"])')
      .filter({ hasText: /^Add$/ })
      .click();
    await submitTodoForm(page);

    // Label pill is visible on the card.
    await expect(
      page
        .getByRole("listitem")
        .filter({ hasText: "Email Bob" })
        .getByText("work"),
    ).toBeVisible();

    // Open the Labels manager and rename "work" → "office".
    await page.getByRole("button", { name: /manage labels/i }).click();
    const manager = page.getByRole("dialog", { name: /manage labels/i });
    await manager.getByRole("button", { name: /edit work/i }).click();
    // The row with data-label-name="work" contains the inline edit input.
    const editInput = manager.locator('[data-label-name="work"] input').first();
    await editInput.fill("office");
    await editInput.press("Enter");
    await manager.getByRole("button", { name: /^done$/i }).click();

    // The "work" pill on the todo card now reads "office".
    await expect(
      page
        .getByRole("listitem")
        .filter({ hasText: "Email Bob" })
        .getByText("office"),
    ).toBeVisible();
  });

  test("creates a label via the inline NewLabelRow in the todo modal", async ({
    page,
  }) => {
    // Different creation path than the manager: inline in the todo form.
    await page.getByRole("button", { name: /add todo/i }).click();
    const dialog = page.getByRole("dialog", { name: /new todo/i });
    await dialog.getByPlaceholder(/what needs doing/i).fill("Inline label");
    await dialog.getByPlaceholder(/new label name/i).fill("just-here");
    await dialog
      .locator('button:not([form="todo-form"])')
      .filter({ hasText: /^Add$/ })
      .click();
    await submitTodoForm(page);
    // The new label is on the todo and registered globally — open the
    // manager to confirm it shows up there too.
    await page.getByRole("button", { name: /manage labels/i }).click();
    const manager = page.getByRole("dialog", { name: /manage labels/i });
    await expect(
      manager.locator('[data-label-name="just-here"]'),
    ).toBeVisible();
  });

  test("toggling labels on a todo via the picker persists across reopen", async ({
    page,
  }) => {
    // Seed: a todo + an existing label.
    await page.getByRole("button", { name: /add todo/i }).click();
    const dialog = page.getByRole("dialog", { name: /new todo/i });
    await dialog.getByPlaceholder(/what needs doing/i).fill("Picker test");
    await dialog.getByPlaceholder(/new label name/i).fill("optional");
    await dialog
      .locator('button:not([form="todo-form"])')
      .filter({ hasText: /^Add$/ })
      .click();
    await submitTodoForm(page);

    const card = page.getByRole("listitem").filter({ hasText: "Picker test" });
    await expect(card.getByText("optional")).toBeVisible();

    // Open in view → edit → toggle the label off. The dialog's
    // aria-label flips to "Edit todo" after the Edit click, so we
    // re-acquire the dialog locator by the new name.
    await card.getByRole("button", { name: /^Picker test/ }).click();
    await page.getByRole("button", { name: /^edit$/i }).click();
    const editDialog = page.getByRole("dialog", { name: /edit todo/i });
    await editDialog
      .getByRole("button", { name: "optional", pressed: true })
      .click();
    await submitTodoForm(page);

    // After save the modal flips back to view mode — the body's
    // labels list no longer contains "optional". Close and confirm
    // the card's pill is gone too.
    const view = page.getByRole("dialog", { name: /todo details/i });
    await view.getByRole("button", { name: /^close$/i }).click();
    await expect(card.getByText("optional")).not.toBeVisible();
  });

  test("recolor updates the swatch shown in the manager", async ({ page }) => {
    // Seed a label.
    await page.getByRole("button", { name: /manage labels/i }).click();
    const manager = page.getByRole("dialog", { name: /manage labels/i });
    await manager.getByPlaceholder(/new label name/i).fill("color-me");
    await manager.getByRole("button", { name: /^add$/i }).click();

    // Open the row's edit mode and the color picker.
    await manager.getByRole("button", { name: /edit color-me/i }).click();
    const swatchTrigger = manager.getByRole("button", {
      name: /color-me color$/i,
    });
    // Snapshot the trigger background before the recolor; the
    // inner dot's `background` style mirrors the current swatch.
    const beforeBg = await swatchTrigger
      .locator("span[aria-hidden]")
      .getAttribute("style");

    await swatchTrigger.click();
    const popover = page.getByRole("dialog", {
      name: /color-me color options/i,
    });
    await popover
      .getByRole("button", { name: /color-me color: blue/i })
      .click();

    // After picking, the trigger's inner dot reflects the new color
    // (the picker closes and the row re-renders with the new swatch).
    await expect(
      swatchTrigger.locator("span[aria-hidden]"),
    ).not.toHaveAttribute("style", beforeBg ?? "");
  });

  test("delete in the manager strips the label from every todo", async ({
    page,
  }) => {
    // Seed: create a todo with two labels via NewLabelRow inside the
    // create-todo dialog.
    await page.getByRole("button", { name: /add todo/i }).click();
    const dialog = page.getByRole("dialog", { name: /new todo/i });
    await dialog.getByPlaceholder(/what needs doing/i).fill("Meeting prep");
    for (const labelName of ["work", "urgent"]) {
      await dialog.getByPlaceholder(/new label name/i).fill(labelName);
      await dialog
        .locator('button:not([form="todo-form"])')
        .filter({ hasText: /^Add$/ })
        .click();
    }
    await submitTodoForm(page);

    const card = page.getByRole("listitem").filter({ hasText: "Meeting prep" });
    await expect(card.getByText("work")).toBeVisible();
    await expect(card.getByText("urgent")).toBeVisible();

    // Open manager, peek-delete "work".
    await page.getByRole("button", { name: /manage labels/i }).click();
    const manager = page.getByRole("dialog", { name: /manage labels/i });
    // Trash icon → peek state.
    await manager.getByRole("button", { name: /^delete work$/i }).click();
    // Confirm.
    await manager.getByRole("button", { name: /confirm delete work/i }).click();
    await manager.getByRole("button", { name: /^done$/i }).click();

    // The "work" pill is gone; "urgent" remains.
    await expect(card.getByText("work")).not.toBeVisible();
    await expect(card.getByText("urgent")).toBeVisible();
  });
});
