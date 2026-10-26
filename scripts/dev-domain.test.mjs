import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deploymentDomain } from './dev-domain.mjs';

test('canonical domain and aliases share the same site without changing the public origin', () => {
  assert.deepEqual(deploymentDomain('reflejati.com', 'https://reflejati.com', 'www.reflejati.com,rti-dev.18-210-172-252.nip.io'), {
    siteAddresses: 'reflejati.com, www.reflejati.com, rti-dev.18-210-172-252.nip.io', canonicalHost: 'reflejati.com',
  });
});
test('aliases are optional, trimmed and deduplicated', () => {
  assert.equal(deploymentDomain('dev.example.com', 'https://dev.example.com').siteAddresses, 'dev.example.com');
  assert.equal(deploymentDomain('example.com', 'https://example.com', ' example.com, www.example.com, www.example.com ').siteAddresses,
    'example.com, www.example.com');
});
test('rejects inconsistent origins, paths, user information and unsafe configuration text', () => {
  for (const url of ['http://example.com', 'https://other.example', 'https://example.com/', 'https://example.com/login',
    'https://example.com?query=1', 'https://user@example.com', undefined]) {
    assert.throws(() => deploymentDomain('example.com', url));
  }
  for (const host of ['example.com\nrespond 200', 'example.com:443', 'https://example.com', '*.example.com', '-bad.example', '127.0.0.1']) {
    assert.throws(() => deploymentDomain(host, `https://${host}`));
    assert.throws(() => deploymentDomain('example.com', 'https://example.com', host));
  }
  assert.throws(() => deploymentDomain('example.com', 'https://example.com', 'www.example.com,'));
  assert.throws(() => deploymentDomain('example.com', 'https://example.com', 'a.co,b.co,c.co,d.co,e.co,f.co'));
});
