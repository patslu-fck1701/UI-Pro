import React,{useEffect,useState} from 'react';
export type ProviderState={oidc_required:boolean;providers:{id:string;label:string}[]};
async function request(path:string,body?:unknown){
 const r=await fetch('/api/auth'+path,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const data=await r.json();if(!r.ok)throw Error(data.detail||'Vorgang fehlgeschlagen.');return data;
}
export function OnlineLogin({providers}:{providers:ProviderState['providers']}){
 const [error,setError]=useState(''),[busy,setBusy]=useState(false);
 return <main className="auth"><h1>WerkZ Digital</h1><p>Mit deinem WerkZ-Konto anmelden. Testzugänge sind befristet.</p>
 {providers.length?<form onSubmit={e=>{e.preventDefault();setBusy(true);setError('');const invitation=String(new FormData(e.currentTarget).get('invitation')||'');void request('/login',{invitation}).then(v=>window.location.assign(v.url)).catch(e=>{setError(e.message);setBusy(false);});}}>
 <label>Einladungscode (nur bei erster Anmeldung)<input type="password" name="invitation" maxLength={128} autoComplete="off"/></label><button disabled={busy}>{providers[0].label}</button></form>:<p role="status">Online-Anmeldung noch nicht eingerichtet. Bitte den Owner kontaktieren.</p>}
 {error&&<p role="alert">{error}</p>}</main>;
}
type Customer={id:string;recipient:string;expires:number;modules:string[];revoked:boolean;accepted:boolean;role:string};
function AccessEditor({row,onChange,onError}:{row:Customer;onChange:()=>void;onError:(text:string)=>void}){
 return <form onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);void request('/owner/customers/'+row.id+'/access',{expected_expires:row.expires,duration_hours:Number(f.get('hours')),role:f.get('role'),modules:f.get('hotel')==='on'?['hotel']:[]}).then(onChange).catch(e=>onError(e.message));}}>
 <label>Rolle<select name="role" defaultValue={row.role}><option>TEST_CUSTOMER</option><option>CUSTOMER_USER</option><option>CUSTOMER_ADMIN</option></select></label>
 <label><input type="checkbox" name="hotel" defaultChecked={row.modules.includes('hotel')}/>Hotel freigegeben</label>
 <label>Neue Gültigkeit ab jetzt (Stunden)<input type="number" name="hours" min={1} max={168} defaultValue={24} required/></label>
 <button>Rechte aktualisieren und Sitzungen beenden</button></form>;
}
export function OwnerCustomers(){
 const [rows,setRows]=useState<Customer[]>([]),[error,setError]=useState(''),[token,setToken]=useState('');
 const refresh=()=>request('/owner/customers').then(setRows).catch(e=>setError(e.message));
 useEffect(()=>{void refresh();},[]);
 function create(e:React.FormEvent<HTMLFormElement>){e.preventDefault();setToken('');setError('');const f=new FormData(e.currentTarget);void request('/owner/customers',{recipient:f.get('recipient'),recipient_confirmed:f.get('confirmed')==='on',duration_hours:Number(f.get('duration')),modules:['hotel']}).then(v=>{setToken(v.token);void refresh();}).catch(e=>setError(e.message));}
 return <details className="panel"><summary>Owner · Testkunden verwalten</summary><p>Jeder Zugang erhält einen eigenen synthetischen Hotelbereich. Keine E-Mail wird versendet.</p>
 <form onSubmit={create}><label>Bestätigter Empfänger<input name="recipient" type="email" required maxLength={254}/></label><label>Gültigkeit ab Erstellung (Stunden)<input name="duration" type="number" min={1} max={168} defaultValue={24} required/></label>
 <label><input name="confirmed" type="checkbox" required/>Ich bestätige diesen Empfänger und die Erstellung seines befristeten Hotel-Testzugangs.</label><button>Einmaligen Einladungscode erstellen</button></form>
 {token&&<section><p>Innerhalb einer Stunde annehmen. Code nur sicher an den bestätigten Empfänger weitergeben.</p><output>{token}</output><button onClick={()=>setToken('')}>Code ausblenden</button></section>}
 {error&&<p role="alert">{error}</p>}{rows.map(r=><article key={r.id}><p>{r.recipient} · {r.role} · {r.modules.join(', ')} · bis {new Date(r.expires*1000).toLocaleString()} · {r.revoked?'widerrufen':r.accepted?'angenommen':'offen'}</p>{!r.revoked&&<><AccessEditor key={r.expires} row={r} onChange={()=>void refresh()} onError={setError}/><button onClick={()=>{if(window.confirm('Testzugang und aktive Sitzungen widerrufen?'))void request('/owner/customers/'+r.id+'/revoke',{}).then(refresh).catch(e=>setError(e.message));}}>Widerrufen</button></>}</article>)}</details>;
}
