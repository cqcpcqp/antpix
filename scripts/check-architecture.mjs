// Structural constraints complement behavioral tests; no browser or Cocos startup required.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, resolve, relative, basename } from 'node:path';
import ts from 'typescript';

const root = resolve('assets/scripts');
const files = readdirSync(root, { recursive: true })
  .filter((file) => file.endsWith('.ts'))
  .map((file) => resolve(root, file));
const graph = new Map();
const uuids = new Set();
const names = new Set();
const errors = [];
function check(condition, message) {
  if (!condition) errors.push(message);
}
for (const file of files) {
  const name = relative(root, file);
  check(
    !names.has(basename(file)),
    `${name}: duplicate module basename breaks built-module checks`,
  );
  names.add(basename(file));
  const metaPath = file + '.meta';
  check(existsSync(metaPath), `${name}: missing Cocos .meta`);
  if (existsSync(metaPath)) {
    const meta = JSON.parse(readFileSync(metaPath, 'utf8'));
    check(!uuids.has(meta.uuid), `${name}: duplicate Cocos UUID`);
    uuids.add(meta.uuid);
    check(meta.importer === 'typescript', `${name}: incorrect Cocos importer`);
  }
  if (name === 'PixelGarden.ts') {
    check(
      JSON.parse(readFileSync(metaPath, 'utf8')).uuid === '43c9cd44-4a6f-40f1-87d9-a7135b2f6e80',
      'PixelGarden scene component UUID must remain stable',
    );
  }
  const source = ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  const dependencies = [];
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) continue;
    const specifier = statement.moduleSpecifier;
    if (!specifier || !ts.isStringLiteral(specifier)) continue;
    const value = specifier.text;
    const typeOnly = ts.isImportDeclaration(statement)
      ? statement.importClause?.isTypeOnly ||
        (!statement.importClause?.name &&
          statement.importClause?.namedBindings &&
          ts.isNamedImports(statement.importClause.namedBindings) &&
          statement.importClause.namedBindings.elements.every((item) => item.isTypeOnly))
      : statement.isTypeOnly;
    if (!value.startsWith('.')) {
      check(
        !name.startsWith('domain/'),
        `${name}: domain must not import external module ${value}`,
      );
      continue;
    }
    const target = resolve(dirname(file), value + '.ts');
    check(existsSync(target), `${name}: unresolved import ${value}`);
    const targetName = relative(root, target);
    if (name.startsWith('domain/'))
      check(targetName.startsWith('domain/'), `${name}: domain depends on ${targetName}`);
    if (name.startsWith('platform/'))
      check(
        /^(domain|platform)\//.test(targetName),
        `${name}: platform adapter depends on ${targetName}`,
      );
    if (name.startsWith('presentation/'))
      check(
        /^(domain|presentation)\//.test(targetName),
        `${name}: drawing primitive depends on ${targetName}`,
      );
    if (name.startsWith('features/') && targetName.startsWith('app/'))
      check(typeOnly, `${name}: features may reference app contracts only through type imports`);
    if (!typeOnly) dependencies.push(target);
  }
  graph.set(file, dependencies);
}
// Reject runtime cycles; type-only dependency contracts are erased by Cocos.
const visited = new Set();
const active = new Set();
function visit(file, chain) {
  if (active.has(file)) {
    errors.push(
      'Runtime import cycle: ' + [...chain, file].map((p) => relative(root, p)).join(' -> '),
    );
    return;
  }
  if (visited.has(file)) return;
  active.add(file);
  for (const dependency of graph.get(file) || []) visit(dependency, [...chain, file]);
  active.delete(file);
  visited.add(file);
}
for (const file of files) visit(file, []);
assert.deepEqual(errors, [], errors.join('\n'));
console.log(
  `Architecture passed: ${files.length} modules, layer boundaries, acyclic runtime imports, stable Cocos metadata.`,
);
