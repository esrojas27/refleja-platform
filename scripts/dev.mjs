import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createWriteStream, existsSync } from 'node:fs';
import { mkdir, open, readFile, unlink, writeFile } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const web = path.join(root, 'apps', 'web');
const windows = process.platform === 'win32';
const children = new Set();
const logStreams = [];
let stopping = false;
let secrets = [];

export function redact(text, values = []) {
  let result = String(text);
  for (const value of values.filter(Boolean).sort((a, b) => b.length - a.length)) {
    result = result.split(value).join('[REDACTED]');
  }
  return result.replace(/([?&](?:code|state|access_token|id_token|refresh_token)=)[^\s&]*/gi, '$1[REDACTED]')
    .replace(/Bearer\s+[^\s"']+/gi, 'Bearer [REDACTED]');
}

export function parseEnvironment(output) {
  const result = {};
  for (const line of output.split(/\r?\n/)) {
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line);
    if (match) result[match[1]] = match[2];
  }
  return result;
}

function configured(value) {
  return Boolean(value?.trim()) && !/replace-with|<[^>]+>/.test(value);
}

export function authenticationEnvironment(backend, frontend) {
  const result = { ...frontend };
  for (const [key, value] of Object.entries(backend)) {
    if (key.startsWith('NEXT_PUBLIC_') && !result[key]) result[key] = value;
  }
  const keys = ['NEXT_PUBLIC_COGNITO_USER_POOL_ID', 'NEXT_PUBLIC_COGNITO_APP_CLIENT_ID',
    'NEXT_PUBLIC_COGNITO_DOMAIN', 'NEXT_PUBLIC_COGNITO_REDIRECT_SIGN_IN', 'NEXT_PUBLIC_COGNITO_REDIRECT_SIGN_OUT'];
  for (const key of keys) {
    if (!configured(result[key])) throw new Error(`Configura ${key} en apps/web/.env.local (ver .env.example).`);
  }
  for (const key of ['COGNITO_ISSUER_URI', 'COGNITO_JWK_SET_URI', 'COGNITO_APP_CLIENT_ID']) {
    if (!configured(backend[key])) throw new Error(`Configura ${key} en .env usando las salidas de infra/cognito.`);
  }
  if (result.NEXT_PUBLIC_COGNITO_APP_CLIENT_ID !== backend.COGNITO_APP_CLIENT_ID ||
      !backend.COGNITO_ISSUER_URI.endsWith(`/${result.NEXT_PUBLIC_COGNITO_USER_POOL_ID}`) ||
      backend.COGNITO_JWK_SET_URI !== `${backend.COGNITO_ISSUER_URI}/.well-known/jwks.json`) {
    throw new Error('Las configuraciones Cognito de .env y apps/web/.env.local no coinciden.');
  }
  const callback = new URL(result.NEXT_PUBLIC_COGNITO_REDIRECT_SIGN_IN);
  const logout = new URL(result.NEXT_PUBLIC_COGNITO_REDIRECT_SIGN_OUT);
  if (callback.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(callback.hostname) ||
      callback.origin !== logout.origin || callback.pathname !== '/account' || logout.pathname !== '/login' ||
      callback.search || callback.hash || logout.search || logout.hash || callback.username || callback.password) {
    throw new Error('Los redirects locales deben compartir origen HTTP local y terminar en /account y /login.');
  }
  return { publicEnv: result, origin: callback.origin, port: Number(callback.port || 80) };
}

export function invitationEnvironment(backend, frontend) {
  const enabled = String(backend.INVITATIONS_ENABLED || 'false').toLowerCase() === 'true';
  if (!enabled) return { INVITATIONS_ENABLED: 'false' };
  const required = ['INVITATIONS_AWS_REGION', 'INVITATIONS_COGNITO_USER_POOL_ID',
    'INVITATIONS_SES_FROM', 'INVITATIONS_WEB_BASE_URL'];
  for (const key of required) {
    if (!configured(backend[key])) throw new Error(`Configura ${key} en .env antes de habilitar invitaciones.`);
  }
  const webBase = new URL(backend.INVITATIONS_WEB_BASE_URL);
  const signIn = new URL(frontend.NEXT_PUBLIC_COGNITO_REDIRECT_SIGN_IN);
  if (webBase.origin !== signIn.origin || webBase.pathname !== '/' || webBase.search || webBase.hash) {
    throw new Error('INVITATIONS_WEB_BASE_URL debe ser el origen exacto configurado para la web.');
  }
  if (backend.INVITATIONS_COGNITO_USER_POOL_ID !== frontend.NEXT_PUBLIC_COGNITO_USER_POOL_ID ||
      !backend.COGNITO_ISSUER_URI.endsWith(`/${backend.INVITATIONS_COGNITO_USER_POOL_ID}`)) {
    throw new Error('El User Pool de invitaciones no coincide con autenticacion.');
  }
  return Object.fromEntries(['INVITATIONS_ENABLED', ...required, 'AWS_PROFILE']
    .filter(key => backend[key]).map(key => [key, backend[key]]));
}

export async function portAvailable(port) {
  // Windows can allow overlapping binds. Check live listeners as well as binds.
  for (const host of ['127.0.0.1', '::1']) {
    const listening = await new Promise((resolve) => {
      const socket = net.createConnection({ host, port });
      const finish = (busy) => { socket.destroy(); resolve(busy); };
      socket.once('connect', () => finish(true));
      socket.once('error', () => finish(false));
      socket.setTimeout(500, () => finish(true));
    });
    if (listening) return false;
    const available = await new Promise((resolve, reject) => {
      const server = net.createServer();
      server.once('error', (error) => {
        if (['EADDRINUSE', 'EACCES'].includes(error.code)) resolve(false);
        else if (host === '::1' && ['EAFNOSUPPORT', 'EADDRNOTAVAIL'].includes(error.code)) resolve(true);
        else reject(error);
      });
      server.listen({ port, host, ipv6Only: host === '::1', exclusive: true }, () => server.close(() => resolve(true)));
    });
    if (!available) return false;
  }
  return true;
}

export async function selectPort(preferred, alternatives = []) {
  for (const port of [...new Set([preferred, ...alternatives])]) {
    if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Puerto local invalido (1024-65535).');
    if (await portAvailable(port)) return port;
  }
  throw new Error(`Puertos ocupados: ${[preferred, ...alternatives].join(', ')}. Cierra el servicio correspondiente o configura otro puerto.`);
}

function launch(command, args, { cwd = root, env = process.env, log } = {}) {
  if (stopping) throw new Error('Arranque cancelado.');
  const child = spawn(command, args, { cwd, env, windowsHide: true, detached: !windows, stdio: ['ignore', 'pipe', 'pipe'] });
  children.add(child);
  child.done = new Promise((resolve, reject) => {
    child.once('error', () => { children.delete(child); reject(new Error(`No se pudo ejecutar ${path.basename(command)}. Comprueba su instalacion y PATH.`)); });
    child.once('close', (code) => { children.delete(child); resolve(code); });
  });
  // Readiness loops report failures; avoid an unhandled rejection before they run.
  child.done.catch(() => {});
  if (log) {
    const stream = createWriteStream(log, { flags: 'a' });
    logStreams.push(stream);
    for (const pipe of [child.stdout, child.stderr]) {
      const lines = createInterface({ input: pipe });
      lines.on('line', (line) => stream.write(`${redact(line, secrets)}\n`));
    }
  }
  return child;
}

async function stopChild(child) {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null) return;
  if (windows) {
    // Only the process tree started by this invocation; never kill by image or port.
    await new Promise((resolve) => {
      const killer = spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
      killer.once('error', resolve);
      killer.once('exit', resolve);
    });
  } else {
    try { process.kill(-child.pid, 'SIGTERM'); } catch { return; }
    await Promise.race([child.done, delay(3000)]);
    try { process.kill(-child.pid, 'SIGKILL'); } catch { /* Already stopped. */ }
  }
}

