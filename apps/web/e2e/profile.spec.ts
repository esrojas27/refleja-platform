import { expect, test } from "@playwright/test";

test("collaborator profile route is responsive and does not expose a form without a Cognito session", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/profile?organizationId=01900000-0000-7000-8000-000000000901");
  const accountNavigation = page.getByRole("navigation", { name: "Secciones de la cuenta" });
  await expect(accountNavigation).toBeVisible();
  await expect(accountNavigation.getByRole("link", { name: "Cuenta", exact: true })).toBeVisible();
  await expect(accountNavigation.getByRole("link", { name: "Invitaciones" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Perfil del colaborador" })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Tu sesión no está disponible");
  await expect(page.getByRole("form", { name: "Perfil del colaborador" })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
