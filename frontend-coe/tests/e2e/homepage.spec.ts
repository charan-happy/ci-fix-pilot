import { expect, test } from "@playwright/test";

test.describe("Homepage", () => {
  test("should load the homepage successfully", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveTitle(/patch pilot|PatchPilot Dashboard/i);

    await expect(page.getByRole("heading", { name: /Fix CI failures faster/i })).toBeVisible();

    await expect(page.getByAltText("Patch Pilot Logo")).toBeVisible();

    await expect(page.getByRole("link", { name: /Open CI Dashboard/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Agent Thinking/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Repo Fix Board/ })).toBeVisible();
  });

  test("should navigate to agent thinking section", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("link", { name: /Agent Thinking/ }).click();

    await expect(page.getByRole("heading", { name: /Agent Thinking Process Visibility/i })).toBeVisible();
    await expect(page.getByText("Failure Ingested")).toBeVisible();
    await expect(page.getByText("Patch Proposed")).toBeVisible();
  });

  test("should navigate to metrics section", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("link", { name: /Metrics Visibility/ }).click();

    await expect(page.getByRole("heading", { name: /Metrics Visibility/i })).toBeVisible();
    await expect(page.getByText("Webhook Events")).toBeVisible();
    await expect(page.getByText("PR Gate Pass Rate")).toBeVisible();
  });

  test("should have working external link to GitHub", async ({ page }) => {
    await page.goto("/");

    const githubLink = page.getByRole("link", { name: /Open Repository/ });
    await expect(githubLink).toHaveAttribute("href", "https://github.com/charan-happy/ci-fix-pilot");
    await expect(githubLink).toHaveAttribute("target", "_blank");
    await expect(githubLink).toHaveAttribute("rel", "noopener noreferrer");
  });

  test("should be responsive on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");

    await expect(page.getByRole("heading", { name: /Fix CI failures faster/i })).toBeVisible();
    await expect(page.getByText(/Patch Pilot gives a redirectable command center/i)).toBeVisible();

    await expect(page.getByRole("link", { name: /Open CI Dashboard/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Repo Fix Board/ })).toBeVisible();
  });

  test("should have proper SEO meta tags", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveTitle(/patch pilot|PatchPilot Dashboard/i);

    const metaDescription = page.locator('meta[name="description"]');
    await expect(metaDescription).toHaveAttribute("content", /patch pilot|Patch Pilot/i);

    const ogType = page.locator('meta[property="og:type"]');
    await expect(ogType).toHaveAttribute("content", "website");
  });
});
