import {useEffect,useState} from 'react';
type Domain={id:string;state:string;reason?:string;revision?:string;records?:number;local_model_ready?:boolean;checks?:{configured:boolean;reachable:boolean;authenticated:boolean;usable:boolean}};
type Source={id:string;title:string;summary:string;source_uri:string;source_revision:string};
export function OperatorTools({identity}:{identity:{id:string;tenant:string}}){
 const [domains,setDomains]=useState<Domain[]>([]),[checked,setChecked]=useState(''),[error,setError]=useState(''),[query,setQuery]=useState(''),[results,setResults]=useState<Source[]|null>(null),[busy,setBusy]=useState(false);
 async function request(path:string,body?:unknown){
  const response=await fetch('/api/operator'+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json','x-werkz-actor':identity.id,'x-werkz-tenant':identity.tenant},...(body?{body:JSON.stringify(body)}:{})});
  const value=await response.json();if(!response.ok)throw Error(typeof value.detail==='string'?value.detail:'Status konnte nicht geprüft werden.');return value;
 }
 async function refresh(){setError('');try{const value=await request('/domains');setDomains(value.domains);setChecked(value.checked_at);}catch(e){setError(e instanceof Error?e.message:'Prüfung fehlgeschlagen.');}}
 const [clock,setClock]=useState(Date.now());useEffect(()=>{const timer=setInterval(()=>setClock(Date.now()),1000);return()=>clearInterval(timer);},[]);
 useEffect(()=>{void refresh();},[identity.id,identity.tenant]);
 const names:Record<string,string>={werkz:'WerkZ · Hotel und KI',kundenz:'KundenZ · Rechte im WerkZ-Backend',aiz:'AiZ · freigegebenes Wissen','master-control':'Master Control · Betriebsstatus',deutschz:'DeutschZ · eigenständiges Projekt'};
 const states:Record<string,string>={AVAILABLE:'Erreichbar',PARTIAL:'Teilweise angebunden',NOT_CONNECTED:'Nicht verbunden'};
 return <section className="panel"><h3>Verbindungen & freigegebenes Wissen</h3><p className="muted">Geprüfte lokale Schnittstellen. Eine Plugin-Installation allein ist keine Backend-Verbindung.</p>
 <button className="ghost" onClick={()=>void refresh()}>Anbindungen prüfen</button>{checked&&<p className="small muted">Geprüft: {new Date(checked).toLocaleString('de-DE')}</p>}
 {checked&&clock-Date.parse(checked)>60000&&<p role="status">Prüfstand veraltet. Bitte Anbindungen erneut prüfen.</p>}{domains.map(domain=><p key={domain.id}><b>{names[domain.id]||domain.id}</b> · {states[domain.state]||domain.state}{domain.id==='werkz'&&<> · KI {domain.local_model_ready?'bereit':'offline'}</>}{domain.records!==undefined&&<> · {domain.records} indexierte Lernregeln</>}{domain.checks&&<small style={{display:"block"}}>Konfiguriert: {domain.checks.configured?"ja":"nicht belegt"} | Erreichbar: {domain.checks.reachable?"ja":"nicht belegt"} | Authentifiziert: {domain.checks.authenticated?"ja":"nicht belegt"} | Fachlich nutzbar: {domain.checks.usable?"ja":"nicht belegt"}</small>}{domain.reason&&<> · {domain.reason}</>}</p>)}
 <form onSubmit={async event=>{event.preventDefault();setBusy(true);setError('');setResults(null);try{const value=await request('/knowledge/search',{query,limit:5});setResults(value.results);}catch(e){setError(e instanceof Error?e.message:'AiZ-Suche nicht verfügbar.');}finally{setBusy(false);}}}>
 <label>Im freigegebenen WerkZ-Wissen suchen<input value={query} maxLength={240} required onChange={event=>setQuery(event.target.value)}/></label><button disabled={busy}>{busy?'Suche läuft …':'AiZ durchsuchen'}</button>
 </form><p className="small muted">Nur geprüfte portable Lernregeln. Kein Import von Gäste-, Kunden- oder DeutschZ-Daten und Übernahme in den KI-Kontext nur über die ausdrückliche AiZ-Option im Chat.</p>
 {error&&<p role="alert" className="error">{error}</p>}{results?.length===0&&<p role="status">Keine freigegebenen Treffer für diesen Suchbegriff.</p>}
 {results?.map(source=><article key={source.id}><h4>{source.title}</h4><p>{source.summary}</p><p className="small muted">Quellrevision: {source.source_revision}</p>{/^https?:\/\//.test(source.source_uri)&&<a href={source.source_uri} target="_blank" rel="noopener noreferrer">Beleg öffnen</a>}</article>)}
 </section>;
}
