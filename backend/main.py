import os
import uuid
import json
import asyncio
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any, AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Depends, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import desc, func

from backend.db import get_db, engine, Base
from backend.models import User, Transaction, FraudFlag, FlagReason, ReviewAction, RiskLevel, FlagStatus
from backend.schemas import (
    TransactionCreate, TransactionResponse, FraudFlagResponse,
    FlagDetailResponse, ReviewActionCreate, ReviewActionResponse,
    GraphNeighborhood
)
from backend.engine.engine import rule_engine
from backend.engine.graph import graph_engine
from backend.engine.mobility import calculate_mobility_entropy
from backend.ml.pipeline import ml_risk_layer
from backend.ml.explainer import shap_explainer
from backend.services.notifier import notifier
from backend.simulator.simulator import simulator, CITIES

# Create database tables
Base.metadata.create_all(bind=engine)

# Global SSE client queue registry for real-time streaming
_sse_clients: List[asyncio.Queue] = []

async def broadcast_sse_event(event_data: dict):
    """Broadcast a new event to all connected SSE clients."""
    dead = []
    for q in _sse_clients:
        try:
            q.put_nowait(event_data)
        except asyncio.QueueFull:
            dead.append(q)
    for q in dead:
        if q in _sse_clients:
            _sse_clients.remove(q)

def seed_demo_users_and_rebuild_graph(db: Session):
    """
    Seeds baseline demo users and hydrates the in-memory graph from PostgreSQL on startup.
    """
    for u in simulator.demo_users:
        existing = db.query(User).filter(User.user_id == u["user_id"]).first()
        if not existing:
            new_u = User(
                user_id=u["user_id"],
                name=u["name"],
                home_city=u["home_city"],
                home_lat=u["home_lat"],
                home_lon=u["home_lon"],
                avg_amount=u["avg_amount"],
                mobility_entropy=0.5
            )
            db.add(new_u)
    db.commit()

    # Hydrate NetworkX Graph from existing transactions in database
    txns = db.query(Transaction).all()
    flagged_ids = {f.txn_id for f in db.query(FraudFlag).filter(FraudFlag.total_score >= 30).all()}
    for t in txns:
        graph_engine.add_transaction({
            "txn_id": t.txn_id,
            "user_id": t.user_id,
            "amount": t.amount,
            "merchant": t.merchant,
            "device_id": t.device_id,
            "payment_token": t.payment_token,
            "shipping_address": t.shipping_address,
            "city": t.city,
            "latitude": t.latitude,
            "longitude": t.longitude,
            "timestamp": t.timestamp
        }, is_flagged=(t.txn_id in flagged_ids))
    print(f"[Graph] Hydrated in-memory graph with {len(txns)} transactions ({len(flagged_ids)} flagged).")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Seed demo users & hydrate graph
    db = next(get_db())
    try:
        seed_demo_users_and_rebuild_graph(db)
    finally:
        db.close()

    # Connect simulator background callback
    async def ingest_synthetic_txn(txn_data: dict):
        db_s = next(get_db())
        try:
            evaluate_and_save_transaction(txn_data, db_s)
        except Exception as e:
            print(f"[Simulator Ingest Error]: {e}")
        finally:
            db_s.close()

    simulator.set_ingest_callback(ingest_synthetic_txn)
    yield
    # Shutdown: Stop simulator
    simulator.stop()

app = FastAPI(
    title="Location-Aware Graph & Rule-Engine Fraud Detection Platform",
    description="Deterministic rule engine with auto-discovery, in-memory heterogeneous entity graph, spatio-temporal velocity profiling, isolated ML/SHAP risk signals, and human-in-the-loop reviewer console.",
    version="2.0.0",
    lifespan=lifespan
)

