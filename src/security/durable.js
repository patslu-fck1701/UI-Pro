'use strict';

const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
class FileDeviceEnrollmentState {
  constructor(file){this.file=path.resolve(file);}
  load(){
    if(!fs.existsSync(this.file))return {tokens:[],devices:[],challenges:[]};
    const value=JSON.parse(fs.readFileSync(this.file,'utf8'));
    if(value.schemaVersion!==1||!Array.isArray(value.tokens)||!Array.isArray(value.devices)||!Array.isArray(value.challenges))throw new Error('Unsupported enrollment state');
    return {tokens:value.tokens,devices:value.devices,challenges:value.challenges};
  }
  save(value){
    fs.mkdirSync(path.dirname(this.file),{recursive:true});
    const temp=this.file+'.tmp-'+crypto.randomUUID();
    fs.writeFileSync(temp,JSON.stringify({schemaVersion:1,...value}),{mode:0o600,flag:'wx'});
    fs.renameSync(temp,this.file);
  }
}
module.exports={FileDeviceEnrollmentState};
