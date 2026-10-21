'use strict';
const crypto=require('node:crypto');
function hashPassword(value){const secret=String(value??'');if(secret.length<10||secret.length>128)throw Object.assign(new Error('Passwort muss 10 bis 128 Zeichen lang sein.'),{code:'PASSWORD_POLICY'});const salt=crypto.randomBytes(16);return {algorithm:'scrypt',salt:salt.toString('base64url'),hash:crypto.scryptSync(secret,salt,64,{N:16384,r:8,p:1,maxmem:64*1024*1024}).toString('base64url'),updatedAt:new Date().toISOString()};}
function verifyPassword(row,value){const secret=String(value??'');if(!row||row.algorithm!=='scrypt'||secret.length>128)return false;const salt=Buffer.from(String(row.salt||''),'base64url'),expected=Buffer.from(String(row.hash||''),'base64url');if(salt.length!==16||expected.length!==64)return false;const actual=crypto.scryptSync(secret,salt,64,{N:16384,r:8,p:1,maxmem:64*1024*1024});return crypto.timingSafeEqual(expected,actual);}
module.exports={hashPassword,verifyPassword};
