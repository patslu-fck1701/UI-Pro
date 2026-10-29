import {useEffect,useState} from 'react';
export function Models(){
  const [models,setModels]=useState<{id:string;name:string;bytes:number}[]>([]),[busy,setBusy]=useState(false),[status,setStatus]=useState('');
  useEffect(()=>{fetch('/api/admin/models').then(r=>r.json()).then(setModels).catch(()=>setStatus('Modellliste nicht erreichbar.'));},[]);
  async function load(id:string){setBusy(true);setStatus('Lokales Modell wird geladen …');try{const r=await fetch('/api/admin/models/load',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})});const value=await r.json();if(!r.ok)throw Error(value.detail);setStatus(value.loaded+' ist bereit.');}catch(e){setStatus(e instanceof Error?e.message:'Laden fehlgeschlagen.');}finally{setBusy(false);}}
  return <section className="panel"><h2>Lokale Modellverwaltung</h2><p className="muted">Vorhandene GGUF-Dateien aus dem lokalen Hugging-Face-Cache und LM Studio. Ein Modell wird gleichzeitig auf der CPU geladen. Der Modellwechsel beendet nur die von WERKZ gestartete Engine.</p>{models.map(model=><div className="module-row" key={model.id}><span><b>{model.name}</b><small>{(model.bytes/1024**3).toFixed(2)} GB</small></span><button className="ghost" disabled={busy} onClick={()=>void load(model.id)}>Modell laden</button></div>)}<p role="status">{status}</p></section>;
}
