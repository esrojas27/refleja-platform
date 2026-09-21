import { expect, test } from "@playwright/test";

test("invitation route is responsive and requires the invited Cognito account", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/invitations");
  await expect(page).toHaveURL(/\/login\?returnTo=%2Finvitations$/);
  await expect(page.getByRole("heading", { name: "Iniciar sesión", exact: true })).toBeVisible();
  await expect(page.getByText(/Si recibiste una invitación y es tu primer ingreso/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Continuar con Cognito" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Aceptar invitación" })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
