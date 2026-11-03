import logging
import re
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_

from app.core.database import get_db
from app.core.security import verify_password, get_password_hash, create_access_token
from app.models.customer import Customer
from app.models.company import Company
from app.models.user import User
from app.schemas.customer_auth import (
    CustomerRegisterRequest,
    CustomerLoginRequest,
    CustomerAuthResponse,
    CustomerProfileResponse,
    CustomerUpdateProfileRequest
)
from app.api.deps import get_current_customer

logger = logging.getLogger(__name__)
router = APIRouter()

async def generate_unique_customer_code(db: AsyncSession) -> str:
    """Generates sequential unique Customer Code: CUST-2026-00001, CUST-2026-00002..."""
    count_stmt = select(func.count(Customer.id))
    res = await db.execute(count_stmt)
    total_count = res.scalar() or 0
    
    candidate = f"CUST-2026-{total_count + 1:05d}"
    while True:
        exists_stmt = select(Customer).where(Customer.customer_code == candidate)
        exists_res = await db.execute(exists_stmt)
        if not exists_res.scalars().first():
            return candidate
        total_count += 1
        candidate = f"CUST-2026-{total_count + 1:05d}"

def serialize_customer(customer: Customer) -> CustomerProfileResponse:
    clean_p = re.sub(r'\D', '', str(customer.phone or '9840122567'))
    return CustomerProfileResponse(
        id=customer.id,
        customer_code=customer.customer_code or f"CUST-{customer.id[:8].upper()}",
        name=customer.name or "Valued Customer",
        username=getattr(customer, "username", None),
        phone=customer.phone,
        email=customer.email,
        address_line1=customer.address_line1,
        address_line2=customer.address_line2,
        city=customer.city,
        state=customer.state,
        pincode=customer.pincode,
        landmark=customer.landmark,
        preferred_language=customer.preferred_language or "en",
        total_orders_count=customer.total_orders_count or 0,
        avatar_url=getattr(customer, "avatar_url", None),
        upi_id=getattr(customer, "upi_id", None) or f"{clean_p[-10:]}@okhdfcbank",
        wallet_balance=float(getattr(customer, "wallet_balance", 500.0) or 500.0),
        pay_later_limit=25000.0,
        pay_later_available=25000.0,
        created_at=customer.created_at.isoformat() if customer.created_at else datetime.utcnow().isoformat()
    )

@router.post("/register", response_model=CustomerAuthResponse)
async def register_customer(req: CustomerRegisterRequest, db: AsyncSession = Depends(get_db)):
    clean_phone = re.sub(r'\D', '', req.phone.strip())
    if len(clean_phone) == 12 and clean_phone.startswith('91'):
        clean_phone = clean_phone[2:]
    if len(clean_phone) != 10:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mobile number must be exactly 10 digits (e.g. 9876543210)"
        )

    clean_email = req.email.strip().lower() if req.email else None

    # Password match check
    if req.confirm_password and req.password != req.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Passwords do not match. Please verify and try again."
        )

    # Username uniqueness check
    clean_username = req.username.strip() if req.username and req.username.strip() else None
    if clean_username:
        u_un_stmt = select(User).where(func.lower(User.username) == clean_username.lower())
        u_un_res = await db.execute(u_un_stmt)
        if u_un_res.scalars().first():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This username is already taken. Please choose another username."
            )
        c_un_stmt = select(Customer).where(func.lower(Customer.username) == clean_username.lower())
        c_un_res = await db.execute(c_un_stmt)
        if c_un_res.scalars().first():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This username is already taken. Please choose another username."
            )
    else:
        clean_username = clean_email.split('@')[0] if clean_email else f"user_{clean_phone[-4:]}"

    # Check if phone already registered in Customer or User
    phone_stmt = select(Customer).where(or_(Customer.phone == clean_phone, Customer.phone.endswith(clean_phone)))
    phone_res = await db.execute(phone_stmt)
    if phone_res.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A customer with this mobile number is already registered. Please sign in."
        )

    u_phone_stmt = select(User).where(or_(User.phone == clean_phone, User.phone.endswith(clean_phone)))
    u_phone_res = await db.execute(u_phone_stmt)
    if u_phone_res.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this mobile number is already registered. Please sign in."
        )

    # Check if email already registered (if provided)
    if clean_email:
        email_stmt = select(Customer).where(func.lower(Customer.email) == clean_email)
        email_res = await db.execute(email_stmt)
        if email_res.scalars().first():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A customer with this email address is already registered. Please sign in."
            )
        u_email_stmt = select(User).where(func.lower(User.email) == clean_email)
        u_email_res = await db.execute(u_email_stmt)
        if u_email_res.scalars().first():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A user with this email address is already registered. Please sign in."
            )

    # Get primary company ID
    comp_stmt = select(Company)
    comp_res = await db.execute(comp_stmt)
    company = comp_res.scalars().first()

    customer_code = await generate_unique_customer_code(db)
    pwd_hash = get_password_hash(req.password)

    new_customer = Customer(
        company_id=company.id if company else None,
        customer_code=customer_code,
        name=req.name.strip(),
        username=clean_username,
        phone=clean_phone,
        email=clean_email,
        hashed_password=pwd_hash,
        address_line1=req.address_line1,
        address_line2=req.address_line2,
        city=req.city or "Chennai",
        state=req.state or "Tamil Nadu",
        pincode=req.pincode or "600001",
        landmark=req.landmark,
        preferred_language=req.preferred_language or "en",
        role="CUSTOMER",
        is_active=True,
        consent_for_outbound=True,
        dnd_opt_out=False
    )
    db.add(new_customer)

    # Mirror in User table
    user_email = clean_email or f"{clean_phone}@customer.nexora.ai"
    user = User(
        company_id=company.id if company else None,
        username=clean_username,
        email=user_email,
        phone=clean_phone,
        full_name=req.name.strip(),
        hashed_password=pwd_hash,
        role="CUSTOMER",
        department="Customer Portal",
        status="AVAILABLE",
        is_active=True
    )
    db.add(user)

    await db.commit()
    await db.refresh(new_customer)

    # Generate token with CUSTOMER role
    token = create_access_token(subject=new_customer.id, role="CUSTOMER")
    return CustomerAuthResponse(
        access_token=token,
        token_type="bearer",
        customer=serialize_customer(new_customer)
    )

