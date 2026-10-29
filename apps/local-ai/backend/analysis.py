import io
import json
import re
import zipfile
from pathlib import Path
from defusedxml import ElementTree

def inspect_file(name: str, data: bytes) -> tuple[str, dict]:
    suffix=Path(name).suffix.lower()
    if suffix in {'.xlsx','.docx'}:
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            if sum(item.file_size for item in archive.infolist())>40*1024*1024:
                raise ValueError('Entpackte Datei zu groß.')
    if suffix in {'.csv','.xlsx','.json'}:
        import pandas as pd
        if suffix=='.csv':
            frame=pd.read_csv(io.BytesIO(data),sep=None,engine='python',nrows=10000)
        elif suffix=='.xlsx':
            frame=pd.read_excel(io.BytesIO(data),nrows=10000)
        else:
            value=json.loads(data)
            if isinstance(value,dict):
                value=[value]
            frame=pd.json_normalize(value)
        frame=frame.iloc[:10000,:100]
        numeric=frame.select_dtypes(include='number')
        result={'kind':'table','rows':len(frame),'columns':list(map(str,frame.columns)),
                'missing':{str(k):int(v) for k,v in frame.isna().sum().items()},
                'duplicates':int(frame.astype(str).duplicated().sum()),
                'statistics':json.loads(numeric.describe().to_json()) if len(numeric.columns) else {},
                'preview':json.loads(frame.head(30).to_json(orient='records',date_format='iso')),
                'chart':[{'name':str(col),'value':float(numeric[col].mean())} for col in numeric.columns if pd.notna(numeric[col].mean())],
                'limits':'Maximal 10.000 Zeilen und 100 Spalten; Diagramm zeigt numerische Mittelwerte.'}
        return frame.head(100).to_csv(index=False),result
    if suffix=='.pdf':
        from pypdf import PdfReader
        reader=PdfReader(io.BytesIO(data))
        text='\n'.join(page.extract_text() or '' for page in reader.pages[:50])
        return text[:100000],{'kind':'document','pages':len(reader.pages),'characters':len(text),'note':'Maximal 50 Seiten; gescannte PDFs ohne Text benötigen OCR.'}
    text=data.decode('utf-8-sig',errors='replace')[:200000]
    if suffix=='.xml':
        root=ElementTree.fromstring(text)
        names=[node.get('name') for node in root.iter('type')]
        errors=[]
        for node in root.iter('type'):
            for tag in ['nominal','min','lifetime','restock']:
                value=node.findtext(tag)
                if value is not None:
                    try:
                        if int(value)<0: errors.append(f'{node.get("name")}: {tag} ist negativ')
                    except ValueError: errors.append(f'{node.get("name")}: {tag} ist keine Ganzzahl')
            try:
                if int(node.findtext('min','0'))>int(node.findtext('nominal','0')): errors.append(f'{node.get("name")}: min ist größer als nominal')
            except ValueError: pass
        duplicate_names=sorted({name for name in names if name and names.count(name)>1})
        return text,{'kind':'xml','root':root.tag,'types':len(names),'duplicateTypes':duplicate_names,'errors':errors[:100],'status':'STRUKTURELL GEPRÜFT','note':'Keine Aussage über Classname-Existenz oder Funktion auf einem Dedicated Server.'}
    findings=[]
    for index,line in enumerate(text.splitlines(),1):
        if re.search(r'(?i)error|exception|crash|cannot compile|undefined|duplicate|conflict|missing',line):
            findings.append({'line':index,'text':line[:600]})
    return text,{'kind':'log' if suffix in {'.rpt','.log','.mdmp'} else 'text','characters':len(text),'findings':findings[:150],'note':'Fundstellen sind Hinweise, keine bestätigten Ursachen oder Mod-Konflikte.'}

def build_prompt(kind: str, subject: str, style: str, negative: str, duration: int, character: str,provider: str='local-prompt-builder',model: str='') -> dict:
    subject=subject.strip()
    if not subject:
        raise ValueError('Bitte ein Motiv oder Thema eingeben.')
    parts=[f'{"Video" if kind=="video" else "Bild"}-Prompt: {subject}',f'Stil und Licht: {style or "natürliches Licht, klare Bildsprache"}']
    if character: parts.append('Charakterprofil: '+character)
    parts+=['Komposition: Hauptmotiv klar erkennbar; konsistente Perspektive und Proportionen.','Negative Prompt: '+(negative or 'unscharf, Artefakte, verzerrte Proportionen, unleserlicher Text')]
    timeline=[]
    if kind=='video':
        for i,label in enumerate(['Szene etablieren','Hauptaktion zeigen','Ruhiger Abschluss']):
            timeline.append({'start':round(duration*i/3,1),'end':round(duration*(i+1)/3,1),'action':label})
        parts.append('Timeline: '+'; '.join(f'{row["start"]}–{row["end"]} s: {row["action"]}' for row in timeline))
    return {'prompt':'\n\n'.join(parts),'timeline':timeline,'generatedMedia':False,'provider':provider,'model':model,'connected':False}
