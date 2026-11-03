import {useState} from 'react';
import {Hotel} from './Hotel';
import {OwnerCustomers} from './OnlineIdentity';
import {GiniCloudPanel} from './GiniCloudPanel';
import {OwnerQuotas} from './OwnerQuotas';
import './online-workspace.css';

type User={id:string;username:string;role:string;tenant:string;modules:Record<string,boolean|string>;kundenz_role?:string};
export function OnlineWorkspace({user,onLogout,onProfile}:{user:User;onLogout:()=>Promise<void>;onProfile:(user:User)=>void}){
 const [view,setView]=useState('hotel'),[question,setQuestion]=useState(''),[error,setError]=useState('');
 const hotel=user.modules.hotel_ai===true;
 return <main className="online-workspace"><header><a href="/" className="brand">WerkZ Digital</a><p>{user.username} · {user.kundenz_role}</p><button onClick={()=>void onLogout().catch(e=>setError(e.message))}>Abmelden</button></header>
 <h1>Dein WerkZ-Arbeitsbereich</h1><p>Freigegebene Funktionen und Dateien deines Kontos.</p>
 <nav aria-label="WerkZ Digital">{hotel&&<><button aria-pressed={view==='hotel'} onClick={()=>setView('hotel')}>Hotelbetrieb</button><button aria-pressed={view==='gini'} onClick={()=>setView('gini')}>GINI und Dateien</button></>}{user.kundenz_role==='OWNER'&&<button aria-pressed={view==='customers'} onClick={()=>setView('customers')}>Testkunden</button>}{user.kundenz_role==='OWNER'&&<button aria-pressed={view==='quotas'} onClick={()=>setView('quotas')}>Kosten und Kontingente</button>}</nav>
 {view==='quotas'&&user.kundenz_role==='OWNER'&&<OwnerQuotas/>}
 {error&&<p role="alert">{error}</p>}
 {view==='customers'&&user.kundenz_role==='OWNER'&&<OwnerCustomers/>}
 {view==='gini'&&hotel&&<GiniCloudPanel key={user.id+user.tenant} initialQuestion={question}/>}
 {view==='hotel'&&hotel&&<Hotel key={user.id} demo={false} onProfile={value=>onProfile(value as User)} onAsk={value=>{setQuestion(value);setView('gini');}}/>}
 {!hotel&&view!=='customers'&&<p role="status">Für dieses Konto ist derzeit kein Fachmodul freigegeben.</p>}
 </main>;
}
