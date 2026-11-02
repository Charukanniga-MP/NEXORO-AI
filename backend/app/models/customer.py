import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, Boolean, DateTime, Integer, Numeric, ForeignKey, JSON
from app.core.database import Base

class Customer(Base):
    __tablename__ = "customers"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    company_id = Column(String(36), ForeignKey("companies.id"), nullable=True)
    
    # Unique sequential Customer ID (e.g., CUST-2026-00001)
    customer_code = Column(String(50), unique=True, index=True, nullable=False)
    
    name = Column(String(255), default="Guest Customer", nullable=False)
    phone = Column(String(50), index=True, nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=True)
    hashed_password = Column(String(255), nullable=True)
    
    # Address details
    address_line1 = Column(String(255), nullable=True)
    address_line2 = Column(String(255), nullable=True)
    city = Column(String(100), default="Chennai")
    state = Column(String(100), default="Tamil Nadu")
    pincode = Column(String(20), default="600001")
    landmark = Column(String(100), nullable=True)
    
    # Preferred language for AI calls & shopping (en, ta, te, ml, kn, hi)
    preferred_language = Column(String(10), default="en")
    
    # Regulatory Consent & Outbound Settings
    consent_for_outbound = Column(Boolean, default=True)
    dnd_opt_out = Column(Boolean, default=False)
    
    # Customer Profile Extra Features
    avatar_url = Column(Text, nullable=True)
    upi_id = Column(String(100), default="user@okhdfcbank", nullable=True)
    wallet_balance = Column(Numeric(10, 2), default=500.00, nullable=True)

    role = Column(String(20), default="CUSTOMER")
    is_active = Column(Boolean, default=True)
    company_name = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)
    tags = Column(JSON, default=lambda: ["Customer"])
    total_calls_count = Column(Integer, default=0)
    total_orders_count = Column(Integer, default=0)
    last_contacted_at = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
