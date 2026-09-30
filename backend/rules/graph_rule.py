from typing import List, Dict, Any, Optional
from backend.engine.base import BaseRule, RuleResult

class SharedEntityGraphRiskRule(BaseRule):
    name: str = "SharedEntityGraphRiskRule"

    def evaluate(self, txn: dict, history: List[dict], graph: Any) -> Optional[RuleResult]:
        """
        Traverses NetworkX graph to detect if device_id or shipping_address is shared
        across >= 3 distinct user accounts or connected to a previously flagged fraudulent transaction.
        """
        if graph is None:
            return None

        user_id = txn["user_id"]
        device_id = txn.get("device_id")
        shipping_address = txn.get("shipping_address")

        check = graph.check_shared_entities(
            user_id=user_id,
            device_id=device_id,
            shipping_address=shipping_address
        )

        if check["has_risk"]:
            reasons = []
            if check["shared_devices"]:
                for dev, users in check["shared_devices"].items():
                    reasons.append(f"Device {dev[:8]} shared by {len(users)} distinct user accounts ({', '.join(users[:3])})")
            if check["shared_addresses"]:
                for addr, users in check["shared_addresses"].items():
                    reasons.append(f"Shipping address '{addr[:20]}...' shared by {len(users)} distinct accounts")
            if check["connected_to_fraud"]:
                reasons.extend(check["fraud_reasons"])

            primary_reason = "; ".join(reasons) if reasons else "Entity linked to high-risk fraud cluster in transaction graph."

            return RuleResult(
                rule_name="SharedEntityGraphRiskRule",
                score=20,
                reason=f"Graph Entity Risk: {primary_reason}",
                evidence={
                    "shared_devices": check["shared_devices"],
                    "shared_addresses": check["shared_addresses"],
                    "connected_to_fraud": check["connected_to_fraud"],
                    "fraud_path_details": check["fraud_reasons"],
                    "entity_types_evaluated": ["device_id", "shipping_address"]
                }
            )

        return None
