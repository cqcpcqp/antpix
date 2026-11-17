// Read real System.register exports: a component name in deprecated code is not an export.
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const ts = require('typescript');

function engineExports(code) {
  const source = ts.createSourceFile('cc.js', code, ts.ScriptTarget.Latest, true);
  const registration = source.statements[0].expression;
  let declare = registration.arguments[1];
  while (ts.isParenthesizedExpression(declare)) declare = declare.expression;
  const exporter = declare.parameters[0].name.text;
  const names = new Set();
  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === exporter
    ) {
      const first = node.arguments[0];
      if (first && ts.isStringLiteral(first)) names.add(first.text);
      if (first && ts.isObjectLiteralExpression(first))
        for (const property of first.properties)
          if (
            property.name &&
            (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))
          )
            names.add(property.name.text);
    }
    ts.forEachChild(node, visit);
  }
  visit(declare.body);
  return names;
}

function checkEngineModules(root) {
  const names = engineExports(readFileSync(resolve(root, 'cocos-js/cc.js'), 'utf8'));
  for (const component of [
    'Node',
    'UITransform',
    'Graphics',
    'Label',
    'Sprite',
    'Mask',
    'ScrollView',
  ])
    assert.ok(
      names.has(component),
      `Built Cocos engine must export ${component}; check engine module stripping`,
    );
  console.log('Built Cocos engine exports all leaderboard components, including Mask.');
}
module.exports = { engineExports, checkEngineModules };
