import re
import logging
from datetime import datetime, timedelta
from typing import Optional
from pydantic import BaseModel, field_validator
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func

from app.core.database import get_db
from app.core.security import verify_password, get_password_hash, create_access_token
from app.models.user import User
from app.models.company import Company
from app.models.customer import Customer
from app.schemas.auth import LoginRequest, RegisterRequest, Token, ForgotPasswordRequest, ResetPasswordRequest
from app.schemas.user import UserResponse
from app.api.deps import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()

class UserPortalLoginRequest(BaseModel):
    name: str
    email: str
    phone: str
    password: Optional[str] = None

class CustomerRegisterPortalRequest(BaseModel):
    name: str
    email: str
    phone: str
    password: str
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
    identifier: str # 10-digit mobile number or email
    password: str

@router.post("/login", response_model=Token)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    clean_id = (req.username_or_email or req.email or "").strip()
    digits = re.sub(r'\D', '', clean_id)
    is_phone = len(digits) == 10 or (len(digits) == 12 and digits.startswith('91'))
    phone_clean = digits[-10:] if is_phone else clean_id
    email_clean = clean_id.lower()

    # 1. Check in User table by username, email, or phone
    stmt = select(User).where(
        or_(
            User.username == clean_id,
            User.email == email_clean,
            User.phone == phone_clean,
            User.phone == clean_id
        )
    )
    result = await db.execute(stmt)
    user = result.scalars().first()

    # 2. If not found in User, check Customer table
    if not user:
        c_stmt = select(Customer).where(
            or_(
                Customer.email == email_clean,
                Customer.phone == phone_clean,
                Customer.phone == clean_id
            )
        )
        c_res = await db.execute(c_stmt)
        customer = c_res.scalars().first()

        if customer and verify_password(req.password, customer.hashed_password):
            # Sync user record
            comp_stmt = select(Company)
            comp_res = await db.execute(comp_stmt)
            company = comp_res.scalars().first()

            user_email = customer.email or f"{customer.phone}@customer.nexora.ai"
            user = User(
                id=customer.id,
                company_id=company.id if company else None,
                username=customer.email or customer.phone,
                email=user_email,
                phone=customer.phone,
                full_name=customer.name,
                hashed_password=customer.hashed_password,
                role="CUSTOMER",
                department="Customer Portal",
                status="AVAILABLE",
                is_active=True
            )
            db.add(user)
            await db.commit()
            await db.refresh(user)

    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials. Please verify your username/email and password.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Account is disabled")

    access_token = create_access_token(
        subject=user.id,
        role=user.role
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "username": getattr(user, 'username', None) or user.email,
            "full_name": user.full_name,
            "phone": user.phone,
            "role": user.role,
            "department": user.department,
            "status": user.status,
            "extension": user.extension
        }
    }

@router.post("/customer-register", response_model=Token)
async def customer_portal_register(req: CustomerRegisterPortalRequest, db: AsyncSession = Depends(get_db)):
    digits = re.sub(r'\D', '', req.phone.strip())
    if len(digits) == 12 and digits.startswith('91'):
        digits = digits[2:]
    if len(digits) != 10:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mobile number must be exactly 10 digits (e.g. 9876543210)"
        )

    clean_email = req.email.strip().lower()
    clean_name = req.name.strip()

    # Check existing user
    stmt = select(User).where((User.email == clean_email) | (User.phone == digits))
    res = await db.execute(stmt)
    if res.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A customer with this 10-digit mobile number or email is already registered. Please sign in."
        )

    # Check existing customer
    c_stmt = select(Customer).where((Customer.email == clean_email) | (Customer.phone == digits))
    c_res = await db.execute(c_stmt)
    if c_res.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A customer with this 10-digit mobile number or email is already registered. Please sign in."
        )

    comp_stmt = select(Company)
    comp_res = await db.execute(comp_stmt)
    company = comp_res.scalars().first()

    pwd_hash = get_password_hash(req.password)

    # Count for code
    cnt_stmt = select(func.count(Customer.id))
    cnt_res = await db.execute(cnt_stmt)
    cnt = cnt_res.scalar() or 0
    cust_code = f"CUST-2026-{cnt + 1:05d}"

    # 1. Create Customer record
    customer = Customer(
        company_id=company.id if company else None,
        customer_code=cust_code,
        name=clean_name,
        email=clean_email,
        phone=digits,
        hashed_password=pwd_hash,
        preferred_language=req.preferred_language or "en",
        role="CUSTOMER",
        is_active=True,
        consent_for_outbound=True,
        dnd_opt_out=False
    )
    db.add(customer)

    # 2. Create User record
    user = User(
        company_id=company.id if company else None,
        username=clean_email,
        email=clean_email,
        phone=digits,
        full_name=clean_name,
        hashed_password=pwd_hash,
        role="CUSTOMER",
        department="Customer Portal",
        status="AVAILABLE",
        is_active=True
    )
    db.add(user)

    await db.commit()
    await db.refresh(user)

    access_token = create_access_token(subject=user.id, role="CUSTOMER")
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "username": getattr(user, 'username', None) or user.email,
            "full_name": user.full_name,
            "phone": user.phone,
            "role": user.role,
            "department": user.department,
            "status": user.status,
            "extension": user.extension
        }
    }

