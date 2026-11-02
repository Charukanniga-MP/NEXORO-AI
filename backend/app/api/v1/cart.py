from typing import Optional, List, Dict, Any
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models.cart import Cart
from app.models.product import Product
from app.models.customer import Customer
from app.api.deps import get_current_customer

router = APIRouter()

class AddToCartRequest(BaseModel):
    product_id: str
    quantity: int = 1

class UpdateCartItemRequest(BaseModel):
    product_id: str
    quantity: int

class ApplyCouponRequest(BaseModel):
    coupon_code: str

class CartItemResponse(BaseModel):
    product_id: str
    sku: str
    name: str
    image_url: Optional[str] = None
    price: float
    quantity: int
    total: float

class CartResponse(BaseModel):
    items: List[CartItemResponse]
    items_count: int
    subtotal: float
    delivery_charge: float
    discount: float
    coupon_code: Optional[str] = None
    final_amount: float

COUPONS = {
    "WELCOME10": {"type": "PERCENT", "value": 10, "min_order": 500},
    "KHAIRA50": {"type": "FLAT", "value": 50, "min_order": 400},
    "FESTIVE20": {"type": "PERCENT", "value": 20, "min_order": 1000},
    "DIWALI2026": {"type": "PERCENT", "value": 25, "min_order": 499},
    "DIWALI": {"type": "PERCENT", "value": 20, "min_order": 499},
    "DIWALIDHAMAKA": {"type": "FLAT", "value": 250, "min_order": 999},
    "XMAS2026": {"type": "PERCENT", "value": 20, "min_order": 499},
    "PONGAL2027": {"type": "PERCENT", "value": 15, "min_order": 499},
}

def recalculate_cart(cart: Cart) -> CartResponse:
    items = cart.items or []
    subtotal = sum(Decimal(str(item.get("total", 0.0))) for item in items)
    
    # Free delivery above ₹499, otherwise ₹40
    delivery_charge = Decimal("0.00") if subtotal >= 499 or subtotal == 0 else Decimal("40.00")
    
    discount = Decimal("0.00")
    coupon = (cart.coupon_code or "").upper().strip()
    if coupon in COUPONS:
        c_info = COUPONS[coupon]
        if subtotal >= c_info["min_order"]:
            if c_info["type"] == "PERCENT":
                discount = (subtotal * Decimal(str(c_info["value"]))) / Decimal("100")
            elif c_info["type"] == "FLAT":
                discount = Decimal(str(c_info["value"]))
        else:
            cart.coupon_code = None
            
    final_amount = max(Decimal("0.00"), subtotal + delivery_charge - discount)
    
    cart.subtotal = subtotal
    cart.delivery_charge = delivery_charge
    cart.discount = discount
    cart.final_amount = final_amount
    
    return CartResponse(
        items=[
            CartItemResponse(
                product_id=it["product_id"],
                sku=it.get("sku", ""),
                name=it.get("name", ""),
                image_url=it.get("image_url"),
                price=float(it.get("price", 0.0)),
                quantity=it.get("quantity", 1),
                total=float(it.get("total", 0.0))
            ) for it in items
        ],
        items_count=sum(it.get("quantity", 1) for it in items),
        subtotal=float(subtotal),
        delivery_charge=float(delivery_charge),
        discount=float(discount),
        coupon_code=cart.coupon_code,
        final_amount=float(final_amount)
    )

async def get_or_create_cart(customer: Customer, db: AsyncSession) -> Cart:
    stmt = select(Cart).where(Cart.customer_id == customer.id)
    res = await db.execute(stmt)
    cart = res.scalars().first()
    if not cart:
        cart = Cart(customer_id=customer.id, items=[])
        db.add(cart)
        await db.commit()
        await db.refresh(cart)
    return cart

@router.get("", response_model=CartResponse)
async def get_my_cart(
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db)
):
    cart = await get_or_create_cart(customer, db)
    return recalculate_cart(cart)

@router.post("/add", response_model=CartResponse)
async def add_item_to_cart(
    req: AddToCartRequest,
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db)
):
    if req.quantity <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be greater than 0")

    # Fetch product
    p_stmt = select(Product).where(Product.id == req.product_id, Product.is_active == True)
    p_res = await db.execute(p_stmt)
    product = p_res.scalars().first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found or currently unavailable")

    cart = await get_or_create_cart(customer, db)
    current_items = list(cart.items or [])
    
    # Check if already in cart
    found = False
    for it in current_items:
        if it["product_id"] == product.id:
            it["quantity"] += req.quantity
            it["total"] = float(Decimal(str(it["price"])) * it["quantity"])
            found = True
            break
            
    if not found:
        current_items.append({
            "product_id": product.id,
            "sku": product.sku,
            "name": product.name,
            "image_url": product.image_url,
            "price": float(product.price),
            "quantity": req.quantity,
            "total": float(Decimal(str(product.price)) * req.quantity)
        })
        
    cart.items = current_items
    resp = recalculate_cart(cart)
    await db.commit()
    await db.refresh(cart)
    return resp

@router.put("/item", response_model=CartResponse)
async def update_item_quantity(
    req: UpdateCartItemRequest,
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db)
):
    cart = await get_or_create_cart(customer, db)
    current_items = list(cart.items or [])
    
    if req.quantity <= 0:
        # Remove item
        current_items = [it for it in current_items if it["product_id"] != req.product_id]
    else:
        for it in current_items:
            if it["product_id"] == req.product_id:
                it["quantity"] = req.quantity
                it["total"] = float(Decimal(str(it["price"])) * req.quantity)
                break
                
    cart.items = current_items
    resp = recalculate_cart(cart)
    await db.commit()
    await db.refresh(cart)
    return resp

@router.delete("/item/{product_id}", response_model=CartResponse)
async def remove_item_from_cart(
    product_id: str,
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db)
):
    cart = await get_or_create_cart(customer, db)
    current_items = [it for it in (cart.items or []) if it["product_id"] != product_id]
    cart.items = current_items
    resp = recalculate_cart(cart)
    await db.commit()
    await db.refresh(cart)
    return resp

@router.post("/apply-coupon", response_model=CartResponse)
async def apply_coupon(
    req: ApplyCouponRequest,
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db)
):
    coupon = req.coupon_code.upper().strip()
    if coupon not in COUPONS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid coupon code '{coupon}'. Try WELCOME10, KHAIRA50, or FESTIVE20."
        )
        
    cart = await get_or_create_cart(customer, db)
    cart.coupon_code = coupon
    resp = recalculate_cart(cart)
    
    # Check if minimum order met
    c_info = COUPONS[coupon]
    if cart.subtotal < c_info["min_order"]:
        cart.coupon_code = None
        await db.commit()
        raise HTTPException(
            status_code=400,
            detail=f"Coupon '{coupon}' requires a minimum order value of ₹{c_info['min_order']}."
        )
        
    await db.commit()
    await db.refresh(cart)
    return resp

@router.delete("/clear")
async def clear_cart(
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db)
):
    cart = await get_or_create_cart(customer, db)
    cart.items = []
    cart.coupon_code = None
    recalculate_cart(cart)
    await db.commit()
    return {"status": "CLEARED", "message": "Cart has been emptied"}

