"""Enroll one explicitly authorized owner; password arrives only over private stdin.

No password arguments, files, logs, tokens in output or external account changes.
Only the existing setup/login endpoints of the verified local hotel program.
"""
import argparse,sys,getpass
import httpx

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--username',required=True)
    args=parser.parse_args()
    base='http://127.0.0.1:8001'
    with httpx.Client(base_url=base,headers={'origin':base},trust_env=False,timeout=10) as client:
        health=client.get('/api/health').json()
        if health.get('package')!='hotel' or health.get('mode')!='production':raise SystemExit('REFUSED_UNEXPECTED_LOCAL_TARGET')
        if client.get('/api/setup').json().get('required') is not True:raise SystemExit('REFUSED_SETUP_ALREADY_COMPLETED')
        print('LOCAL_PASSWORD_INPUT_REQUIRED',flush=True)
        password=getpass.getpass('Local password: ') if sys.stdin.isatty() else sys.stdin.readline().rstrip('\r\n')
        if not 4<=len(password)<=128:raise SystemExit('REFUSED_PASSWORD_LENGTH')
        body={'username':args.username,'password':password}
        if client.post('/api/setup',json=body).status_code!=201:raise SystemExit('LOCAL_OWNER_SETUP_FAILED')
        if client.post('/api/login',json=body).status_code!=200:raise SystemExit('LOCAL_OWNER_LOGIN_FAILED')
        body.clear();password=''
        profile=client.get('/api/me').json()
        if profile.get('username')!=args.username or profile.get('role')!='admin':raise SystemExit('LOCAL_OWNER_READBACK_FAILED')
        print('LOCAL_OWNER_CREATED_AND_LOGIN_VERIFIED')

if __name__=='__main__':main()
