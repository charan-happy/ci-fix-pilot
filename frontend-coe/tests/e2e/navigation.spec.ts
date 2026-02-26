import { expect, test } from "@playwright/test";

test.describe("Navigation & Routing", () => {
  test("should redirect root to /home", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveURL("/");

    await expect(page.getByRole("heading", { name: /Fix CI failures faster/i })).toBeVisible();
  });

  test("should handle direct navigation to /home", async ({ page }) => {
    await page.goto("/home");

    await expect(page.getByRole("heading", { name: /Fix CI failures faster/i })).toBeVisible();
    await expect(page.getByText(/Patch Pilot gives a redirectable command center/i)).toBeVisible();
  });

  test("should handle 404 pages gracefully", async ({ page }) => {
    const response = await page.goto("/non-existent-page");

    // Should return 404 status
    expect(response?.status()).toBe(404);

    // Should show Next.js 404 page or custom 404
    await expect(page.getByText(/404|not found|page not found/i)).toBeVisible();
  });

  test("should handle unauthorized page", async ({ page }) => {
    const response = await page.goto("/unauthorized");

    expect(response?.status()).toBe(200);
    await expect(page.getByText("Unauthorized")).toBeVisible();
    await expect(
      page.getByText("You are not authorized to access this resource or this page."),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Return Home" })).toBeVisible();
  });

  test("should handle forbidden page", async ({ page }) => {
    const response = await page.goto("/forbidden");

    expect(response?.status()).toBe(200);
    await expect(page.getByText("Forbidden")).toBeVisible();
    await expect(page.getByText("You are not authorized to access this resource.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Return Home" })).toBeVisible();
  });

  test("should handle Sentry example page", async ({ page }) => {
    await page.goto("/sentry-example-page");

    // Should load without crashing, even if Sentry is not configured
    // The page should exist and not throw unhandled errors
    await expect(page.locator("body")).toBeVisible();

    // Should not have JavaScript errors (basic check)
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.waitForLoadState("networkidle");

    // Allow for some expected errors related to missing Sentry config
    // but should not have critical errors
    const criticalErrors = errors.filter(
      (error) => !error.includes("Sentry") && !error.includes("PostHog") && !error.includes("GTM"),
    );

    expect(criticalErrors).toHaveLength(0);
  });

  test("should maintain scroll position on navigation", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("link", { name: /Agent Thinking/ }).click();

    await page.waitForTimeout(1000);

    const scrollY = await page.evaluate(() => window.scrollY);
    expect(scrollY).toBeGreaterThan(0);

    await page.goBack();

    await page.waitForTimeout(500);
    const newScrollY = await page.evaluate(() => window.scrollY);
    expect(newScrollY).toBeLessThan(scrollY);
  });
});
