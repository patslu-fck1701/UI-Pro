import {useState} from 'react';
type Row={id:string;revision:number;[key:string]:unknown};
export function HotelReservationEdit({reservation:r,rooms,onChanged,onError}:{reservation:Row;rooms:Row[];onChanged:()=>Promise<void>;onError:(s:string)=>void}){
 const [busy,setBusy]=useState(false);
 async function save(path:string,body:unknown,method:string){setBusy(true);onError('');try{const response=await fetch('/api/hotel/reservations/'+r.id+path,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const value=await response.json();if(!response.ok)throw Error(typeof value.detail==='string'?value.detail:'Reservierung konnte nicht geändert werden.');await onChanged();}catch(e){onError(e instanceof Error?e.message:'Vorgang fehlgeschlagen.');}finally{setBusy(false);}}
 if(!['request','confirmed'].includes(String(r.state)))return null;
 return <details><summary>Reservierung bearbeiten oder stornieren</summary><form className="hotel-form" onSubmit={e=>{e.preventDefault();const values=Object.fromEntries(new FormData(e.currentTarget));void save('',{...values,persons:Number(values.persons),breakfast:values.breakfast==='on',revision:r.revision},'PATCH');}}>
 <label>Zimmer<select name="room_id" defaultValue={String(r.room_id)}>{rooms.map(room=><option value={room.id} key={room.id}>{String(room.number)}{room.blocked?' · gesperrt':''}</option>)}</select></label>
 <label>Anreise<input name="arrival" type="date" defaultValue={String(r.arrival)} required/></label><label>Abreise<input name="departure" type="date" defaultValue={String(r.departure)} required/></label>
 <label>Personen<input name="persons" type="number" min="1" max="8" defaultValue={Number(r.persons)} required/></label><label><input name="breakfast" type="checkbox" defaultChecked={Boolean(r.breakfast)}/>Frühstück</label>
 <p className="small muted">Verfügbarkeit und Änderungen anderer Mitarbeiter werden beim Speichern erneut geprüft.</p><button disabled={busy}>Änderungen prüfen & speichern</button>
 <button type="button" className="danger" disabled={busy} onClick={()=>{if(confirm('Diese Reservierung verbindlich stornieren?'))void save('/cancel',{revision:r.revision,confirmed:true},'POST');}}>Reservierung stornieren</button></form></details>;
}
