# 🛡️ Acentra Aegis: Location-Aware Graph & Rule-Engine Fraud Detection Platform

> **Production-Grade FinTech Hybrid Defense Architecture** combining a Deterministic Rule Engine (Strategy Pattern with Auto-Discovery), In-Memory Heterogeneous Entity Graph (NetworkX), Spatio-Temporal Mobility & Haversine Travel Velocity Engine, Isolated XGBoost/SHAP Machine Learning Layer, and an Explainable Human-in-the-Loop Reviewer Cockpit.

---

## 🏛️ System Architecture

```
                       ┌────────────────────────────────────────────────────────┐
                       │                Incoming Financial Event                │
                       │           (user, amount, geo, device, card)            │
                       └───────────────────────────┬────────────────────────────┘
                                                   │
                ┌──────────────────────────────────┴──────────────────────────────────┐
                ▼                                                                     ▼
┌───────────────────────────────┐                                     ┌───────────────────────────────┐
│   Deterministic Rule Engine   │                                     │ In-Memory Heterogeneous Graph │
│  (Primary Foundation Layer)   │                                     │     (NetworkX Entity Ring)    │
├───────────────────────────────┤                                     ├───────────────────────────────┤
│ • Velocity (5m sliding burst) │                                     │ • User Nodes                  │
│ • Amount (Z-score & 10x avg)  │                                     │ • Transaction Nodes           │
│ • Geo-Temporal Haversine >900 │                                     │ • Device ID Nodes             │
│ • Shared Entity Ring Rule     │                                     │ • Payment Token / Card Nodes  │
└───────────────┬───────────────┘                                     │ • Shipping Address Nodes      │
                │                                                     └───────────────┬───────────────┘
                │ Score (0-100) & Evidence                                            │ Subgraph
                └──────────────────────────────────┬──────────────────────────────────┘
                                                   │
                                                   ▼
                ┌─────────────────────────────────────────────────────────────────────┐
                │          Isolated Machine Learning Layer (Secondary Signal)         │
                ├─────────────────────────────────────────────────────────────────────┤
                │ • XGBoost Anomaly Classifier (calibrated probability 0.0 - 1.0)     │
                │ • SHAP (Shapley Additive exPlanations) Local Feature Attribution   │
                │   (Transparent cognitive reviewer aid; does NOT overwrite rules)   │
                └──────────────────────────────────┬──────────────────────────────────┘
                                                   │
                        ┌──────────────────────────┴──────────────────────────┐
                        ▼                                                     ▼
        ┌───────────────────────────────┐                     ┌───────────────────────────────┐
        │   Persistence & Alerting      │                     │ Human-in-the-Loop Console     │
        ├───────────────────────────────┤                     ├───────────────────────────────┤
        │ • Serverless Neon PostgreSQL  │                     │ • Geo Investigation Map View  │
        │ • AWS SNS / SES Real-Time     │                     │ • Interactive Entity Graph    │
        │   Alerts (Score >= 70)        │                     │ • Side-by-Side Rule Breakdown │
        │ • Review Action Audit Trail   │                     │ • Confirm/Clear/Escalate HUD  │
        └───────────────────────────────┘                     └───────────────────────────────┘
```

---

## 📐 Mathematical & Spatio-Temporal Formulations

### 1. Haversine Great-Circle Geodesic Distance
To detect impossible travel velocities across consecutive transactions:
$$d = 2r \arcsin\left(\sqrt{\sin^2\left(\frac{\Delta \phi}{2}\right) + \cos(\phi_1)\cos(\phi_2)\sin^2\left(\frac{\Delta \lambda}{2}\right)}\right)$$
Where:
- $r = 6371.0\text{ km}$ (Earth radius)
- $\phi_1, \phi_2$: latitudes in radians
- $\Delta \phi = \phi_2 - \phi_1$, $\Delta \lambda = \lambda_2 - \lambda_1$

### 2. Implied Travel Velocity ($V$)
$$V = \frac{d}{\Delta T\text{ (hours)}} = \frac{d \cdot 3600}{\Delta t\text{ (seconds)}}$$
If $V > 900\text{ km/h}$ (maximum commercial aviation threshold), the **Impossible Geographical Location Rule** fires (+25 score).

### 3. Customer Mobility Entropy ($H$)
Quantifies user spatial dispersion vs localized routine:
$$H = -\sum_{i=1}^{k} p_i \log_2(p_i)$$
Where $p_i$ is the empirical fraction of transactions in geographic cluster $i$. Low entropy signals localized routine; high entropy represents dispersed international travel.

---

## 🧩 The 4 Core Deterministic Rules

| Rule Name | File | Max Score | Logic & Condition |
| :--- | :--- | :---: | :--- |
| **Transaction Velocity Rule** | `rules/velocity.py` | **+25** | Counts transactions for the same `user_id` in a sliding 5-minute window. Fires if `count > 5`. |
| **Unusual Amount Rule** | `rules/amount.py` | **+30** | Evaluates transaction amount against `user.avg_amount`. Fires if `amount > 10x` baseline or statistical $Z\text{-score} > 3.0$. |
| **Impossible Geo Location** | `rules/geo.py` | **+25** | Haversine distance / elapsed time. Fires if implied travel speed $V > 900\text{ km/h}$. |
| **Shared Entity Graph Risk** | `rules/graph_rule.py` | **+20** | Traverses NetworkX entity graph. Fires if `device_id` or `shipping_address` is shared across $\ge 3$ distinct accounts or links to previously flagged fraud. |

### Rule Auto-Discovery (`backend/engine/engine.py`)
New business rules are loaded dynamically using Python's `pkgutil` and `importlib`. Dropping a new `.py` file containing a subclass of `BaseRule` into `backend/rules/` activates it immediately without altering core platform code.

---

## 🚀 Quickstart Guide

### 1. Environment Configuration
Create `.env` at root:
```env
DATABASE_URL=postgresql://neondb_owner:npg_mF60NnkxojgO@ep-twilight-night-b5wfnze5-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require
AWS_REGION=us-east-1
AWS_SNS_TOPIC_ARN=arn:aws:sns:us-east-1:123456789012:FraudHighRiskAlerts
```

### 2. Run Backend (FastAPI)
```bash
.\venv\Scripts\Activate.ps1
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

### 3. Run Frontend (React + Vite + Tailwind)
```bash
cd frontend
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## 🧪 Deterministic Fraud Scenarios

The simulator includes one-click scenario injection:
1. **Impossible Travel**: Chennai at 10:00 AM $\rightarrow$ London at 10:31 AM (6,700 km in 31m, implied speed $12,968\text{ km/h}$).
2. **Velocity Burst**: 6 rapid transactions in 2 minutes for single account.
3. **Amount Spike**: $\$15,850.00$ charge ($113\times$ user baseline average).
4. **Shared Syndicate Ring**: Shared Android device and Springfield shipping address linking multiple accounts.
5. **Critical Multi-Vector Attack**: Teleport + high amount + syndicate device (triggers aggregate score $95+/100$ and AWS SNS alert).
