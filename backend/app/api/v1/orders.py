import random
from typing import List, Optional, Dict, Any
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func, or_
from datetime import datetime, timedelta

from app.core.database import get_db
from app.models.order import Order
from app.models.customer import Customer
from app.models.cart import Cart
from app.schemas.order import (
    OrderCreate,
    OrderUpdate,
    OrderResponse,
    CheckoutRequest
)
from app.api.deps import get_current_customer, get_current_user
from app.services.ai_calling_agent import ai_calling_agent
from app.services.event_dispatcher import event_dispatcher

router = APIRouter()

async def generate_unique_order_number(db: AsyncSession) -> str:
    """Generates sequential unique Order ID: ORD-2026-00001, ORD-2026-00002..."""
    count_stmt = select(func.count(Order.id))
    res = await db.execute(count_stmt)
    total_count = res.scalar() or 0
    candidate = f"ORD-2026-{total_count + 1:05d}"
    
    while True:
        exists_stmt = select(Order).where(Order.order_number == candidate)
        exists_res = await db.execute(exists_stmt)
        if not exists_res.scalars().first():
            return candidate
        total_count += 1
        candidate = f"ORD-2026-{total_count + 1:05d}"

# -------------------------------------------------------------------------
# Customer Checkout & My Orders Endpoints
# -------------------------------------------------------------------------

@router.post("/checkout", response_model=Dict[str, Any])
async def checkout_cart(
    req: CheckoutRequest,
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db)
):
    """
    Transforms customer's cart into an official order.
    Generates sequential Order ID (ORD-2026-00001).
    If COD: marks confirmed and immediately dispatches the AI Outbound Confirmation Voice Call!
    If Online: generates order ready for payment verification.
    """
    # 1. Fetch Cart
    c_stmt = select(Cart).where(Cart.customer_id == customer.id)
    c_res = await db.execute(c_stmt)
    cart = c_res.scalars().first()
    
    if not cart or not cart.items:
        raise HTTPException(status_code=400, detail="Cannot checkout an empty shopping cart")

    order_number = await generate_unique_order_number(db)
    is_cod = req.payment_method.upper() in ["CASH_ON_DELIVERY", "COD"]
    
    full_address = f"{req.shipping_address}, {req.city}, {req.state} - {req.pincode}"

    order = Order(
        customer_id=customer.id,
        order_number=order_number,
        customer_name=customer.name,
        customer_phone=customer.phone,
        customer_email=customer.email,
        items=list(cart.items),
        subtotal=cart.subtotal,
        delivery_fee=cart.delivery_charge,
        discount_amount=cart.discount,
        coupon_code=cart.coupon_code,
        total_amount=cart.final_amount,
        currency="INR",
        status="ORDER_CONFIRMED" if is_cod else "ORDER_PLACED",
        payment_status="PENDING",
        payment_method=req.payment_method,
        tracking_number=f"TRK-{random.randint(10000000, 99999999)}",
        courier_name="BlueDart Express",
        estimated_delivery=datetime.utcnow() + timedelta(days=3),
        shipping_address=full_address,
        delivery_notes=req.delivery_notes,
        preferred_language=req.preferred_language or customer.preferred_language or "en",
        ai_call_status="PENDING"
    )
    db.add(order)

    # Empty cart after checkout
    cart.items = []
    cart.coupon_code = None
    cart.subtotal = Decimal("0.00")
    cart.delivery_charge = Decimal("0.00")
    cart.discount = Decimal("0.00")
    cart.final_amount = Decimal("0.00")

    await db.commit()
    await db.refresh(order)

    ai_call_result = None
    # 2. If Cash on Delivery, trigger AI Outbound Confirmation Call immediately!
    if is_cod:
        ai_call_result = await event_dispatcher.on_order_created(
            order=order,
            customer=customer,
            db=db,
            simulate_outcome="SUCCESS"
        )

    return {
        "success": True,
        "message": f"Order {order_number} created successfully.",
        "order": {
            "id": order.id,
            "order_number": order.order_number,
            "customer_code": customer.customer_code,
            "total_amount": float(order.total_amount),
            "payment_method": order.payment_method,
            "payment_status": order.payment_status,
            "status": order.status,
            "shipping_address": order.shipping_address,
            "estimated_delivery": order.estimated_delivery.isoformat() if order.estimated_delivery else None,
            "ai_call_status": order.ai_call_status,
            "preferred_language": order.preferred_language
        },
        "ai_call": ai_call_result
    }

