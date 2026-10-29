import {useState} from 'react';
type State='active'|'trial'|'suspended'|'expired';
type Props={revision:string;available:Record<string,{name:string;status:string}>;identity:{id:string;tenant:string};onChange:()=>Promise<void>};
export function EntitlementControls({revision,available,identity,onChange}:Props){
  const [module,setModule]=useState('hotel_ai'),[status,setStatus]=useState<State>('active'),[expires,setExpires]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
  async function save(event:React.FormEvent){
    event.preventDefault();setBusy(true);setNotice('');
    try{
      const response=await fetch('/api/admin/entitlements/'+encodeURIComponent(module),{method:'PUT',headers:{'Content-Type':'application/json','x-werkz-actor':identity.id,'x-werkz-tenant':identity.tenant},body:JSON.stringify({status,expiresAt:expires?new Date(expires).toISOString():null,expectedRevision:revision})});
      const result=await response.json();
      if(!response.ok)throw Error(typeof result.detail==='string'?result.detail:'Freigabe konnte nicht gespeichert werden.');
      await onChange();setNotice('Freigabe gespeichert. Daten- und KI-Zugriffe prüfen sie bei jeder Anfrage erneut.');
    }catch(error){setNotice(error instanceof Error?error.message:'Freigabe fehlgeschlagen.');}
    finally{setBusy(false);}
  }
  return <form onSubmit={save} className="panel"><h3>Modulfreigaben · Hotel zuerst</h3><p className="muted">Lokale Demo-Verwaltung für diesen Betrieb. Fachrollen und Datensatzrechte gelten zusätzlich.</p>
    <label htmlFor="entitlement-module">Fachmodul</label><select id="entitlement-module" value={module} disabled={busy} onChange={event=>setModule(event.target.value)}>{Object.entries(available).filter(([,value])=>value.status==='available').sort(([a],[b])=>a==='hotel_ai'?-1:b==='hotel_ai'?1:a.localeCompare(b)).map(([id,value])=><option key={id} value={id}>{value.name}</option>)}</select>
    <label htmlFor="entitlement-state">Freigabe</label><select id="entitlement-state" value={status} disabled={busy} onChange={event=>setStatus(event.target.value as State)}><option value="active">Aktiv</option><option value="trial">Testfreigabe</option><option value="suspended">Gesperrt</option><option value="expired">Beendet</option></select>
    <label htmlFor="entitlement-expiry">Gültig bis (lokale Zeit, optional)</label><input id="entitlement-expiry" type="datetime-local" value={expires} disabled={busy} onChange={event=>setExpires(event.target.value)}/>
    <button disabled={busy}>{busy?'Speichert …':'Freigabe speichern'}</button>{notice&&<p role="status">{notice}</p>}
  </form>;
}
