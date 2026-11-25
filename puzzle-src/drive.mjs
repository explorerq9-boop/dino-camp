import puppeteer from 'puppeteer-core';
import http from 'http'; import fs from 'fs'; import path from 'path';
const root='/tmp/render';
const types={'.html':'text/html','.js':'text/javascript','.glb':'model/gltf-binary'};
const srv=http.createServer((q,r)=>{const f=path.join(root,decodeURIComponent(q.url.split('?')[0]));fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);r.end();return;}r.writeHead(200,{'Content-Type':types[path.extname(f)]||'application/octet-stream'});r.end(d);});}).listen(8765);
const [,,cfgFile,outDir,only]=process.argv;
const scenes=(await import(path.resolve(cfgFile)+'?'+Date.now())).default;
const browser=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const page=await browser.newPage();
page.on('console',m=>console.log('PAGE',m.text())); page.on('pageerror',e=>console.log('ERR',e.message));
const w=+(process.env.W||1600);
await page.setViewport({width:800,height:500});
for(const [name,cfg] of Object.entries(scenes)){
  if(only&&!only.split(',').includes(name)) continue;
  await page.goto(`http://localhost:8765/index.html?w=${w}`);
  await page.waitForFunction('window.ready',{timeout:60000});
  const t=Date.now();
  const url=await page.evaluate(c=>window.renderScene(c),cfg);
  fs.writeFileSync(`${outDir}/${name}.png`,Buffer.from(url.split(',')[1],'base64'));
  console.log(name,(Date.now()-t)+'ms');
}
await browser.close();srv.close();
