import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const requiredVariables = [
  'RTI_E2E_AWS_ACCOUNT_ID',
  'RTI_E2E_AWS_ROLE_ARN',
  'RTI_E2E_AWS_REGION',
  'RTI_E2E_COGNITO_USER_POOL_ID',
  'RTI_E2E_COGNITO_APP_CLIENT_ID',
  'RTI_E2E_COGNITO_DOMAIN',
  'RTI_E2E_CONSULTANT_SUBJECT',
  'RTI_E2E_CONSULTANT_EMAIL',
  'RTI_E2E_CONSULTANT_PASSWORD',
  'RTI_E2E_COLLABORATOR_EMAIL',
  'RTI_E2E_COLLABORATOR_PASSWORD',
  'RTI_E2E_SES_FROM',
];

const email = /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/;
// Validate the canonical UUID text shape used by Cognito without imposing UUID
// version or variant semantics on an identifier that consumers treat as opaque.
const subject = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateMvpE2eEnvironment(environment) {
  const missing = requiredVariables.filter(name => !environment[name]?.trim());
  if (missing.length) throw new Error(`Faltan variables RTI-VS1-013: ${missing.join(', ')}`);

  const account = environment.RTI_E2E_AWS_ACCOUNT_ID;
  const region = environment.RTI_E2E_AWS_REGION;
  const pool = environment.RTI_E2E_COGNITO_USER_POOL_ID;
  const role = environment.RTI_E2E_AWS_ROLE_ARN;
  const domain = environment.RTI_E2E_COGNITO_DOMAIN;
  const client = environment.RTI_E2E_COGNITO_APP_CLIENT_ID;
  const consultantSubject = environment.RTI_E2E_CONSULTANT_SUBJECT.trim();
  const consultant = environment.RTI_E2E_CONSULTANT_EMAIL.trim().toLowerCase();
  const collaborator = environment.RTI_E2E_COLLABORATOR_EMAIL.trim().toLowerCase();
  const sender = environment.RTI_E2E_SES_FROM.trim().toLowerCase();

  if (!/^\d{12}$/.test(account) ||
      role !== `arn:aws:iam::${account}:role/refleja-tu-interior-github-actions` ||
      !/^[a-z]{2}(?:-gov)?-[a-z]+-\d$/.test(region) ||
      !new RegExp(`^${region.replaceAll('-', '\\-')}_[A-Za-z0-9]+$`).test(pool) ||
      !/^[a-z0-9]+$/.test(client) ||
      !new RegExp(`^[a-z0-9-]+\\.auth\\.${region.replaceAll('-', '\\-')}\\.amazoncognito\\.com$`).test(domain)) {
    throw new Error('La cuenta, el rol OIDC o la configuración pública de Cognito no son coherentes.');
  }
  if (!subject.test(consultantSubject)) {
    throw new Error('RTI_E2E_CONSULTANT_SUBJECT no tiene el formato entregado por Cognito.');
  }
  if (!email.test(consultant) || !email.test(collaborator) || !email.test(sender) || consultant === collaborator) {
    throw new Error('Las identidades E2E deben ser dos cuentas válidas y diferentes.');
  }
  if (environment.RTI_E2E_CONSULTANT_PASSWORD.length < 8 ||
      environment.RTI_E2E_COLLABORATOR_PASSWORD.length < 8) {
    throw new Error('Las credenciales E2E no cumplen la longitud mínima esperada.');
  }
  return { account, region, pool, role, domain, client };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    validateMvpE2eEnvironment(process.env);
    console.log('Configuración RTI-VS1-013 completa. No se imprimieron valores sensibles.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
