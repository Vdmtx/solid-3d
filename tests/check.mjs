import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';
import assert from 'node:assert/strict';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const moduleSource = html.split('<script type="module">')[1]?.split('</script>')[0];
assert.ok(moduleSource, 'Modulo do editor 3D ausente');
const imports = /import\s*(?:\{[^}]*\}|\*\s+as\s+\w+)\s*from\s*['"][^'"]*['"]\s*;/g;
const stripped = moduleSource.replace(imports, '');
assert.doesNotMatch(stripped, /\bimport\s*\{|\bimport\s*\*/, 'Import nao removido na verificacao');
new Script(stripped, { filename: 'solid3d-inline.js' });
console.log('PASS: sintaxe JS (sem imports externos)');

const ids = [...html.matchAll(/\bid=["']([^"']+)["']/g)].map(m => m[1]);
assert.equal(new Set(ids).size, ids.length, 'IDs duplicados');
const idSet = new Set(ids);
for (const match of moduleSource.matchAll(/\$\(['"]([^'"]+)['"]\)/g)) {
  assert.ok(idSet.has(match[1]), 'Elemento de interface inexistente: ' + match[1]);
}
console.log('PASS: IDs de interface e referencias');

for (const id of ['scene','toolRail','leftPanel','colorPalette','uiTheme','viewportTheme','uiLanguage','filamentPalette','objectList','stl','save','load','booleanUnion','booleanSubtract','booleanIntersect','extrudeSelectedFace','applyVertex']) {
  assert.ok(idSet.has(id), 'Falta componente: ' + id);
}
console.log('PASS: controles essenciais');

assert.match(moduleSource, /version:3,objects:snapshot\(\)/, 'O projeto deve salvar snapshot com todos os dados');
const loadSource = moduleSource.slice(moduleSource.indexOf("$('file').onchange"), moduleSource.indexOf("$('stl').onclick"));
assert.match(loadSource, /'csg'/, 'Malhas booleanas excluidas da abertura');
assert.match(loadSource, /restore\(data\)/, 'Carregamento nao usa restauracao completa');
assert.match(moduleSource, /Object\.assign\(o\.userData,structuredClone\(d\)\)/, 'Duplicacao ou restauracao incompleta');
console.log('PASS: rotas de persistencia e CSG');

assert.match(moduleSource, /dim=\[amount,amount,w,w,w,w\]/, 'Extrusao cima e baixo com volume degenerado');
assert.match(moduleSource, /curveGeom\(nodes,w,h,d,curveStyle==='smooth'/, 'Opcao curva suavizada ignorada');
assert.match(moduleSource, /vertexColors:true,depthTest:true/, 'Grade desenhada atraves dos solidos');
assert.doesNotMatch(moduleSource, /if\(cutSeams\.children\.length\)refreshCutSeams\(\)/, 'Linhas de corte reconstruidas a cada quadro');
assert.match(moduleSource, /selectionBox\.visible=faceIndex<0/, 'Contorno total encobre selecao da face');
console.log('PASS: invariantes das correcoes da auditoria');

console.log('AVISO: estes sao testes estaticos; NAO verificam booleanas, extrusao ou STL em um navegador.');
