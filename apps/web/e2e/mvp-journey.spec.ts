import { expect, test, type Page } from "@playwright/test";

const credentialNames = [
  "RTI_E2E_CONSULTANT_EMAIL",
  "RTI_E2E_CONSULTANT_PASSWORD",
  "RTI_E2E_COLLABORATOR_EMAIL",
  "RTI_E2E_COLLABORATOR_PASSWORD",
] as const;
const missingCredentials = credentialNames.filter((name) => !process.env[name]?.trim());

function credential(name: (typeof credentialNames)[number]) {
  const value = process.env[name];
  if (!value) throw new Error(`Falta ${name}`);
  return value;
}

async function cognitoLogin(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByRole("button", { name: "Continuar con Cognito" }).click();
  await page.waitForURL((url) => url.hostname.endsWith(".amazoncognito.com"));
  await page.getByLabel(/^Email$/i).fill(email);
  await page.getByLabel(/^Password$/i).fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL((url) => url.hostname === "localhost" && url.pathname === "/account", { timeout: 60_000 });
  await expect(page).toHaveURL((url) => !url.searchParams.has("code") && !url.searchParams.has("state"));
  await expect(page.getByRole("heading", { level: 1, name: "Cuenta" })).toBeVisible();
}

function isoDate(daysFromToday: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + daysFromToday);
  return date.toISOString().slice(0, 10);
}

// Authentication traces and screenshots can capture credentials or OAuth artifacts.
test.use({ trace: "off", screenshot: "off", video: "off" });

test.describe("@mvp RTI-VS1-013 authenticated vertical slice", () => {
  test.describe.configure({ mode: "serial", retries: 0 });
  test.skip(missingCredentials.length > 0, `Live Cognito credentials not configured: ${missingCredentials.join(", ")}`);

  test("consultant creates the assignment and the collaborator accepts and views it", async ({ page }) => {
    test.setTimeout(180_000);
    const suffix = `${process.env.GITHUB_RUN_ID ?? Date.now()}-${process.env.GITHUB_RUN_ATTEMPT ?? "local"}`;
    const organizationName = `MVP E2E ${suffix}`;
    const programName = `Programa MVP E2E ${suffix}`;
    const consultantEmail = credential("RTI_E2E_CONSULTANT_EMAIL");
    const consultantPassword = credential("RTI_E2E_CONSULTANT_PASSWORD");
    const collaboratorEmail = credential("RTI_E2E_COLLABORATOR_EMAIL");
    const collaboratorPassword = credential("RTI_E2E_COLLABORATOR_PASSWORD");

    await cognitoLogin(page, consultantEmail, consultantPassword);
    await page.getByRole("button", { name: "Comprobar sesión" }).click();
    await expect(page.getByText("Sesión autenticada.")).toBeVisible();
    await expect(page.getByText(consultantEmail, { exact: true })).toBeVisible();

    await page.getByRole("link", { name: "Crear organización" }).click();
    await page.getByLabel("Nombre", { exact: true }).fill(organizationName);
    await page.getByLabel("Zona horaria").fill("America/Bogota");
    await page.getByRole("button", { name: "Crear organización" }).click();
    await expect(page.getByRole("status")).toHaveText("Organización creada.");
    await expect(page.getByText(organizationName, { exact: true })).toBeVisible();

    await page.getByRole("link", { name: "Volver a Cuenta" }).click();
    await page.getByRole("button", { name: "Comprobar sesión" }).click();
    await expect(page.getByText("Sesión autenticada.")).toBeVisible();
    await page.getByLabel("Organización activa").selectOption({ label: organizationName });
    await expect(page.getByText("Roles activos: CONSULTANT")).toBeVisible();
    await page.getByRole("link", { name: "Ver programas" }).click();

    await page.getByRole("link", { name: "Crear programa" }).click();
    await page.getByLabel("Nombre", { exact: true }).fill(programName);
    await page.getByLabel("Descripción (opcional)").fill("Recorrido automático RTI-VS1-013");
    await page.getByLabel("Fecha de inicio").fill(isoDate(1));
    await page.getByLabel("Fecha de fin").fill(isoDate(8));
    await page.getByRole("button", { name: "Crear programa" }).click();
    await expect(page.getByRole("status")).toHaveText("Programa creado.");
    await page.getByRole("link", { name: "Consultar programa creado" }).click();
    await expect(page.getByText(programName, { exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Colaboradores del programa" }).click();

    await page.getByLabel("Correo electrónico").fill(collaboratorEmail);
    await page.getByLabel("Nombre", { exact: true }).fill("Colaborador");
    await page.getByLabel("Apellido", { exact: true }).fill("MVP");
    await page.getByRole("button", { name: "Registrar e invitar" }).click();
    await expect(page.getByText(collaboratorEmail, { exact: true })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText(/Inscripción: INVITED · Invitación: PENDING/)).toBeVisible();

    await page.goto("/account");
    await page.getByRole("button", { name: "Cerrar sesión" }).click();
    await page.waitForURL((url) => url.hostname === "localhost" && url.pathname === "/login", { timeout: 60_000 });

    await cognitoLogin(page, collaboratorEmail, collaboratorPassword);
    await page.getByRole("link", { name: "Invitaciones" }).click();
    const invitation = page.getByRole("listitem").filter({ hasText: programName });
    await expect(invitation).toContainText(organizationName);
    await invitation.getByRole("button", { name: "Aceptar invitación" }).click();
    await expect(page.getByRole("status")).toContainText("Invitación aceptada.");

    await page.getByRole("link", { name: "Volver a Cuenta" }).click();
    await page.getByRole("button", { name: "Comprobar sesión" }).click();
    await expect(page.getByText("Sesión autenticada.")).toBeVisible();
    await expect(page.getByText("Roles activos: COLLABORATOR")).toBeVisible();
    await page.getByRole("link", { name: "Mis programas" }).click();
    await expect(page.getByRole("link", { name: programName })).toBeVisible();
    await expect(page.getByText(organizationName, { exact: true })).toBeVisible();
    await page.getByRole("link", { name: programName }).click();
    await expect(page.getByRole("heading", { name: "Detalle del programa" })).toBeVisible();
    await expect(page.getByText(programName, { exact: true })).toBeVisible();
    await expect(page.getByText(organizationName, { exact: true })).toBeVisible();
  });
});
