import assert from 'node:assert/strict';
import test from 'node:test';

import { requiredVariables, validateMvpE2eEnvironment } from './check-mvp-e2e-environment.mjs';

function valid() {
  return {
    RTI_E2E_AWS_ACCOUNT_ID: '123456789012',
    RTI_E2E_AWS_ROLE_ARN: 'arn:aws:iam::123456789012:role/refleja-tu-interior-github-actions',
    RTI_E2E_AWS_REGION: 'us-east-1',
    RTI_E2E_COGNITO_USER_POOL_ID: 'us-east-1_example',
    RTI_E2E_COGNITO_APP_CLIENT_ID: 'client123',
    RTI_E2E_COGNITO_DOMAIN: 'rti-e2e.auth.us-east-1.amazoncognito.com',
    RTI_E2E_CONSULTANT_SUBJECT: '01900000-0000-7000-8000-000000000013',
    RTI_E2E_CONSULTANT_EMAIL: 'consultant@example.test',
    RTI_E2E_CONSULTANT_PASSWORD: 'not-a-real-password',
    RTI_E2E_COLLABORATOR_EMAIL: 'collaborator@example.test',
    RTI_E2E_COLLABORATOR_PASSWORD: 'also-not-a-real-password',
    RTI_E2E_SES_FROM: 'sender@example.test',
  };
}

test('accepts one coherent development configuration without returning credentials', () => {
  const result = validateMvpE2eEnvironment(valid());
  assert.deepEqual(result, {
    account: '123456789012', region: 'us-east-1', pool: 'us-east-1_example',
    role: 'arn:aws:iam::123456789012:role/refleja-tu-interior-github-actions',
    domain: 'rti-e2e.auth.us-east-1.amazoncognito.com', client: 'client123',
  });
  assert.equal('RTI_E2E_CONSULTANT_PASSWORD' in result, false);
});

test('reports every missing variable by name without exposing configured values', () => {
  const environment = valid();
  delete environment.RTI_E2E_CONSULTANT_PASSWORD;
  delete environment.RTI_E2E_SES_FROM;
  assert.throws(() => validateMvpE2eEnvironment(environment), error => {
    assert.match(error.message, /RTI_E2E_CONSULTANT_PASSWORD/);
    assert.match(error.message, /RTI_E2E_SES_FROM/);
    assert.doesNotMatch(error.message, /not-a-real-password/);
    return true;
  });
});

test('rejects account, role, pool, domain, identity and credential mismatches', () => {
  const mutations = [
    environment => { environment.RTI_E2E_AWS_ROLE_ARN = 'arn:aws:iam::123456789012:role/admin'; },
    environment => { environment.RTI_E2E_COGNITO_USER_POOL_ID = 'eu-west-1_example'; },
    environment => { environment.RTI_E2E_COGNITO_DOMAIN = 'https://rti-e2e.auth.us-east-1.amazoncognito.com'; },
    environment => { environment.RTI_E2E_COLLABORATOR_EMAIL = environment.RTI_E2E_CONSULTANT_EMAIL; },
    environment => { environment.RTI_E2E_CONSULTANT_SUBJECT = 'not-a-subject'; },
    environment => { environment.RTI_E2E_COLLABORATOR_PASSWORD = 'short'; },
  ];
  for (const mutate of mutations) {
    const environment = valid();
    mutate(environment);
    assert.throws(() => validateMvpE2eEnvironment(environment));
  }
});

test('keeps the public required-variable contract stable', () => {
  assert.equal(requiredVariables.length, 12);
  assert.equal(new Set(requiredVariables).size, requiredVariables.length);
});
