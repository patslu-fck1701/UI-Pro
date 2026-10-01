'use strict';

const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
class FileRetryJobState {
  constructor(file){this.file=path.resolve(file)}
  load(){
    if(!fs.existsSync(this.file))return {jobs:[]};
    const value=JSON.parse(fs.readFileSync(this.file,'utf8'));
    if(value.schemaVersion!==1||!Array.isArray(value.jobs))throw new Error('Unsupported retry job state');
    return {jobs:value.jobs};
  }
  save(value){
    fs.mkdirSync(path.dirname(this.file),{recursive:true});
    const temp=this.file+'.tmp-'+crypto.randomUUID();
    fs.writeFileSync(temp,JSON.stringify({schemaVersion:1,jobs:value.jobs}),{mode:0o600,flag:'wx'});
    fs.renameSync(temp,this.file);
  }
}
module.exports={FileRetryJobState};
