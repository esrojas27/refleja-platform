import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseEnvironment } from './dev.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const help = 'node scripts/bootstrap-operator.mjs --subject <Cognito-sub> --profile <AWS-profile> --account <12-digits> [--apply --confirm-development]';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function parseOptions(args) {
  const result = { apply: false, confirmDevelopment: false };
  const seen = new Set();
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (seen.has(key)) throw new Error('Opcion duplicada. ' + help);
    seen.add(key);
    if (key === '--apply') result.apply = true;
    else if (key === '--confirm-development') result.confirmDevelopment = true;
    else if (['--subject', '--profile', '--account'].includes(key)) result[key.slice(2)] = args[++i];
    else throw new Error('Opcion desconocida. ' + help);
  }
  if (!uuid.test(result.subject || '') || !/^[A-Za-z0-9_-]+$/.test(result.profile || '') ||
      !/^\d{12}$/.test(result.account || '') || (result.apply && !result.confirmDevelopment)) {
    throw new Error('Parametros invalidos; aplicar requiere confirmacion explicita. ' + help);
  }
  return result;
}

export function requireLocalDocker(endpoint) {
  if (typeof endpoint !== 'string' || !(/^(unix:\/\/\/[^\r\n]+|npipe:\/\/\/\/\.\/pipe\/[A-Za-z0-9_-]+)$/.test(endpoint))) {
    throw new Error('Docker debe usar un socket local; no se admite TCP, SSH ni un host remoto.');
  }
  return endpoint;
}

export function cognitoLocation(environment) {
  const match = /^https:\/\/cognito-idp\.([a-z0-9-]+)\.amazonaws\.com\/([a-z0-9-]+_[A-Za-z0-9]+)$/.exec(environment.COGNITO_ISSUER_URI || '');
  if (!match || !match[2].startsWith(match[1] + '_') ||
      environment.COGNITO_JWK_SET_URI !== environment.COGNITO_ISSUER_URI + '/.well-known/jwks.json' ||
      !/^[a-z0-9]+$/.test(environment.COGNITO_APP_CLIENT_ID || '')) {
    throw new Error('Configuracion Cognito local invalida.');
  }
  return { region: match[1], poolId: match[2], clientId: environment.COGNITO_APP_CLIENT_ID };
}

export function verifyCognito({ caller, pool, client, users }, options, location) {
  if (caller.Account !== options.account || !caller.Arn?.startsWith(`arn:aws:sts::${options.account}:assumed-role/`)) {
    throw new Error('La cuenta AWS o el rol asumido no coincide con lo solicitado.');
  }
  if (pool.Id !== location.poolId || pool.Arn !== `arn:aws:cognito-idp:${location.region}:${options.account}:userpool/${location.poolId}` ||
      pool.UserPoolTags?.Environment !== 'development' || pool.UserPoolTags?.Application !== 'refleja-tu-interior') {
    throw new Error('El pool debe pertenecer al proyecto y estar etiquetado development.');
  }
  if (client.UserPoolId !== location.poolId || client.ClientId !== location.clientId || client.ClientSecret ||
      !client.CallbackURLs?.includes('http://localhost:3000/account')) {
    throw new Error('El app client no corresponde al cliente publico de desarrollo local.');
  }
  if (users.length !== 1 || users[0].Enabled !== true || users[0].UserStatus !== 'CONFIRMED') {
    throw new Error('Se requiere exactamente un usuario Cognito habilitado y confirmado.');
  }
  const attributes = Object.fromEntries(users[0].Attributes.map(a => [a.Name, a.Value]));
  if (attributes.sub !== options.subject || attributes.email_verified !== 'true' ||
      typeof attributes.email !== 'string' || !attributes.email.includes('@') || /[\r\n\0]/.test(attributes.email)) {
    throw new Error('El sub o el email verificado no coincide. No se aprovisiona por email.');
  }
  return { subject: attributes.sub, email: attributes.email };
}

export function verifyContainer(container, compose, expectedRoot) {
  const labels = container.Config?.Labels || {};
  const normalize = value => String(value || '').replaceAll('\\', '/').replace(/\/$/, '').toLowerCase();
  if (!container.State?.Running || labels['com.docker.compose.service'] !== 'postgres' ||
      labels['com.docker.compose.project'] !== compose.name ||
      normalize(labels['com.docker.compose.project.working_dir']) !== normalize(expectedRoot) ||
      container.Config.Image !== 'postgres:18' ||
      !container.Config.Env?.includes('POSTGRES_DB=refleja_tu_interior') ||
      !container.Mounts?.some(m => m.Type === 'volume' && m.Destination === '/var/lib/postgresql' && m.Name === `${compose.name}_postgres_data`)) {
    throw new Error('El contenedor no es el PostgreSQL local esperado de este proyecto.');
  }
}

