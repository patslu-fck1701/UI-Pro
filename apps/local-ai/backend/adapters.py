"""Provider-neutral approval contracts. No credentials or external execution."""
from dataclasses import dataclass

@dataclass(frozen=True)
class PreparedAdapter:
    name:str
    category:str
    def describe(self):
        return {'name':self.name,'category':self.category,'status':'not_connected','canExecute':False,'requiresApproval':True}
    def prepare(self,description:str):
        description=description.strip()
        if not description:raise ValueError('Eine Aufgabenbeschreibung ist erforderlich.')
        return {'adapter':self.name,'description':description,'executed':False,'requiresApproval':True}

class AdapterRegistry:
    def __init__(self):self._adapters={}
    def register(self,adapter:PreparedAdapter):
        if adapter.name in self._adapters:raise ValueError('Adapter ist bereits registriert.')
        self._adapters[adapter.name]=adapter
    def get(self,name:str):
        if name not in self._adapters:raise ValueError('Unbekannter Adapter.')
        return self._adapters[name]
    def describe(self):return [adapter.describe() for adapter in self._adapters.values()]
    def names(self):return list(self._adapters)

registry=AdapterRegistry()
for name,category in [('GitHub','development'),('Render','hosting'),('Gmail','mail'),('Google Drive','files'),('Google Calendar','calendar'),('Slack','communication'),('WebsitePublisher','publishing')]:
    registry.register(PreparedAdapter(name,category))