@router.post("/customer-login", response_model=Token)
async def customer_portal_login(req: CustomerLoginPortalRequest, db: AsyncSession = Depends(get_db)):
    raw_id = req.identifier.strip()
    digits = re.sub(r'\D', '', raw_id)
    is_phone = len(digits) == 10 or (len(digits) == 12 and digits.startswith('91'))
    phone_clean = digits[-10:] if is_phone else raw_id
    email_clean = raw_id.lower()

    # Search in User
    stmt = select(User).where(
        or_(
            User.username == raw_id,
            User.email == email_clean,
            User.phone == phone_clean,
            User.phone == raw_id
        )
    )
    res = await db.execute(stmt)
    user = res.scalars().first()

    # Search in Customer
    if not user:
        c_stmt = select(Customer).where(
            or_(
                Customer.email == email_clean,
                Customer.phone == phone_clean,
                Customer.phone == raw_id
            )
        )
        c_res = await db.execute(c_stmt)
        customer = c_res.scalars().first()

        if customer and verify_password(req.password, customer.hashed_password):
            comp_stmt = select(Company)
            comp_res = await db.execute(comp_stmt)
            company = comp_res.scalars().first()

            user = User(
                id=customer.id,
                company_id=company.id if company else None,
                username=customer.email or customer.phone,
                email=customer.email or f"{customer.phone}@customer.nexora.ai",
                phone=customer.phone,
                full_name=customer.name,
                hashed_password=customer.hashed_password,
                role="CUSTOMER",
                department="Customer Portal",
                status="AVAILABLE",
                is_active=True
            )
            db.add(user)
            await db.commit()
            await db.refresh(user)

    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid 10-digit mobile number/email or password."
        )

    access_token = create_access_token(subject=user.id, role="CUSTOMER")
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "username": getattr(user, 'username', None) or user.email,
            "full_name": user.full_name,
            "phone": user.phone,
            "role": user.role,
            "department": user.department,
            "status": user.status,
            "extension": user.extension
        }
    }

@router.post("/user-login", response_model=Token)
async def user_portal_legacy_login(req: UserPortalLoginRequest, db: AsyncSession = Depends(get_db)):
    cleaned_email = req.email.strip().lower()
    raw_phone = req.phone.strip()
    digits = re.sub(r'\D', '', raw_phone)
    phone_clean = digits[-10:] if len(digits) >= 10 else raw_phone
    cleaned_name = req.name.strip()

    stmt = select(User).where((User.email == cleaned_email) | (User.phone == phone_clean))
    res = await db.execute(stmt)
    user = res.scalars().first()

    comp_stmt = select(Company)
    comp_res = await db.execute(comp_stmt)
    company = comp_res.scalars().first()

    pwd = req.password or "customer"

    if not user:
        user = User(
            company_id=company.id if company else None,
            username=cleaned_email,
            email=cleaned_email,
            hashed_password=get_password_hash(pwd),
            full_name=cleaned_name,
            phone=phone_clean,
            department="Customer Portal",
            role="CUSTOMER",
            status="AVAILABLE",
            is_active=True
        )
        db.add(user)
    else:
        user.full_name = cleaned_name
        user.phone = phone_clean

    cust_stmt = select(Customer).where((Customer.email == cleaned_email) | (Customer.phone == phone_clean))
    cust_res = await db.execute(cust_stmt)
    customer = cust_res.scalars().first()
    if not customer:
        cnt_stmt = select(func.count(Customer.id))
        cnt_res = await db.execute(cnt_stmt)
        cnt = cnt_res.scalar() or 0
        customer = Customer(
            company_id=company.id if company else None,
            customer_code=f"CUST-2026-{cnt + 1:05d}",
            name=cleaned_name,
            email=cleaned_email,
            phone=phone_clean,
            hashed_password=get_password_hash(pwd),
            preferred_language="en",
            role="CUSTOMER",
            is_active=True,
            consent_for_outbound=True,
            dnd_opt_out=False
        )
        db.add(customer)

    await db.commit()
    await db.refresh(user)

    access_token = create_access_token(subject=user.id, role="CUSTOMER")
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "username": getattr(user, 'username', None) or user.email,
            "full_name": user.full_name,
            "phone": user.phone,
            "role": user.role,
            "department": user.department,
            "status": user.status,
            "extension": user.extension
        }
    }

