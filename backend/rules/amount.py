import math
from typing import List, Dict, Any, Optional
from backend.engine.base import BaseRule, RuleResult

class UnusualTransactionAmountRule(BaseRule):
    name: str = "UnusualTransactionAmountRule"

    def evaluate(self, txn: dict, history: List[dict], graph: Any) -> Optional[RuleResult]:
        """
        Compare transaction amount against user.avg_amount or historical distribution.
        If amount > 10x average or Z-score > 3.0, score = 30.
        """
        amount = float(txn.get("amount", 0.0))
        user_info = txn.get("user") or {}
        user_avg = float(user_info.get("avg_amount", 100.0))
        
        # Calculate historical amounts for this user if available
        user_history_amounts = [
            float(h["amount"]) for h in history 
            if h.get("user_id") == txn.get("user_id") and "amount" in h
        ]

        if user_history_amounts:
            # Recompute empirical mean & std
            mean_amt = sum(user_history_amounts) / len(user_history_amounts)
            if len(user_history_amounts) > 1:
                variance = sum((x - mean_amt) ** 2 for x in user_history_amounts) / (len(user_history_amounts) - 1)
                std_amt = math.sqrt(variance)
            else:
                std_amt = user_avg * 0.2
        else:
            mean_amt = user_avg
            std_amt = user_avg * 0.25

        # Avoid zero division
        if std_amt < 1.0:
            std_amt = 1.0

        z_score = (amount - mean_amt) / std_amt
        ratio_to_avg = amount / max(user_avg, 1.0)

        is_10x = ratio_to_avg > 10.0
        is_z_outlier = z_score > 3.0

        if is_10x or is_z_outlier:
            trigger_reason = []
            if is_10x:
                trigger_reason.append(f"amount (${amount:,.2f}) is {ratio_to_avg:.1f}x higher than baseline average (${user_avg:,.2f})")
            if is_z_outlier:
                trigger_reason.append(f"statistical Z-score is {z_score:.2f} (> 3.0 std deviations)")

            return RuleResult(
                rule_name="UnusualTransactionAmountRule",
                score=30,
                reason=f"Anomalous transaction amount: {'; '.join(trigger_reason)}.",
                evidence={
                    "amount": round(amount, 2),
                    "user_avg_amount": round(user_avg, 2),
                    "ratio_to_avg": round(ratio_to_avg, 2),
                    "historical_mean": round(mean_amt, 2),
                    "historical_std": round(std_amt, 2),
                    "z_score": round(z_score, 2),
                    "is_10x_exceeded": is_10x,
                    "is_z_outlier": is_z_outlier
                }
            )

        return None
