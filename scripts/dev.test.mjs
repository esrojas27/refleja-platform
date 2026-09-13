import assert from 'node:assert/strict';
import net from 'node:net';
import { test } from 'node:test';
import { authenticationEnvironment, invitationEnvironment, parseEnvironment, portAvailable, redact, selectPort } from './dev.mjs';

const backend = {
  COGNITO_APP_CLIENT_ID: 'test-client',
  COGNITO_ISSUER_URI: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_test',
  COGNITO_JWK_SET_URI: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_test/.well-known/jwks.json',
};
const frontend = {
  NEXT_PUBLIC_COGNITO_APP_CLIENT_ID: 'test-client', NEXT_PUBLIC_COGNITO_USER_POOL_ID: 'us-east-1_test',
  NEXT_PUBLIC_COGNITO_DOMAIN: 'test.auth.us-east-1.amazoncognito.com',
  NEXT_PUBLIC_COGNITO_REDIRECT_SIGN_IN: 'http://localhost:3000/account',
  NEXT_PUBLIC_COGNITO_REDIRECT_SIGN_OUT: 'http://localhost:3000/login',
};

test('Compose environment values remain literal, including equals and dollar signs', () => {
  assert.deepEqual(parseEnvironment('PASSWORD=a=$value#literal\r\nPORT=3000\n'), { PASSWORD: 'a=$value#literal', PORT: '3000' });
});

test('Cognito matches across services and preserves the registered web origin', () => {
  const auth = authenticationEnvironment(backend, frontend);
  assert.equal(auth.origin, 'http://localhost:3000');
  assert.equal(auth.port, 3000);
  assert.throws(() => authenticationEnvironment(backend, { ...frontend, NEXT_PUBLIC_COGNITO_APP_CLIENT_ID: 'other' }), /no coinciden/);
  assert.throws(() => authenticationEnvironment(backend, { ...frontend, NEXT_PUBLIC_COGNITO_REDIRECT_SIGN_OUT: 'http://localhost:3100/login' }), /redirects locales/);
  assert.throws(() => authenticationEnvironment(backend, { ...frontend, NEXT_PUBLIC_COGNITO_DOMAIN: 'replace-with-domain' }), /Configura/);
});

test('logs remove passwords, OAuth callback values and Bearer tokens', () => {
  const result = redact('password=secret /account?code=private-code&state=private-state HTTP Bearer abc.def.ghi', ['secret']);
  for (const value of ['secret', 'private-code', 'private-state', 'abc.def.ghi']) assert.ok(!result.includes(value));
});

test('invitations remain disabled unless their AWS and web settings are coherent', () => {
  assert.deepEqual(invitationEnvironment({}, frontend), { INVITATIONS_ENABLED: 'false' });
  const enabled = { ...backend, INVITATIONS_ENABLED: 'true', INVITATIONS_AWS_REGION: 'us-east-1',
    INVITATIONS_COGNITO_USER_POOL_ID: 'us-east-1_test', INVITATIONS_SES_FROM: 'sender@example.test',
    INVITATIONS_WEB_BASE_URL: 'http://localhost:3000', AWS_PROFILE: 'rti-dev' };
  assert.equal(invitationEnvironment(enabled, frontend).INVITATIONS_SES_FROM, 'sender@example.test');
  assert.throws(() => invitationEnvironment({ ...enabled, INVITATIONS_SES_FROM: '' }, frontend), /INVITATIONS_SES_FROM/);
  assert.throws(() => invitationEnvironment({ ...enabled, INVITATIONS_WEB_BASE_URL: 'http://localhost:3001' }, frontend), /origen exacto/);
});

test('a busy port is not reused or killed, and a free alternative is selected', async () => {
  const occupied = net.createServer();
  await new Promise((resolve) => occupied.listen(0, resolve));
  const busy = occupied.address().port;
  try {
    assert.equal(await portAvailable(busy), false);
    await assert.rejects(selectPort(busy), /Puertos ocupados/);
    const probe = net.createServer();
    await new Promise((resolve) => probe.listen(0, resolve));
    const free = probe.address().port;
    await new Promise((resolve) => probe.close(resolve));
    assert.equal(await selectPort(busy, [free]), free);
    assert.equal(occupied.listening, true);
  } finally { await new Promise((resolve) => occupied.close(resolve)); }
});

test('an IPv4-only listener is detected even when IPv6 can bind the same port', async () => {
  const occupied = net.createServer();
  await new Promise((resolve) => occupied.listen(0, '127.0.0.1', resolve));
  try { assert.equal(await portAvailable(occupied.address().port), false); }
  finally { await new Promise((resolve) => occupied.close(resolve)); }
});