async function run(command, args, options = {}) {
  const child = launch(command, args, options);
  let stdout = '';
  let stderr = '';
  if (!options.log) {
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
  }
  const timeout = setTimeout(() => { void stopChild(child); }, options.timeout ?? 30000);
  const progress = options.log ? setInterval(() => console.log(`${options.label ?? path.basename(command)} sigue en curso. Log: ${options.log}`), 30000) : undefined;
  try {
    const code = await child.done;
    if (code !== 0) throw new Error(`${options.label ?? path.basename(command)} fallo (codigo ${code ?? 'interrumpido'}).${options.log ? ` Revisa ${options.log}` : ''}`);
    return { stdout, stderr };
  } finally { clearTimeout(timeout); clearInterval(progress); }
}

function packageCommand(command, args) {
  if (!windows) return [command, args];
  // Static commands only. Paths, passwords and user values never become shell source.
  const scripts = {
    mavenVersion: '& mvn.cmd --version; exit $LASTEXITCODE',
    mavenRun: '& mvn.cmd spring-boot:run; exit $LASTEXITCODE',
    npmInstall: '& npm.cmd ci; exit $LASTEXITCODE',
  };
  const key = command === 'mvn' ? (args[0] === '--version' ? 'mavenVersion' : 'mavenRun') : 'npmInstall';
  return ['powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', scripts[key]]];
}

