import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bootstrap, cognitoLocation, parseOptions, requireLocalDocker, transactionSql, verifyCognito, verifyContainer } from './bootstrap-operator.mjs';

const subject = '01900000-0000-7000-8000-000000000001';
const options = { subject, profile: 'test-dev', account: '123456789012', apply: false };
const location = { region: 'us-east-1', poolId: 'us-east-1_test', clientId: 'testclient' };
const evidence = () => ({
  caller: { Account: options.account, Arn: `arn:aws:sts::${options.account}:assumed-role/Development/test` },
  pool: { Id: location.poolId, Arn: `arn:aws:cognito-idp:us-east-1:${options.account}:userpool/${location.poolId}`,
    UserPoolTags: { Application: 'refleja-tu-interior', Environment: 'development' } },
  client: { UserPoolId: location.poolId, ClientId: location.clientId, CallbackURLs: ['http://localhost:3000/account'] },
  users: [{ Enabled: true, UserStatus: 'CONFIRMED', Attributes: [
    { Name: 'sub', Value: subject }, { Name: 'email', Value: 'operator@example.test' }, { Name: 'email_verified', Value: 'true' },
  ] }],
});

test('CLI defaults to dry-run and requires explicit apply confirmation', () => {
  const args = ['--subject', subject, '--profile', 'test-dev', '--account', options.account];
  assert.equal(parseOptions(args).apply, false);
  assert.throws(() => parseOptions([...args, '--apply']));
  assert.equal(parseOptions([...args, '--apply', '--confirm-development']).apply, true);
  for (const extra of [['--unknown'], ['--profile', 'other'], ['--subject', 'bad']]) assert.throws(() => parseOptions([...args, ...extra]));
  assert.throws(() => parseOptions(['--subject']));
});

test('only local Docker sockets are accepted', () => {
  assert.equal(requireLocalDocker('npipe:////./pipe/dockerDesktopLinuxEngine'), 'npipe:////./pipe/dockerDesktopLinuxEngine');
  assert.equal(requireLocalDocker('unix:///var/run/docker.sock'), 'unix:///var/run/docker.sock');
  for (const endpoint of ['tcp://localhost:2375', 'ssh://server', 'npipe:////server/pipe/docker', '', undefined]) {
    assert.throws(() => requireLocalDocker(endpoint));
  }
});

test('Cognito configuration uses the approved issuer and matching region/JWKS', () => {
  const env = { COGNITO_ISSUER_URI: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_test',
    COGNITO_JWK_SET_URI: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_test/.well-known/jwks.json', COGNITO_APP_CLIENT_ID: 'testclient' };
  assert.deepEqual(cognitoLocation(env), location);
  assert.throws(() => cognitoLocation({ ...env, COGNITO_JWK_SET_URI: 'https://other.test/keys' }));
  assert.throws(() => cognitoLocation({ ...env, COGNITO_ISSUER_URI: 'http://localhost/pool' }));
});

test('Cognito guards reject foreign accounts, production, root, unconfirmed identity and client secrets', () => {
  assert.deepEqual(verifyCognito(evidence(), options, location), { subject, email: 'operator@example.test' });
  const mutations = [
    e => { e.caller.Account = '999999999999'; },
    e => { e.caller.Arn = `arn:aws:iam::${options.account}:root`; },
    e => { e.pool.UserPoolTags.Environment = 'production'; },
    e => { e.pool.UserPoolTags.Application = 'other'; },
    e => { e.pool.Id = 'other'; },
    e => { e.client.ClientSecret = 'not-a-real-secret'; },
    e => { e.client.ClientId = 'other'; },
    e => { e.users = []; },
    e => { e.users.push(e.users[0]); },
    e => { e.users[0].Enabled = false; },
    e => { e.users[0].UserStatus = 'FORCE_CHANGE_PASSWORD'; },
    e => { e.users[0].Attributes[0].Value = 'other-sub'; },
    e => { e.users[0].Attributes[2].Value = 'false'; },
  ];
  for (const mutate of mutations) { const e = evidence(); mutate(e); assert.throws(() => verifyCognito(e, options, location)); }
});

test('container verification binds project, working directory, image, database and persistent volume', () => {
  const container = () => ({ State: { Running: true }, Config: { Image: 'postgres:18', Env: ['POSTGRES_DB=refleja_tu_interior'], Labels: {
    'com.docker.compose.service': 'postgres', 'com.docker.compose.project': 'project', 'com.docker.compose.project.working_dir': 'D:\\work\\repo',
  } }, Mounts: [{ Type: 'volume', Destination: '/var/lib/postgresql', Name: 'project_postgres_data' }] });
  verifyContainer(container(), { name: 'project' }, 'D:/work/repo');
  for (const mutate of [c => { c.State.Running = false; }, c => { c.Config.Env = ['POSTGRES_DB=production']; },
    c => { c.Config.Labels['com.docker.compose.project'] = 'other'; }, c => { c.Mounts = []; }]) {
    const c = container(); mutate(c); assert.throws(() => verifyContainer(c, { name: 'project' }, 'D:/work/repo'));
  }
});

test('identity values travel as encoded data, and dry-run rolls back', () => {
  const input = { subject, email: "quote'; DROP TABLE rti.users; --@example.test" };
  const sql = transactionSql(input, 'SELECT 1;', false);
  assert.ok(!sql.includes(input.email));
  assert.ok(sql.startsWith('BEGIN;'));
  assert.ok(sql.endsWith('ROLLBACK;\n'));
  assert.ok(transactionSql(input, 'SELECT 1;', true).endsWith('COMMIT;\n'));
});

test('a remote Docker context stops orchestration before any AWS or database command', async () => {
  const calls = [];
  await assert.rejects(bootstrap(options, { run: async (command, args) => {
    calls.push([command, args]); return JSON.stringify([{ Endpoints: { docker: { Host: 'ssh://production' } } }]);
  } }), /socket local/);
  assert.equal(calls.length, 1);
});

test('programmatic apply also requires explicit confirmation before running any command', async () => {
  let calls = 0;
  await assert.rejects(bootstrap({ ...options, apply: true }, { run: async () => { calls++; } }), /confirm-development/);
  assert.equal(calls, 0);
});
