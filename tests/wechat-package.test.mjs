import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, truncateSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import wechatPackage from '../scripts/wechat-package.cjs';

function withPackage(run) {
  const root = mkdtempSync(resolve(tmpdir(), 'antpix-subpackage-'));
  try {
    mkdirSync(resolve(root, 'subpackages/resources'), { recursive: true });
    writeFileSync(
      resolve(root, 'game.json'),
      JSON.stringify({ subpackages: [{ name: 'resources', root: 'subpackages/resources/' }] }),
    );
    writeFileSync(resolve(root, 'game.js'), '');
    writeFileSync(resolve(root, 'subpackages/resources/data.bin'), '');
    run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('ordinary subpackages can exceed 4 MiB without consuming the main budget', () => {
  withPackage((root) => {
    truncateSync(resolve(root, 'game.js'), 2 * 1024 ** 2);
    truncateSync(resolve(root, 'subpackages/resources/data.bin'), 5 * 1024 ** 2);
    const result = wechatPackage.checkPackageSize(root);
    assert.ok(result.mainBytes < 3 * 1024 ** 2);
    assert.equal(result.packages[0].bytes, 5 * 1024 ** 2);
    assert.ok(result.totalBytes > 7 * 1024 ** 2);
  });
});

test('main and total budgets are enforced separately', () => {
  withPackage((root) => {
    truncateSync(resolve(root, 'game.js'), 4 * 1024 ** 2);
    assert.throws(() => wechatPackage.checkPackageSize(root), /main package/);
    truncateSync(resolve(root, 'game.js'), 0);
    truncateSync(resolve(root, 'subpackages/resources/data.bin'), 30 * 1024 ** 2);
    assert.throws(() => wechatPackage.checkPackageSize(root), /total package/);
  });
});

test('independent packages retain their own 4 MiB budget', () => {
  withPackage((root) => {
    writeFileSync(
      resolve(root, 'game.json'),
      JSON.stringify({
        subpackages: [{ name: 'resources', root: 'subpackages/resources/', independent: true }],
      }),
    );
    truncateSync(resolve(root, 'subpackages/resources/data.bin'), 5 * 1024 ** 2);
    assert.throws(() => wechatPackage.checkPackageSize(root), /Independent package/);
  });
});

test('a missing declared subpackage is rejected', () => {
  withPackage((root) => {
    rmSync(resolve(root, 'subpackages/resources'), { recursive: true });
    assert.throws(() => wechatPackage.checkPackageSize(root), /ENOENT/);
  });
});
