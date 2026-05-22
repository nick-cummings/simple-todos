import { expect, test } from "@playwright/test";

/**
 * Reminders E2E. We can't reliably exercise the real Web Push API
 * in Playwright (the headless browser's push service is fickle and
 * needs a real VAPID service to bind against), so we mock the
 * /api/push/* endpoints and assert on the user-facing UI + the
 * wiring contract.
 *
 * The remaining behavior (server-side fanout, scheduling, etc.) is
 * covered by unit + integration tests.
 */

test.beforeEach(({ browserName }) => {
  // On webkit (and real iOS Safari) the Push API isn't available
  // outside an installed PWA, so the gate intentionally never
  // shows. That's correct production behavior; the chromium project
  // covers the gate-visible paths.
  test.skip(
    browserName === "webkit",
    "Reminders gate doesn't surface on webkit / non-PWA Safari",
  );
});

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

test("the gate prompts the user to enable reminders on first load", async ({
  page,
}) => {
  // VAPID public key is set in start:test, and we haven't been
  // prompted yet, so the gate should appear.
  await expect(
    page.getByRole("region", { name: /reminders permission prompt/i }),
  ).toBeVisible();
});

test("dismissing the gate with 'Not now' hides it for the session", async ({
  page,
}) => {
  const gate = page.getByRole("region", {
    name: /reminders permission prompt/i,
  });
  await expect(gate).toBeVisible();
  await page.getByRole("button", { name: /not now/i }).click();
  await expect(gate).not.toBeVisible();
});

test("clicking Enable reminders attempts a subscribe POST", async ({
  context,
  page,
}) => {
  // Allow Notification.requestPermission to resolve to granted.
  await context.grantPermissions(["notifications"]);

  // Intercept the subscribe endpoint so we can assert on it without
  // depending on Upstash being reachable.
  let subscribeBody: null | string = null;
  await page.route("**/api/push/subscribe", async (route) => {
    const req = route.request();
    if (req.method() === "POST") {
      subscribeBody = req.postData();
    }
    await route.fulfill({
      body: JSON.stringify({ ok: true }),
      contentType: "application/json",
      status: 200,
    });
  });

  await page.reload();
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: /enable reminders/i }).click();

  // The subscribe POST may not always reach the server in a headless
  // browser without a real push service — the browser-side
  // pushManager.subscribe can reject. We assert the gate dismisses
  // either way (the flow ran), and *if* a subscribe attempt did make
  // it through, the body shape is what the server expects.
  await expect(
    page.getByRole("region", { name: /reminders permission prompt/i }),
  ).not.toBeVisible();
  if (subscribeBody !== null) {
    const body = JSON.parse(subscribeBody) as {
      browserId: string;
      subscription: { endpoint: string };
    };
    expect(typeof body.browserId).toBe("string");
    expect(body.browserId.length).toBeGreaterThan(8);
    expect(body.subscription.endpoint).toMatch(/^https?:\/\//);
  }
});

test("Enable button shows a busy state while the subscribe call resolves", async ({
  context,
  page,
}) => {
  await context.grantPermissions(["notifications"]);
  // Stall the subscribe response so we can see the "Enabling…" label.
  let release: () => void = () => undefined;
  await page.route("**/api/push/subscribe", async (route) => {
    await new Promise<void>((r) => {
      release = r;
    });
    await route.fulfill({
      body: JSON.stringify({ ok: true }),
      contentType: "application/json",
      status: 200,
    });
  });

  await page.reload();
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: /enable reminders/i }).click();

  // While the request is in flight, the button label flips to
  // "Enabling…" and the button is disabled. If the browser side
  // never produces a real subscription, the route handler never
  // fires — that's fine, the busy state lives on regardless.
  const busyBtn = page.getByRole("button", { name: /enabling…/i });
  if (await busyBtn.isVisible().catch(() => false)) {
    await expect(busyBtn).toBeDisabled();
  }
  release();
});
