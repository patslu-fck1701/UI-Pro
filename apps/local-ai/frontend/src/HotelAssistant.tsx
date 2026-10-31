import {useEffect, useState} from 'react';

type Provider = 'local' | 'openai';
type Usage = {calls:number;reservedMicroUsd:number;actualMicroUsd:number;callLimit:number;budgetMicroUsd:number};
type Status = {local:{state:string};openai:{state:string};cloudDataScope:string;hotelRecordsShared:boolean;outboundBridge:string;openaiUsage:Usage|null};
type Answer = {answer:string;model:string;provider:Provider;verifiedHotelData:boolean;createdReservation:boolean;dataScope:string;openaiUsage:Usage|null};

export function HotelAssistant(){
  const [status,setStatus]=useState<Status|null>(null);
  const [provider,setProvider]=useState<Provider>('local');
  const [question,setQuestion]=useState('');
  const [answer,setAnswer]=useState<Answer|null>(null);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  useEffect(()=>{
    const controller=new AbortController();
    void fetch('/api/hotel/ai/providers',{signal:controller.signal})
      .then(async r=>{if(!r.ok)throw Error('KI-Status konnte nicht gelesen werden.');return r.json();})
      .then((v:Status)=>{setStatus(v);setProvider(v.local.state==='NOT_CONNECTED'?'openai':'local');})
      .catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:'KI-Status nicht erreichbar.');});
    return ()=>controller.abort();
  },[]);
  const available=(which:Provider)=> status
    && status[which].state !== 'NOT_CONNECTED';
  async function ask(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();if(busy||!question.trim())return;
    setError('');setAnswer(null);setBusy(true);
    try{
      const response=await fetch('/api/hotel/ai/ask',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({provider,question:question.trim()})
      });
      const result=await response.json();
      if(!response.ok)throw Error(typeof result.detail==='string'?result.detail:'KI-Antwort fehlgeschlagen.');
      setAnswer(result as Answer);
    }catch(e){setError(e instanceof Error?e.message:'KI-Antwort fehlgeschlagen.');}
    finally{setBusy(false);}
  }
  return <section className="panel" aria-label="WerkZ Hotel KI">
    <h2>WerkZ Hotel-KI</h2>
    <p className="muted">Du verwendest das bestehende Hotelprogramm. Diese erste KI-Verbindung beantwortet nur deine eigene Frage – ohne Buchungen, Gästedaten, Personalakten oder automatische Hotelaktionen.</p>
    <form onSubmit={ask}>
      <label>KI-Anbieter
        <select value={provider} onChange={e=>{setProvider(e.target.value as Provider);setAnswer(null);}}>
          <option value="local" disabled={!available('local')}>Lokales Qwen{!available('local')?' – nicht verbunden':''}</option>
          <option value="openai" disabled={!available('openai')}>OpenAI API{!available('openai')?' – nicht freigeschaltet':''}</option>
        </select>
      </label>
      <label>Frage
        <textarea value={question} maxLength={1000} rows={4} onChange={e=>setQuestion(e.target.value)}
          placeholder="Zum Beispiel: Welche Schritte gehören zu einer sauberen Rezeption-Übergabe?" />
      </label>
      <button type="submit" disabled={busy||!available(provider)||question.trim().length<2}>
        {busy?'KI antwortet …':'Frage beantworten'}
      </button>
    </form>
    {error&&<p className="error" role="alert">{error}</p>}
    {answer&&<article className="business-row" aria-live="polite">
      <strong>{answer.provider==='openai'?'OpenAI API':'Lokales Qwen'} · {answer.model}</strong>
      <p style={{whiteSpace:'pre-wrap'}}>{answer.answer}</p>
      <p className="muted small">Keine Echtzeit-Hoteldaten geprüft. Keine Reservierung ausgelöst.</p>
      {answer.openaiUsage&&<p className="muted small">OpenAI-Testbudget: {answer.openaiUsage.calls}/{answer.openaiUsage.callLimit} Aufrufe · maximal reserviert {(answer.openaiUsage.reservedMicroUsd/1_000_000).toFixed(6)} USD von {(answer.openaiUsage.budgetMicroUsd/1_000_000).toFixed(6)} USD.</p>}
    </article>}
    {!available('local')&&!available('openai')&&<p className="muted" role="status">Noch kein autorisierter KI-Anbieter verbunden. Lokales Qwen benötigt den vorhandenen llama.cpp-Server; Online-Qwen benötigt erst die private, authentifizierte Bridge. OpenAI erfordert eine separate serverseitige Betreiberfreigabe.</p>}
    <p className="muted small">Status der ausgehenden Geräte-Bridge: {status?.outboundBridge??'nicht geprüft'} · Cloud-Freigabe: {status?.openai.state??'unbekannt'}.</p>
    {status?.openaiUsage&&<p className="muted small">Persistenter OpenAI-Zähler: {status.openaiUsage.calls}/{status.openaiUsage.callLimit} Aufrufe · maximal reserviert {(status.openaiUsage.reservedMicroUsd/1_000_000).toFixed(6)} USD von {(status.openaiUsage.budgetMicroUsd/1_000_000).toFixed(6)} USD.</p>}
  </section>;
}
