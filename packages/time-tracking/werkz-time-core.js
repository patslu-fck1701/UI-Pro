(function(g){
'use strict';
const STATE='werkz_time_state_v1',BACKUP='werkz_time_backup_v1',ERRORS='werkz_time_errorlog_v1';
function now(){return Date.now()}
function uid(prefix){return prefix+'-'+now().toString(36)+'-'+Math.random().toString(36).slice(2,8)}
function clone(v){return JSON.parse(JSON.stringify(v))}
function fresh(){return {version:1,profile:'reference-gabriel',settings:{favorites:[{id:'philipp',name:'Philipp',sub:'Steinmetz'},{id:'juergen',name:'Jürgen',sub:'Fenster / Maurer'}]},active:null,shifts:[],jobsites:[],events:[],updatedAt:now()}}
function safeParse(s){try{return JSON.parse(s)}catch(e){return null}}
function logError(stage,error,meta){
  try{
    const list=safeParse(localStorage.getItem(ERRORS))||[];
    list.unshift({id:uid('err'),time:now(),stage:String(stage||'unknown'),message:String(error&&error.message?error.message:error||'Fehler'),meta:meta||null});
    localStorage.setItem(ERRORS,JSON.stringify(list.slice(0,100)));
  }catch(_){}
}
function load(){
  try{
    const x=safeParse(localStorage.getItem(STATE));
    if(x&&x.version===1){if(!Array.isArray(x.shifts))x.shifts=[];if(!Array.isArray(x.jobsites))x.jobsites=[];if(!Array.isArray(x.events))x.events=[];if(!x.settings)x.settings=fresh().settings;return x}
  }catch(e){logError('load',e)}
  return fresh();
}
function save(state){
  try{
    const old=localStorage.getItem(STATE);if(old)localStorage.setItem(BACKUP,old);
    state.updatedAt=now();localStorage.setItem(STATE,JSON.stringify(state));return true
  }catch(e){logError('save',e);return false}
}
function startShift(input){
  const s=load();if(s.active)throw new Error('Es läuft bereits eine Arbeitszeit.');
  const name=String(input&&input.employer||'').trim();if(!name)throw new Error('Arbeitgeber/Auftraggeber fehlt.');
  const shift={id:uid('shift'),start:now(),end:null,employer:name,assignmentId:String(input&&input.assignmentId||''),note:String(input&&input.note||''),status:'running'};
  s.active=clone(shift);s.shifts.push(shift);s.events.push({id:uid('evt'),kind:'start',time:shift.start,shiftId:shift.id,employer:name});save(s);return shift
}
function finishShift(){
  const s=load();if(!s.active)throw new Error('Keine laufende Arbeitszeit.');
  const end=now(),id=s.active.id;let shift=s.shifts.find(x=>x.id===id);
  if(!shift){shift=clone(s.active);s.shifts.push(shift)}
  shift.end=end;shift.duration=Math.max(0,end-Number(shift.start));shift.status='finished';
  s.events.push({id:uid('evt'),kind:'finish',time:end,shiftId:id,employer:shift.employer});
  s.active=null;save(s);return shift
}
function addJobsite(input){
  const s=load();if(!s.active)throw new Error('Keine laufende Arbeitszeit.');
  const j={id:uid('job'),shiftId:s.active.id,time:now(),employer:s.active.employer,customer:String(input&&input.customer||'').trim(),place:String(input&&input.place||'').trim(),note:String(input&&input.note||'').trim(),address:String(input&&input.address||'').trim(),gps:input&&input.gps?input.gps:null,photo:input&&input.photo?input.photo:null};
  s.jobsites.push(j);s.events.push({id:uid('evt'),kind:'jobsite',time:j.time,shiftId:j.shiftId,jobsiteId:j.id,employer:j.employer});save(s);return j
}
function active(){return load().active}
function dayKey(ts){const d=new Date(Number(ts)||now()),z=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+z(d.getMonth()+1)+'-'+z(d.getDate())}
function summary(ts){
  const s=load(),day=dayKey(ts||now()),shifts=s.shifts.filter(x=>x.start&&dayKey(x.start)===day),jobs=s.jobsites.filter(x=>x.time&&dayKey(x.time)===day);
  let total=0;shifts.forEach(x=>{if(x.end)total+=Number(x.duration||Math.max(0,x.end-x.start))});
  const start=shifts.length?Math.min.apply(null,shifts.map(x=>Number(x.start))):null,end=shifts.filter(x=>x.end).length?Math.max.apply(null,shifts.filter(x=>x.end).map(x=>Number(x.end))):null;
  return {day,shifts,jobs,start,end,total,employers:Array.from(new Set(shifts.map(x=>x.employer).filter(Boolean)))}
}
function errors(){return safeParse(localStorage.getItem(ERRORS))||[]}
function snapshot(){return {state:load(),backup:safeParse(localStorage.getItem(BACKUP)),errors:errors(),exportedAt:new Date().toISOString()}}
function downloadSnapshot(){
  try{const blob=new Blob([JSON.stringify(snapshot(),null,2)],{type:'application/json'}),a=document.createElement('a'),u=URL.createObjectURL(blob);a.href=u;a.download='WerkZ_Zeit_Backup_'+dayKey(now())+'.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1000)}catch(e){logError('downloadSnapshot',e)}
}
function restoreBackup(){const b=localStorage.getItem(BACKUP);if(!b)return false;try{JSON.parse(b);localStorage.setItem(STATE,b);return true}catch(e){logError('restoreBackup',e);return false}}
function photoFromFile(file,max=900,quality=.72){
  return new Promise((resolve,reject)=>{try{if(!file)return resolve(null);const img=new Image(),r=new FileReader();r.onload=()=>{img.onload=()=>{try{let w=img.width,h=img.height;if(w>max){h=Math.round(h*max/w);w=max}if(h>max){w=Math.round(w*max/h);h=max}const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(img,0,0,w,h);resolve({name:file.name,type:'image/jpeg',data:c.toDataURL('image/jpeg',quality)})}catch(e){reject(e)}};img.onerror=reject;img.src=r.result};r.onerror=reject;r.readAsDataURL(file)}catch(e){reject(e)}})
}
g.WZTime={load,save,startShift,finishShift,addJobsite,active,summary,errors,snapshot,downloadSnapshot,restoreBackup,logError,photoFromFile,dayKey};
window.addEventListener('error',e=>logError('window.error',e.error||e.message,{file:e.filename,line:e.lineno}));
window.addEventListener('unhandledrejection',e=>logError('unhandledrejection',e.reason));
})(window);