@router.post("/register", response_model=Token)
async def register(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    clean_email = req.email.strip().lower()
    clean_username = req.username.strip() if req.username else clean_email

    stmt = select(User).where((User.email == clean_email) | (User.username == clean_username))
    res = await db.execute(stmt)
    if res.scalars().first():
        raise HTTPException(status_code=400, detail="An account with this email or username is already registered.")

    comp_stmt = select(Company)
    comp_res = await db.execute(comp_stmt)
    company = comp_res.scalars().first()

    new_user = User(
        company_id=company.id if company else None,
        username=clean_username,
        email=clean_email,
        hashed_password=get_password_hash(req.password),
        full_name=req.full_name,
        phone=req.phone,
        department=req.department or "Operations",
        role=req.role or "ADMIN",
        status="AVAILABLE",
        is_active=True,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    access_token = create_access_token(subject=new_user.id, role=new_user.role)
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": new_user.id,
            "email": new_user.email,
            "username": new_user.username,
            "full_name": new_user.full_name,
            "role": new_user.role,
            "department": new_user.department,
            "status": new_user.status,
            "extension": new_user.extension
        }
    }

@router.post("/forgot-password")
async def forgot_password(req: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    clean_id = req.email_or_username.strip()
    digits = re.sub(r'\D', '', clean_id)
    is_phone = len(digits) == 10 or (len(digits) == 12 and digits.startswith('91'))
    phone_clean = digits[-10:] if is_phone else clean_id
    email_clean = clean_id.lower()

    stmt = select(User).where(
        or_(
            User.username == clean_id,
            User.email == email_clean,
            User.phone == phone_clean
        )
    )
    res = await db.execute(stmt)
    user = res.scalars().first()

    if not user:
        c_stmt = select(Customer).where(
            or_(
                Customer.email == email_clean,
                Customer.phone == phone_clean
            )
        )
        c_res = await db.execute(c_stmt)
        user = c_res.scalars().first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No account found with this username, email, or mobile number."
        )

    return {
        "success": True,
        "message": f"Password reset verification code generated for {clean_id}.",
        "reset_code": "NEXORA-8821"
    }

@router.post("/reset-password")
async def reset_password(req: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    if req.new_password != req.confirm_new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Passwords do not match."
        )
    
    clean_id = req.email_or_username.strip()
    digits = re.sub(r'\D', '', clean_id)
    is_phone = len(digits) == 10 or (len(digits) == 12 and digits.startswith('91'))
    phone_clean = digits[-10:] if is_phone else clean_id
    email_clean = clean_id.lower()

    new_hash = get_password_hash(req.new_password)
    found = False

    stmt = select(User).where(
        or_(
            User.username == clean_id,
            User.email == email_clean,
            User.phone == phone_clean
        )
    )
    res = await db.execute(stmt)
    user = res.scalars().first()
    if user:
        user.hashed_password = new_hash
        user.updated_at = datetime.utcnow()
        found = True

    c_stmt = select(Customer).where(
        or_(
            Customer.email == email_clean,
            Customer.phone == phone_clean
        )
    )
    c_res = await db.execute(c_stmt)
    customer = c_res.scalars().first()
    if customer:
        customer.hashed_password = new_hash
        customer.updated_at = datetime.utcnow()
        found = True

    if not found:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found."
        )

    await db.commit()
    return {
        "success": True,
        "message": "Password updated successfully. You can now log in with your new password."
    }

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    if not current_user.created_at:
        current_user.created_at = datetime.utcnow()
    return current_user
