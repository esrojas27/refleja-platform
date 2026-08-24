import { expect, test } from "@playwright/test";

test("home page renders responsively", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/");

  await expect(
    page.getByRole("heading", { level: 1, name: "Refleja Tu Interior" }),
  ).toBeVisible();
  await expect(page.getByText("Frontend preparado")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("login route renders without an authentication form", async ({ page }) => {
  await page.goto("/login");

  await expect(
    page.getByRole("heading", { level: 1, name: "Iniciar sesión" }),
  ).toBeVisible();
  await expect(page.locator("form")).toHaveCount(0);
});
