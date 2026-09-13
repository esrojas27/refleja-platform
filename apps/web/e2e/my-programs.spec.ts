import { expect, test } from "@playwright/test";

test("my programs routes are responsive and require a Cognito session", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/my-programs");
  await expect(page.getByRole("heading", { name: "Mis programas", exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Tu sesión no está disponible");
  await expect(page.getByRole("link", { name: "Iniciar sesión" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.goto("/my-programs/not-assigned");
  await expect(page.getByRole("heading", { name: "Detalle del programa", exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Tu sesión no está disponible");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
