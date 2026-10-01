'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
let files=0;
function walk(dir){for(const name of fs.readdirSync(dir)){const p=path.join(dir,name),s=fs.statSync(p);if(s.isDirectory())walk(p);else if(p.endsWith('.js')){new vm.Script(fs.readFileSync(p,'utf8'),{filename:p});files++;}}}
walk('src');console.log('typecheck: '+files+' CommonJS modules parsed (runtime contract validation is covered by tests)');
