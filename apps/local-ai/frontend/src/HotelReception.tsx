import {useEffect,useState} from 'react';
type Row={id:string;revision:number;[key:string]:unknown};
type AvailableRoom={id:string;number:string;room_type:string;cleaning:string;ready_for_checkin:boolean};
async function request(path:string,body?:unknown,method='POST'){
  const r=await fetch('/api/hotel'+path,body?{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{});const value=await r.json();if(!r.ok)throw Error(typeof value.detail==='string'?value.detail:'Vorgang fehlgeschlagen.');return value;
}
export function HotelReception({guests,today,onChanged,onError,intent}:{guests:Row[];today:string;onChanged:()=>Promise<void>;onError:(message:string)=>void;intent:{id:string;version:number}}){
  const [search,setSearch]=useState(''),[mode,setMode]=useState('existing'),[guestId,setGuestId]=useState(''),[name,setName]=useState(''),[contact,setContact]=useState('');
  const [arrival,setArrival]=useState(today),[departure,setDeparture]=useState(''),[persons,setPersons]=useState(1),[roomId,setRoomId]=useState(''),[rooms,setRooms]=useState<AvailableRoom[]>([]),[checking,setChecking]=useState(false),[availabilityError,setAvailabilityError]=useState(''),[busy,setBusy]=useState(false),[saved,setSaved]=useState(''),[refresh,setRefresh]=useState(0);
  useEffect(()=>{if(!intent.id)return;if(intent.id==='hotel-new-guest')setMode('new');requestAnimationFrame(()=>document.getElementById('hotel-new-reservation')?.scrollIntoView({block:'start'}));},[intent]);
  useEffect(()=>{
    setRooms([]);setRoomId('');setAvailabilityError('');
    if(!arrival||!departure||departure<=arrival||persons<1||persons>8){setChecking(false);return;}
    const controller=new AbortController();setChecking(true);
    void fetch('/api/hotel/availability?'+new URLSearchParams({arrival,departure,persons:String(persons)}),{signal:controller.signal}).then(async r=>{const value=await r.json();if(!r.ok)throw Error(typeof value.detail==='string'?value.detail:'Verfügbarkeit nicht abrufbar.');return value;}).then(value=>{if(!controller.signal.aborted)setRooms(value.rooms);}).catch(e=>{if(!controller.signal.aborted)setAvailabilityError(e.message);}).finally(()=>{if(!controller.signal.aborted)setChecking(false);});
    return()=>controller.abort();
  },[arrival,departure,persons,refresh]);
  return <div>
    <section id="hotel-new-guest"><h3>Gäste verwalten</h3><label>Gäste suchen<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Name oder Kontakt"/></label>
      {guests.filter(g=>(String(g.name)+' '+String(g.contact)).toLowerCase().includes(search.toLowerCase())).map(g=><details className="business-row" key={g.id}><summary>{String(g.name)} · {String(g.contact||'Kein Kontakt hinterlegt')}</summary><form className="hotel-form" onSubmit={async e=>{e.preventDefault();const values=Object.fromEntries(new FormData(e.currentTarget));setBusy(true);onError('');try{await request('/guests/'+g.id,{...values,revision:g.revision},'PATCH');await onChanged();setSaved('Gastdaten gespeichert.');}catch(error){onError(error instanceof Error?error.message:'Gastdaten konnten nicht gespeichert werden.');}finally{setBusy(false);}}}><label>Vollständiger Gastname<input name="name" defaultValue={String(g.name)} minLength={2} maxLength={160} required/></label><label>Kontakt<input name="contact" defaultValue={String(g.contact||'')} maxLength={200}/></label><label>Notizen<textarea name="notes" defaultValue={String(g.notes||'')} maxLength={1000}/></label><button disabled={busy}>Gastdaten speichern</button></form></details>)}
      <button className="ghost" onClick={()=>{setMode('new');document.getElementById('hotel-new-reservation')?.scrollIntoView({block:'start'});}}>Neuen Gast während der Reservierung erfassen</button>
    </section>
    <form className="hotel-form" id="hotel-new-reservation" onSubmit={async e=>{e.preventDefault();if(checking||busy||!roomId)return;setBusy(true);setSaved('');onError('');const form=new FormData(e.currentTarget);try{await request('/reservations',{guest_id:mode==='existing'?guestId:'',guest_name:mode==='new'?name:'',guest_contact:mode==='new'?contact:'',room_id:roomId,arrival,departure,persons,breakfast:form.get('breakfast')==='on',state:form.get('state')});await onChanged();setSaved('Reservierung dauerhaft gespeichert.');setName('');setContact('');setRefresh(n=>n+1);}catch(error){onError(error instanceof Error?error.message:'Reservierung konnte nicht gespeichert werden.');}finally{setBusy(false);}}}>
      <h3>Reservierung anlegen</h3><div className="actions"><button type="button" className={mode==='existing'?'':'ghost'} onClick={()=>setMode('existing')}>Bestehenden Gast auswählen</button><button type="button" className={mode==='new'?'':'ghost'} onClick={()=>setMode('new')}>Neuen Gast eingeben</button></div>
      {mode==='existing'?<label>Gast<select value={guestId} onChange={e=>setGuestId(e.target.value)} required><option value="">Gast auswählen …</option>{guests.map(g=><option key={g.id} value={g.id}>{String(g.name)}</option>)}</select></label>:<><label>Neuer Gast – vollständiger Name<input value={name} onChange={e=>setName(e.target.value)} minLength={2} maxLength={160} required/></label><label>Kontakt des neuen Gastes (optional)<input value={contact} onChange={e=>setContact(e.target.value)} maxLength={200}/></label></>}
      <div className="two"><label>Anreise<input type="date" value={arrival} onChange={e=>setArrival(e.target.value)} required/></label><label>Abreise<input type="date" value={departure} onChange={e=>setDeparture(e.target.value)} min={arrival} required/></label></div>
      <label>Personen<input type="number" min={1} max={8} value={persons} onChange={e=>setPersons(Number(e.target.value))} required/></label>
      {departure&&departure<=arrival&&<p className="error">Die Abreise muss nach der Anreise liegen.</p>}
      <p className="small muted" role="status">{checking?'Verfügbarkeit wird geprüft …':rooms.length?rooms.length+' passende Zimmer im Zeitraum.':departure?'Keine passenden freien Zimmer im gewählten Zeitraum.':'Bitte zuerst Anreise, Abreise und Personenzahl wählen.'}</p>
      {availabilityError&&<p className="error" role="alert">{availabilityError}</p>}
      <label>Zimmer<select value={roomId} onChange={e=>setRoomId(e.target.value)} disabled={checking||!rooms.length} required><option value="">Verfügbares Zimmer auswählen …</option>{rooms.map(r=><option key={r.id} value={r.id}>{r.number} · {r.room_type} · {r.ready_for_checkin?'bezugsfertig':'Reinigung / Kontrolle vor Check-in nötig'}</option>)}</select></label>
      <p className="small muted">Abreise ist das exklusive Ende. Der Server prüft die Verfügbarkeit beim Speichern erneut. Freie Zimmer sind nicht automatisch bezugsfertig.</p>
      <label className="checkbox-label"><input name="breakfast" type="checkbox" defaultChecked/>Frühstück gebucht</label><label>Reservierungsart<select name="state"><option value="request">Unbestätigte Anfrage</option><option value="confirmed">Nach Verfügbarkeitsprüfung bestätigen</option></select></label>
      <button disabled={busy||checking||!roomId}>{busy?'Wird gespeichert …':'Reservierung prüfen & speichern'}</button>
    </form>{saved&&<p role="status">{saved}</p>}
  </div>;
}
