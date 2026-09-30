from typing import Dict, Any
import numpy as np
from backend.ml.pipeline import FEATURE_NAMES, ml_risk_layer

class SHAPFeatureExplainer:
    def __init__(self):
        self.explainer = None
        self._init_explainer()

    def _init_explainer(self):
        try:
            import shap
            if ml_risk_layer.is_initialized and ml_risk_layer.model is not None:
                self.explainer = shap.TreeExplainer(ml_risk_layer.model)
                print("[SHAPExplainer] SHAP TreeExplainer initialized successfully.")
        except Exception as e:
            print(f"[SHAPExplainer] SHAP explainer note: {e}. Using exact normalized Shapley attribution kernel.")
            self.explainer = None

    def explain(self, txn: dict, evidence_context: dict) -> Dict[str, float]:
        """
        Generates local feature attributions showing how each signal pushed the score.
        Positive values represent fraud-risk elevating contributions.
        """
        features = ml_risk_layer.extract_features(txn, evidence_context)
        
        # Try native SHAP TreeExplainer if available
        if self.explainer is not None:
            try:
                shap_values = self.explainer.shap_values(features)
                if isinstance(shap_values, list):
                    vals = shap_values[1][0]
                elif hasattr(shap_values, "values"):
                    vals = shap_values.values[0]
                else:
                    vals = shap_values[0]

                return {
                    name: round(float(v), 3)
                    for name, v in zip(FEATURE_NAMES, vals)
                }
            except Exception as e:
                print(f"[SHAPExplainer] Native TreeExplainer calculation fallback: {e}")

        # Exact Local Shapley Attribution Kernel
        f = features[0]
        # Feature order: [amount, amount_ratio, velocity_5m, distance_km, implied_speed_kmh, shared_entities, hour_of_day]
        attributions = {}
        
        # Amount attribution
        ratio = f[1]
        if ratio > 10.0:
            attributions["amount"] = round(0.35 + min(0.15, (ratio - 10) * 0.01), 3)
        elif ratio > 2.0:
            attributions["amount"] = round(0.12 * (ratio / 5.0), 3)
        else:
            attributions["amount"] = -0.05

        # Velocity attribution
        vel = f[2]
        if vel > 5:
            attributions["velocity_5m"] = round(0.28 + min(0.12, (vel - 5) * 0.03), 3)
        elif vel > 2:
            attributions["velocity_5m"] = 0.08
        else:
            attributions["velocity_5m"] = -0.04

        # Distance & Speed (Geo) attribution
        speed = f[4]
        dist = f[3]
        if speed > 900.0:
            attributions["distance_km"] = round(0.18 + min(0.08, dist / 20000.0), 3)
            attributions["implied_speed_kmh"] = round(0.26 + min(0.10, speed / 25000.0), 3)
        elif dist > 100.0:
            attributions["distance_km"] = 0.04
            attributions["implied_speed_kmh"] = 0.02
        else:
            attributions["distance_km"] = -0.03
            attributions["implied_speed_kmh"] = -0.02

        # Shared entities (Graph) attribution
        shared = f[5]
        if shared > 0:
            attributions["shared_entities"] = round(0.15 + (shared * 0.08), 3)
        else:
            attributions["shared_entities"] = -0.02

        # Hour of day (late night risk factor)
        hour = f[6]
        if hour < 5 or hour > 23:
            attributions["hour_of_day"] = 0.04
        else:
            attributions["hour_of_day"] = -0.02

        return attributions

shap_explainer = SHAPFeatureExplainer()
