import { expect, test } from "@playwright/test";

test("my programs routes are responsive and require a Cognito session", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/my-programs");
  await expect(page.getByRole("heading", { name: "Mis programas", exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Tu sesión no está disponible");
  await expect(page.getByRole("link", { name: "Iniciar sesión" })).toBeVisible();
  const accountNavigation = page.getByRole("navigation", { name: "Secciones de la cuenta" });
  await expect(accountNavigation).toBeVisible();
  await expect(accountNavigation.getByRole("link", { name: "Cuenta", exact: true })).toBeVisible();
  await expect(accountNavigation.getByRole("link", { name: "Invitaciones" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.goto("/my-programs/not-assigned");
  await expect(page.getByRole("heading", { name: "Resumen del programa", exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Tu sesión no está disponible");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.goto("/my-programs/not-assigned/activities");
  await expect(page.getByRole("heading", { name: "Actividades", exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Tu sesión no está disponible");
  await expect(page.getByRole("navigation", { name: "Secciones de tu programa" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
