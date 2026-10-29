"""Pinned, read-only port into the existing independent AiZ checkout.

No scans, imports, indexing, approval writes, remote URLs or user-selectable paths.
"""
import hashlib,json,re,subprocess,sys,sqlite3,types
from pathlib import Path

class KnowledgeUnavailable(ValueError):pass

class KnowledgeSearchPort:
    def __init__(self,binding:Path):self.binding=binding
    def fingerprint(self):
        """Cheap read-only revocation epoch; any source/store change stops output."""
        try:
            root=Path(json.loads(self.binding.read_text(encoding='utf-8'))['root'])
            files=[self.binding,root/'aiz/knowledge.py',root/'aiz/handoff.py',*sorted((root/'knowledge/approved').glob('*.json'))]
            files += [root/'.aiz-local'/name for name in ['index.sqlite3','index.sqlite3-wal','exchange.sqlite3','exchange.sqlite3-wal']]
            digest=hashlib.sha256()
            for file in files:
                digest.update(str(file).encode())
                if file.exists():
                    if file.is_symlink() or file.stat().st_size>16*1024*1024:raise ValueError()
                    digest.update(file.read_bytes())
            return digest.hexdigest()
        except (OSError,ValueError,KeyError):raise KnowledgeUnavailable('AIZ_SOURCE_UNAVAILABLE')
    def _git(self,root,*args):
        try:
            result=subprocess.run(['git','-C',str(root),*args],capture_output=True,text=True,timeout=5)
        except (OSError,subprocess.TimeoutExpired):raise KnowledgeUnavailable('AIZ_SOURCE_UNAVAILABLE')
        if result.returncode:raise KnowledgeUnavailable('AIZ_SOURCE_CHANGED')
        return result.stdout.strip()
    def _source(self):
        try:
            if self.binding.is_symlink():raise ValueError()
            binding=json.loads(self.binding.read_text(encoding='utf-8'))
            if set(binding)!={'root','revision','knowledge_sha256'}:raise ValueError()
            if not re.fullmatch('[a-f0-9]{40}',binding['revision']) or not re.fullmatch('[a-f0-9]{64}',binding['knowledge_sha256']):raise ValueError()
            root=Path(binding['root'])
            if not root.is_absolute() or root.is_symlink() or root.is_junction():raise ValueError()
            root=root.resolve();script=root/'aiz'/'knowledge.py'
            for folder in [root/'knowledge',root/'knowledge'/'approved',root/'.aiz-local']:
                if folder.is_symlink() or folder.is_junction():raise ValueError()
            if script.is_symlink() or script.parent.is_symlink() or script.parent.is_junction():raise ValueError()
            if hashlib.sha256(script.read_bytes()).hexdigest()!=binding['knowledge_sha256']:raise ValueError()
            if self._git(root,'rev-parse','HEAD')!=binding['revision']:raise ValueError()
            self._git(root,'diff','--quiet','HEAD','--','aiz/knowledge.py')
            return root,script,binding['revision']
        except (OSError,ValueError,TypeError,KeyError):raise KnowledgeUnavailable('AIZ_BINDING_MISSING_OR_STALE')
    def _call(self,*args):
        root,script,revision=self._source()
        try:
            result=subprocess.run([sys.executable,'-I',str(script),'--root',str(root),*args],capture_output=True,text=True,encoding='utf-8',timeout=5)
            if result.returncode or len(result.stdout.encode())>65536:raise ValueError()
            return root,revision,json.loads(result.stdout)
        except (OSError,ValueError,subprocess.TimeoutExpired):raise KnowledgeUnavailable('AIZ_QUERY_UNAVAILABLE')
    def status(self):
        _,revision,value=self._call('status')
        if value.get('status')!='INDEX_PRESENT_LOCAL_ONLY':raise KnowledgeUnavailable('AIZ_INDEX_MISSING')
        return {'state':'AVAILABLE','revision':revision,'records':value['records'],'scope':'werkz','mode':'read_only'}
    def search(self,query,limit=5):
        if not isinstance(query,str) or not 1<=len(query)<=240 or not 1<=limit<=5:raise KnowledgeUnavailable('AIZ_QUERY_INVALID')
        root,revision,value=self._call('search','--project','werkz','--query',query,'--limit',str(limit))
        results=value.get('results')
        if not isinstance(results,list) or len(results)>limit:raise KnowledgeUnavailable('AIZ_RESULT_INVALID')
        # Rehydrate only selected approved/versioned records; stale index text is never trusted.
        verified=[]
        for result in results:
            try:
                identifier=result['id']
                if not re.fullmatch('[a-z0-9][a-z0-9_-]{2,63}',identifier):raise ValueError()
                relative='knowledge/approved/'+identifier+'.json';file=root/relative
                if file.is_symlink() or file.parent.is_symlink() or file.parent.is_junction() or file.stat().st_size>40000:raise ValueError()
                self._git(root,'ls-files','--error-unmatch',relative)
                self._git(root,'diff','--quiet','HEAD','--',relative)
                current=json.loads(file.read_text(encoding='utf-8'))
                if current.get('status')!='approved' or current.get('classification')!='portable' or current.get('project') not in {'werkz','shared'}:raise ValueError()
                keys=['id','project','title','summary','root_cause','resolution','prevention','source_uri','source_revision','verified_at']
                if any(not isinstance(current.get(key),str) or current[key]!=result.get(key) for key in keys):raise ValueError()
                verified.append({key:current[key] for key in keys})
            except (OSError,ValueError,TypeError,KeyError):raise KnowledgeUnavailable('AIZ_RECORD_REVOKED_OR_STALE')
        self._source() # refuse a revision or approved-source change during retrieval
        self._git(root,'diff','--quiet','HEAD','--','knowledge/approved')
        return {'scope':'werkz','revision':revision,'results':verified,'readOnly':True,'purpose':'operator_knowledge_lookup'}

    def context(self,query,limit=3,chars=2400):
        """Both approved protocols, read-only. Never create/approve/index a store."""
        if not 1<=chars<=2400:raise KnowledgeUnavailable('AIZ_CONTEXT_LIMIT')
        if not isinstance(query,str) or not 1<=len(query)<=240 or not 1<=limit<=5:raise KnowledgeUnavailable('AIZ_QUERY_INVALID')
        result=self.search(query,limit)
        if not result['results']:
            for term in list(dict.fromkeys(re.findall(r'\w{3,}',query)))[:6]:
                partial=self.search(term,limit)
                result['results'].extend(card for card in partial['results'] if card['id'] not in {c['id'] for c in result['results']})
                result['results']=result['results'][:limit]
                if len(result['results'])==limit:break
        root,_,revision=self._source()
        script=root/'aiz/handoff.py'
        try:
            expected=subprocess.run(['git','-C',str(root),'show',revision+':aiz/handoff.py'],capture_output=True,timeout=5)
            if expected.returncode or script.is_symlink():raise ValueError()
            self._git(root,'diff','--quiet','HEAD','--','aiz/handoff.py')
            validator=types.ModuleType('werkz_pinned_handoff');validator.__file__=str(script)
            exec(compile(expected.stdout,str(script),'exec'),validator.__dict__)
            file=root/'.aiz-local/exchange.sqlite3'
            cards=[dict(row,protocol='approved-v1') for row in result['results']]
            if file.exists():
                if file.is_symlink():raise ValueError()
                with sqlite3.connect(file.as_uri()+'?mode=ro',uri=True,timeout=2) as db:
                    rows=db.execute("SELECT case_id,status,payload,content_hash FROM cases WHERE target_scope IN ('werkz','shared') LIMIT 501").fetchall()
                if len(rows)>500:raise ValueError()
                terms={word.lower() for word in re.findall(r'\w+',query) if len(word)>2}
                for identifier,state,payload,digest in rows:
                    if state!='APPROVED_PORTABLE':
                        if any(card['id']==identifier for card in cards):raise ValueError()
                        continue
                    if len(payload)>40000:raise ValueError()
                    item=json.loads(payload);validator._validate(item)
                    if item['approval']['policy_version']!='2':raise ValueError()
                    canonical=json.dumps(item,ensure_ascii=False,sort_keys=True,separators=(',',':'))
                    if hashlib.sha256(canonical.encode()).hexdigest()!=digest or item['case_id']!=identifier:raise ValueError()
                    if item['target_scope'] not in {'werkz','shared'}:raise ValueError()
                    text=item['title']+' '+item['summary']
                    if terms and not any(term in text.lower() for term in terms):continue
                    cards.append({'id':identifier,'title':item['title'],'summary':item['summary'],'source_uri':item['source_uri'],'source_revision':item['source_revision'],'protocol':'exchange-v2'})
            unique={}
            for card in cards:
                if card['id'] in unique and any(unique[card['id']].get(k)!=card.get(k) for k in ['summary','source_uri','source_revision']):raise ValueError()
                unique[card['id']]=card
            selected=[];used=0
            for card in unique.values():
                size=len(json.dumps(card,ensure_ascii=False))
                if used+size>chars:continue
                selected.append(card);used+=size
                if len(selected)==limit:break
            self._source()
            return {'scope':'werkz','revision':revision,'results':selected,'readOnly':True,'sources_checked':['approved-v1','exchange-v2'],'model_called':False}
        except (OSError,ValueError,sqlite3.Error,subprocess.TimeoutExpired):raise KnowledgeUnavailable('AIZ_HANDOFF_UNAVAILABLE_OR_CONFLICT')
