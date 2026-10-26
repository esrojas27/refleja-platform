import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const image = 'caddy:2.10.2-alpine';
const config = fileURLToPath(new URL('../infra/dev/Caddyfile', import.meta.url));
function docker(...args) {
  const result = spawnSync('docker', args, { encoding: 'utf8', timeout: 30_000 });
  assert.equal(result.status, 0, result.stderr || result.error?.message || result.stdout);
  return result.stdout.trim();
}
const mount = ['--mount', `type=bind,source=${config},target=/etc/caddy/Caddyfile,readonly`];

test('Caddy validates local defaults and the HTTPS migration configuration without network access', () => {
  for (const settings of [[], ['-e', 'DEV_SITE_ADDRESS=reflejati.com, www.reflejati.com, rti-dev.18-210-172-252.nip.io',
    '-e', 'DEV_CANONICAL_HOST=reflejati.com', '-e', 'DEV_PUBLIC_URL=https://reflejati.com']]) {
    docker('run', '--rm', '--network', 'none', ...mount, ...settings, image,
      'caddy', 'validate', '--config', '/etc/caddy/Caddyfile', '--adapter', 'caddyfile');
  }
});

test('real proxy redirects aliases, retains normal paths and queries, and discards old OAuth callbacks', { timeout: 60_000 }, async () => {
  const name = `rti-domain-check-${randomUUID()}`;
  // HTTP-only test sites avoid ACME and do not contact the public domains.
  docker('run', '-d', '--rm', '--name', name, '-p', '127.0.0.1::80', '--add-host', 'web:127.0.0.1', '--add-host', 'api:127.0.0.1', ...mount,
    '-e', 'DEV_SITE_ADDRESS=http://reflejati.com, http://www.reflejati.com, http://rti-dev.18-210-172-252.nip.io',
    '-e', 'DEV_CANONICAL_HOST=reflejati.com', '-e', 'DEV_PUBLIC_URL=https://reflejati.com', image);
  try {
    const port = docker('port', name, '80/tcp').split(':').at(-1);
    const request = (host, pathname) => new Promise((resolve, reject) => {
      const req = http.get(`http://127.0.0.1:${port}${pathname}`, { headers: { Host: host } }, response => {
        response.resume();
        response.on('end', () => resolve({ status: response.statusCode, headers: { get: key => response.headers[key] ?? null } }));
      });
      req.setTimeout(3000, () => req.destroy(new Error('Proxy request timed out')));
      req.on('error', reject);
    });
    let ready = false;
    for (let attempt = 0; attempt < 30; attempt++) {
      try { await request('www.reflejati.com', '/'); ready = true; break; }
      catch { await new Promise(resolve => setTimeout(resolve, 100)); }
    }
    assert.ok(ready, 'Caddy must start');
    for (const host of ['www.reflejati.com', 'rti-dev.18-210-172-252.nip.io']) {
      const normal = await request(host, '/invitations?source=existing-link');
      assert.equal(normal.status, 302);
      assert.equal(normal.headers.get('location'), 'https://reflejati.com/invitations?source=existing-link');
      const callback = await request(host, '/account?code=synthetic-code&state=synthetic-state');
      assert.equal(callback.status, 302);
      assert.equal(callback.headers.get('location'), 'https://reflejati.com/login');
    }
    const canonical = await request('reflejati.com', '/login');
    // There is no web upstream in this isolated smoke test, but the canonical host must not redirect itself.
    assert.equal(canonical.status, 502);
    assert.equal(canonical.headers.get('location'), null);
  } finally { docker('stop', '--time', '1', name); }
});
