'use strict';

const child=require('node:child_process');

const required=['tools/time-test-server.js','src/handwerk/http.js','src/handwerk/service.js','src/handwerk/sevdesk.js','apps/trades-pilot/roles.js'];
const tracked=child.execFileSync('git',['ls-files','*.js'],{encoding:'utf8'}).split(/\r?\n/).filter(Boolean);
for(const file of required)if(!tracked.includes(file))throw new Error('Deployment runtime file missing: '+file);
for(const file of tracked)child.execFileSync(process.execPath,['--check',file],{stdio:'inherit'});
process.stdout.write('deployment-preflight: '+tracked.length+' tracked JavaScript runtime files checked\n');
