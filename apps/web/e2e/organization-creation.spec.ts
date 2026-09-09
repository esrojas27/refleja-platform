import { expect, test } from "@playwright/test";

test("creation route is responsive and does not expose a form without verified permission", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/organizations/new");
  await expect(page.getByRole("heading", { name: "Crear organización" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Volver a Cuenta" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Ir a iniciar sesión" })).toBeVisible();
  await expect(page.getByRole("form")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/organization-creation-mobile.png", fullPage: true });
});
