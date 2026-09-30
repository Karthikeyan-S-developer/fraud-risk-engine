import urllib.request
import json

def post(url, body=None):
    req = urllib.request.Request(
        url,
        method='POST',
        data=json.dumps(body).encode() if body else None,
        headers={'Content-Type': 'application/json'} if body else {}
    )
    res = urllib.request.urlopen(req)
    return json.loads(res.read().decode())

def get(url):
    res = urllib.request.urlopen(url)
    return json.loads(res.read().decode())

flags_before = get('http://127.0.0.1:8000/flags?status=PENDING')
print(f"Pending flags before triage: {len(flags_before)}")

triage_res = post('http://127.0.0.1:8000/flags/auto-triage')
print("Auto-Triage Result:", triage_res)

flags_after = get('http://127.0.0.1:8000/flags?status=PENDING')
print(f"Pending flags after triage: {len(flags_after)}")

stats = get('http://127.0.0.1:8000/stats')
print("Updated Platform Stats:")
print(f"  Confirmed Fraud: {stats['confirmed_fraud']}")
print(f"  Cleared Flags:   {stats['cleared_flags']}")
print(f"  Pending Flags:   {stats['pending_flags']}")
