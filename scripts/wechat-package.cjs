// Measure upload budgets from game.json: ordinary subpackages share the total
// allowance, while only files outside their roots count toward the main package.
const assert = require('node:assert/strict');
const { readFileSync, readdirSync, statSync } = require('node:fs');
const { resolve, relative, isAbsolute } = require('node:path');

function checkPackageSize(root) {
  root = resolve(root);
  const game = JSON.parse(readFileSync(resolve(root, 'game.json'), 'utf8'));
  const packages = game.subpackages.map((entry) => {
    const path = resolve(root, entry.root);
    const within = relative(root, path);
    assert.ok(within && !within.startsWith('..') && !isAbsolute(within), entry.root);
    return { ...entry, path, bytes: 0 };
  });
  assert.ok(packages.some((entry) => entry.name === 'resources'));
  let mainBytes = 0;
  const walk = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) walk(path);
      else {
        const bytes = statSync(path).size;
        const owner = packages.find((pkg) => {
          const within = relative(pkg.path, path);
          return !within.startsWith('..') && !isAbsolute(within);
        });
        if (owner) owner.bytes += bytes;
        else mainBytes += bytes;
      }
    }
  };
  // Read every declared root as well, so a missing subpackage cannot pass.
  for (const pkg of packages) readdirSync(pkg.path);
  walk(root);
  const totalBytes = mainBytes + packages.reduce((sum, pkg) => sum + pkg.bytes, 0);
  assert.ok(mainBytes < 4 * 1024 ** 2, `WeChat main package: ${mainBytes} bytes >= 4 MiB`);
  assert.ok(totalBytes < 30 * 1024 ** 2, `WeChat total package: ${totalBytes} bytes >= 30 MiB`);
  for (const pkg of packages) {
    if (pkg.independent)
      assert.ok(pkg.bytes < 4 * 1024 ** 2, `Independent package ${pkg.name} >= 4 MiB`);
  }
  return { mainBytes, totalBytes, packages };
}

module.exports = { checkPackageSize };
