import {useEffect,useRef,useState} from 'react';

// Vorlesen nur auf ausdrücklichen Klick, ausschließlich für tatsächliche Antworten.
// kind:'answer' erzwingt am Aufrufer, dass nur echte Antworttexte übergeben werden
// (keine Statusmeldungen, Fehler oder Platzhalter).
//
// Verantwortung: Gini V10 kommt vom Server (WerkZ/KundenZ). Die Browser-Stimme ist nur
// ein technischer Ersatz, wenn der Server nicht eingerichtet oder nicht erreichbar ist,
// und wird immer als "nicht Gini V10" gekennzeichnet.
type Phase='ready'|'generating'|'playing'|'stopped'|'failed'|'not-configured';
const LABEL:Record<Phase,string>={
  ready:'Vorlesen',
  generating:'Audio wird erzeugt …',
  playing:'Wiedergabe läuft',
  stopped:'Gestoppt',
  failed:'Fehlgeschlagen',
  'not-configured':'Stimme noch nicht eingerichtet',
};

class SpeakFailure extends Error{
  constructor(readonly phase:Phase,message:string){super(message);}
}

// ── Web Speech API (lokal, kein Server nötig) ────────────────────────────────

function webSpeechAvailable():boolean{
  return typeof window!=='undefined'&&'speechSynthesis' in window;
}

// Chrome kann eine Utterance ohne Referenz vorzeitig freigeben; deshalb hier halten.
let liveUtterance:SpeechSynthesisUtterance|null=null;

function speakWithWebSpeech(text:string,onEnd:()=>void,onError:(e:string)=>void):()=>void{
  const synth=window.speechSynthesis;
  synth.cancel(); // evtl. laufende Ausgabe anderer Instanzen stoppen

  const utter=new SpeechSynthesisUtterance(stripMarkdown(text));

  // Bevorzuge deutschsprachige weibliche Stimme, sonst eine deutsche, sonst Standard
  const voices=synth.getVoices();
  const giniVoice=
    voices.find(v=>v.lang.startsWith('de')&&v.name.toLowerCase().includes('female'))
    ||voices.find(v=>v.lang.startsWith('de')&&!v.name.toLowerCase().includes('male'))
    ||voices.find(v=>v.lang.startsWith('de'))
    ||voices.find(v=>v.default)
    ||null;
  if(giniVoice)utter.voice=giniVoice;

  utter.lang='de-DE';
  utter.rate=0.95;
  utter.pitch=1.05;
  utter.volume=0.95;

  utter.onend=()=>{if(liveUtterance===utter)liveUtterance=null;onEnd();};
  utter.onerror=(ev)=>{
    if(liveUtterance===utter)liveUtterance=null;
    // "canceled"/"interrupted" entsteht durch Stopp oder durch eine neue Ausgabe, kein Fehler
    if(ev.error==='canceled'||ev.error==='interrupted'){onEnd();return;}
    onError(ev.error||'Sprachausgabe fehlgeschlagen.');
  };
  liveUtterance=utter;
  synth.speak(utter);

  return ()=>{if(liveUtterance===utter)liveUtterance=null;synth.cancel();};
}

