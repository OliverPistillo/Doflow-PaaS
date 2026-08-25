import fs from 'node:fs';
import ts from '../apps/frontend/node_modules/typescript/lib/typescript.js';

const providerPath = new URL(
  '../apps/frontend/src/features/commercial/components/commercial-leads-provider.tsx',
  import.meta.url,
);
const sourceText = fs.readFileSync(providerPath, 'utf8');
const source = ts.createSourceFile(
  providerPath.pathname,
  sourceText,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);

let storeObject;
const helperNodes = new Map();
function visit(node) {
  if (ts.isFunctionDeclaration(node) && node.name) {
    helperNodes.set(node.name.text, node);
  }
  if (
    ts.isVariableDeclaration(node)
    && ts.isIdentifier(node.name)
    && node.initializer
    && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
  ) {
    helperNodes.set(node.name.text, node.initializer);
  }
  if (
    ts.isVariableDeclaration(node)
    && node.name.getText(source) === 'value'
    && node.initializer
  ) {
    const findStoreObject = (candidate) => {
      if (storeObject) return;
      if (ts.isObjectLiteralExpression(candidate)) {
        const keys = new Set(candidate.properties.map((property) => property.name?.getText(source)));
        if (keys.has('leads') && keys.has('customers') && keys.has('projects')) {
          storeObject = candidate;
          return;
        }
      }
      ts.forEachChild(candidate, findStoreObject);
    };
    findStoreObject(node.initializer);
  }
  ts.forEachChild(node, visit);
}
visit(source);

if (!storeObject) throw new Error('Commercial store object not found.');

const directNetworkPattern = /apiFetch|commercialApi|contractsApi|automationsApi|listDocuments|createActivityOnServer|updateActivityOnServer|deleteActivityOnServer/;

function calledHelpers(node) {
  const names = new Set();
  function collect(candidate) {
    if (ts.isCallExpression(candidate) && ts.isIdentifier(candidate.expression)) {
      names.add(candidate.expression.text);
    }
    if (
      ts.isCallExpression(candidate)
      && ts.isPropertyAccessExpression(candidate.expression)
      && candidate.expression.expression.kind === ts.SyntaxKind.ThisKeyword
    ) {
      names.add(candidate.expression.name.text);
    }
    ts.forEachChild(candidate, collect);
  }
  collect(node);
  return [...names];
}

function reachesNetwork(node, seen = new Set()) {
  if (directNetworkPattern.test(node.getText(source))) return true;
  return calledHelpers(node).some((name) => {
    if (seen.has(name)) return false;
    const helper = helperNodes.get(name);
    if (!helper) return false;
    const nextSeen = new Set(seen);
    nextSeen.add(name);
    return reachesNetwork(helper, nextSeen);
  });
}

const actions = [];
for (const property of storeObject.properties) {
  const name = property.name?.getText(source)?.replace(/["']/g, '');
  if (name) helperNodes.set(name, property);
}
for (const property of storeObject.properties) {
  const name = property.name?.getText(source)?.replace(/["']/g, '');
  if (!name) continue;
  const text = property.getText(source);
  const callable = ts.isMethodDeclaration(property)
    || (ts.isPropertyAssignment(property) && /=>|function/.test(text));
  if (!callable) continue;
  actions.push({
    name,
    line: source.getLineAndCharacterOfPosition(property.getStart(source)).line + 1,
    network: reachesNetwork(property),
    mutatesState: /\bset[A-Z]|\.push\(|\.splice\(/.test(text),
    asynchronous: /^\s*async\b|async\s*\(/.test(text),
    lines: text.split(/\r?\n/).length,
  });
}

const clientOnlyMutations = actions.filter((action) => action.mutatesState && !action.network);
for (const action of clientOnlyMutations) {
  process.stdout.write(
    `${action.line} :: ${action.name} :: async=${action.asynchronous} :: ${action.lines} lines\n`,
  );
}
process.stdout.write(
  `ACTIONS=${actions.length} CLIENT_ONLY_MUTATIONS=${clientOnlyMutations.length}\n`,
);
