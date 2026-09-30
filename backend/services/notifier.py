import os
import json
import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional
import boto3
from botocore.exceptions import BotoCoreError, ClientError

logger = logging.getLogger("FraudNotifier")
logging.basicConfig(level=logging.INFO)

class FraudAlertNotifier:
    def __init__(self):
        self.region = os.getenv("AWS_REGION", "us-east-1")
        self.topic_arn = os.getenv(
            "AWS_SNS_TOPIC_ARN", 
            "arn:aws:sns:us-east-1:123456789012:FraudHighRiskAlerts"
        )
        self.source_email = os.getenv("AWS_SES_SOURCE_EMAIL", "alerts@fraud-engine.internal")
        
        # In-memory alert audit buffer for reviewer inspection
        self.alert_history = []

        # Initialize AWS clients using environment or default provider chain
        aws_access_key = os.getenv("AWS_ACCESS_KEY_ID")
        aws_secret_key = os.getenv("AWS_SECRET_ACCESS_KEY")

        boto_kwargs = {"region_name": self.region}
        if aws_access_key and aws_secret_key and not aws_access_key.startswith("your_"):
            boto_kwargs["aws_access_key_id"] = aws_access_key
            boto_kwargs["aws_secret_access_key"] = aws_secret_key

        try:
            self.sns_client = boto3.client("sns", **boto_kwargs)
            logger.info(f"[Notifier] AWS SNS Client initialized successfully for region {self.region}.")
        except Exception as e:
            logger.warning(f"[Notifier] AWS SNS client init notice: {e}. Active mock mode fallback enabled.")
            self.sns_client = None

        try:
            self.ses_client = boto3.client("ses", **boto_kwargs)
            logger.info(f"[Notifier] AWS SES Client initialized successfully for region {self.region}.")
        except Exception as e:
            logger.warning(f"[Notifier] AWS SES client init notice: {e}.")
            self.ses_client = None

    def publish_high_risk_alert(
        self, 
        txn_id: str, 
        total_score: int, 
        risk_level: str, 
        reasons: list, 
        details: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Publishes a real-time high-risk fraud alert via AWS SNS topic and SES email.
        """
        now = datetime.now(timezone.utc).isoformat()
        alert_payload = {
            "eventType": "HIGH_RISK_FRAUD_ALERT",
            "timestamp": now,
            "transactionId": txn_id,
            "totalScore": total_score,
            "riskLevel": risk_level,
            "triggeredRules": [
                {
                    "rule": getattr(r, "rule_name", r.get("rule_name") if isinstance(r, dict) else str(r)),
                    "score": getattr(r, "score", r.get("score") if isinstance(r, dict) else 0),
                    "reason": getattr(r, "reason", r.get("reason") if isinstance(r, dict) else "")
                }
                for r in reasons
            ],
            "details": details or {}
        }

        subject = f"FRAUD ALERT: High-Risk Transaction {txn_id} (Score: {total_score}/100)"
        message_body = json.dumps(alert_payload, indent=2)

        dispatch_status = "MOCK_CONSOLE_DISPATCHED"
        message_id = f"msg-{int(datetime.now().timestamp() * 1000)}"

        # 1. Dispatch via AWS SNS (with automatic fallback to mock logging if AWS token invalid/unconfigured)
        if self.sns_client:
            try:
                response = self.sns_client.publish(
                    TopicArn=self.topic_arn,
                    Subject=subject[:100],  # AWS SNS Subject limit is 100 characters
                    Message=message_body
                )
                message_id = response.get("MessageId", message_id)
                dispatch_status = "AWS_SNS_DELIVERED"
                logger.info(f"✅ [AWS SNS] High-risk alert published for {txn_id} to {self.topic_arn}. MessageId: {message_id}")
            except (BotoCoreError, ClientError) as e:
                dispatch_status = "MOCK_SNS_AUTOFALLBACK"
                logger.warning(f"⚠️ [AWS SNS Notice] AWS SNS credentials unauthenticated ({e}). Fallback to active mock alert stream.")
                logger.info(
                    f"\n==================== [ALERT DISPATCH - MOCK SNS STREAM] ====================\n"
                    f"TOPIC ARN : {self.topic_arn}\n"
                    f"SUBJECT   : {subject}\n"
                    f"PAYLOAD   :\n{message_body}\n"
                    f"===========================================================================\n"
                )
        else:
            dispatch_status = "MOCK_SNS_DISPATCHED"
            logger.info(
                f"\n==================== [ALERT DISPATCH - MOCK SNS STREAM] ====================\n"
                f"TOPIC ARN : {self.topic_arn}\n"
                f"SUBJECT   : {subject}\n"
                f"PAYLOAD   :\n{message_body}\n"
                f"===========================================================================\n"
            )

        # 2. Dispatch via AWS SES (if configured and valid recipient provided)
        ses_status = "NOT_CONFIGURED"
        recipient = details.get("recipient_email") if details else None
        if self.ses_client and recipient:
            try:
                ses_response = self.ses_client.send_email(
                    Source=self.source_email,
                    Destination={"ToAddresses": [recipient]},
                    Message={
                        "Subject": {"Data": subject},
                        "Body": {"Text": {"Data": message_body}}
                    }
                )
                ses_status = f"AWS_SES_SENT (MsgId: {ses_response.get('MessageId')})"
                logger.info(f"✅ [AWS SES] Email delivered to {recipient}.")
            except Exception as e:
                ses_status = f"MOCK_SES_FALLBACK ({e})"
                logger.warning(f"[AWS SES Notice] {e}")

        alert_record = {
            "timestamp": now,
            "txn_id": txn_id,
            "total_score": total_score,
            "risk_level": risk_level,
            "status": dispatch_status,
            "ses_status": ses_status,
            "message_id": message_id,
            "topic_arn": self.topic_arn,
            "subject": subject
        }
        self.alert_history.insert(0, alert_record)
        if len(self.alert_history) > 100:
            self.alert_history.pop()

        return alert_record

# Global notifier instance
notifier = FraudAlertNotifier()
