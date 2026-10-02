'use strict';

const {backupTimeData,verifyTimeBackup,restoreTimeData}=require('../src');
const [command,sourceRoot,targetRoot]=process.argv.slice(2);
try{
  if(command==='backup'&&sourceRoot&&targetRoot){
    const result=backupTimeData({sourceRoot,targetRoot});process.stdout.write(JSON.stringify({backedUp:true,createdAt:result.createdAt,count:result.count})+'\n');
  }else if(command==='verify'&&sourceRoot&&!targetRoot){
    const result=verifyTimeBackup(sourceRoot);process.stdout.write(JSON.stringify({verified:true,count:result.count})+'\n');
  }else if(command==='restore'&&sourceRoot&&targetRoot){
    const result=restoreTimeData({backupRoot:sourceRoot,targetRoot});
    process.stdout.write(JSON.stringify({restored:true,priorRoot:result.priorRoot})+'\n');
  }else{
    process.stderr.write('Usage: node tools/time-backup.js backup <data-root> <new-backup-dir> | verify <backup-dir> | restore <backup-dir> <existing-data-root>\n');
    process.exitCode=2;
  }
}catch(error){process.stderr.write('Time recovery failed: '+error.message+'\n');process.exitCode=1}
