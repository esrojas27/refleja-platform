import { expect, test } from "@playwright/test";

test("invitation route is responsive and requires the invited Cognito account", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/invitations");
  await expect(page.getByRole("heading", { name: "Invitaciones", exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Tu sesión no está disponible");
  const accountNavigation = page.getByRole("navigation", { name: "Secciones de la cuenta" });
  await expect(accountNavigation).toBeVisible();
  await expect(accountNavigation.getByRole("link", { name: "Cuenta", exact: true })).toBeVisible();
  await expect(accountNavigation.getByRole("link", { name: "Mis programas" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Aceptar invitación" })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
