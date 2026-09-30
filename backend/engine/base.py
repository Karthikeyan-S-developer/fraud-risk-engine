from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Dict, Any, Optional

@dataclass
class RuleResult:
    rule_name: str
    score: int
    reason: str
    evidence: Dict[str, Any] = field(default_factory=dict)

class BaseRule(ABC):
    name: str = "BaseRule"

    @abstractmethod
    def evaluate(self, txn: dict, history: list, graph: Any) -> Optional[RuleResult]:
        """
        Evaluates a single transaction against customer history and entity graph.
        Returns a RuleResult if the rule triggers, or None if no risk was detected.
        """
        pass