@router.get("/my-orders", response_model=List[OrderResponse])
async def get_my_orders(
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Order).where(Order.customer_id == customer.id).order_by(desc(Order.created_at))
    res = await db.execute(stmt)
    return res.scalars().all()

# -------------------------------------------------------------------------
# Admin Order Operations & AI Outbound Calling Trigger
# -------------------------------------------------------------------------

@router.get("", response_model=List[OrderResponse])
async def list_orders(
    status: Optional[str] = None,
    payment_status: Optional[str] = None,
    customer_id: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db)
):
    query = select(Order).order_by(desc(Order.created_at))
    if status:
        query = query.where(Order.status == status)
    if payment_status:
        query = query.where(Order.payment_status == payment_status)
    if customer_id:
        query = query.where(Order.customer_id == customer_id)
    if search:
        query = query.where(
            or_(
                Order.order_number.contains(search),
                Order.customer_name.contains(search),
                Order.customer_phone.contains(search)
            )
        )
    query = query.offset(offset).limit(limit)
    res = await db.execute(query)
    return res.scalars().all()

@router.get("/{order_id}", response_model=OrderResponse)
async def get_order(order_id: str, db: AsyncSession = Depends(get_db)):
    stmt = select(Order).where(or_(Order.id == order_id, Order.order_number == order_id))
    res = await db.execute(stmt)
    order = res.scalars().first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order

@router.post("/{order_id}/trigger-ai-call")
async def trigger_ai_order_call(
    order_id: str,
    outcome: str = Query("CONFIRMED"),
    db: AsyncSession = Depends(get_db)
):
    """
    Manually triggers or retries an automated multilingual AI Voice Calling
    session for a customer order from the Admin Dashboard or Softphone Studio.
    """
    stmt = select(Order).where(or_(Order.id == order_id, Order.order_number == order_id))
    res = await db.execute(stmt)
    order = res.scalars().first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    c_stmt = select(Customer).where(Customer.id == order.customer_id)
    c_res = await db.execute(c_stmt)
    customer = c_res.scalars().first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer associated with order not found")

    call_result = await ai_calling_agent.initiate_order_confirmation_call(
        order=order,
        customer=customer,
        db=db,
        simulate_outcome=outcome
    )
    return call_result

@router.put("/{order_id}", response_model=OrderResponse)
async def update_order(order_id: str, req: OrderUpdate, db: AsyncSession = Depends(get_db)):
    stmt = select(Order).where(or_(Order.id == order_id, Order.order_number == order_id))
    res = await db.execute(stmt)
    order = res.scalars().first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    old_status = order.status
    update_data = req.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        setattr(order, field, val)

    await db.commit()
    await db.refresh(order)

    # Automated Event Detection: Detect order status change and dispatch calls
    if req.status and req.status != old_status:
        c_stmt = select(Customer).where(Customer.id == order.customer_id)
        c_res = await db.execute(c_stmt)
        customer = c_res.scalars().first()
        if customer:
            if order.status in ["ORDER_DELAYED", "DELAYED"]:
                await event_dispatcher.on_order_delayed(order, customer, db)
            elif order.status == "CANCELLED":
                await event_dispatcher.on_order_cancelled(order, customer, db)
            elif order.status == "DELIVERED":
                await event_dispatcher.on_order_delivered(order, customer, db)
            elif order.status in ["ORDER_CONFIRMED", "PROCESSING"]:
                await event_dispatcher.on_order_created(order, customer, db)

    return order
