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

test.describe("Settings page", () => {
    test("settings link in header navigates to /settings", async ({ page }) => {
        await page.getByRole("link", { name: /^settings$/i }).click();
        await expect(page).toHaveURL(/\/settings$/);
        await expect(
            page.getByRole("heading", { name: /^settings$/i }),
        ).toBeVisible();
    });

    test("back link returns to /", async ({ page }) => {
        await page.goto("/settings");
        await page.getByRole("link", { name: /back to todos/i }).click();
        await expect(page).toHaveURL(/\/$/);
    });

    test("clear all data wipes todos and reloads", async ({ page }) => {
        // Seed a todo first.
        await page.getByRole("button", { name: /add todo/i }).click();
        await page
            .getByRole("dialog", { name: /new todo/i })
            .getByPlaceholder(/what needs doing/i)
            .fill("To be deleted");
        await page.locator('button[form="todo-form"]').click();
        await expect(page.getByText("To be deleted")).toBeVisible();
        // Go to settings and clear.
        await page.getByRole("link", { name: /^settings$/i }).click();
        await page.getByRole("button", { name: /clear all data/i }).click();
        await page
            .getByRole("dialog")
            .getByRole("button", { name: /clear everything/i })
            .click();
        // We bounce back to / via location.assign("/")
        await expect(page).toHaveURL(/\/$/);
        await expect(page.getByText("To be deleted")).not.toBeVisible();
        await expect(page.getByText(/no todos yet/i)).toBeVisible();
    });

    test("export downloads a JSON backup with the current todos", async ({
        page,
    }) => {
        // Seed.
        await page.getByRole("button", { name: /add todo/i }).click();
        await page
            .getByRole("dialog", { name: /new todo/i })
            .getByPlaceholder(/what needs doing/i)
            .fill("Backup me");
        await page.locator('button[form="todo-form"]').click();

        await page.getByRole("link", { name: /^settings$/i }).click();
        const downloadPromise = page.waitForEvent("download");
        await page.getByRole("button", { name: /export to json/i }).click();
        const download = await downloadPromise;
        expect(download.suggestedFilename()).toMatch(
            /^simple-todos-backup-\d{4}-\d{2}-\d{2}\.json$/,
        );
    });

    test("import preview + cancel does not modify storage", async ({
        page,
    }) => {
        await page.goto("/settings");
        const fileChooserPromise = page.waitForEvent("filechooser");
        await page.getByRole("button", { name: /import from json/i }).click();
        const chooser = await fileChooserPromise;
        await chooser.setFiles({
            buffer: Buffer.from(
                JSON.stringify({
                    exportedAt: "x",
                    labels: [],
                    todos: [
                        {
                            completed: false,
                            createdAt: 1,
                            id: "from-backup",
                            labels: [],
                            title: "From backup",
                            updatedAt: 1,
                        },
                    ],
                    version: 1,
                }),
            ),
            mimeType: "application/json",
            name: "test.json",
        });
        await expect(
            page.getByRole("dialog", { name: /replace all data/i }),
        ).toBeVisible();
        await page.getByRole("button", { name: /^cancel$/i }).click();
        // Back on /settings — go home and confirm no todo arrived.
        await page.getByRole("link", { name: /back to todos/i }).click();
        await expect(page.getByText("From backup")).not.toBeVisible();
    });

    test("URL filter state survives a reload", async ({ page }) => {
        // Seed a couple of todos so the search has something to do.
        for (const t of ["alpha", "beta"]) {
            await page.getByRole("button", { name: /add todo/i }).click();
            await page
                .getByRole("dialog", { name: /new todo/i })
                .getByPlaceholder(/what needs doing/i)
                .fill(t);
            await page.locator('button[form="todo-form"]').click();
        }
        await page.getByPlaceholder(/search todos/i).fill("alp");
        await expect(page).toHaveURL(/\?q=alp/);
        await expect(page.getByText("alpha")).toBeVisible();
        await expect(page.getByText("beta")).not.toBeVisible();
        // Reload and confirm the search persists.
        await page.reload();
        await expect(page.getByPlaceholder(/search todos/i)).toHaveValue("alp");
        await expect(page.getByText("alpha")).toBeVisible();
        await expect(page.getByText("beta")).not.toBeVisible();
    });
});