/** Markdown-Zeichen für Web Speech entfernen (keine HTML-Tags, keine Sternchen usw.) */
function stripMarkdown(text:string):string{
  return text
    .replace(/```[\s\S]*?```/g,' ')  // Code-Blöcke
    .replace(/`([^`]*)`/g,'$1')      // Inline-Code
    .replace(/#{1,6}\s+/g,'')        // Überschriften
    .replace(/\*\*(.+?)\*\*/g,'$1')  // Fett
    .replace(/\*(.+?)\*/g,'$1')      // Kursiv
    .replace(/~~(.+?)~~/g,'$1')      // Durchgestrichen
    .replace(/\[([^\]]+)\]\([^)]*\)/g,'$1') // Links
    .replace(/!\[([^\]]*)\]\([^)]*\)/g,'$1') // Bilder
    .replace(/^\s*[-*+]\s+/gm,' ')  // Listen
    .replace(/^\s*\d+\.\s+/gm,' ')  // Nummerierte Listen
    .replace(/\|/g,' ')
    .replace(/\s{2,}/g,' ')
    .trim();
}

// ── Haupt-Komponente ─────────────────────────────────────────────────────────

export function GiniSpeakButton({text,kind}:{text:string;kind:'answer'}){
  const [phase,setPhase]=useState<Phase>('ready');
  const [detail,setDetail]=useState('');
  // null = unbekannt, true/false = Serverstatus (Gini V10 eingerichtet?)
  const [serverReady,setServerReady]=useState<boolean|null>(null);
  const busy=useRef(false);
  const controller=useRef<AbortController|null>(null);
  const player=useRef<HTMLAudioElement|null>(null);
  const objectUrl=useRef('');
  const mounted=useRef(true);
  // Lokale Ausgabe: Sitzungs-ID. Jeder Stopp/Neustart macht alte Callbacks wirkungslos.
  const localSession=useRef(0);
  const localStop=useRef<(()=>void)|null>(null);
  const cancelVoiceWait=useRef<(()=>void)|null>(null);

  /** Lokale Web-Speech-Ausgabe vollständig beenden, auch wartende Starts */
  function releaseLocal(){
    localSession.current++;
    if(cancelVoiceWait.current){cancelVoiceWait.current();cancelVoiceWait.current=null;}
    if(localStop.current){localStop.current();localStop.current=null;}
  }

  /** Alle Ressourcen freigeben: Anfrage, Audio, Web Speech */
  function release(){
    controller.current?.abort();
    controller.current=null;
    const a=player.current;
    if(a){a.pause();a.removeAttribute('src');a.load();}
    player.current=null;
    if(objectUrl.current){URL.revokeObjectURL(objectUrl.current);objectUrl.current='';}
    releaseLocal();
    busy.current=false;
  }

  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;release();};},[]);
  useEffect(()=>{
    let alive=true;
    fetch('/api/tts/status',{credentials:'same-origin'})
      .then(r=>r.ok?r.json():Promise.reject())
      .then((d:{configured?:boolean})=>{if(alive)setServerReady(d.configured===true);})
      .catch(()=>{if(alive)setServerReady(false);});
    return()=>{alive=false;};
  },[]);
  // Ändert sich die Antwort, läuft eine alte Ausgabe nicht weiter.
  useEffect(()=>{release();setPhase('ready');setDetail('');},[text]);

  function stop(){
    release();
    setPhase('stopped');
  }

  // ── Browser-Ersatzstimme ───────────────────────────────────────────────────
  function speakLocal(note:string){
    if(busy.current||!text.trim())return;
    busy.current=true;
    const session=++localSession.current;
    setDetail(note);
    setPhase('generating');

    const current=()=>mounted.current&&busy.current&&localSession.current===session;
    let started=false;
    const finish=()=>{
      if(!current())return;
      releaseLocal();
      busy.current=false;
      setPhase('ready');
    };
    // Genau ein Start, egal ob onvoiceschanged oder der Timer zuerst feuert.
    const start=()=>{
      if(started||!current())return;
      started=true;
      if(cancelVoiceWait.current){cancelVoiceWait.current();cancelVoiceWait.current=null;}
      setPhase('playing');
      localStop.current=speakWithWebSpeech(
        text,
        finish,
        (err)=>{
          if(!current())return;
          releaseLocal();
          busy.current=false;
          setPhase('failed');
          setDetail(err);
        },
      );
    };

    const synth=window.speechSynthesis;
    if(synth.getVoices().length===0){
      // Stimmen laden asynchron: auf Ereignis oder kurzen Timer warten, nicht beides starten.
      const timer=window.setTimeout(()=>{cancelWait();start();},300);
      const cancelWait=()=>{synth.onvoiceschanged=null;window.clearTimeout(timer);cancelVoiceWait.current=null;};
      synth.onvoiceschanged=()=>{cancelWait();start();};
      cancelVoiceWait.current=cancelWait;
    }else{
      start();
    }
  }

  // ── Server-TTS (Gini V10 als WAV vom Backend) ──────────────────────────────
  // Ergebnis: 'played' | 'stopped' | 'error' (Anzeige gesetzt) | 'unavailable' (Ersatz erlaubt)
  async function speakServer():Promise<'played'|'stopped'|'error'|'unavailable'>{
    if(busy.current||!text.trim())return 'error';
    busy.current=true;
    setDetail('');
    setPhase('generating');
    const abort=new AbortController();
    controller.current=abort;
    try{
      const response=await fetch('/api/tts/synthesize',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({text}),
        credentials:'same-origin',
        signal:abort.signal,
      });
      if(!response.ok){
        const data=await response.json().catch(()=>({} as {detail?:string}));
        const message=typeof data.detail==='string'?data.detail:'Sprachausgabe fehlgeschlagen.';
        throw new SpeakFailure(
          response.status===503&&message.includes('eingerichtet')?'not-configured':'failed',
          message,
        );
      }
      const blob=await response.blob();
      if(!mounted.current||abort.signal.aborted)return 'stopped';
      objectUrl.current=URL.createObjectURL(blob);
      const a=new Audio(objectUrl.current);
      player.current=a;
      a.onended=()=>{if(player.current===a){release();setPhase('ready');}};
      a.onerror=()=>{if(player.current===a){release();setPhase('failed');setDetail('Wiedergabe nicht möglich.');}};
      setPhase('playing');
      await a.play();
      return 'played';
    }catch(error){
      if(!mounted.current||abort.signal.aborted)return 'stopped';
      release();
      if(error instanceof SpeakFailure){
        setPhase(error.phase);setDetail(error.message);
        return error.phase==='not-configured'?'unavailable':'error';
      }
      if(error instanceof TypeError)return 'unavailable'; // Netzwerk nicht erreichbar
      setPhase('failed');setDetail('Sprachausgabe fehlgeschlagen.');
      return 'error';
    }
  }

  // ── Routing: Gini V10 (Server) zuerst, Browser-Ersatz nur als technischer Fallback
  async function speak(){
    if(serverReady!==false){
      const result=await speakServer();
      if(result!=='unavailable')return;
    }
    if(webSpeechAvailable()){
      speakLocal('Ersatzstimme (Browser), nicht Gini V10');
      return;
    }
    setPhase('not-configured');
    setDetail('Keine Stimme verfügbar');
  }

  const active=phase==='generating'||phase==='playing';
  const statusText=phase==='ready'||phase==='stopped'?'':(LABEL[phase]+(detail?` · ${detail}`:''));

  return(
    <div className="gini-speak" data-kind={kind} data-phase={phase}>
      <button
        type="button"
        className="ghost gini-speak-btn"
        disabled={!text.trim()}
        title={active?'Vorlesen stoppen':'Antwort vorlesen'}
        onClick={()=>active?stop():void speak()}
        aria-label={active?'Vorlesen stoppen':'Antwort vorlesen'}
      >
        {active
          ? <><span className="gini-speak-icon">⏹</span>Stoppen</>
          : <><span className="gini-speak-icon">▶</span>{LABEL.ready}</>
        }
      </button>
      {statusText&&(
        <span className="small muted gini-speak-status" role="status" aria-live="polite">
          {statusText}
        </span>
      )}
    </div>
  );
}