export function transactionSql(input, sql, apply) {
  if (!uuid.test(input.subject || '') || typeof input.email !== 'string') throw new Error('Identidad interna invalida.');
  const encoded = Buffer.from(JSON.stringify(input), 'utf8').toString('base64');
  return `BEGIN;\nSET LOCAL lock_timeout = '5s';\nSET LOCAL statement_timeout = '15s';\n` +
    `DO $input$ BEGIN PERFORM set_config('rti.bootstrap_input', convert_from(decode('${encoded}', 'base64'), 'UTF8'), true); END $input$;\n` +
    sql + '\n' + (apply ? 'COMMIT;' : 'ROLLBACK;') + '\n';
}

// Capture output, never log subprocess input, credentials, Cognito attributes or raw errors.
export function runCommand(command, args, { cwd = root, input = '', env = process.env } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env, windowsHide: true, shell: false, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    const timer = setTimeout(() => child.kill(), 60_000);
    child.stdout.setEncoding('utf8').on('data', chunk => { stdout += chunk; });
    child.stderr.setEncoding('utf8').on('data', chunk => { stderr += chunk; });
    child.stdin.on('error', () => {});
    child.once('error', () => { clearTimeout(timer); reject(new Error(`No se pudo ejecutar ${command}.`)); });
    child.once('close', code => {
      clearTimeout(timer);
      if (code === 0) resolve(stdout.trim());
      else {
        const reason = /BOOTSTRAP_[A-Z_]+/.exec(stderr)?.[0];
        reject(new Error(reason || `${command} fallo; verifica Docker local o renueva AWS SSO. Si fue durante apply, consulta antes de reintentar: el resultado puede ser incierto.`));
      }
    });
    child.stdin.end(input);
  });
}

export async function bootstrap(options, { run = runCommand, projectRoot = root, readSql = () => readFile(path.join(root, 'scripts/sql/bootstrap-operator.sql'), 'utf8') } = {}) {
  if (options.apply && !options.confirmDevelopment) throw new Error('Aplicar requiere --confirm-development.');
  // Pin a verified local Docker endpoint and do not inherit remote context overrides.
  const context = JSON.parse(await run('docker', ['context', 'inspect']));
  if (context.length !== 1) throw new Error('Contexto Docker ambiguo.');
  const endpoint = requireLocalDocker(context[0].Endpoints?.docker?.Host);
  const dockerEnv = { ...process.env };
  for (const key of ['DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH']) delete dockerEnv[key];
  const docker = (args, input) => run('docker', ['--host', endpoint, ...args], { cwd: projectRoot, env: dockerEnv, input });
  const composeArgs = ['compose', '--project-directory', projectRoot, '--env-file', path.join(projectRoot, '.env'), '-f', path.join(projectRoot, 'docker-compose.yml')];
  const compose = JSON.parse(await docker([...composeArgs, 'config', '--format', 'json']));
  if (compose.services?.postgres?.environment?.POSTGRES_DB !== 'refleja_tu_interior') throw new Error('Base local inesperada.');
  const environment = parseEnvironment(await docker([...composeArgs, 'config', '--environment']));
  const location = cognitoLocation(environment);
  const id = await docker([...composeArgs, 'ps', '-q', 'postgres']);
  if (!/^[a-f0-9]{12,64}$/.test(id)) throw new Error('Se requiere un unico contenedor PostgreSQL iniciado.');
  const containers = JSON.parse(await docker(['inspect', id]));
  if (containers.length !== 1) throw new Error('Contenedor ambiguo.');
  verifyContainer(containers[0], compose, projectRoot);

  const aws = async (service, args) => JSON.parse(await run('aws', [service, ...args, '--profile', options.profile,
    '--region', location.region, '--endpoint-url', `https://${service === 'sts' ? 'sts' : 'cognito-idp'}.${location.region}.amazonaws.com`,
    '--output', 'json', '--no-cli-pager'], { env: { ...process.env, AWS_PAGER: '' } }));
  const caller = await aws('sts', ['get-caller-identity']);
  if (caller.Account !== options.account) throw new Error('Cuenta AWS inesperada.');
  const { UserPool: pool } = await aws('cognito-idp', ['describe-user-pool', '--user-pool-id', location.poolId]);
  const { UserPoolClient: client } = await aws('cognito-idp', ['describe-user-pool-client', '--user-pool-id', location.poolId, '--client-id', location.clientId]);
  const { Users: users } = await aws('cognito-idp', ['list-users', '--user-pool-id', location.poolId, '--filter', `sub = "${options.subject}"`, '--no-paginate']);
  const input = verifyCognito({ caller, pool, client, users }, options, location);
  const output = await docker(['exec', '-i', id, 'psql', '-X', '-U', 'rti_app', '-d', 'refleja_tu_interior', '-v', 'ON_ERROR_STOP=1', '-Atq'],
    transactionSql(input, await readSql(), options.apply));
  const result = JSON.parse(output);
  return { action: 'BOOTSTRAP_OPERATOR', requestId: randomUUID(), timestamp: new Date().toISOString(),
    actor: caller.Arn, environment: 'development', mode: options.apply ? 'apply' : 'dry-run', ...result };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  if (process.argv.slice(2).includes('--help')) console.log(help);
  else Promise.resolve().then(() => bootstrap(parseOptions(process.argv.slice(2))))
    .then(result => console.log(JSON.stringify(result, null, 2)))
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}
