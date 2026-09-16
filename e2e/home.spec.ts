import { test, expect } from "@playwright/test";
import { SITE } from "@/site";

// The page, offline: it needs no key and runs no method. What it pins is that
// the app serves its own identity and renders its registry — the empty state on
// a fresh clone, a method's form once one is registered.
test("renders the app's heading, and either the empty state or a method", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1, name: SITE.title })).toBeVisible();
  await expect(page).toHaveTitle(SITE.title);

  const emptyState = page.getByRole("heading", { name: "No method yet" });
  const methodForm = page.locator("form").first();
  await expect(emptyState.or(methodForm)).toBeVisible();
});
