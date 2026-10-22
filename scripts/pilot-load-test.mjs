// Explicit operator tool. Only the fixed DEV deployment and synthetic identities.
// Secrets stay in ignored .local/ files; never enable browser traces/screenshots.
import { createRequire } from 'node:module';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir, unlink, access } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { spawn } from 'node:child_process';
const root = resolve(import.meta.dirname, '..');
const requireWeb = createRequire(join(root, 'apps/web/package.json'));
const base = 'https://rti-dev.18-210-172-252.nip.io';
const pool = 'us-east-1_AKiEfWZMK', client = '35ihde5ft8qvfuaq7d4ctg92pp';
const instance = 'i-08493bca78a5098f7', bucket = 'rti-dev-backups-836528258662';
const [mode, runId] = process.argv.slice(2);
if (!['prepare', 'auth', 'seed', 'smoke', 'run', 'cleanup', 'metrics', 'verify'].includes(mode)
    || !/^pilot-\d{8}-[a-z0-9]{6}$/.test(runId ?? '')) throw new Error('Use MODE pilot-YYYYMMDD-xxxxxx');
const dir = join(root, '.local', 'load-tests', runId);
await mkdir(dir, { recursive: true, mode: 0o700 });
const statePath = join(dir, 'private.json');
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function fileExists(path) { try { await access(path); return true; } catch { return false; } }
async function aws(service, action, input) {
  const path = join(dir, `${randomUUID()}.json`);
  const args = [];
  if (service === 's3api' && action === 'put-object') {
    args.push('--body', input.Body);
    input = { ...input }; delete input.Body;
  }
  await writeFile(path, JSON.stringify(input), { mode: 0o600 });
  try {
    return await new Promise((res, rej) => {
      const child = spawn('aws', [service, action, '--cli-input-json', `file://${path}`, ...args, '--profile', 'rti-dev', '--region', 'us-east-1', '--output', 'json'],
        { windowsHide: true, env: { ...process.env, AWS_PAGER: '', PYTHONIOENCODING: 'utf-8' } });
      let output = '', error = '';
      child.stdout.on('data', chunk => output += chunk);
      child.stderr.on('data', chunk => error += chunk);
      child.on('error', rej);
      child.on('close', code => code ? rej(new Error(`AWS ${action} failed: ${error.slice(0, 350)}`)) : res(output.trim() ? JSON.parse(output) : {}));
    });
  } finally { await unlink(path); }
}
async function ssm(commands) {
  const result = await aws('ssm', 'send-command', { InstanceIds: [instance], DocumentName: 'AWS-RunShellScript',
    Comment: `Pilot load test ${runId} ${mode}`, Parameters: { commands, executionTimeout: ['600'] } });
  const id = result.Command.CommandId;
  await sleep(2000);
  for (let n = 0; n < 200; n++) {
    const invocation = await aws('ssm', 'get-command-invocation', { CommandId: id, InstanceId: instance });
    if (invocation.Status === 'Success') return invocation.StandardOutputContent;
    if (!['Pending', 'InProgress', 'Delayed'].includes(invocation.Status))
      throw new Error(`SSM ${id} ${invocation.Status}: ${invocation.StandardErrorContent?.slice(0, 500)}`);
    await sleep(3000);
  }
  throw new Error(`SSM timeout: ${id}`);
}
async function save(state) { await writeFile(statePath, JSON.stringify(state), { mode: 0o600 }); }
const q = text => `'${String(text).replaceAll("'", "''")}'`;
async function sql(text) {
  // SQL contains only synthetic fixtures; credentials never enter SSM or S3.
  const path = join(dir, 'fixture.sql');
  const key = `deployments/${runId}/fixture.sql`;
  await writeFile(path, text);
  await aws('s3api', 'put-object', { Bucket: bucket, Key: key, Body: path, ServerSideEncryption: 'AES256' });
  try {
    return await ssm(['set -euo pipefail', `file=$(mktemp /tmp/${runId}.XXXXXXXX.sql)`, 'trap \'rm -f -- "$file"\' EXIT',
      `aws s3 cp s3://${bucket}/${key} "$file" --region us-east-1 --only-show-errors`,
      'exec 9>/srv/refleja/application/runtime/maintenance.lock', 'flock -w 600 9',
      'docker exec -i refleja-tu-interior-dev-postgres-1 psql -X -U postgres -d refleja_tu_interior -v ON_ERROR_STOP=1 <"$file"']);
  } finally { await aws('s3api', 'delete-object', { Bucket: bucket, Key: key }); }
}
if (mode === 'prepare') {
  if (await fileExists(statePath)) throw new Error('Run already exists; do not recreate identities.');
  const state = { runId, organizationId: randomUUID(), programId: randomUUID(), users: [], createdAt: new Date().toISOString() };
  await save(state);
  for (let i = 0; i < 30; i++) {
    const email = `load-${runId}-${i}@example.invalid`, password = `A1!${randomBytes(24).toString('hex')}`;
    const created = await aws('cognito-idp', 'admin-create-user', { UserPoolId: pool, Username: email,
      MessageAction: 'SUPPRESS', TemporaryPassword: password, UserAttributes: [{ Name: 'email', Value: email }] });
    const user = { email, password, username: created.User.Username, subject: created.User.Attributes.find(a => a.Name === 'sub').Value,
      id: randomUUID(), membershipId: randomUUID(), enrollmentId: randomUUID() };
    state.users.push(user); await save(state);
    await aws('cognito-idp', 'admin-set-user-password', { UserPoolId: pool, Username: user.username, Password: password, Permanent: true });
    console.log(`Synthetic identity ${i + 1}/30 created; email suppressed.`);
  }
} else {
  const state = JSON.parse(await readFile(statePath, 'utf8'));
  if (state.runId !== runId) throw new Error('Run mismatch.');
  if (state.cleanedAt && !['cleanup','verify','metrics'].includes(mode)) throw new Error('Run already cleaned; use a new identifier.');
  if (mode === 'auth') {
    const { chromium } = requireWeb('@playwright/test');
    const browser = await chromium.launch({ headless: true });
    try {
      for (let i = 0; i < state.users.length; i++) {
        const user = state.users[i];
        const context = await browser.newContext();
        let step = 'open-login';
        try {
          const page = await context.newPage();
          await page.goto(`${base}/login`);
          await page.getByRole('button', { name: 'Continuar con Cognito' }).click();
          await page.waitForURL(u => u.hostname.endsWith('.amazoncognito.com') && u.pathname === '/login');
          step = 'cognito-form';
          await page.locator('input[name="username"]:visible').fill(user.email);
          await page.locator('input[name="password"]:visible').fill(user.password);
          await page.locator('[name="signInSubmitButton"]:visible').click();
          step = 'callback';
          await page.waitForURL(u => u.origin === base && u.pathname === '/account', { timeout: 60000 });
          step = 'access-token';
          // Amplify SSR stores sessions in cookies, not localStorage.
          let cookies;
          for (let attempt = 0; attempt < 60; attempt++) {
            cookies = await context.cookies(base);
            const tokenCookie = cookies.find(c => c.name.endsWith('.accessToken'));
            if (tokenCookie) { user.token = decodeURIComponent(tokenCookie.value); break; }
            await sleep(500);
          }
          if (!user.token) throw new Error('No access token cookie');
          user.cookieHeader = cookies.map(c=>`${c.name}=${c.value}`).join('; ');
          const claims = JSON.parse(Buffer.from(user.token.split('.')[1], 'base64url'));
          if (claims.sub !== user.subject || claims.client_id !== client || claims.token_use !== 'access') throw new Error('Token identity mismatch');
          user.expiresAt = claims.exp;
          await save(state);
          console.log(`Hosted UI session ${i + 1}/30 ready.`);
        } catch {
          // Playwright error call logs can include values passed to fill().
          throw new Error(`Hosted UI login failed for synthetic index ${i}, step ${step}; sensitive diagnostics suppressed.`);
        } finally { await context.close(); }
      }
    } finally { await browser.close(); }
  } else if (mode === 'seed') {
    if (state.seeded) throw new Error('Fixture already seeded.');
    if (state.users.length !== 30) throw new Error('Expected 30 distinct accounts.');
    console.log(await ssm(['/usr/local/sbin/refleja-db-backup backup pre-load-test']));
    const org = q(state.organizationId), program = q(state.programId);
    let script = `BEGIN; SET LOCAL lock_timeout='5s';\n`;
    script += `INSERT INTO rti.organizations(id,name,slug,status,default_time_zone,created_at,updated_at,version) VALUES(${org},${q('PRUEBA SINTETICA ' + runId)},${q(runId)},'ACTIVE','America/Bogota',now(),now(),0);\n`;
    for (const [i, u] of state.users.entries()) {
      script += `INSERT INTO rti.users(id,cognito_subject,email,email_normalized,first_name,last_name,status,full_name,date_of_birth,phone,city,country,created_at,updated_at,version) VALUES(${q(u.id)},${q(u.subject)},${q(u.email)},${q(u.email)},'Sintetico',${q(String(i))},'ACTIVE','Participante sintetico','1990-01-01','0000000000','Prueba','Prueba',now(),now(),0);\n`;
      script += `INSERT INTO rti.organization_memberships(id,organization_id,user_id,status,joined_at,job_title,profile_status,created_at,updated_at,version) VALUES(${q(u.membershipId)},${org},${q(u.id)},'ACTIVE',now(),'Prueba de carga','COMPLETE',now(),now(),0);\nINSERT INTO rti.membership_roles VALUES(${q(u.membershipId)},'COLLABORATOR');\n`;
    }
    script += `INSERT INTO rti.membership_roles VALUES(${q(state.users[0].membershipId)},'CONSULTANT');\n`;
    script += `INSERT INTO rti.programs(id,organization_id,name,description,status,start_date,end_date,activated_at,primary_consultant_membership_id,created_at,updated_at,version) VALUES(${program},${org},'Programa sintetico 30 participantes','Solo prueba de carga','ACTIVE',current_date,current_date+30,now(),${q(state.users[0].membershipId)},now(),now(),0);\n`;
    for (const u of state.users) script += `INSERT INTO rti.enrollments(id,organization_id,program_id,participant_membership_id,status,approved_at,started_at,created_at,updated_at,version) VALUES(${q(u.enrollmentId)},${org},${program},${q(u.membershipId)},'ACTIVE',now(),now(),now(),now(),0);\n`;
    state.activities = [];
    for (let d = 1; d <= 3; d++) {
      const dimension = q(randomUUID());
      script += `INSERT INTO rti.program_modules(id,organization_id,program_id,name,position,created_at,updated_at,version) VALUES(${dimension},${org},${program},'Dimension ${d}',${d},now(),now(),0);\n`;
      for (let s = 1; s <= 2; s++) {
        const session = q(randomUUID());
        script += `INSERT INTO rti.program_sessions(id,organization_id,program_id,module_id,name,objective,scheduled_date,position,created_at,updated_at,version) VALUES(${session},${org},${program},${dimension},'Sesion ${s}','Objetivo sintetico',current_date,${s},now(),now(),0);\n`;
        for (let a = 1; a <= 2; a++) {
          const activity = { id: randomUUID(), evaluationId: randomUUID(), questions: [] };
          script += `INSERT INTO rti.program_activities(id,organization_id,program_id,module_id,session_id,title,instructions,due_date,position,created_at,updated_at,version) VALUES(${q(activity.id)},${org},${program},${dimension},${session},'Actividad ${d}-${s}-${a}','Responder con datos sinteticos',current_date+14,${a},now(),now(),0);\n`;
          script += `INSERT INTO rti.activity_evaluations(id,organization_id,program_id,activity_id,title,created_at,updated_at,version) VALUES(${q(activity.evaluationId)},${org},${program},${q(activity.id)},'Encuesta sintetica',now(),now(),0);\n`;
          for (const [j, type] of ['AGREEMENT_SCALE','LIKELIHOOD_SCALE','OPEN_TEXT','EMOTION_MULTI_SELECT'].entries()) {
            const question = { id: randomUUID(), type }; activity.questions.push(question);
            script += `INSERT INTO rti.activity_evaluation_questions(id,organization_id,program_id,evaluation_id,prompt,question_type,position,created_at,updated_at,version) VALUES(${q(question.id)},${org},${program},${q(activity.evaluationId)},'Pregunta sintetica',${q(type)},${j+1},now(),now(),0);\n`;
          }
          for (const u of state.users) script += `INSERT INTO rti.activity_assignments(id,organization_id,program_id,activity_id,enrollment_id,assigned_at,status,created_at,updated_at,version) VALUES(${q(randomUUID())},${org},${program},${q(activity.id)},${q(u.enrollmentId)},now(),'ASSIGNED',now(),now(),0);\n`;
          state.activities.push(activity);
        }
      }
    }
    script += 'COMMIT; SELECT \'SYNTHETIC_FIXTURE_READY\';';
    await save(state); console.log((await sql(script)).split('\n').slice(-5).join('\n'));
    state.seeded = true; await save(state);
  } else if (mode === 'cleanup') {
    const probeUser = state.users.find(u=>u.token && u.expiresAt * 1000 > Date.now() + 300000);
    const probeToken = probeUser?.token;
    for (const u of state.users) {
      if (!u.email.startsWith(`load-${runId}-`) || !u.email.endsWith('@example.invalid')) throw new Error('Not a synthetic identity');
      if (u.deleted) continue;
      const actual = await aws('cognito-idp', 'admin-get-user', { UserPoolId: pool, Username: u.username });
      if (actual.UserAttributes.find(a=>a.Name==='sub').Value !== u.subject) throw new Error('Subject changed; refusing cleanup');
      await aws('cognito-idp', 'admin-delete-user', { UserPoolId: pool, Username: u.username });
      u.deleted = true; delete u.password; delete u.token; delete u.cookieHeader; await save(state);
    }
    if (state.seeded) {
      const org = q(state.organizationId);
      console.log(await sql(`BEGIN;
DO $$ BEGIN IF NOT EXISTS(SELECT FROM rti.organizations WHERE id=${org} AND slug=${q(runId)} AND name=${q('PRUEBA SINTETICA ' + runId)}) THEN RAISE EXCEPTION 'TEST_ORGANIZATION_MISMATCH'; END IF; END $$;
UPDATE rti.enrollments SET status='WITHDRAWN',withdrawn_at=now(),suspended_from_status=NULL,version=version+1 WHERE organization_id=${org};
UPDATE rti.users SET status='DEACTIVATED',version=version+1 WHERE id IN (SELECT user_id FROM rti.organization_memberships WHERE organization_id=${org}) AND email LIKE ${q('load-' + runId + '-%@example.invalid')};
UPDATE rti.organization_memberships SET status='REVOKED',version=version+1 WHERE organization_id=${org};
UPDATE rti.organizations SET status='DEACTIVATED',version=version+1 WHERE id=${org}; COMMIT;`));
    }
    if (state.seeded && probeToken) {
      const response = await fetch(`${base}/api/v1/me/programs/${state.programId}/activities`,
        {headers:{Authorization:`Bearer ${probeToken}`},signal:AbortSignal.timeout(10000)});
      await response.arrayBuffer();
      await writeFile(join(dir,'cleanup-access.json'),JSON.stringify({status:response.status,checkedAt:new Date().toISOString()}));
      if (![401,403].includes(response.status)) throw new Error('Synthetic account still has unexpected API access after cleanup');
      console.log(`Removed synthetic session denied with HTTP ${response.status}.`);
    }
    state.cleanedAt = new Date().toISOString(); await save(state); console.log('Synthetic accounts removed; test organization deactivated.');
  } else if (mode === 'verify') {
    const org = q(state.organizationId), program = q(state.programId);
    const output = await sql(`BEGIN READ ONLY;
SELECT json_build_object(
  'organizationStatus',(SELECT status FROM rti.organizations WHERE id=${org} AND slug=${q(runId)}),
  'memberships',(SELECT count(*) FROM rti.organization_memberships WHERE organization_id=${org}),
  'activeMemberships',(SELECT count(*) FROM rti.organization_memberships WHERE organization_id=${org} AND status='ACTIVE'),
  'activeEnrollments',(SELECT count(*) FROM rti.enrollments WHERE organization_id=${org} AND program_id=${program} AND status='ACTIVE'),
  'withdrawnEnrollments',(SELECT count(*) FROM rti.enrollments WHERE organization_id=${org} AND program_id=${program} AND status='WITHDRAWN'),
  'assignments',(SELECT count(*) FROM rti.activity_assignments WHERE organization_id=${org} AND program_id=${program}),
  'submissions',(SELECT count(*) FROM rti.activity_assignments WHERE organization_id=${org} AND program_id=${program} AND submitted_at IS NOT NULL),
  'surveys',(SELECT count(*) FROM rti.activity_evaluation_responses WHERE organization_id=${org} AND program_id=${program}),
  'answerValues',(SELECT count(*) FROM rti.activity_evaluation_answers WHERE organization_id=${org} AND program_id=${program}),
  'incompleteSurveys',(SELECT count(*) FROM (SELECT response_id FROM rti.activity_evaluation_answers WHERE organization_id=${org} AND program_id=${program} GROUP BY response_id HAVING count(DISTINCT question_id)<>4 OR count(*)<>5) invalid)
); COMMIT;`);
    const counts = JSON.parse(output.split('\n').find(line=>line.trim().startsWith('{')));
    if (counts.assignments !== 360 || counts.submissions !== counts.surveys || counts.answerValues !== counts.surveys * 5 || counts.incompleteSurveys !== 0)
      throw new Error('Synthetic persistence consistency check failed');
    if (await fileExists(join(dir,'results.json'))) {
      const measured = JSON.parse(await readFile(join(dir,'results.json'),'utf8'));
      const expected = measured.results.reduce((n,stage)=>n+(stage.endpoints['submit-survey']?.requests??0)-(stage.endpoints['submit-survey']?.errors??0),0);
      if (counts.surveys !== expected) throw new Error('Database count does not match successful measured survey requests');
    }
    if (state.cleanedAt && (counts.organizationStatus !== 'DEACTIVATED' || counts.activeMemberships || counts.activeEnrollments || counts.withdrawnEnrollments !== 30))
      throw new Error('Synthetic cleanup check failed');
    if (state.cleanedAt) {
      const remaining = await aws('cognito-idp','list-users',{UserPoolId:pool,Filter:`email ^= "load-${runId}-"`});
      counts.cognitoRemaining = remaining.Users.length;
      if (counts.cognitoRemaining) throw new Error('Synthetic Cognito accounts remain');
    }
    await writeFile(join(dir,state.cleanedAt?'verification-cleanup.json':'verification-load.json'),JSON.stringify(counts,null,2));
    console.log(JSON.stringify(counts));
  } else if (mode === 'metrics') {
    const end = new Date(), start = new Date(Math.floor((end - 2 * 3600_000) / 300_000) * 300_000);
    const metrics = {};
    for (const name of ['CPUUtilization','CPUCreditBalance','CPUCreditUsage','StatusCheckFailed']) {
      metrics[name] = (await aws('cloudwatch','get-metric-statistics',{Namespace:'AWS/EC2',MetricName:name,Dimensions:[{Name:'InstanceId',Value:instance}],StartTime:start.toISOString(),EndTime:end.toISOString(),Period:300,Statistics:['Average','Maximum','Minimum']})).Datapoints;
    }
    await writeFile(join(dir, `cloudwatch-${Date.now()}.json`), JSON.stringify(metrics,null,2));
    console.log('CloudWatch samples saved (no credentials).');
  } else {
    if (mode === 'run' && await fileExists(join(dir,'results.json'))) throw new Error('Do not repeat measured writes; use a new fixture.');
    if (!state.seeded || state.users.some(u => !u.token || u.expiresAt * 1000 < Date.now() + (mode === 'run' ? 1500_000 : 60000))) throw new Error('Seed and refresh Hosted UI sessions first.');
    const { runLoad } = await import('./pilot-load-runner.mjs');
    await runLoad({state, dir, base, ssm, smoke:mode==='smoke'});
  }
}
