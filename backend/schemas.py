from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

class UserBase(BaseModel):
    user_id: str
    name: str
    home_city: Optional[str] = None
    home_lat: Optional[float] = None
    home_lon: Optional[float] = None
    avg_amount: float = 100.0
    mobility_entropy: float = 0.0

class UserResponse(UserBase):
    class Config:
        from_attributes = True

class TransactionCreate(BaseModel):
    txn_id: Optional[str] = None
    user_id: str
    amount: float
    currency: str = "USD"
    merchant: Optional[str] = "Online Merchant"
    device_id: Optional[str] = None
    payment_token: Optional[str] = None
    shipping_address: Optional[str] = None
    city: Optional[str] = "Unknown"
    latitude: float
    longitude: float
    timestamp: Optional[datetime] = None

class TransactionResponse(BaseModel):
    txn_id: str
    user_id: str
    amount: float
    currency: str
    merchant: Optional[str]
    device_id: Optional[str]
    payment_token: Optional[str]
    shipping_address: Optional[str]
    city: Optional[str]
    latitude: float
    longitude: float
    timestamp: datetime

    class Config:
        from_attributes = True

class FlagReasonResponse(BaseModel):
    id: Optional[int] = None
    rule_name: str
    score: int
    reason: str
    evidence: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True

class ReviewActionCreate(BaseModel):
    reviewer: str = Field(..., description="Reviewer identifier or name")
    decision: str = Field(..., description="CONFIRMED_FRAUD, CLEARED, or ESCALATED")
    comment: Optional[str] = ""

class ReviewActionResponse(BaseModel):
    action_id: int
    flag_id: int
    reviewer: str
    decision: str
    comment: Optional[str]
    acted_at: datetime

    class Config:
        from_attributes = True

class FraudFlagResponse(BaseModel):
    flag_id: int
    txn_id: str
    total_score: int
    ml_anomaly_score: float
    risk_level: str
    status: str
    created_at: datetime
    transaction: Optional[TransactionResponse] = None
    reasons: List[FlagReasonResponse] = []
    review_actions: List[ReviewActionResponse] = []

    class Config:
        from_attributes = True

class GraphNode(BaseModel):
    id: str
    label: str
    type: str  # user, txn, device, pmt, addr
    risk: Optional[str] = "normal"  # normal, flagged, high_risk
    properties: Dict[str, Any] = {}

class GraphLink(BaseModel):
    source: str
    target: str
    relationship: str  # PERFORMED, USED_DEVICE, USED_CARD, SHIPPED_TO, CONNECTED_TO

class GraphNeighborhood(BaseModel):
    nodes: List[GraphNode]
    links: List[GraphLink]

class FlagDetailResponse(BaseModel):
    flag: FraudFlagResponse
    shap_attributions: Dict[str, float] = {}
    graph_neighborhood: GraphNeighborhood
    mobility_profile: Dict[str, Any] = {}
