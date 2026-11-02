from typing import Optional, List
from pydantic import BaseModel, field_validator
import re

class CustomerRegisterRequest(BaseModel):
    name: str
    phone: str
    email: Optional[str] = None
    password: str
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = "Chennai"
    state: Optional[str] = "Tamil Nadu"
    pincode: Optional[str] = "600001"
    landmark: Optional[str] = None
    preferred_language: Optional[str] = "en"

    @field_validator("phone")
    def validate_phone(cls, v):
        digits = re.sub(r'\D', '', str(v))
        if len(digits) == 12 and digits.startswith('91'):
            digits = digits[2:]
        if len(digits) != 10:
            raise ValueError("Phone number must be exactly 10 digits (e.g. 9876543210)")
        return digits

    @field_validator("email", mode="before")
    def clean_email(cls, v):
        if not v or not str(v).strip():
            return None
        return str(v).strip().lower()

class CustomerLoginRequest(BaseModel):
    identifier: str # Email or 10-digit Phone
    password: str

class CustomerProfileResponse(BaseModel):
    id: str
    customer_code: str
    name: str
    phone: str
    email: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    landmark: Optional[str] = None
    preferred_language: str
    total_orders_count: int
    avatar_url: Optional[str] = None
    upi_id: Optional[str] = None
    wallet_balance: Optional[float] = 500.0
    pay_later_limit: Optional[float] = 25000.0
    pay_later_available: Optional[float] = 25000.0
    created_at: str

class CustomerAuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    customer: CustomerProfileResponse

class CustomerUpdateProfileRequest(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    landmark: Optional[str] = None
    preferred_language: Optional[str] = None
    avatar_url: Optional[str] = None
    upi_id: Optional[str] = None
