import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    company_id = Column(String(36), ForeignKey("companies.id"), nullable=True)
    username = Column(String(100), unique=True, index=True, nullable=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    phone = Column(String(50), nullable=True)
    extension = Column(String(20), default="101")
    department = Column(String(100), default="Customer Support") # Sales, Support, Billing, Technical, Management
    role = Column(String(50), default="AGENT") # SUPERADMIN, ADMIN, AGENT
    
    # Presence for Live Call Routing & Handoff
    status = Column(String(20), default="AVAILABLE") # AVAILABLE, BUSY, OFFLINE
    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)
    
    avatar_url = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
