import {useEffect,useState} from 'react';
import './gini-cloud.css';
import {CloudVoice} from './CloudVoice';
type Doc={document_id:string;name:string;version:number;content?:string;sha256:string};
type Draft={draft_id:string;proposed_sha256:string;proposed_content:string};
type Caps={features:{voice:boolean};providers:{openai:{state:string;reason?:string}}};
async function api(path:string,body?:unknown){
 const r=await fetch('/api/gini/v1'+path,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const data=await r.json();if(!r.ok)throw Error(data.error?.message||data.detail||'Vorgang nicht möglich.');return data;
}
export function GiniCloudPanel({initialQuestion=''}:{initialQuestion?:string}){
 const [caps,setCaps]=useState<Caps|null>(null),[docs,setDocs]=useState<Doc[]>([]),[doc,setDoc]=useState<Doc|null>(null);
 const [draft,setDraft]=useState<Draft|null>(null),[diff,setDiff]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [question,setQuestion]=useState(initialQuestion),[answer,setAnswer]=useState(''),[instruction,setInstruction]=useState('');
 const [replyId,setReplyId]=useState('');
 const [history,setHistory]=useState<{version:number;sha256:string;created:string}[]>([]),[approved,setApproved]=useState(false);
 const refresh=()=>api('/documents').then(setDocs);
 useEffect(()=>{let active=true;void api('/capabilities').then(v=>{if(active)setCaps(v);}).catch(e=>{if(active)setError(e.message);});void refresh().catch(()=>{});return()=>{active=false;};},[]);
 async function action(fn:()=>Promise<void>){setError('');setBusy(true);try{await fn();}catch(e){setError(e instanceof Error?e.message:'Vorgang fehlgeschlagen.');}finally{setBusy(false);}}
 async function open(id:string){const value=await api('/documents/'+id);setDoc(value);setDraft(null);setDiff('');setApproved(false);setHistory(await api('/documents/'+id+'/versions'));}
 return <details className="panel gini-cloud-panel"><summary>GINI Cloud · Chat und sichere Textdateien</summary>
 <p>Cloud-Anbieter: {caps?.providers.openai.state||'Status wird geprüft'} · {caps?.providers.openai.reason}</p>
 {!caps?.features.voice&&<p role="status">Cloud-Sprachausgabe nicht verfügbar. Anbieter, Budget und Berechtigung sind noch nicht freigegeben.</p>}
 <form onSubmit={e=>{e.preventDefault();setReplyId('');void action(async()=>{const r=await api('/chat',{messages:[{role:'user',content:question}]});setAnswer(r.reply);setReplyId(r.reply_id);});}}>
 <label>Nachricht an GINI<textarea value={question} onChange={e=>setQuestion(e.target.value)} required maxLength={8000}/></label><button disabled={busy}>GINI fragen</button></form>
 {answer&&<article><h3>KI-Vorschlag · OpenAI</h3><pre style={{whiteSpace:'pre-wrap'}}>{answer}</pre><p>Keine automatische Fachaktion. Nicht als Trainingsmaterial verwenden.</p></article>}
 {replyId&&<CloudVoice key={replyId} replyId={replyId} enabled={caps?.features.voice===true}/>}
 <h3>Synthetische Textdatei hochladen</h3><input aria-label="Synthetische Textdatei" type="file" accept=".txt,.md,.csv,.json,.yaml,.yml,.xml,.html,.css,.js,.ts,.py,.ini,.toml,.sql" disabled={busy} onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;void action(async()=>{if(file.size>240000)throw Error('Datei zu groß.');const r=await api('/documents',{name:file.name,content:await file.text(),data_class:'synthetic'});await refresh();await open(r.document_id);});}}/>
 <p>Nur ausgewählte synthetische Textdaten. Bilder, lokale Wissensbestände und Schlüssel bleiben ausgeschlossen.</p>
 <button disabled={busy} onClick={()=>void action(refresh)}>Dateiliste aktualisieren</button>
 <div>{docs.map(d=><button disabled={busy} key={d.document_id} onClick={()=>void action(()=>open(d.document_id))}>{d.name} · v{d.version}</button>)}</div>
 {doc&&<section><h3>{doc.name} · Version {doc.version}</h3><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{doc.content}</pre>
 <form onSubmit={e=>{e.preventDefault();void action(async()=>{const r=await api('/documents/'+doc.document_id+'/edit-proposals',{instruction});setDraft(r.draft);setDiff(r.unified_diff);setApproved(false);});}}><label>Bearbeitungsauftrag<textarea value={instruction} onChange={e=>setInstruction(e.target.value)} required minLength={3} maxLength={2000}/></label><button disabled={busy}>Entwurf erstellen</button></form>
 {draft&&<section><h4>Änderungsvorschlag – noch nicht gespeichert</h4><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{diff}</pre><details><summary>Vollständiger Entwurf</summary><pre style={{whiteSpace:'pre-wrap'}}>{draft.proposed_content}</pre></details>
 <label><input type="checkbox" checked={approved} onChange={e=>setApproved(e.target.checked)}/>Ich bestätige genau diesen Entwurf.</label><button disabled={busy||!approved} onClick={()=>void action(async()=>{await api('/edit-proposals/'+draft.draft_id+'/approve',{explicit_approval:true,proposed_sha256:draft.proposed_sha256,idempotency_key:crypto.randomUUID()});await refresh();await open(doc.document_id);})}>Bestätigten Entwurf speichern</button></section>}
 <h4>Versionshistorie</h4>{history.map(v=><div key={v.version}>Version {v.version} · {v.created} {v.version!==doc.version&&<button disabled={busy} onClick={()=>{if(confirm('Version '+v.version+' als neue Version wiederherstellen?'))void action(async()=>{await api('/documents/'+doc.document_id+'/restore',{version:v.version,expected_version:doc.version,explicit_approval:true,idempotency_key:crypto.randomUUID()});await refresh();await open(doc.document_id);});}}>Wiederherstellen</button>}</div>)}</section>}
 {busy&&<p role="status">Anfrage läuft …</p>}{error&&<p role="alert">{error}</p>}
 </details>;
}
