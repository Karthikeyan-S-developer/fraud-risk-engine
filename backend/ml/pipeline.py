import numpy as np
from typing import Dict, Any, List, Optional

FEATURE_NAMES = [
    "amount",
    "amount_ratio",
    "velocity_5m",
    "distance_km",
    "implied_speed_kmh",
    "shared_entities",
    "hour_of_day"
]

class MLRiskSignalLayer:
    """
    Isolated ML Risk Signal Layer:
    Provides an auxiliary anomaly score and feature attributions.
    CRITICAL: Operates independently from the deterministic rule engine.
    """
    def __init__(self):
        self.model = None
        self.is_initialized = False
        self._init_model()

    def _init_model(self):
        try:
            from xgboost import XGBClassifier
            # Synthesize training baseline with diverse normal and anomalous vectors
            # Features: [amount, amount_ratio, velocity_5m, distance_km, speed_kmh, shared_entities, hour]
            np.random.seed(42)
            n_samples = 600

            # Normal samples (class 0)
            X_norm = np.column_stack([
                np.random.uniform(10, 250, n_samples),
                np.random.uniform(0.3, 1.8, n_samples),
                np.random.poisson(1.2, n_samples),
                np.random.exponential(15, n_samples),
                np.random.exponential(35, n_samples),
                np.zeros(n_samples),
                np.random.randint(0, 24, n_samples)
            ])
            y_norm = np.zeros(n_samples)

            # Anomaly samples (class 1)
            n_anom = 150
            X_anom = np.column_stack([
                np.random.uniform(500, 15000, n_anom),
                np.random.uniform(4.0, 30.0, n_anom),
                np.random.poisson(6.0, n_anom),
                np.random.uniform(1000, 10000, n_anom),
                np.random.uniform(800, 15000, n_anom),
                np.random.choice([1, 2, 3], n_anom),
                np.random.randint(0, 24, n_anom)
            ])
            y_anom = np.ones(n_anom)

            X = np.vstack([X_norm, X_anom])
            y = np.concatenate([y_norm, y_anom])

            self.model = XGBClassifier(
                n_estimators=35,
                max_depth=4,
                learning_rate=0.1,
                eval_metric="logloss",
                random_state=42
            )
            self.model.fit(X, y)
            self.is_initialized = True
            print("[MLRiskLayer] XGBoost isolated anomaly model initialized successfully.")
        except Exception as e:
            print(f"[MLRiskLayer] XGBoost initialization notice: {e}. Using calibrated probabilistic heuristic.")
            self.is_initialized = False

    def extract_features(self, txn: dict, evidence_context: dict) -> np.ndarray:
        amount = float(txn.get("amount", 0.0))
        user_info = txn.get("user") or {}
        user_avg = float(user_info.get("avg_amount", 100.0))
        amount_ratio = amount / max(user_avg, 1.0)
        
        velocity_5m = float(evidence_context.get("velocity_count", 1))
        distance_km = float(evidence_context.get("distance_km", 0.0))
        speed_kmh = float(evidence_context.get("implied_speed_kmh", 0.0))
        shared_entities = float(evidence_context.get("shared_entity_count", 0))
        
        # Hour of day
        t = txn.get("timestamp")
        hour = t.hour if hasattr(t, "hour") else 12

        return np.array([
            amount,
            amount_ratio,
            velocity_5m,
            distance_km,
            speed_kmh,
            shared_entities,
            hour
        ], dtype=float).reshape(1, -1)

    def score(self, txn: dict, evidence_context: dict) -> float:
        """
        Returns ML anomaly score between 0.0 and 1.0.
        """
        features = self.extract_features(txn, evidence_context)
        
        if self.is_initialized and self.model is not None:
            try:
                proba = float(self.model.predict_proba(features)[0][1])
                return round(proba, 4)
            except Exception as e:
                print(f"[MLRiskLayer] Prediction error: {e}")

        # Fallback calibrated risk scoring
        f = features[0]
        score = 0.02
        if f[1] > 5.0:  # amount ratio
            score += 0.35 * min(1.0, f[1] / 15.0)
        if f[2] > 4:    # velocity
            score += 0.25
        if f[4] > 800:  # speed
            score += 0.30
        if f[5] > 0:    # shared entities
            score += 0.20
        return round(min(0.99, max(0.01, score)), 4)

ml_risk_layer = MLRiskSignalLayer()
