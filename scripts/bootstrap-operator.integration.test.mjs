import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, before, beforeEach, test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { requireLocalDocker, runCommand, transactionSql } from './bootstrap-operator.mjs';

// Explicit integration command: real PostgreSQL 18, private container, no host ports.
// No automatic skip on missing Docker; this suite must fail if its runtime is absent.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const name = `rti-operator-test-${randomUUID()}`;
const subject = '01900000-0000-7000-8000-000000000001';
const email = 'operator@example.test';
let containerId;
let bootstrapSql;
let endpoint;
const dockerEnv = { ...process.env };
for (const key of ['DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH']) delete dockerEnv[key];
const docker = (args, input = '') => runCommand('docker', ['--host', endpoint, ...args], { env: dockerEnv, input });
const sql = (query, user = 'rti_app') => docker(['exec', '-i', containerId, 'psql', '-X', '-U', user,
  '-d', 'refleja_tu_interior', '-v', 'ON_ERROR_STOP=1', '-Atq'], query);
const invoke = (apply = true, identity = { subject, email }) => sql(transactionSql(identity, bootstrapSql, apply)).then(JSON.parse);

before(async () => {
  const contexts = JSON.parse(await runCommand('docker', ['context', 'inspect']));
  assert.equal(contexts.length, 1);
  endpoint = requireLocalDocker(contexts[0].Endpoints?.docker?.Host);
  bootstrapSql = await readFile(path.join(root, 'scripts/sql/bootstrap-operator.sql'), 'utf8');
  containerId = await docker(['run', '--rm', '-d', '--network', 'none', '--memory', '256m', '--name', name,
    '-e', 'POSTGRES_DB=refleja_tu_interior', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:18']);
  assert.match(containerId, /^[a-f0-9]{64}$/);
  let ready = false;
  for (let i = 0; i < 30; i++) {
    try { await sql('SELECT 1;', 'postgres'); ready = true; break; } catch { await delay(500); }
  }
  assert.ok(ready, 'Test PostgreSQL must start');
  await sql('CREATE ROLE rti_migrator LOGIN; CREATE ROLE rti_app LOGIN NOSUPERUSER NOBYPASSRLS; CREATE SCHEMA rti AUTHORIZATION rti_migrator;', 'postgres');
  const migrationDir = path.join(root, 'apps/api/src/main/resources/db/migration');
  for (const file of (await readdir(migrationDir)).filter(f => f.endsWith('.sql')).sort()) {
    await sql('SET ROLE rti_migrator;\n' + await readFile(path.join(migrationDir, file), 'utf8'), 'postgres');
  }
  await sql('GRANT USAGE ON SCHEMA rti TO rti_app;', 'postgres');
});

after(async () => {
  if (containerId && /^[a-f0-9]{64}$/.test(containerId)) {
    // Only this suite's newly-created container; never the development service.
    await docker(['rm', '-f', containerId]);
  }
});

beforeEach(async () => {
  await sql(`TRUNCATE rti.membership_roles, rti.organization_memberships, rti.organizations, rti.users CASCADE;
    INSERT INTO rti.users (id,cognito_subject,email,email_normalized,status,created_at,updated_at,version)
    VALUES (uuidv7(),'${subject}','${email}','${email}','ACTIVE',now(),now(),0);`, 'postgres');
});

test('dry-run leaves all organization data absent', async () => {
  assert.equal((await invoke(false)).result, 'created');
  assert.equal(await sql('SELECT count(*) FROM rti.organizations;'), '0');
  assert.equal(await sql('SELECT count(*) FROM rti.users;'), '1');
});

test('apply creates exactly the approved organization, active membership and CONSULTANT role', async () => {
  const result = await invoke();
  assert.equal(result.result, 'created');
  assert.equal(await sql("SELECT name || '|' || status || '|' || default_time_zone || '|' || uuid_extract_version(id) || '|' || version FROM rti.organizations;"),
    'Refleja Tu Interior|ACTIVE|America/Bogota|7|0');
  assert.equal(await sql("SELECT status || '|' || uuid_extract_version(id) || '|' || version FROM rti.organization_memberships;"), 'ACTIVE|7|0');
  assert.equal(await sql('SELECT role FROM rti.membership_roles;'), 'CONSULTANT');
  assert.equal(await sql('SELECT count(*) FROM rti.programs;'), '0');
  assert.equal(await sql('SELECT count(*) FROM rti.enrollments;'), '0');
});

test('repeat is a no-op, preserving IDs and versions', async () => {
  const first = await invoke(); const second = await invoke();
  assert.deepEqual(second, { ...first, result: 'unchanged' });
  assert.equal(await sql('SELECT count(*) FROM rti.organizations;'), '1');
  assert.equal(await sql('SELECT count(*) FROM rti.organization_memberships;'), '1');
  assert.equal(await sql('SELECT count(*) FROM rti.membership_roles;'), '1');
});

test('concurrent first executions serialize and create only one membership', async () => {
  const results = await Promise.all([invoke(), invoke()]);
  assert.deepEqual(results.map(r => r.result).sort(), ['created', 'unchanged']);
  assert.equal(results[0].organizationId, results[1].organizationId);
});

test('missing internal user and mismatched profile never provision a user', async () => {
  await assert.rejects(invoke(true, { subject: '01900000-0000-7000-8000-000000000002', email }), /ACTIVE_INTERNAL_USER_REQUIRED/);
  await assert.rejects(invoke(true, { subject, email: 'other@example.test' }), /PROFILE_MISMATCH/);
  assert.equal(await sql('SELECT count(*) FROM rti.organizations;'), '0');
  assert.equal(await sql('SELECT count(*) FROM rti.users;'), '1');
});

test('inactive users cannot bootstrap or be reactivated', async () => {
  for (const state of ['INVITED', 'SUSPENDED', 'DEACTIVATED']) {
    await sql(`UPDATE rti.users SET status='${state}';`);
    await assert.rejects(invoke(), /ACTIVE_INTERNAL_USER_REQUIRED/);
    assert.equal(await sql('SELECT status FROM rti.users;'), state);
  }
  assert.equal(await sql('SELECT count(*) FROM rti.organizations;'), '0');
});

test('revoked or suspended membership is never restored', async () => {
  await invoke();
  for (const state of ['PENDING', 'REVOKED', 'SUSPENDED']) {
    await sql(`UPDATE rti.organization_memberships SET status='${state}';`);
    await assert.rejects(invoke(), /MEMBERSHIP_CONFLICT/);
    assert.equal(await sql('SELECT status FROM rti.organization_memberships;'), state);
  }
});

test('removed CONSULTANT role is not silently re-granted', async () => {
  await invoke(); await sql('DELETE FROM rti.membership_roles;');
  await assert.rejects(invoke(), /ROLE_REMOVED/);
  assert.equal(await sql('SELECT count(*) FROM rti.membership_roles;'), '0');
});

test('an inactive operator organization cannot be reactivated', async () => {
  await invoke(); await sql("UPDATE rti.organizations SET status='SUSPENDED';");
  await assert.rejects(invoke(), /ORGANIZATION_CONFLICT/);
  assert.equal(await sql('SELECT status FROM rti.organizations;'), 'SUSPENDED');
});

test('a second identity cannot gain operator membership by repeating bootstrap', async () => {
  await invoke();
  await sql(`INSERT INTO rti.users (id,cognito_subject,email,email_normalized,status,created_at,updated_at,version)
    VALUES (uuidv7(),'01900000-0000-7000-8000-000000000002','${email}','${email}','ACTIVE',now(),now(),0);`);
  await assert.rejects(invoke(true, { subject: '01900000-0000-7000-8000-000000000002', email }), /MEMBERSHIP_CONFLICT/);
  assert.equal(await sql('SELECT count(*) FROM rti.organization_memberships;'), '1');
});

test('an unrelated organization blocks initial bootstrap rather than receiving operator roles', async () => {
  await sql("INSERT INTO rti.organizations (id,name,status,default_time_zone,created_at,updated_at,version) VALUES (uuidv7(),'Other','ACTIVE','America/Bogota',now(),now(),0);");
  await assert.rejects(invoke(), /NOT_AN_INITIAL_ENVIRONMENT/);
  assert.equal(await sql('SELECT count(*) FROM rti.organization_memberships;'), '0');
});

test('a persistence failure after creating the organization rolls back all bootstrap writes', async () => {
  await sql("ALTER TABLE rti.membership_roles ADD CONSTRAINT test_reject_consultant CHECK (role <> 'CONSULTANT');", 'postgres');
  try {
    await assert.rejects(invoke());
    assert.equal(await sql('SELECT count(*) FROM rti.organizations;'), '0');
    assert.equal(await sql('SELECT count(*) FROM rti.organization_memberships;'), '0');
    assert.equal(await sql('SELECT count(*) FROM rti.membership_roles;'), '0');
  } finally { await sql('ALTER TABLE rti.membership_roles DROP CONSTRAINT test_reject_consultant;', 'postgres'); }
});

test('ambiguous operator organization names are rejected without altering memberships', async () => {
  await invoke();
  await sql("INSERT INTO rti.organizations (id,name,status,default_time_zone,created_at,updated_at,version) VALUES (uuidv7(),'Refleja Tu Interior','ACTIVE','America/Bogota',now(),now(),0);");
  await assert.rejects(invoke(), /AMBIGUOUS_ORGANIZATION/);
  assert.equal(await sql('SELECT count(*) FROM rti.organization_memberships;'), '1');
});
