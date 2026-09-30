#!/bin/bash
dnf update -y
dnf install -y python3.11 python3.11-pip git tar

mkdir -p /opt/acentra
cd /opt/acentra

# Download backend bundle from public S3 URL
curl -s -o /opt/acentra/backend.tar.gz https://acentra-fraud-cockpit-605411278941.s3.ap-south-1.amazonaws.com/backend.tar.gz
tar -xzf backend.tar.gz

# Create python virtual environment
python3.11 -m venv /opt/acentra/venv
/opt/acentra/venv/bin/pip install --upgrade pip
/opt/acentra/venv/bin/pip install fastapi uvicorn sqlalchemy psycopg2-binary pydantic networkx haversine faker boto3 python-dotenv scikit-learn numpy xgboost joblib

# Create production .env
cat << 'EOF' > /opt/acentra/.env
DATABASE_URL=postgresql://neondb_owner:npg_mF60NnkxojgO@ep-twilight-night-b5wfnze5-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require
AWS_REGION=ap-south-1
AWS_SNS_TOPIC_ARN=arn:aws:sns:ap-south-1:605411278941:FraudHighRiskAlerts
AWS_SES_SOURCE_EMAIL=alerts@fraud-engine.internal
PORT=8000
HOST=0.0.0.0
EOF

# Create systemd service for FastAPI backend
cat << 'EOF' > /etc/systemd/system/acentra-backend.service
[Unit]
Description=Acentra Fraud Detection Platform Backend
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/acentra
EnvironmentFile=/opt/acentra/.env
ExecStart=/opt/acentra/venv/bin/python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable acentra-backend
systemctl start acentra-backend
