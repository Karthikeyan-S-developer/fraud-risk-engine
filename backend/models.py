from datetime import datetime, timezone
import enum
from sqlalchemy import Column, String, Float, Integer, DateTime, ForeignKey, Text, Enum
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.types import JSON
from sqlalchemy.orm import relationship
from backend.db import Base

class RiskLevel(str, enum.Enum):
    NONE = "NONE"
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"

class FlagStatus(str, enum.Enum):
    PENDING = "PENDING"
    CONFIRMED_FRAUD = "CONFIRMED_FRAUD"
    CLEARED = "CLEARED"
    ESCALATED = "ESCALATED"

class User(Base):
    __tablename__ = "users"

    user_id = Column(String(64), primary_key=True, index=True)
    name = Column(String(128), nullable=False)
    home_city = Column(String(128), nullable=True)
    home_lat = Column(Float, nullable=True)
    home_lon = Column(Float, nullable=True)
    avg_amount = Column(Float, default=100.0)
    mobility_entropy = Column(Float, default=0.0)

    transactions = relationship("Transaction", back_populates="user", cascade="all, delete-orphan")

class Transaction(Base):
    __tablename__ = "transactions"

    txn_id = Column(String(64), primary_key=True, index=True)
    user_id = Column(String(64), ForeignKey("users.user_id"), nullable=False, index=True)
    amount = Column(Float, nullable=False)
    currency = Column(String(10), default="USD")
    merchant = Column(String(128), nullable=True)
    device_id = Column(String(128), index=True, nullable=True)
    payment_token = Column(String(128), index=True, nullable=True)
    shipping_address = Column(String(256), index=True, nullable=True)
    city = Column(String(128), nullable=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    timestamp = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)

    user = relationship("User", back_populates="transactions")
    flags = relationship("FraudFlag", back_populates="transaction", cascade="all, delete-orphan")

class FraudFlag(Base):
    __tablename__ = "fraud_flags"

    flag_id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    txn_id = Column(String(64), ForeignKey("transactions.txn_id"), nullable=False, index=True)
    total_score = Column(Integer, default=0)
    ml_anomaly_score = Column(Float, default=0.0)
    risk_level = Column(String(32), default=RiskLevel.NONE.value, index=True)
    status = Column(String(32), default=FlagStatus.PENDING.value, index=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    transaction = relationship("Transaction", back_populates="flags")
    reasons = relationship("FlagReason", back_populates="flag", cascade="all, delete-orphan")
    review_actions = relationship("ReviewAction", back_populates="flag", cascade="all, delete-orphan")

class FlagReason(Base):
    __tablename__ = "flag_reasons"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    flag_id = Column(Integer, ForeignKey("fraud_flags.flag_id"), nullable=False, index=True)
    rule_name = Column(String(128), nullable=False)
    score = Column(Integer, nullable=False)
    reason = Column(Text, nullable=False)
    evidence = Column(JSON, nullable=True)

    flag = relationship("FraudFlag", back_populates="reasons")

class ReviewAction(Base):
    __tablename__ = "review_actions"

    action_id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    flag_id = Column(Integer, ForeignKey("fraud_flags.flag_id"), nullable=False, index=True)
    reviewer = Column(String(128), nullable=False)
    decision = Column(String(64), nullable=False)
    comment = Column(Text, nullable=True)
    acted_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    flag = relationship("FraudFlag", back_populates="review_actions")
