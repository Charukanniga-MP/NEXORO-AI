from pydantic import BaseModel, EmailStr
from typing import Optional

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
    password: str
    role: Optional[str] = None
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
