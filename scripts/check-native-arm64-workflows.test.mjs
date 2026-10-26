import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const workflows = ['deploy-development', 'dev-container-gate'];

for (const workflow of workflows) {
  test(`${workflow} builds DEV images on native ARM64 without QEMU`, () => {
    const source = readFileSync(new URL(`../.github/workflows/${workflow}.yml`, import.meta.url), 'utf8');
    assert.match(source, /^    runs-on: ubuntu-24\.04-arm$/m);
    assert.match(source, /test "\$\(uname -m\)" = aarch64/);
    assert.doesNotMatch(source, /uses: docker\/setup-qemu-action/);
    const platforms = [...source.matchAll(/^          platforms: (.+)$/gm)].map(match => match[1]);
    assert.deepEqual(platforms, ['linux/arm64', 'linux/arm64']);
    for (const service of ['api', 'web']) {
      assert.match(source, new RegExp(`cache-from: type=gha,scope=dev-${service}-arm64-native-v1`));
      assert.match(source, new RegExp(`cache-to: type=gha,mode=max,scope=dev-${service}-arm64-native-v1`));
    }
  });
}

test('container gate runs for deployment workflow changes', () => {
  const gate = readFileSync(new URL('../.github/workflows/dev-container-gate.yml', import.meta.url), 'utf8');
  assert.equal((gate.match(/"\.github\/workflows\/deploy-development.yml"/g) ?? []).length, 2);
});
