import {useEffect,useRef,useState} from 'react';

export function CloudVoice({replyId,enabled}:{replyId:string;enabled:boolean}){
 const [state,setState]=useState(''),[busy,setBusy]=useState(false);
 const player=useRef<HTMLAudioElement|null>(null),url=useRef(''),abort=useRef<AbortController|null>(null);
 function stop(){abort.current?.abort();player.current?.pause();if(player.current)player.current.src='';player.current=null;if(url.current)URL.revokeObjectURL(url.current);url.current='';}
 useEffect(()=>{stop();setState('');setBusy(false);return stop;},[replyId,enabled]);
 async function play(){
  if(!enabled||busy)return;
  stop();setBusy(true);setState('Audio wird angefordert …');
  const controller=new AbortController();abort.current=controller;
  try{
   const r=await fetch('/api/gini/v1/voice/tts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reply_id:replyId}),signal:controller.signal});
   if(!r.ok){const e=await r.json();throw Error(e.error?.message||e.detail||'Sprachausgabe nicht verfügbar.');}
   if(!r.headers.get('content-type')?.startsWith('audio/mpeg'))throw Error('Ungültige Audioantwort.');
   const blob=await r.blob();if(controller.signal.aborted)return;
   url.current=URL.createObjectURL(blob);const audio=new Audio(url.current);player.current=audio;
   audio.onended=()=>setState('Wiedergabe beendet.');audio.onerror=()=>setState('Audio konnte nicht wiedergegeben werden.');
   await audio.play();setState(r.headers.get('X-GINI-Voice')==='cache'?'Wiedergabe aus kurzem Sitzungscache.':'Wiedergabe gestartet.');
  }catch(e){if(!controller.signal.aborted)setState(e instanceof Error?e.message:'Wiedergabe fehlgeschlagen.');}
  finally{if(!controller.signal.aborted)setBusy(false);}
 }
 return <section aria-label="GINI Cloud Sprachausgabe"><button disabled={!enabled||busy} onClick={()=>void play()}>Vorlesen oder wiederholen</button><button onClick={()=>{stop();setBusy(false);setState('Wiedergabe gestoppt.');}}>Stopp</button><p role="status">{state||(!enabled?'Cloud-Stimme noch nicht freigegeben.':'V10 ist konfiguriert. Wiedergabe startet nur nach Klick; Hörabnahme separat.')}</p></section>;
}
