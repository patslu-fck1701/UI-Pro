"""GINI Cloud – KI- und Dateibearbeitungslogik für WerkZ Digital ohne Owner-PC.

Standardbibliothek only. Keine Dateisystem-, Netzwerk- (außer OpenAI) oder lokalen
Pfadzugriffe. Vertrag: docs/GINI_CLOUD_API_1.0.md, schema/gini-cloud-1.0.0.schema.json.
"""
from .contract import (CONTRACT_VERSION, Document, GiniCloudError, Identity, reject_client_identity,
                       sha256_text)
from .memory_store import InMemoryDocumentStore
from .providers import OpenAIPort, TokenBudget
from .service import GiniCloud

__all__ = ['CONTRACT_VERSION', 'Document', 'GiniCloud', 'GiniCloudError', 'Identity', 'InMemoryDocumentStore',
           'OpenAIPort', 'TokenBudget', 'reject_client_identity', 'sha256_text']
