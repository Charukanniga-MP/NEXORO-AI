from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional
import re

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict

class TokenPayload(BaseModel):
    sub: Optional[str] = None
    role: Optional[str] = None

class LoginRequest(BaseModel):
    email: Optional[str] = None
    username_or_email: Optional[str] = None
    username: Optional[str] = None
    password: str
    role: Optional[str] = None
    remember_me: Optional[bool] = False

class CustomerRegisterPortalRequest(BaseModel):
    name: str
    username: Optional[str] = None
    email: str
    phone: str
    password: str
    confirm_password: Optional[str] = None
    preferred_language: Optional[str] = "en"

    @field_validator("phone")
    def validate_10_digits(cls, v):
        digits = re.sub(r'\D', '', str(v))
        if len(digits) == 12 and digits.startswith('91'):
            digits = digits[2:]
        if len(digits) != 10:
            raise ValueError("Mobile number must be exactly 10 digits (e.g. 9876543210)")
        return digits

    @field_validator("email", mode="before")
    def clean_email(cls, v):
        if not v or not str(v).strip():
            raise ValueError("Email is required for customer registration")
        return str(v).strip().lower()

class CustomerLoginPortalRequest(BaseModel):
    identifier: str # Username, 10-digit mobile number, or email
    password: str
    remember_me: Optional[bool] = False

class RegisterRequest(BaseModel):
    email: EmailStr
    username: Optional[str] = None
    password: str
    full_name: str
    phone: Optional[str] = None
    department: Optional[str] = "Customer Support"
    role: Optional[str] = "ADMIN"

class ForgotPasswordRequest(BaseModel):
    email_or_username: str

class ResetPasswordRequest(BaseModel):
    email_or_username: str
    new_password: str
    confirm_new_password: str
    reset_code: Optional[str] = None
