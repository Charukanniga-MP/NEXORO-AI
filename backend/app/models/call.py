import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, Integer, Float, Boolean, DateTime, ForeignKey, JSON
from app.core.database import Base

class Call(Base):
    __tablename__ = "calls"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    company_id = Column(String(36), ForeignKey("companies.id"), nullable=True)
    customer_id = Column(String(36), ForeignKey("customers.id"), nullable=True, index=True)
    order_id = Column(String(36), nullable=True, index=True)
    appointment_id = Column(String(36), nullable=True, index=True)
    complaint_id = Column(String(36), nullable=True, index=True)
    payment_id = Column(String(36), nullable=True, index=True)
    agent_id = Column(String(36), ForeignKey("users.id"), nullable=True, index=True)
    agent_name = Column(String(255), nullable=True)
    category = Column(String(100), default="ORDER_CONFIRMATION", index=True)
    call_reason = Column(String(255), nullable=True)
    escalated_to_human = Column(Boolean, default=False)
    
    # INBOUND, OUTBOUND, OUTBOUND_ORDER_CONFIRMATION, CAMPAIGN
    direction = Column(String(50), default="INBOUND")
    call_type = Column(String(50), default="INBOUND", index=True)
    caller_number = Column(String(50), nullable=False)
    receiver_number = Column(String(50), default="+91-80-6000-4400")
    
    # Lifecycle Status:
    # PENDING, INITIATED, RINGING, CONNECTED, COMPLETED, NOT_ANSWERED, FAILED, RETRY_SCHEDULED, ESCALATED, TRANSFERRED
    status = Column(String(50), default="IN_PROGRESS", index=True)
    language = Column(String(10), default="en") # en, ta, te, ml, kn, hi
    detected_languages = Column(JSON, default=lambda: ["en"])
    
    start_time = Column(DateTime, default=datetime.utcnow)
    end_time = Column(DateTime, nullable=True)
    duration_seconds = Column(Integer, default=0)
    latency_ms = Column(Float, default=320.0) # Average voice roundtrip response time
    
    # Transcripts & AI Analysis
    # transcript: list of {"speaker": "customer"|"ai"|"agent", "text": "...", "timestamp": "...", "language": "..."}
    transcript = Column(JSON, default=list)
    summary = Column(Text, nullable=True)
    intent = Column(String(100), default="Order Confirmation")
    sentiment = Column(String(50), default="NEUTRAL") # POSITIVE, NEUTRAL, CONCERNED, FRUSTRATED, URGENT
    outcome = Column(String(100), default="RESOLVED_BY_AI") # CONFIRMED, CANCELLED, ESCALATED, NO_ANSWER
    
    # Order confirmation specific fields
    confirmation_status = Column(String(50), nullable=True) # CONFIRMED, CANCEL_REQUESTED, MODIFICATION_REQUESTED, NOT_ANSWERED
    retry_count = Column(Integer, default=0)
    next_retry_at = Column(DateTime, nullable=True)
    
    # Handoff linkage if transferred
    transferred_to_user_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    recording_url = Column(String(500), nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
