from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from backend.engine.base import BaseRule, RuleResult
from backend.engine.mobility import haversine_distance

SPEED_THRESHOLD_KMH = 900.0

class ImpossibleGeographicalLocationRule(BaseRule):
    name: str = "ImpossibleGeographicalLocationRule"

    def evaluate(self, txn: dict, history: List[dict], graph: Any) -> Optional[RuleResult]:
        """
        Calculates implied travel velocity between consecutive transactions.
        If speed > 900 km/h, flags as impossible geographical movement.
        """
        user_id = txn["user_id"]
        curr_lat = float(txn.get("latitude", 0.0))
        curr_lon = float(txn.get("longitude", 0.0))
        curr_city = txn.get("city", "Current Location")
        
        curr_time = txn.get("timestamp")
        if isinstance(curr_time, str):
            curr_time = datetime.fromisoformat(curr_time.replace("Z", "+00:00"))
        elif curr_time is None:
            curr_time = datetime.now(timezone.utc)

        # Find the most recent previous transaction for this user
        prev_txn = None
        for past_txn in sorted(
            [h for h in history if h.get("user_id") == user_id],
            key=lambda x: str(x.get("timestamp", "")),
            reverse=True
        ):
            p_time = past_txn.get("timestamp")
            if isinstance(p_time, str):
                p_time = datetime.fromisoformat(p_time.replace("Z", "+00:00"))
            elif p_time is None:
                continue

            if p_time < curr_time:
                prev_txn = past_txn
                break

        # Fallback to user home coordinates if no previous transaction exists
        if not prev_txn:
            user_info = txn.get("user") or {}
            home_lat = user_info.get("home_lat")
            home_lon = user_info.get("home_lon")
            if home_lat is not None and home_lon is not None:
                # If current location differs significantly from home with minimal elapsed time
                # We can construct a virtual anchor, but let's only compare if distance > 100km
                d_home = haversine_distance((home_lat, home_lon), (curr_lat, curr_lon))
                if d_home > 5000:
                    # User registered home in one continent but suddenly transacts in another without prior warmup
                    pass
            return None

        p_lat = float(prev_txn.get("latitude", 0.0))
        p_lon = float(prev_txn.get("longitude", 0.0))
        p_city = prev_txn.get("city", "Previous Location")
        p_time = prev_txn.get("timestamp")
        if isinstance(p_time, str):
            p_time = datetime.fromisoformat(p_time.replace("Z", "+00:00"))

        distance_km = haversine_distance((p_lat, p_lon), (curr_lat, curr_lon))
        delta_seconds = abs((curr_time - p_time).total_seconds())
        if delta_seconds < 1.0:
            delta_seconds = 1.0

        elapsed_hours = delta_seconds / 3600.0
        elapsed_min = delta_seconds / 60.0
        implied_speed = distance_km / elapsed_hours

        # Only evaluate if locations actually differ (> 10 km)
        if distance_km > 10.0 and implied_speed > SPEED_THRESHOLD_KMH:
            return RuleResult(
                rule_name="ImpossibleGeographicalLocationRule",
                score=25,
                reason=(
                    f"Impossible travel velocity detected: {p_city} -> {curr_city} "
                    f"({distance_km:,.1f} km in {elapsed_min:.1f} min). "
                    f"Implied speed of {implied_speed:,.1f} km/h exceeds commercial aviation threshold (900 km/h)."
                ),
                evidence={
                    "prev_city": p_city,
                    "curr_city": curr_city,
                    "prev_time": p_time.isoformat(),
                    "curr_time": curr_time.isoformat(),
                    "distance_km": round(distance_km, 1),
                    "elapsed_min": round(elapsed_min, 1),
                    "implied_speed_kmh": round(implied_speed, 1),
                    "threshold_kmh": int(SPEED_THRESHOLD_KMH),
                    "prev_coords": [p_lat, p_lon],
                    "curr_coords": [curr_lat, curr_lon]
                }
            )

        return None
