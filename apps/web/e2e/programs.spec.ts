import { expect, test } from "@playwright/test";

const base = "/organizations/01900000-0000-7000-8000-000000000901/programs";
for (const [path, heading] of [[base, "Programas"], [`${base}/new`, "Crear programa"],
  [`${base}/01900000-0000-7000-8000-000000000905`, "Detalle del programa"],
  [`${base}/01900000-0000-7000-8000-000000000905/content`, "Contenido"],
  [`${base}/01900000-0000-7000-8000-000000000905/activities`, "Actividades"],
  [`${base}/01900000-0000-7000-8000-000000000905/enrollments`, "Personas del programa"]]) {
  test(`${heading}: responsive route without session does not expose business data`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(path);
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    await expect(page.getByRole("status")).toContainText("Tu sesión no está disponible");
    await expect(page.getByRole("link", { name: "Volver a Cuenta" })).toBeVisible();
    await expect(page.getByRole("form")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}
