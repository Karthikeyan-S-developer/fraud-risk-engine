import urllib.request
import json

def post(url):
    req = urllib.request.Request(url, method='POST')
    res = urllib.request.urlopen(req)
    return json.loads(res.read().decode())

def get(url):
    res = urllib.request.urlopen(url)
    return json.loads(res.read().decode())

print("=== INJECTING FRAUD SCENARIOS ===")
teleport = post("http://127.0.0.1:8000/simulate/inject?scenario=teleport")
print("1. Teleport Injection:", teleport["status"])
for r in teleport["results"]:
    print(f"   TXN: {r['txn_id']} | Score: {r['total_score']} | Risk: {r['risk_level']}")
    for rule in r["reasons"]:
        print(f"     -> Fired: {rule['rule_name']} (+{rule['score']} pts): {rule['reason'][:60]}...")

amt = post("http://127.0.0.1:8000/simulate/inject?scenario=amount")
print("\n2. Amount Injection:", amt["status"])

vel = post("http://127.0.0.1:8000/simulate/inject?scenario=velocity")
print("\n3. Velocity Injection:", vel["status"])

ring = post("http://127.0.0.1:8000/simulate/inject?scenario=ring")
print("\n4. Ring Injection:", ring["status"])

combo = post("http://127.0.0.1:8000/simulate/inject?scenario=combo")
print("\n5. Combo Injection:", combo["status"])

print("\n=== VERIFYING STATS ===")
stats = get("http://127.0.0.1:8000/stats")
print(f"Total Transactions: {stats['total_transactions']}")
print(f"Flagged Transactions: {stats['flagged_transactions']}")
print(f"High Risk (SNS Alerts): {stats['risk_distribution']['HIGH']}")
print(f"Active Rules: {stats['active_rules']}")

print("\n=== VERIFYING NOTIFICATIONS (AWS SNS / Mock) ===")
notifs = get("http://127.0.0.1:8000/notifications")
print(f"Total Published Alerts: {notifs['total']}")
for a in notifs["alerts"][:2]:
    safe_subj = a['subject'].encode('ascii', 'replace').decode('ascii')
    print(f"   Alert: {safe_subj} | Status: {a['status']}")

print("\n=== VERIFYING DETAILED INVESTIGATION PAYLOAD ===")
flags = get("http://127.0.0.1:8000/flags?min_score=30&limit=5")
first_flag_id = flags[0]["flag_id"]
detail = get(f"http://127.0.0.1:8000/flags/{first_flag_id}")
print(f"Detail Flag ID: {detail['flag']['flag_id']} | Txn: {detail['flag']['txn_id']}")
print(f"SHAP Attributions: {detail['shap_attributions']}")
print(f"Graph Neighborhood Nodes: {len(detail['graph_neighborhood']['nodes'])}, Links: {len(detail['graph_neighborhood']['links'])}")
print(f"Mobility Profile: {detail['mobility_profile']}")

print("\n=== SUBMITTING AUDIT REVIEW ACTION ===")
req_body = json.dumps({
    "reviewer": "Principal Investigator (Acentra)",
    "decision": "CONFIRMED_FRAUD",
    "comment": "Confirmed impossible velocity and coordinated entity usage. Account frozen."
}).encode("utf-8")
patch_req = urllib.request.Request(
    f"http://127.0.0.1:8000/flags/{first_flag_id}",
    data=req_body,
    headers={"Content-Type": "application/json"},
    method="PATCH"
)
patch_res = urllib.request.urlopen(patch_req)
updated_flag = json.loads(patch_res.read().decode())
print(f"Updated Flag #{first_flag_id} Status: {updated_flag['status']}")

audit_logs = get("http://127.0.0.1:8000/audit-logs")
print(f"Audit Log Count: {len(audit_logs)}")
print(f"Latest Log Decision: {audit_logs[0]['decision']} by {audit_logs[0]['reviewer']}")

print("\n>>> ALL TESTS COMPLETED SUCCESSFULLY! <<<")
