import math
from datetime import datetime
from typing import Tuple, List, Dict, Any

EARTH_RADIUS_KM = 6371.0

def haversine_distance(coord1: Tuple[float, float], coord2: Tuple[float, float]) -> float:
    """
    Computes Geodesic Distance (in km) using the Haversine formula:
    d = 2r * arcsin(sqrt(sin^2(d_phi / 2) + cos(phi1) * cos(phi2) * sin^2(d_lambda / 2)))
    """
    lat1, lon1 = coord1
    lat2, lon2 = coord2

    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (math.sin(delta_phi / 2.0) ** 2 +
         math.cos(phi1) * math.cos(phi2) * (math.sin(delta_lambda / 2.0) ** 2))
    
    # Bound within [0, 1] to avoid float precision domain error in sqrt/asin
    a = min(1.0, max(0.0, a))
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return EARTH_RADIUS_KM * c

def calculate_speed_kmh(
    coord1: Tuple[float, float], 
    time1: datetime, 
    coord2: Tuple[float, float], 
    time2: datetime
) -> Dict[str, Any]:
    """
    Calculates distance, elapsed time, and implied speed between two geo-temporal points.
    """
    distance_km = haversine_distance(coord1, coord2)
    
    # Delta time in seconds
    delta_seconds = abs((time2 - time1).total_seconds())
    
    if delta_seconds < 1.0:
        # Avoid division by zero for instantaneous events
        delta_seconds = 1.0

    delta_hours = delta_seconds / 3600.0
    delta_minutes = delta_seconds / 60.0
    implied_speed = distance_km / delta_hours

    return {
        "distance_km": round(distance_km, 2),
        "elapsed_seconds": round(delta_seconds, 1),
        "elapsed_minutes": round(delta_minutes, 2),
        "elapsed_hours": round(delta_hours, 4),
        "implied_speed_kmh": round(implied_speed, 2)
    }

def calculate_mobility_entropy(locations: List[str]) -> float:
    """
    Calculates Shannon Entropy of visited locations:
    H = - sum(p_i * log2(p_i))
    Low entropy: predictable, stationary behavior.
    High entropy: broad mobility footprint.
    """
    if not locations:
        return 0.0

    total = len(locations)
    frequency: Dict[str, int] = {}
    for loc in locations:
        frequency[loc] = frequency.get(loc, 0) + 1

    entropy = 0.0
    for count in frequency.values():
        p = count / total
        if p > 0:
            entropy -= p * math.log2(p)

    return round(entropy, 3)
