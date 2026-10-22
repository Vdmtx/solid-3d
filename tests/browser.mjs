import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';
const pageHtml=readFileSync(new URL('../index.html',import.meta.url));
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
console.log('PASS binary STL structure, triangles:',triangles);


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
console.log('PASS Boolean:',label)
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

await page.screenshot({path:'audit-browser.png'});
console.log('Browser audit completed. Caveat: no manifold validation.');
}catch(e){console.error('BROWSER AUDIT FAILED:',e.message);throw e}finally{await browser?.close();await new Promise(resolve=>server.close(resolve))}
