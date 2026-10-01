'use strict';
const fs=require('node:fs'),path=require('node:path');
const roots=['src','test','demo','tools'];
let failures=0,files=0;
function walk(dir){if(!fs.existsSync(dir))return;for(const name of fs.readdirSync(dir)){const p=path.join(dir,name),s=fs.statSync(p);if(s.isDirectory())walk(p);else if(p.endsWith('.js')){files++;const t=fs.readFileSync(p,'utf8');if(/\t/.test(t)||/[ \t]+$/m.test(t)){console.error('format violation: '+p);failures++;}}}}
roots.forEach(walk);if(failures)process.exit(1);console.log('lint: '+files+' JavaScript files checked');