@router.post("/login", response_model=CustomerAuthResponse)
async def login_customer(req: CustomerLoginRequest, db: AsyncSession = Depends(get_db)):
    raw_ident = req.identifier.strip()
    digits = re.sub(r'\D', '', raw_ident)
    is_phone = len(digits) == 10 or (len(digits) == 12 and digits.startswith('91'))
    phone_clean = digits[-10:] if is_phone else ""
    email_clean = raw_ident.lower()

    # Search in Customer table
    c_conds = [
        func.lower(Customer.username) == email_clean,
        func.lower(Customer.email) == email_clean,
        Customer.phone == raw_ident
    ]
    if phone_clean:
        c_conds.extend([
            Customer.phone == phone_clean,
            Customer.phone.endswith(phone_clean)
        ])
    stmt = select(Customer).where(or_(*c_conds))
    res = await db.execute(stmt)
    customer = res.scalars().first()

    # Search in User table
    u_conds = [
        func.lower(User.username) == email_clean,
        func.lower(User.email) == email_clean,
        User.phone == raw_ident
    ]
    if phone_clean:
        u_conds.extend([
            User.phone == phone_clean,
            User.phone.endswith(phone_clean)
        ])
    u_stmt = select(User).where(or_(*u_conds))
    u_res = await db.execute(u_stmt)
    user_match = u_res.scalars().first()

    matched = False
    if customer and customer.hashed_password and verify_password(req.password, customer.hashed_password):
        matched = True
    elif user_match and user_match.hashed_password and verify_password(req.password, user_match.hashed_password):
        matched = True

    if not matched:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid mobile number, username, email, or password."
        )

    # Sync Customer if user was found but Customer was not
    if not customer and user_match:
        code = await generate_unique_customer_code(db)
        customer = Customer(
            id=user_match.id,
            company_id=user_match.company_id,
            customer_code=code,
            name=user_match.full_name,
            username=user_match.username,
            phone=user_match.phone or (phone_clean if phone_clean else "9876543210"),
            email=user_match.email,
            hashed_password=user_match.hashed_password,
            role="CUSTOMER",
            is_active=user_match.is_active,
            preferred_language="en"
        )
        db.add(customer)
        await db.commit()
        await db.refresh(customer)

    if customer and not customer.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This customer account has been deactivated. Please contact support."
        )

    token = create_access_token(subject=customer.id, role="CUSTOMER")
    return CustomerAuthResponse(
        access_token=token,
        token_type="bearer",
        customer=serialize_customer(customer)
    )

@router.get("/me", response_model=CustomerProfileResponse)
async def get_my_profile(customer: Customer = Depends(get_current_customer)):
    return serialize_customer(customer)

@router.put("/profile", response_model=CustomerProfileResponse)
async def update_my_profile(
    req: CustomerUpdateProfileRequest,
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db)
):
    update_data = req.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        if val is not None:
            setattr(customer, field, val)

    await db.commit()
    await db.refresh(customer)
    return serialize_customer(customer)
