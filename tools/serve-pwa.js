'use strict';

const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'../apps/time-pwa');
const port=Number(process.env.WERKZ_PWA_PORT||4173);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.webmanifest':'application/manifest+json','.svg':'image/svg+xml'};

http.createServer((request,response)=>{
  const pathname=new URL(request.url,'http://localhost').pathname;
  const relative=pathname==='/'?'index.html':pathname.replace(/^\/+/,''),file=path.resolve(root,relative);
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){
    response.writeHead(404,{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'});response.end('Not found');return;
  }
  response.writeHead(200,{'content-type':types[path.extname(file)]||'application/octet-stream','cache-control':'no-store'});
  fs.createReadStream(file).pipe(response);
}).listen(port,'127.0.0.1',()=>{
  console.log('WerkZ Time PWA: http://127.0.0.1:'+port);
  console.log('Static shell only: connect a WerkZ API for session and business operations.');
});
