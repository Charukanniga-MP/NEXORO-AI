from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models.order import Order
from app.models.customer import Customer
from app.models.payment import Payment
from app.api.deps import get_current_customer, get_current_user
from app.services.payment_service import payment_service

router = APIRouter()

class CreateGatewayOrderRequest(BaseModel):
    order_id: str

class VerifyPaymentRequest(BaseModel):
    order_id: str
    payment_method: str = "UPI" # UPI, DEBIT_CARD, CREDIT_CARD, NET_BANKING, CASH_ON_DELIVERY
    gateway_payment_id: Optional[str] = None
    gateway_order_id: Optional[str] = None
    gateway_signature: Optional[str] = None
    simulate_call_outcome: Optional[str] = "CONFIRMED" # CONFIRMED, DELIVERY_INQUIRY, CANCEL_REQUESTED

class PaymentResponse(BaseModel):
    id: str
    order_id: str
    customer_id: str
    transaction_id: str
    amount: float
    currency: str
    payment_method: str
    status: str
    gateway_name: str
    gateway_payment_id: Optional[str] = None
    receipt_number: Optional[str] = None
    created_at: str

@router.post("/create-order")
async def create_payment_order(
    req: CreateGatewayOrderRequest,
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Order).where(Order.id == req.order_id, Order.customer_id == customer.id)
    res = await db.execute(stmt)
    order = res.scalars().first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found for current customer")

    gateway_data = await payment_service.initiate_gateway_order(order)
    return gateway_data

@router.post("/verify")
async def verify_payment(
    req: VerifyPaymentRequest,
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Order).where(Order.id == req.order_id, Order.customer_id == customer.id)
    res = await db.execute(stmt)
    order = res.scalars().first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found for current customer")

    result = await payment_service.verify_and_process_payment(
        db=db,
        order=order,
        customer=customer,
        payment_method=req.payment_method,
        gateway_payment_id=req.gateway_payment_id,
        gateway_order_id=req.gateway_order_id,
        gateway_signature=req.gateway_signature
    )
    return result

@router.post("/simulate-failure")
async def simulate_payment_failure(
    order_id: str,
    reason: str = "Bank gateway authorization timeout",
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Order).where(Order.id == order_id, Order.customer_id == customer.id)
    res = await db.execute(stmt)
    order = res.scalars().first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found for current customer")

    result = await payment_service.record_failed_payment(
        db=db,
        order=order,
        customer=customer,
        payment_method=order.payment_method or "UPI",
        error_message=reason
    )
    return result

@router.get("/order/{order_id}")
async def get_order_payments(
    order_id: str,
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Payment).where(Payment.order_id == order_id, Payment.customer_id == customer.id)
    res = await db.execute(stmt)
    payments = res.scalars().all()
    return payments

