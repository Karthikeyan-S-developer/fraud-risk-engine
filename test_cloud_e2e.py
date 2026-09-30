import urllib.request
import json

BASE_URL = "http://13.126.41.84:8000"

def post(url, data=None):
    body = json.dumps(data).encode('utf-8') if data else None
    headers = {'Content-Type': 'application/json'} if data else {}
    req = urllib.request.Request(url, data=body, headers=headers, method='POST')
    res = urllib.request.urlopen(req)
    return json.loads(res.read().decode())

def get(url):
    req = urllib.request.Request(url)
    res = urllib.request.urlopen(req)
    return json.loads(res.read().decode())

def patch(url, data):
    body = json.dumps(data).encode('utf-8')
    req = urllib.request.Request(url, data=body, headers={'Content-Type': 'application/json'}, method='PATCH')
    res = urllib.request.urlopen(req)
    return json.loads(res.read().decode())

print("==================================================")
print("ACENTRA AEGIS - CLOUD EC2 LIVE VERIFICATION SUITE")
print("Target:", BASE_URL)
print("==================================================")

# 1. Health check
health = get(f"{BASE_URL}/health")
print(f"[1] Health Check: {health['status']} | Timestamp: {health['timestamp']}")

# 2. Inject Amount Scenario
print("\n[2] Injecting Amount Outlier Scenario...")
amt_res = post(f"{BASE_URL}/simulate/inject?scenario=amount")
print(f"   Status: {amt_res['status']} | Txns: {amt_res['transactions_generated']}")
for r in amt_res["results"]:
    print(f"   Txn: {r['txn_id']} | Score: {r['total_score']} | Risk: {r['risk_level']}")

# 3. Inject Ring Scenario
print("\n[3] Injecting Coordinated Fraud Ring Scenario...")
ring_res = post(f"{BASE_URL}/simulate/inject?scenario=ring")
print(f"   Status: {ring_res['status']} | Txns: {ring_res['transactions_generated']}")
for r in ring_res["results"]:
    print(f"   Txn: {r['txn_id']} | Score: {r['total_score']} | Risk: {r['risk_level']}")

# 4. Check Stats
print("\n[4] Querying Live Stats...")
stats = get(f"{BASE_URL}/stats")
print(f"   Total Txns: {stats['total_transactions']}")
print(f"   Flagged: {stats['flagged_transactions']}")
print(f"   Pending: {stats['pending_flags']}")
print(f"   Confirmed Fraud: {stats['confirmed_fraud']}")
print(f"   Cleared: {stats['cleared_flags']}")
print(f"   Risk Distribution: {stats['risk_distribution']}")

# 5. Check Notifications & AWS SNS
print("\n[5] Querying High-Risk AWS Alert Telemetry...")
notifs = get(f"{BASE_URL}/notifications")
print(f"   Total Alerts Triggered: {notifs['total']}")
for a in notifs["alerts"][:3]:
    subj = a['subject'].encode('ascii', 'replace').decode('ascii')
    print(f"   - {subj} | Status: {a['status']}")

# 6. Auto-Triage Demonstration
print("\n[6] Testing Auto-Triage Endpoint...")
triage_res = post(f"{BASE_URL}/flags/auto-triage")
print(f"   Auto-Triage Result: Triaged={triage_res['total_triaged']} (Confirmed={triage_res['confirmed_fraud']}, Cleared={triage_res['cleared']})")

# 7. Check Audit Logs
print("\n[7] Querying Audit Trail...")
audit = get(f"{BASE_URL}/audit-logs?limit=5")
print(f"   Total Audit Entries: {len(audit)}")
if audit:
    print(f"   Latest Audit: Flag #{audit[0]['flag_id']} -> {audit[0]['decision']} by {audit[0]['reviewer']} ({audit[0]['acted_at']})")

print("\n==================================================")
print("ALL AWS CLOUD SERVICES VERIFIED AND OPERATIONAL")
print("==================================================")
