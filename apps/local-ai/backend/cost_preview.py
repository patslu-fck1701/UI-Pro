"""Public-price synthetic preview only. NEVER authorizes or makes a provider call."""
from decimal import Decimal, ROUND_CEILING
from fastapi import APIRouter,Depends
from pydantic import BaseModel,ConfigDict,Field,model_validator
from .test_customers import owner

router=APIRouter(prefix='/api/auth/owner/quotas',tags=['owner-cost-preview'])
class Preview(BaseModel):
    model_config=ConfigDict(extra='forbid')
    input_tokens:int=Field(default=1000,ge=0,le=100000)
    cached_tokens:int=Field(default=0,ge=0,le=100000)
    output_tokens:int=Field(default=600,ge=0,le=1600)
    tts_characters:int=Field(default=0,ge=0,le=1200)
    preview_cap_usd:Decimal=Field(default=Decimal('0.10'),gt=0,le=1)
    @model_validator(mode='after')
    def cache_within_input(self):
        if self.cached_tokens>self.input_tokens:raise ValueError('Cache übersteigt Input')
        return self

def preview(data):
    # Official list prices checked 2026-11-03; not an account/credit quote.
    uncached=data.input_tokens-data.cached_tokens
    text=(Decimal(uncached)*Decimal('0.10')+Decimal(data.cached_tokens)*Decimal('0.01')+
          Decimal(data.output_tokens)*Decimal('0.50'))/Decimal(1000000)
    voice=Decimal(data.tts_characters)*Decimal('0.08')/Decimal(1000)
    total=(text+voice).quantize(Decimal('0.000001'),rounding=ROUND_CEILING)
    return {'source':'SCHAETZUNG','currency':'USD','price_as_of':'2026-11-03',
        'text_model':'gpt-6-luna','tts_model':'eleven_multilingual_v2',
        'text_list_price_usd':str(text),'voice_list_price_equivalent_usd':str(voice),
        'total_list_price_usd':str(total),'within_preview_cap':total<=data.preview_cap_usd,
        'paid_call_allowed':False,'actual_prepaid_balance':None,'actual_voice_credits':None,
        'sources':['https://developers.openai.com/api/docs/pricing','https://elevenlabs.io/pricing/api'],
        'limitations':['Nur synthetische Mengeneingaben; keine Anbieteraufrufe.',
            'Tarifcredits, Steuern, Wechselkurs und tatsächlicher Saldo unbekannt.',
            'Keine Geldreservierung oder Kostenfreigabe; vor Echtgeldtest separat implementieren und genehmigen.']}

@router.post('/cost-preview')
def cost_preview(data:Preview,user=Depends(owner)):return preview(data)
