from tests.test_cloud_host import system
from backend.cost_preview import Preview,preview

def test_synthetic_preview_bounds_and_never_authorizes():
    short=preview(Preview(input_tokens=1000,output_tokens=600))
    long=preview(Preview(input_tokens=1000,output_tokens=1600))
    assert float(short['text_list_price_usd'])==0.0004
    assert float(long['text_list_price_usd'])==0.0009
    assert short['paid_call_allowed'] is False and short['actual_prepaid_balance'] is None
    voice=preview(Preview(input_tokens=0,output_tokens=0,tts_characters=1200))
    assert float(voice['voice_list_price_equivalent_usd'])==0.096
    assert preview(Preview(input_tokens=1000,cached_tokens=1000,output_tokens=0))['text_list_price_usd']=='0.00001'

def test_preview_owner_only_and_invalid_cache(system):
    _,user=system;url='/api/auth/owner/quotas/cost-preview';headers={'origin':'https://testserver'}
    assert user('customer-a').post(url,json={},headers=headers).status_code==403
    c=user('owner');assert c.post(url,json={},headers=headers).json()['source']=='SCHAETZUNG'
    assert c.post(url,json={'input_tokens':1,'cached_tokens':2},headers=headers).status_code==422
    assert c.post(url,json={'output_tokens':1601},headers=headers).status_code==422
