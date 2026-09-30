from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from backend.engine.base import BaseRule, RuleResult

class TransactionVelocityRule(BaseRule):
    name: str = "TransactionVelocityRule"

    def evaluate(self, txn: dict, history: List[dict], graph: Any) -> Optional[RuleResult]:
        """
        Count transactions for the same user_id in a sliding 5-minute time window.
        If count > 5 txns, score = 25.
        """
        user_id = txn["user_id"]
        curr_time = txn.get("timestamp")
        if isinstance(curr_time, str):
            curr_time = datetime.fromisoformat(curr_time.replace("Z", "+00:00"))
        elif curr_time is None:
            curr_time = datetime.now(timezone.utc)

        # Sliding 5-minute (300 seconds) window
        count_5m = 0
        matching_txns = []

        for past_txn in history:
            if past_txn.get("user_id") != user_id:
                continue
            
            p_time = past_txn.get("timestamp")
            if isinstance(p_time, str):
                p_time = datetime.fromisoformat(p_time.replace("Z", "+00:00"))
            elif p_time is None:
                continue

            delta_sec = (curr_time - p_time).total_seconds()
            # Check within 5 minutes (0 to 300 seconds)
            if 0 <= delta_sec <= 300:
                count_5m += 1
                matching_txns.append({
                    "txn_id": past_txn.get("txn_id"),
                    "amount": past_txn.get("amount"),
                    "timestamp": str(p_time)
                })

        # Threshold: if count > 5 (meaning 6 or more txns in 5 minutes)
        if count_5m > 5:
            return RuleResult(
                rule_name="TransactionVelocityRule",
                score=25,
                reason=f"High transaction frequency: {count_5m} transactions detected in the last 5 minutes (threshold: >5).",
                evidence={
                    "user_id": user_id,
                    "window_seconds": 300,
                    "count": count_5m,
                    "threshold": 5,
                    "recent_txns": matching_txns[:5]
                }
            )

        return None
