'use strict';

const fs=require('node:fs'),child=require('node:child_process');
const PRIVATE_KEY_MARKERS=[
  '-----BEGIN PRIVATE KEY-----',
  '-----BEGIN ENCRYPTED PRIVATE KEY-----',
  '-----BEGIN RSA PRIVATE KEY-----',
  '-----BEGIN EC PRIVATE KEY-----',
  '-----BEGIN OPENSSH PRIVATE KEY-----',
  '-----BEGIN PGP PRIVATE KEY BLOCK-----'
];
const tracked=child.execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const violations=[];
for(const file of tracked){
  let stat;
  try{stat=fs.statSync(file)}catch{continue}
  if(!stat.isFile()||stat.size>5*1024*1024)continue;
  let bytes;
  try{bytes=fs.readFileSync(file)}catch{continue}
  if(bytes.includes(0))continue;
  const text=bytes.toString('utf8');
  const marker=PRIVATE_KEY_MARKERS.find(value=>text.includes(value));
  if(marker)violations.push({file,marker});
}
if(violations.length){
  process.stderr.write('secret-audit: private key material found in tracked files\n');
  for(const item of violations)process.stderr.write('- '+item.file+' ('+item.marker+')\n');
  process.exitCode=1;
}else process.stdout.write('secret-audit: no tracked private-key material found\n');