async function waitFor(label, probe, timeout = 180000, service) {
  const started = Date.now();
  const deadline = started + timeout;
  let nextNotice = started + 30000;
  console.log(`Esperando ${label}...`);
  while (Date.now() < deadline) {
    if (stopping) throw new Error('Arranque cancelado.');
    if (service && !children.has(service)) throw new Error(`${label} termino antes de estar listo. Revisa su log.`);
    if (await probe()) return;
    if (Date.now() >= nextNotice) {
      console.log(`${label}: ${Math.round((Date.now() - started) / 1000)} s esperando disponibilidad...`);
      nextNotice = Date.now() + 30000;
    }
    await delay(1000);
  }
  throw new Error(`${label} no estuvo listo a tiempo. Revisa los logs y la configuracion.`);
}

async function httpReady(url, expected = 200, health = false) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000), redirect: 'manual' });
    const body = await response.text();
    return response.status === expected && (!health || JSON.parse(body).status === 'UP');
  } catch { return false; }
}

async function main() {
  const flags = process.argv.slice(2);
  if (flags.includes('--help')) {
    console.log('Uso: node scripts/dev.mjs [--smoke] [--install]\n--smoke: comprueba DB/API/web y detiene API/web al terminar.\n--install: fuerza npm ci. Ctrl+C cierra API/web; PostgreSQL conserva sus datos.');
    return;
  }
  if (flags.some((flag) => !['--smoke', '--install'].includes(flag))) throw new Error('Opcion desconocida. Consulta --help.');
  const [nodeMajor, nodeMinor] = process.versions.node.split('.').map(Number);
  if (nodeMajor < 20 || (nodeMajor === 20 && nodeMinor < 9)) throw new Error('Next.js requiere Node.js 20.9 o posterior.');
  if (!existsSync(path.join(root, '.env'))) throw new Error('Falta .env: copia .env.example y configura contrasenas locales y Cognito.');

  const localDir = path.join(root, '.local', 'dev');
  await mkdir(localDir, { recursive: true });
  const lockPath = path.join(localDir, 'launcher.lock');
  let lock;
  try { lock = await open(lockPath, 'wx'); } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const previous = Number(await readFile(lockPath, 'utf8'));
    let alive = true;
    if (Number.isInteger(previous) && previous > 0) {
      try { process.kill(previous, 0); } catch (e) { if (e.code === 'ESRCH') alive = false; }
    }
    if (alive) throw new Error('Ya hay un arranque activo (o lock sin propietario verificable). Usa Ctrl+C en su terminal.');
    await unlink(lockPath);
    lock = await open(lockPath, 'wx');
  }
  await lock.writeFile(String(process.pid));
  const cancel = () => { stopping = true; void Promise.all([...children].map(stopChild)); };
  process.on('SIGINT', cancel);
  process.on('SIGTERM', cancel);
  try {
    const logDir = path.join(localDir, new Date().toISOString().replace(/[:.]/g, '-'));
    await mkdir(logDir, { recursive: true });
    console.log(`Refleja Tu Interior - desarrollo local\nLogs: ${logDir}`);
    const maven = await run(...packageCommand('mvn', ['--version']), { label: 'Maven / Java 21' });
    if (!/Java version: 21(?:[.\s,]|$)/.test(maven.stdout + maven.stderr)) throw new Error('Maven debe utilizar Java 21. Revisa JAVA_HOME y PATH.');
    await run('docker', ['compose', 'version'], { label: 'Docker Compose' });
    try { await run('docker', ['info', '--format', '{{.ServerVersion}}']); }
    catch {
      console.log('Iniciando Docker Desktop...');
      await run('docker', ['desktop', 'start', '--detach'], { label: 'Docker Desktop: inicia Docker Desktop manualmente si esta version no soporta el comando' });
      await waitFor('Docker Engine', async () => {
        try { await run('docker', ['info', '--format', '{{.ServerVersion}}'], { timeout: 5000 }); return true; } catch { return false; }
      }, 120000);
    }
    const composeArgs = ['compose', '--project-directory', root, '--env-file', path.join(root, '.env'), '-f', path.join(root, 'docker-compose.yml')];
    const compose = (args, options) => run('docker', [...composeArgs, ...args], options);
    const backend = parseEnvironment((await compose(['config', '--environment'], { label: 'Lectura de .env por Compose' })).stdout);
    const startupSeconds = Number(backend.RTI_STARTUP_TIMEOUT_SECONDS || 600);
    if (!Number.isInteger(startupSeconds) || startupSeconds < 30 || startupSeconds > 1800) {
      throw new Error('RTI_STARTUP_TIMEOUT_SECONDS debe estar entre 30 y 1800.');
    }
    for (const key of ['POSTGRES_SUPERUSER_PASSWORD', 'RTI_MIGRATOR_PASSWORD', 'RTI_APP_PASSWORD']) {
      if (!configured(backend[key])) throw new Error(`Configura ${key} en .env.`);
    }
    secrets = [backend.POSTGRES_SUPERUSER_PASSWORD, backend.RTI_MIGRATOR_PASSWORD, backend.RTI_APP_PASSWORD];
    if (new Set(secrets).size !== 3) throw new Error('Las tres contrasenas tecnicas de PostgreSQL deben ser diferentes.');
    const lockHash = createHash('sha256').update(await readFile(path.join(web, 'package-lock.json'))).update(await readFile(path.join(web, 'package.json'))).digest('hex');
    const installedMarker = path.join(localDir, 'npm-inputs.sha256');
    const installedHash = await readFile(installedMarker, 'utf8').catch(() => '');
    if (flags.includes('--install') || installedHash !== lockHash || !existsSync(path.join(web, 'node_modules', 'next', 'dist', 'bin', 'next'))) {
      console.log('Instalando dependencias web con npm ci (primer arranque o cambio de lockfile)...');
      await run(...packageCommand('npm', ['ci']), { cwd: web, env: { ...process.env, NODE_ENV: 'development' }, label: 'npm ci', timeout: 600000, log: path.join(logDir, 'npm.log') });
      await writeFile(installedMarker, lockHash);
    }
    const envReader = "const {loadEnvConfig}=require('@next/env');const {combinedEnv}=loadEnvConfig(process.cwd(),true,{info(){},error(){}});console.log(JSON.stringify(Object.fromEntries(Object.entries(combinedEnv).filter(([key])=>key.startsWith('NEXT_PUBLIC_')))));";
    const publicConfig = JSON.parse((await run(process.execPath, ['-e', envReader], { cwd: web, env: { ...process.env, NODE_ENV: 'development' } })).stdout);
    const auth = authenticationEnvironment(backend, publicConfig);
    if (!await portAvailable(auth.port)) throw new Error(`El puerto web ${auth.port} esta ocupado. Cierra el Next.js anterior; el puerto debe coincidir con el callback Cognito.`);

    // Reuse the actual published port: .env may differ from a previous local override.
    const containerId = (await compose(['ps', '-q', 'postgres'])).stdout.trim();
    let dbPort;
    if (containerId) {
      const ports = (await compose(['port', 'postgres', '5432'])).stdout.trim();
      dbPort = Number(/:(\d+)\s*$/.exec(ports)?.[1]);
      if (!dbPort) throw new Error('El PostgreSQL existente no publica un puerto local valido. Revisa docker compose ps.');
      console.log(`Reutilizando PostgreSQL del proyecto en ${dbPort}.`);
    } else {
      dbPort = await selectPort(Number(backend.POSTGRES_PORT || 5432), [55432, 55433]);
      console.log(`Iniciando PostgreSQL en ${dbPort}...`);
      await compose(['up', '-d', '--wait', '--wait-timeout', '120', 'postgres'], {
        env: { ...process.env, POSTGRES_PORT: String(dbPort) }, timeout: 180000, log: path.join(logDir, 'postgres.log'),
      });
    }
    const activeId = (await compose(['ps', '-q', 'postgres'])).stdout.trim();
    await waitFor('PostgreSQL healthy', async () => {
      const status = (await run('docker', ['inspect', '--format', '{{.State.Health.Status}}', activeId])).stdout.trim();
      return status === 'healthy';
    }, 120000);
    const composeConfig = JSON.parse((await compose(['config', '--format', 'json'])).stdout);
    const dbName = composeConfig.services.postgres.environment.POSTGRES_DB;
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(dbName)) throw new Error('POSTGRES_DB debe ser un identificador PostgreSQL simple.');
    const apiPort = await selectPort(Number(backend.SERVER_PORT || 8080), [8081, 8082, 8083]);
    const apiOrigin = `http://localhost:${apiPort}`;
    const dbUrl = `jdbc:postgresql://127.0.0.1:${dbPort}/${dbName}`;
    const invitations = invitationEnvironment(backend, auth.publicEnv);
    const apiEnv = { ...process.env, DB_URL: dbUrl, DB_USERNAME: 'rti_app', DB_PASSWORD: backend.RTI_APP_PASSWORD,
      DB_MIGRATION_URL: dbUrl, DB_MIGRATION_USERNAME: 'rti_migrator', DB_MIGRATION_PASSWORD: backend.RTI_MIGRATOR_PASSWORD,
      COGNITO_ISSUER_URI: backend.COGNITO_ISSUER_URI, COGNITO_JWK_SET_URI: backend.COGNITO_JWK_SET_URI,
      COGNITO_APP_CLIENT_ID: backend.COGNITO_APP_CLIENT_ID, CORS_ALLOWED_ORIGINS: auth.origin,
      OPERATOR_ORGANIZATION_ID: backend.OPERATOR_ORGANIZATION_ID || '',
      ...invitations,
      SERVER_ADDRESS: '127.0.0.1', SERVER_PORT: String(apiPort) };
    const api = launch(...packageCommand('mvn', ['spring-boot:run']), { cwd: path.join(root, 'apps', 'api'), env: apiEnv, log: path.join(logDir, 'api.log') });
    await waitFor('API /actuator/health', () => httpReady(`${apiOrigin}/actuator/health`, 200, true), startupSeconds * 1000, api);
    if (!await httpReady(`${apiOrigin}/api/v1/me`, 401)) throw new Error('/api/v1/me no devuelve el 401 esperado sin autenticacion.');
    const frontendEnv = { ...process.env, ...auth.publicEnv, NODE_ENV: 'development', NEXT_PUBLIC_API_BASE_URL: apiOrigin };
    // DB credentials loaded from .env are supplied exclusively to the API process.
    const frontend = launch(process.execPath, [path.join(web, 'node_modules', 'next', 'dist', 'bin', 'next'), 'dev', '--hostname', '127.0.0.1', '--port', String(auth.port)], { cwd: web, env: frontendEnv, log: path.join(logDir, 'web.log') });
    for (const route of ['/', '/login', '/account']) {
      await waitFor(`web ${route}`, () => httpReady(`${auth.origin}${route}`), startupSeconds * 1000, frontend);
    }
    console.log(`\nLISTO\nWeb: ${auth.origin}\nLogin: ${auth.origin}/login\nAPI: ${apiOrigin}\nPostgreSQL: 127.0.0.1:${dbPort}\nLa URL de la API se inyecta en Next.js para esta sesion.\nCtrl+C detiene API y web. PostgreSQL y sus datos se conservan.`);
    if (flags.includes('--smoke')) { console.log('Smoke OK: health UP, /me 401 y las tres rutas web 200.'); return; }
    while (!stopping) {
      if (!children.has(api) || !children.has(frontend)) throw new Error('API o web termino inesperadamente. Revisa los logs.');
      await delay(1000);
    }
  } finally {
    stopping = true;
    await Promise.all([...children].map(stopChild));
    await Promise.all(logStreams.map((stream) => new Promise((resolve) => stream.end(resolve))));
    await lock.close();
    await unlink(lockPath);
    process.off('SIGINT', cancel);
    process.off('SIGTERM', cancel);
    console.log('API/web detenidos. PostgreSQL se conserva; para detenerlo: docker compose stop postgres');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => { console.error(`ERROR: ${redact(error.message, secrets)}`); process.exitCode = 1; });
}
