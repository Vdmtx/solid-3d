import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';
const pageHtml=readFileSync(new URL('../index.html',import.meta.url));
function inspectStlTopology(buf){
const count=buf.readUInt32LE(80),edges=new Map();let degenerate=0;
const key=p=>p.map(n=>Math.round(n*1000)).join(',');
for(let i=0;i<count;i++){
const off=84+i*50,v=[];
for(let j=0;j<3;j++)v.push([buf.readFloatLE(off+12+j*12),buf.readFloatLE(off+16+j*12),buf.readFloatLE(off+20+j*12)]);
const a=v[0],b=v[1],c=v[2],u=b.map((n,k)=>n-a[k]),w=c.map((n,k)=>n-a[k]);
const cross=[u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]];
if(Math.hypot(...cross)<1e-6)degenerate++;
for(const [x,y] of [[0,1],[1,2],[2,0]]){const p=[key(v[x]),key(v[y])].sort().join(' ~ ');edges.set(p,(edges.get(p)||0)+1)}
}
const unpaired=[...edges.values()].filter(n=>n!==2);
return {triangles:count,unpairedEdges:unpaired.length,degenerateTriangles:degenerate};
}

const server=createServer((req,res)=>{if(new URL(req.url,'http://localhost').pathname!=='/'){res.writeHead(404);res.end();return}res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'});res.end(pageHtml)});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port+'/';
let browser;
try{
browser=await chromium.launch({headless:true,args:['--enable-webgl','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
const page=await browser.newPage({viewport:{width:1500,height:950},acceptDownloads:true});
const pageErrors=[];
page.on('pageerror',err=>pageErrors.push(err.message));
page.on('requestfailed',req=>{if(/esm\.sh|jsdelivr|raw\.githubusercontent/.test(req.url()))console.log('CDN REQUEST FAILED:',req.url(),req.failure()?.errorText)});
await page.goto(base,{waitUntil:'domcontentloaded'});
try{
await page.waitForFunction(()=>typeof document.querySelector('#box')?.onclick==='function'&&document.querySelector('#scene')?.width>600,null,{timeout:45000});
}catch(e){console.log('EDITOR STARTUP FAILED:',await page.locator('#status').innerText());console.log('JS errors:',pageErrors);throw e}
console.log('PASS browser startup; canvas:',await page.locator('#scene').evaluate(el=>el.width+'x'+el.height));
assert.equal(pageErrors.length,0,'Erro JS durante inicializacao: '+pageErrors.join(' | '));
await page.locator('#uiTheme').selectOption('light');assert.equal(await page.locator('body').getAttribute('data-theme'),'light');
await page.locator('#viewportTheme').selectOption('gray');
await page.locator('#uiLanguage').selectOption('en');assert.match(await page.locator('#undo').innerText(),/Undo/);
await page.locator('#uiLanguage').selectOption('pt');
await page.locator('#filamentPalette').selectOption('polymaker');
assert.ok(await page.locator('#colorPalette button').count()>=12);
console.log('PASS theme, viewport, language and filament palettes');
await page.locator('#toggleTools').click();
await page.locator('#box').click();
assert.match(await page.locator('#selected').innerText(),/Peça|Piece/);
assert.match(await page.locator('#stats').innerText(),/1 sólido/);
console.log('PASS create box and object properties');
let download=await Promise.all([page.waitForEvent('download'),page.locator('#save').click()]).then(x=>x[0]);
let data=JSON.parse(readFileSync(await download.path(),'utf8'));
assert.equal(data.objects.length,1);assert.equal(data.objects[0].kind,'rect');
console.log('PASS JSON save of a primitive');
await page.locator('#file').setInputFiles({name:'test.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});
await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Projeto aberto'),null,{timeout:10000});
assert.equal(await page.locator('#objectList option').count(),1);
console.log('PASS JSON reload of a primitive');
await page.locator('[data-activate-tool="face"]').click();
const bounds=await page.locator('#scene').boundingBox();
let face=false;
for(const [fx,fy] of [[.50,.50],[.5,.47],[.49,.52],[.52,.48],[.5,.55]]){
await page.mouse.click(bounds.x+bounds.width*fx,bounds.y+bounds.height*fy);
if((await page.locator('#faceInfo').innerText()).includes('selecionada')){face=true;break}
}
if(!face)throw Error('Nao conseguiu selecionar a face da caixa pelo canvas');
console.log('PASS individual face selection');
await page.locator('#faceExtrudeAmount').fill('12');
await page.locator('#extrudeSelectedFace').click();
const msg=await page.locator('#status').innerText();
if(!msg.includes('Face extrudida'))throw Error('Extrusao adicional falhou: '+msg);
console.log('PASS CSG whole-face extrusion');
download=await Promise.all([page.waitForEvent('download'),page.locator('#save').click()]).then(x=>x[0]);
data=JSON.parse(readFileSync(await download.path(),'utf8'));
assert.equal(data.objects[0].kind,'csg');
assert.ok(data.objects[0].csgPositions?.length>9);
await page.locator('#file').setInputFiles({name:'csg.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});
await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Projeto aberto'),null,{timeout:10000});
assert.equal(await page.locator('#objectList option').count(),1);
console.log('PASS saving and reopening a CSG mesh');
download=await Promise.all([page.waitForEvent('download'),page.locator('#stl').click()]).then(x=>x[0]);
const stl=readFileSync(await download.path());
const triangles=stl.readUInt32LE(80);
assert.ok(triangles>0,'STL sem triangulos');
assert.equal(stl.length,84+triangles*50,'STL binario inconsistente');
console.log('PASS binary STL structure, triangles:',triangles);console.log('STL TOPOLOGY full-face CSG:',inspectStlTopology(stl));


// Validate that derived meshes remain editable after reopening.
await page.locator('#objectList').selectOption('0');
await page.locator('#duplicate').click();
assert.equal(await page.locator('#objectList option').count(),2);
download=await Promise.all([page.waitForEvent('download'),page.locator('#save').click()]).then(x=>x[0]);
let copyProject=JSON.parse(readFileSync(await download.path(),'utf8'));
assert.equal(copyProject.objects[1].kind,'csg');
assert.deepEqual(copyProject.objects[0].csgPositions,copyProject.objects[1].csgPositions);
console.log('PASS duplicate boolean mesh with its geometry');
const beforeWidth=Number(copyProject.objects[1].w);
await page.locator('#width').fill(String(beforeWidth+10));
await page.locator('#width').press('Tab');
download=await Promise.all([page.waitForEvent('download'),page.locator('#save').click()]).then(x=>x[0]);
copyProject=JSON.parse(readFileSync(await download.path(),'utf8'));
assert.ok(Math.abs(copyProject.objects[1].w-(beforeWidth+10))<.01);
assert.notDeepEqual(copyProject.objects[0].csgPositions,copyProject.objects[1].csgPositions);
console.log('PASS scaling a derived boolean mesh updates its geometry');

// Additional modeling regression checks.
async function clearScene(){page.once('dialog',d=>d.accept());await page.locator('#removeAll').click();assert.equal(await page.locator('#objectList option').count(),0)}
await clearScene();
await page.locator('#box').click();
await page.locator('#toggleTools').click(); // close overlay before clicking a viewport button
await page.locator('[data-view="top"]').click();
await page.locator('#toggleTools').click();
await page.locator('[data-activate-tool="split"]').click();
const area=await page.locator('#scene').boundingBox(),mx=area.x+area.width*.5,my=area.y+area.height*.5;
await page.mouse.move(mx-45,my);await page.mouse.down();await page.mouse.move(mx+45,my,{steps:10});await page.mouse.up();
assert.equal(await page.locator('#objectList option').count(),2,'Primeiro corte de face falhou');
console.log('PASS primeira subdivisao da face superior');
let topoDownload=await Promise.all([page.waitForEvent('download'),page.locator('#stl').click()]).then(x=>x[0]);
console.log('STL TOPOLOGY subdivided pieces:',inspectStlTopology(readFileSync(await topoDownload.path())));
let secondCut=false;
for(const oy of [-24,24]){
await page.mouse.move(mx-38,my+oy);await page.mouse.down();await page.mouse.move(mx+38,my+oy,{steps:8});await page.mouse.up();
if(await page.locator('#objectList option').count()===3){secondCut=true;break}
}
assert.ok(secondCut,'Nao foi possivel dividir uma regiao pela segunda vez');
console.log('PASS cortes repetidos em regioes separadas');
await page.locator('#undo').click();assert.equal(await page.locator('#objectList option').count(),2);
await page.locator('#redo').click();assert.equal(await page.locator('#objectList option').count(),3);
console.log('PASS undo/redo de subdivisoes');

await clearScene();
await page.locator('#box').click();
await page.locator('[data-tool="vertex"]').click();
await page.mouse.click(mx,my);
assert.match(await page.locator('#vertexInfo').innerText(),/selecionado/);
await page.locator('#vertexDy').fill('12');
await page.locator('#applyVertex').click();
assert.match(await page.locator('#status').innerText(),/Canto deslocado/);
download=await Promise.all([page.waitForEvent('download'),page.locator('#save').click()]).then(x=>x[0]);
data=JSON.parse(readFileSync(await download.path(),'utf8'));
assert.ok(Object.keys(data.objects[0].vertexOffsets||{}).length>0);
await page.locator('#file').setInputFiles({name:'sloped.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});
await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Projeto aberto'),null,{timeout:10000});
assert.equal(await page.locator('#objectList option').count(),1);
console.log('PASS vertex displacement and JSON restoration');

for(const [button,label] of [['booleanUnion','Soldar'],['booleanSubtract','Aparar'],['booleanIntersect','Interseção']]){
await clearScene();
await page.locator('#box').click();
await page.locator('#cylinder').click();
await page.locator('#height').fill('55');
await page.locator('#height').press('Tab');
await page.locator('#objectList').selectOption('0');
await page.mouse.click(mx,my,{button:'left'});
await page.locator('#objectList').selectOption('0');
await page.keyboard.down('Control');
await page.mouse.click(mx,my);
await page.keyboard.up('Control');
const choice=await page.locator('#status').innerText();
assert.match(choice,/Operação 3D: principal/,label+': nao selecionou a segunda peça via Ctrl+clique: '+choice);
await page.locator('#'+button).click();
const result=await page.locator('#status').innerText();
assert.match(result,/Operação concluída/,label+': '+result);
assert.equal(await page.locator('#objectList option').count(),1);
console.log('PASS Boolean:',label);
topoDownload=await Promise.all([page.waitForEvent('download'),page.locator('#stl').click()]).then(x=>x[0]);
console.log('STL TOPOLOGY '+label+':',inspectStlTopology(readFileSync(await topoDownload.path())))
}


await clearScene();
await page.locator('#box').click();
await page.locator('#wall').fill('2');
await page.locator('#cavityDepth').fill('10');
await page.locator('#makeCavity').click();
assert.match(await page.locator('#status').innerText(),/Cavidade criada/);
download=await Promise.all([page.waitForEvent('download'),page.locator('#save').click()]).then(x=>x[0]);
data=JSON.parse(readFileSync(await download.path(),'utf8'));
assert.equal(data.objects[0].cavity.depth,10);
await page.locator('#removeCavity').click();
await page.locator('#edgeSize').fill('2');
await page.locator('#applyEdge').click();
assert.match(await page.locator('#status').innerText(),/Acabamento geométrico aplicado/);
console.log('PASS cavity, removal and edge rounding');
await page.locator('[data-activate-tool="face"]').click();
await page.mouse.click(mx,my);
assert.match(await page.locator('#faceInfo').innerText(),/selecionada/);
await page.locator('#faceColor').fill('#ff0000');
download=await Promise.all([page.waitForEvent('download'),page.locator('#save').click()]).then(x=>x[0]);
data=JSON.parse(readFileSync(await download.path(),'utf8'));
assert.ok(data.objects[0].colors.includes(0xff0000),'Cor de face nao persistida');
console.log('PASS selecting, painting and saving a face');


const imagePNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGP8z8Dwn4GBgYGJAQoAHxcCAk+Uzr4AAAAASUVORK5CYII=','base64');
await page.locator('#imageFile').setInputFiles({name:'referencia.png',mimeType:'image/png',buffer:imagePNG});
await page.waitForFunction(()=>document.querySelector('#imageInfo').textContent.includes('Imagem ajustada'),null,{timeout:12000});
download=await Promise.all([page.waitForEvent('download'),page.locator('#save').click()]).then(x=>x[0]);
data=JSON.parse(readFileSync(await download.path(),'utf8'));
assert.ok(data.reference.data.startsWith('data:image/png;base64,'),'Imagem referencia ausente no JSON');
console.log('PASS PNG reference image imported and saved');

for(const shape of ['sphere','cone','torus','prism','pyramid']){
await clearScene();await page.locator('#'+shape).click();
assert.equal(await page.locator('#objectList option').count(),1,'Primitive '+shape);
download=await Promise.all([page.waitForEvent('download'),page.locator('#stl').click()]).then(x=>x[0]);
const buf=readFileSync(await download.path());
assert.ok(buf.readUInt32LE(80)>0,'Primitive STL vazio: '+shape);
console.log('PASS primitive and binary STL:',shape);console.log('STL TOPOLOGY '+shape+':',inspectStlTopology(buf))
}
await clearScene();
await page.locator('#textValue').fill('SOLID');
await page.locator('#addText').click();
await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Texto 3D criado'),null,{timeout:30000});
download=await Promise.all([page.waitForEvent('download'),page.locator('#save').click()]).then(x=>x[0]);
data=JSON.parse(readFileSync(await download.path(),'utf8'));
assert.equal(data.objects[0].kind,'text');
assert.equal(data.objects[0].textValue,'SOLID');
console.log('PASS editable 3D text creation');
await clearScene();
await page.locator('#curveStyle').selectOption('smooth');
await page.locator('[data-activate-tool="bezier"]').click();
for(const [dx,dy] of [[-40,-30],[40,-30],[40,30],[-40,30]])await page.mouse.click(mx+dx,my+dy);
await page.locator('#closeCurve').click();
download=await Promise.all([page.waitForEvent('download'),page.locator('#save').click()]).then(x=>x[0]);
data=JSON.parse(readFileSync(await download.path(),'utf8'));
assert.equal(data.objects[0].kind,'bezier');
assert.equal(data.objects[0].curveStyle,'smooth');
console.log('PASS smooth Bezier profile saved');

await page.screenshot({path:'audit-browser.png'});
console.log('Browser audit completed. Caveat: no manifold validation.');
}catch(e){console.error('BROWSER AUDIT FAILED:',e.message);throw e}finally{await browser?.close();await new Promise(resolve=>server.close(resolve))}