# Enable CORS for frontend Vite dev server & production builds
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def evaluate_and_save_transaction(txn_data: dict, db: Session) -> Dict[str, Any]:
    """
    Core processing pipeline:
    1. Resolve user entity & historical records
    2. Evaluate deterministic rules via RuleEngine (Strategy pattern)
    3. Update in-memory heterogeneous NetworkX graph
    4. Compute isolated ML anomaly score & SHAP feature attributions
    5. Persist transaction, fraud flag, and flag reasons to Neon PostgreSQL
    6. Publish real-time AWS SNS alert if high-risk (score >= 70)
    """
    txn_id = txn_data.get("txn_id") or f"txn_{uuid.uuid4().hex[:12]}"
    user_id = txn_data["user_id"]
    timestamp = txn_data.get("timestamp") or datetime.now(timezone.utc)
    if isinstance(timestamp, str):
        timestamp = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))

    # Ensure user exists in DB
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        user_info = txn_data.get("user") or {}
        user = User(
            user_id=user_id,
            name=user_info.get("name", f"User {user_id}"),
            home_city=user_info.get("home_city", txn_data.get("city", "Unknown")),
            home_lat=user_info.get("home_lat", txn_data.get("latitude")),
            home_lon=user_info.get("home_lon", txn_data.get("longitude")),
            avg_amount=user_info.get("avg_amount", 100.0),
            mobility_entropy=0.5
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    # Fetch user history (last 50 transactions)
    past_txns_query = (
        db.query(Transaction)
        .filter(Transaction.user_id == user_id)
        .order_by(desc(Transaction.timestamp))
        .limit(50)
        .all()
    )
    history = [
        {
            "txn_id": p.txn_id,
            "user_id": p.user_id,
            "amount": p.amount,
            "city": p.city,
            "latitude": p.latitude,
            "longitude": p.longitude,
            "timestamp": p.timestamp,
            "device_id": p.device_id,
            "shipping_address": p.shipping_address
        }
        for p in past_txns_query
    ]

    # Build evaluation payload
    eval_payload = {
        "txn_id": txn_id,
        "user_id": user_id,
        "amount": txn_data["amount"],
        "currency": txn_data.get("currency", "USD"),
        "merchant": txn_data.get("merchant", "Merchant"),
        "device_id": txn_data.get("device_id"),
        "payment_token": txn_data.get("payment_token"),
        "shipping_address": txn_data.get("shipping_address"),
        "city": txn_data.get("city", "Unknown"),
        "latitude": txn_data["latitude"],
        "longitude": txn_data["longitude"],
        "timestamp": timestamp,
        "user": {
            "avg_amount": user.avg_amount,
            "home_lat": user.home_lat,
            "home_lon": user.home_lon,
            "home_city": user.home_city
        }
    }

    # 1. Evaluate Deterministic Rule Engine
    rule_eval = rule_engine.evaluate_transaction(eval_payload, history, graph_engine)
    total_score = rule_eval["total_score"]
    risk_level = rule_eval["risk_level"]
    is_high_risk = rule_eval["is_high_risk"]

    # 2. Add to NetworkX Graph
    is_flagged = total_score >= 30
    graph_engine.add_transaction(eval_payload, is_flagged=is_flagged)

    # 3. Context for Isolated ML & SHAP
    geo_evidence = next((r.evidence for r in rule_eval["results"] if r.rule_name == "ImpossibleGeographicalLocationRule"), {})
    vel_evidence = next((r.evidence for r in rule_eval["results"] if r.rule_name == "TransactionVelocityRule"), {})
    graph_evidence = next((r.evidence for r in rule_eval["results"] if r.rule_name == "SharedEntityGraphRiskRule"), {})

    evidence_context = {
        "velocity_count": vel_evidence.get("count", 1),
        "distance_km": geo_evidence.get("distance_km", 0.0),
        "implied_speed_kmh": geo_evidence.get("implied_speed_kmh", 0.0),
        "shared_entity_count": (
            len(graph_evidence.get("shared_devices", {})) + 
            len(graph_evidence.get("shared_addresses", {})) +
            (1 if graph_evidence.get("connected_to_fraud") else 0)
        )
    }

    ml_score = ml_risk_layer.score(eval_payload, evidence_context)
    shap_vals = shap_explainer.explain(eval_payload, evidence_context)

    # 4. Update user mobility entropy based on past cities
    all_cities = [p.city for p in past_txns_query if p.city] + [txn_data.get("city", "Unknown")]
    user.mobility_entropy = calculate_mobility_entropy(all_cities)

    # 5. Persist Transaction
    db_txn = Transaction(
        txn_id=txn_id,
        user_id=user_id,
        amount=txn_data["amount"],
        currency=txn_data.get("currency", "USD"),
        merchant=txn_data.get("merchant"),
        device_id=txn_data.get("device_id"),
        payment_token=txn_data.get("payment_token"),
        shipping_address=txn_data.get("shipping_address"),
        city=txn_data.get("city"),
        latitude=txn_data["latitude"],
        longitude=txn_data["longitude"],
        timestamp=timestamp
    )
    db.add(db_txn)

    # 6. Persist Fraud Flag
    flag = FraudFlag(
        txn_id=txn_id,
        total_score=total_score,
        ml_anomaly_score=ml_score,
        risk_level=risk_level,
        status=FlagStatus.PENDING.value if is_flagged else "NORMAL",
        created_at=timestamp
    )
    db.add(flag)
    db.flush()

    # 7. Persist Flag Reasons
    for r in rule_eval["results"]:
        db_reason = FlagReason(
            flag_id=flag.flag_id,
            rule_name=r.rule_name,
            score=r.score,
            reason=r.reason,
            evidence=r.evidence
        )
        db.add(db_reason)

    db.commit()
    db.refresh(flag)

    # 8. Trigger Real-Time Alerting (AWS SNS / Mock) if score >= 70
    if is_high_risk:
        notifier.publish_high_risk_alert(
            txn_id=txn_id,
            total_score=total_score,
            risk_level=risk_level,
            reasons=rule_eval["results"],
            details={
                "amount": txn_data["amount"],
                "user_id": user_id,
                "city": txn_data.get("city"),
                "ml_anomaly_score": ml_score,
                "evidence_context": evidence_context
            }
        )

    result = {
        "flag_id": flag.flag_id,
        "txn_id": txn_id,
        "total_score": total_score,
        "ml_anomaly_score": ml_score,
        "risk_level": risk_level,
        "status": flag.status,
        "amount": txn_data["amount"],
        "merchant": txn_data.get("merchant"),
        "city": txn_data.get("city"),
        "user_id": user_id,
        "timestamp": timestamp.isoformat(),
        "reasons": [
            {"rule_name": r.rule_name, "score": r.score, "reason": r.reason, "evidence": r.evidence}
            for r in rule_eval["results"]
        ],
        "shap_attributions": shap_vals
    }

    # 9. Broadcast to SSE live stream clients
    asyncio.create_task(broadcast_sse_event(result))

    return result

# ==================== REST API ENDPOINTS ====================

@app.post("/transactions", response_model=Dict[str, Any])
def ingest_transaction(txn: TransactionCreate, db: Session = Depends(get_db)):
    """
    Ingests and scores a transaction in real-time.
    Runs rule discovery engine, updates in-memory graph, evaluates ML attribution,
    and publishes alerts for high-risk flags.
    """
    payload = txn.model_dump()
    result = evaluate_and_save_transaction(payload, db)
    return result

@app.get("/flags", response_model=List[FraudFlagResponse])
def get_flags(
    status: Optional[str] = Query(None, description="PENDING, CONFIRMED_FRAUD, CLEARED, ESCALATED"),
    risk_level: Optional[str] = Query(None, description="LOW, MEDIUM, HIGH"),
    min_score: Optional[int] = Query(1, description="Minimum rule score to filter"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """
    Returns flagged transactions with optional filtering by status and risk level.
    """
    query = db.query(FraudFlag).join(Transaction)
    
    if status and status.upper() != "ALL":
        query = query.filter(FraudFlag.status == status.upper())
    
    if risk_level and risk_level.upper() != "ALL":
        query = query.filter(FraudFlag.risk_level == risk_level.upper())
        
    if min_score is not None:
        query = query.filter(FraudFlag.total_score >= min_score)

    flags = query.order_by(desc(FraudFlag.created_at)).offset(offset).limit(limit).all()
    return flags

@app.get("/flags/{flag_id}", response_model=FlagDetailResponse)
def get_flag_detail(flag_id: int, db: Session = Depends(get_db)):
    """
    Returns complete investigation cocktail:
    - Rule score breakdown & evidence
    - Isolated SHAP ML feature attributions
    - Geo-Temporal investigation metrics (velocity, distance, coordinates)
    - Subgraph neighborhood around the transaction
    - Mobility entropy profile of customer
    """
    flag = db.query(FraudFlag).filter(FraudFlag.flag_id == flag_id).first()
    if not flag:
        raise HTTPException(status_code=404, detail="Fraud flag not found.")

    txn = flag.transaction
    user = txn.user if txn else None

    # Retrieve Subgraph neighborhood from NetworkX
    neighborhood = graph_engine.get_subgraph_neighborhood(txn.txn_id, max_depth=2)

    # Extract evidence context for SHAP
    geo_evidence = {}
    vel_evidence = {}
    graph_evidence = {}
    for r in flag.reasons:
        if r.rule_name == "ImpossibleGeographicalLocationRule" and r.evidence:
            geo_evidence = r.evidence
        elif r.rule_name == "TransactionVelocityRule" and r.evidence:
            vel_evidence = r.evidence
        elif r.rule_name == "SharedEntityGraphRiskRule" and r.evidence:
            graph_evidence = r.evidence

    evidence_context = {
        "velocity_count": vel_evidence.get("count", 1),
        "distance_km": geo_evidence.get("distance_km", 0.0),
        "implied_speed_kmh": geo_evidence.get("implied_speed_kmh", 0.0),
        "shared_entity_count": (
            len(graph_evidence.get("shared_devices", {})) + 
            len(graph_evidence.get("shared_addresses", {})) +
            (1 if graph_evidence.get("connected_to_fraud") else 0)
        )
    }

    eval_payload = {
        "txn_id": txn.txn_id,
        "user_id": txn.user_id,
        "amount": txn.amount,
        "timestamp": txn.timestamp,
        "user": {
            "avg_amount": user.avg_amount if user else 100.0,
            "home_city": user.home_city if user else "",
            "home_lat": user.home_lat if user else 0.0,
            "home_lon": user.home_lon if user else 0.0
        }
    }
    shap_vals = shap_explainer.explain(eval_payload, evidence_context)

    mobility_profile = {
        "home_city": user.home_city if user else "Unknown",
        "home_coords": [user.home_lat, user.home_lon] if user else None,
        "avg_amount": user.avg_amount if user else 100.0,
        "mobility_entropy": user.mobility_entropy if user else 0.0
    }

    return FlagDetailResponse(
        flag=flag,
        shap_attributions=shap_vals,
        graph_neighborhood=GraphNeighborhood(**neighborhood),
        mobility_profile=mobility_profile
    )

@app.patch("/flags/{flag_id}", response_model=FraudFlagResponse)
def submit_review_decision(
    flag_id: int, 
    review: ReviewActionCreate, 
    db: Session = Depends(get_db)
):
    """
    Submits reviewer decision (CONFIRMED_FRAUD, CLEARED, ESCALATED) with audit comment.
    Persists audit trail to review_actions table and updates flag status.
    """
    flag = db.query(FraudFlag).filter(FraudFlag.flag_id == flag_id).first()
    if not flag:
        raise HTTPException(status_code=404, detail="Fraud flag not found.")

    decision_clean = review.decision.upper()
    valid_decisions = ["CONFIRMED_FRAUD", "CLEARED", "ESCALATED", "PENDING"]
    if decision_clean not in valid_decisions:
        raise HTTPException(status_code=400, detail=f"Decision must be one of {valid_decisions}")

    flag.status = decision_clean

    # If confirmed fraud, mark transaction in graph engine as flagged
    if decision_clean == "CONFIRMED_FRAUD":
        graph_engine.mark_flagged(flag.txn_id)

    # Persist immutable review action
    action = ReviewAction(
        flag_id=flag_id,
        reviewer=review.reviewer,
        decision=decision_clean,
        comment=review.comment or "Reviewed via Investigator Console",
        acted_at=datetime.now(timezone.utc)
    )
    db.add(action)
    db.commit()
    db.refresh(flag)
    return flag

class BatchReviewRequest(BaseModel):
    flag_ids: List[int]
    decision: str
    reviewer: str = "Compliance Officer"
    comment: Optional[str] = "Batch reviewed via Investigator Console"

@app.post("/flags/batch-review")
def batch_review_flags(
    req: BatchReviewRequest,
    db: Session = Depends(get_db)
):
    """
    Batch reviews multiple flags at once to quickly resolve PENDING items.
    """
    decision_clean = req.decision.upper()
    valid_decisions = ["CONFIRMED_FRAUD", "CLEARED", "ESCALATED"]
    if decision_clean not in valid_decisions:
        raise HTTPException(status_code=400, detail=f"Decision must be one of {valid_decisions}")

    flags = db.query(FraudFlag).filter(FraudFlag.flag_id.in_(req.flag_ids)).all()
    updated_count = 0
    now = datetime.now(timezone.utc)

    for flag in flags:
        flag.status = decision_clean
        if decision_clean == "CONFIRMED_FRAUD":
            graph_engine.mark_flagged(flag.txn_id)
        
        action = ReviewAction(
            flag_id=flag.flag_id,
            reviewer=req.reviewer,
            decision=decision_clean,
            comment=req.comment or f"Batch resolved as {decision_clean}",
            acted_at=now
        )
        db.add(action)
        updated_count += 1

    db.commit()
    return {
        "status": "success",
        "decision": decision_clean,
        "updated_count": updated_count,
        "flag_ids": [f.flag_id for f in flags]
    }

@app.post("/flags/auto-triage")
def auto_triage_pending(
    reviewer: str = "Auto-Triage Rule Engine",
    db: Session = Depends(get_db)
):
    """
    Automatically resolves all PENDING flags using policy thresholds:
    - Score >= 70: CONFIRMED_FRAUD
    - Score < 70: CLEARED (or marked based on risk tier)
    """
    pending_flags = db.query(FraudFlag).filter(FraudFlag.status == "PENDING").all()
    now = datetime.now(timezone.utc)
    confirmed_count = 0
    cleared_count = 0

    for flag in pending_flags:
        if flag.total_score >= 70:
            decision = "CONFIRMED_FRAUD"
            graph_engine.mark_flagged(flag.txn_id)
            confirmed_count += 1
            cmt = f"Auto-triaged: High risk score ({flag.total_score}/100) policy rule applied."
        else:
            decision = "CLEARED"
            cleared_count += 1
            cmt = f"Auto-triaged: Score ({flag.total_score}/100) below critical threshold, risk cleared."

        flag.status = decision
        action = ReviewAction(
            flag_id=flag.flag_id,
            reviewer=reviewer,
            decision=decision,
            comment=cmt,
            acted_at=now
        )
        db.add(action)

    db.commit()
    return {
        "status": "success",
        "total_triaged": len(pending_flags),
        "confirmed_fraud": confirmed_count,
        "cleared": cleared_count
    }

@app.get("/audit-logs", response_model=List[ReviewActionResponse])
def get_audit_logs(limit: int = 50, db: Session = Depends(get_db)):
    """
    Returns chronological audit trail of all reviewer decisions and actions.
    """
    actions = (
        db.query(ReviewAction)
        .order_by(desc(ReviewAction.acted_at))
        .limit(limit)
        .all()
    )
    return actions

@app.get("/stats")
def get_platform_stats(db: Session = Depends(get_db)):
    """
    Dashboard aggregation metrics: total volumes, fraud counts, risk tier distributions.
    """
    total_txns = db.query(func.count(Transaction.txn_id)).scalar() or 0
    total_flags = db.query(func.count(FraudFlag.flag_id)).filter(FraudFlag.total_score >= 30).scalar() or 0
    confirmed_fraud = db.query(func.count(FraudFlag.flag_id)).filter(FraudFlag.status == "CONFIRMED_FRAUD").scalar() or 0
    cleared_flags = db.query(func.count(FraudFlag.flag_id)).filter(FraudFlag.status == "CLEARED").scalar() or 0
    pending_flags = db.query(func.count(FraudFlag.flag_id)).filter(FraudFlag.status == "PENDING").scalar() or 0

    high_risk_count = db.query(func.count(FraudFlag.flag_id)).filter(FraudFlag.risk_level == "HIGH").scalar() or 0
    med_risk_count = db.query(func.count(FraudFlag.flag_id)).filter(FraudFlag.risk_level == "MEDIUM").scalar() or 0
    low_risk_count = db.query(func.count(FraudFlag.flag_id)).filter(FraudFlag.risk_level == "LOW").scalar() or 0

    active_rules = [r.name for r in rule_engine.rules]

    return {
        "total_transactions": total_txns,
        "flagged_transactions": total_flags,
        "confirmed_fraud": confirmed_fraud,
        "cleared_flags": cleared_flags,
        "pending_flags": pending_flags,
        "risk_distribution": {
            "HIGH": high_risk_count,
            "MEDIUM": med_risk_count,
            "LOW": low_risk_count
        },
        "active_rules_count": len(active_rules),
        "active_rules": active_rules,
        "simulator_running": simulator.is_running,
        "recent_alerts_count": len(notifier.alert_history)
    }

@app.get("/notifications")
def get_notifications():
    """
    Returns audit buffer of AWS SNS / Mock alerts published.
    """
    return {
        "total": len(notifier.alert_history),
        "alerts": notifier.alert_history
    }

# ==================== SIMULATOR CONTROLS ====================

@app.post("/simulate/start")
def start_simulator(interval: float = Query(3.0, ge=0.5, le=30.0)):
    simulator.start(interval=interval)
    return {"status": "Simulator started", "interval": interval}

@app.post("/simulate/stop")
def stop_simulator():
    simulator.stop()
    return {"status": "Simulator stopped"}

@app.post("/simulate/inject")
def inject_scenario(
    scenario: str = Query(..., description="teleport, velocity, amount, ring, combo"),
    db: Session = Depends(get_db)
):
    """
    Injects deterministic fraud attack scenario directly into pipeline.
    """
    valid = ["teleport", "velocity", "amount", "ring", "combo"]
    if scenario not in valid:
        raise HTTPException(status_code=400, detail=f"Scenario must be one of {valid}")

    generated_txns = simulator.generate_scenario(scenario)
    scored_results = []
    for t in generated_txns:
        res = evaluate_and_save_transaction(t, db)
        scored_results.append(res)

    return {
        "status": f"Injected '{scenario}' scenario successfully",
        "transactions_generated": len(generated_txns),
        "results": scored_results
    }

@app.get("/simulate/status")
def get_simulator_status():
    return {
        "is_running": simulator.is_running,
        "interval": simulator.interval,
        "stats": simulator.stats
    }

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "Fraud Detection Platform API",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

# ==================== REAL-TIME SSE LIVE STREAM ====================

@app.get("/stream/live")
async def live_transaction_stream():
    """
    Server-Sent Events (SSE) endpoint for real-time transaction feed.
    Each connected client gets its own queue. Events are pushed as they
    are processed by evaluate_and_save_transaction. Yields:
      - heartbeat every 5s (keep-alive ping)
      - transaction event with full scoring result
    """
    client_queue: asyncio.Queue = asyncio.Queue(maxsize=100)
    _sse_clients.append(client_queue)

    async def event_generator() -> AsyncGenerator[str, None]:
        # Send initial connection confirmation
        yield f"data: {json.dumps({'type': 'connected', 'message': 'Live stream connected', 'timestamp': datetime.now(timezone.utc).isoformat()})}\n\n"
        
        try:
            while True:
                try:
                    # Wait for a new event, but yield heartbeat every 5s if idle
                    event = await asyncio.wait_for(client_queue.get(), timeout=5.0)
                    payload = json.dumps({"type": "transaction", "data": event, "default": str}, default=str)
                    yield f"data: {payload}\n\n"
                except asyncio.TimeoutError:
                    # Heartbeat to keep connection alive
                    yield f"data: {json.dumps({'type': 'heartbeat', 'timestamp': datetime.now(timezone.utc).isoformat()})}\n\n"
        except Exception:
            pass
        finally:
            if client_queue in _sse_clients:
                _sse_clients.remove(client_queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "Access-Control-Allow-Origin": "*"
        }
    )

@app.get("/stream/recent")
def get_recent_transactions(limit: int = Query(20, ge=1, le=100), db: Session = Depends(get_db)):
    """
    Returns most recent scored transactions for initial dashboard load
    before SSE stream kicks in.
    """
    flags = (
        db.query(FraudFlag)
        .join(Transaction)
        .order_by(desc(FraudFlag.created_at))
        .limit(limit)
        .all()
    )
    results = []
    for f in flags:
        txn = f.transaction
        results.append({
            "flag_id": f.flag_id,
            "txn_id": f.txn_id,
            "total_score": f.total_score,
            "ml_anomaly_score": f.ml_anomaly_score,
            "risk_level": f.risk_level,
            "status": f.status,
            "amount": txn.amount if txn else None,
            "merchant": txn.merchant if txn else None,
            "city": txn.city if txn else None,
            "user_id": txn.user_id if txn else None,
            "timestamp": f.created_at.isoformat() if f.created_at else None
        })
    return results
