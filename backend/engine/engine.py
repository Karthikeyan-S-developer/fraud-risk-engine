import importlib
import inspect
import pkgutil
from typing import List, Dict, Any, Type
import backend.rules
from backend.engine.base import BaseRule, RuleResult

class RuleEngine:
    def __init__(self):
        self.rules: List[BaseRule] = []
        self.load_rules()

    def load_rules(self):
        """
        Auto-discovers and dynamically loads all subclasses of BaseRule
        from the backend.rules package using pkgutil and importlib.
        """
        self.rules.clear()
        package = backend.rules
        prefix = package.__name__ + "."

        discovered_classes: List[Type[BaseRule]] = []

        for _, module_name, _ in pkgutil.iter_modules(package.__path__, prefix):
            try:
                module = importlib.import_module(module_name)
                # Re-import / reload in case of runtime file addition
                importlib.reload(module)
                for _, obj in inspect.getmembers(module):
                    if (
                        inspect.isclass(obj)
                        and issubclass(obj, BaseRule)
                        and obj is not BaseRule
                    ):
                        if obj not in discovered_classes:
                            discovered_classes.append(obj)
            except Exception as e:
                print(f"[RuleEngine] Error loading module {module_name}: {e}")

        for cls in discovered_classes:
            try:
                rule_instance = cls()
                self.rules.append(rule_instance)
            except Exception as e:
                print(f"[RuleEngine] Error instantiating rule {cls.__name__}: {e}")

        print(f"[RuleEngine] Auto-discovered and active rules ({len(self.rules)}): {[r.name for r in self.rules]}")

    def evaluate_transaction(
        self, 
        txn: dict, 
        history: List[dict], 
        graph: Any
    ) -> Dict[str, Any]:
        """
        Runs all discovered rules against the transaction.
        Aggregates individual rule scores up to a ceiling of 100.
        Assigns standard FinTech risk tiers:
          0       -> NONE
          1 - 29  -> LOW
          30 - 69 -> MEDIUM
          70 - 100 -> HIGH
        """
        triggered_results: List[RuleResult] = []
        raw_score = 0

        for rule in self.rules:
            try:
                res = rule.evaluate(txn, history, graph)
                if res and res.score > 0:
                    triggered_results.append(res)
                    raw_score += res.score
            except Exception as e:
                print(f"[RuleEngine] Exception evaluating rule {rule.name}: {e}")

        # Cap aggregate rule score at 100
        total_score = min(100, raw_score)

        # Risk level determination
        if total_score == 0:
            risk_level = "NONE"
        elif total_score < 30:
            risk_level = "LOW"
        elif total_score < 70:
            risk_level = "MEDIUM"
        else:
            risk_level = "HIGH"

        return {
            "total_score": total_score,
            "raw_score": raw_score,
            "risk_level": risk_level,
            "results": triggered_results,
            "is_high_risk": total_score >= 70
        }

# Global singleton rule engine
rule_engine = RuleEngine()
