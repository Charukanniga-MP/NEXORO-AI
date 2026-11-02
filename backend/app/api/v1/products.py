from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, asc, func, or_

from app.core.database import get_db
from app.models.product import Product
from app.models.category import Category
from app.schemas.product import (
    ProductCreate,
    ProductUpdate,
    ProductResponse,
    CustomerProductResponse,
    CategoryResponse
)
from app.services.marketplace_service import marketplace_service
from app.services.live_catalog_service import live_catalog_service
from app.services.festival_service import festival_service

router = APIRouter()

# -------------------------------------------------------------------------
# Customer Public Store Endpoints (Strictly Sanitized - Zero 3rd Party Leak)
# -------------------------------------------------------------------------

@router.get("/categories", response_model=List[CategoryResponse])
async def list_categories(db: AsyncSession = Depends(get_db)):
    stmt = select(Category).order_by(Category.name.asc())
    res = await db.execute(stmt)
    categories = res.scalars().all()
    
    # If categories table is empty, auto-populate from marketplace service
    if not categories:
        for cat_data in marketplace_service.CATEGORIES:
            cat = Category(
                name=cat_data["name"],
                slug=cat_data["slug"],
                icon=cat_data["icon"],
                description=cat_data["description"]
            )
            db.add(cat)
        await db.commit()
        res = await db.execute(stmt)
        categories = res.scalars().all()
        
    return categories

@router.get("/festival-offer")
async def get_festival_offer(
    month: Optional[int] = Query(None, description="Month number 1-12 to query festival offer"),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns the active upcoming festival (e.g. Diwali in November),
    active festive discount coupons, and top trending festival deals.
    """
    return await festival_service.get_festival_offer_data(db, month)

@router.get("/public", response_model=List[CustomerProductResponse])
async def list_public_products(
    search: Optional[str] = None,
    category: Optional[str] = None,
    sort_by: Optional[str] = "featured", # featured, price_asc, price_desc, rating
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db)
):
    """
    Public sanitized shopping catalog. Combines products from multiple supplier feeds
    into one unified, independent e-commerce organization storefront.
    Auto-syncs from Live E-Commerce API (DummyJSON) if catalog has few items.
    """
    # 1. Check if DB needs auto-sync from live API
    count_stmt = select(func.count(Product.id))
    count_res = await db.execute(count_stmt)
    total_db_products = count_res.scalar() or 0
    if total_db_products < 80:
        comprehensive = live_catalog_service.get_comprehensive_catalog()
        for item in comprehensive:
            chk = select(Product).where(Product.sku == item["sku"])
            chk_res = await db.execute(chk)
            if not chk_res.scalars().first():
                db.add(Product(**item))
        await db.commit()

    query = select(Product).where(Product.is_active == True)
    
    if search:
        search_term = f"%{search.strip()}%"
        query = query.where(
            or_(
                Product.name.ilike(search_term),
                Product.description.ilike(search_term),
                Product.category.ilike(search_term)
            )
        )
    if category and category.lower() != "all":
        query = query.where(Product.category.ilike(category))
    if min_price is not None:
        query = query.where(Product.price >= min_price)
    if max_price is not None:
        query = query.where(Product.price <= max_price)
        
    if sort_by == "price_asc":
        query = query.order_by(Product.price.asc())
    elif sort_by == "price_desc":
        query = query.order_by(Product.price.desc())
    elif sort_by == "rating":
        query = query.order_by(Product.rating.desc(), Product.reviews_count.desc())
    else:
        query = query.order_by(Product.rating.desc(), Product.name.asc())
        
    query = query.offset(offset).limit(limit)
    res = await db.execute(query)
    products = res.scalars().all()
    return products

@router.get("/public/{product_id}", response_model=CustomerProductResponse)
async def get_public_product(product_id: str, db: AsyncSession = Depends(get_db)):
    stmt = select(Product).where(
        or_(
            Product.id == product_id,
            Product.sku == product_id
        ),
        Product.is_active == True
    )
    res = await db.execute(stmt)
    prod = res.scalars().first()
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found in organization catalog")
    return prod

@router.post("/sync-live-api")
async def sync_live_api_catalog(db: AsyncSession = Depends(get_db)):
    """
    Syncs live products from external public DummyJSON API and category extensions.
    """
    comprehensive = live_catalog_service.get_comprehensive_catalog()
    added = 0
    updated = 0
    for item in comprehensive:
        chk = select(Product).where(Product.sku == item["sku"])
        chk_res = await db.execute(chk)
        existing = chk_res.scalars().first()
        if existing:
            for k, v in item.items():
                setattr(existing, k, v)
            updated += 1
        else:
            db.add(Product(**item))
            added += 1
    await db.commit()
    return {
        "status": "SUCCESS",
        "message": f"Successfully synchronized {added} new products and updated {updated} products across all categories from Live E-Commerce API.",
        "total_catalog_size": added + updated
    }

# -------------------------------------------------------------------------
# Admin & Catalog Management Endpoints
# -------------------------------------------------------------------------

@router.get("", response_model=List[ProductResponse])
async def list_products(
    search: Optional[str] = None,
    category: Optional[str] = None,
    source_marketplace: Optional[str] = None,
    is_active: Optional[bool] = None,
    limit: int = 100,
    offset: int = 0,
    db: AsyncSession = Depends(get_db)
):
    query = select(Product).order_by(Product.name.asc())
    if search:
        query = query.where(Product.name.contains(search) | Product.sku.contains(search))
    if category:
        query = query.where(Product.category == category)
    if source_marketplace:
        query = query.where(Product.source_marketplace == source_marketplace)
    if is_active is not None:
        query = query.where(Product.is_active == is_active)
    query = query.offset(offset).limit(limit)
    res = await db.execute(query)
    return res.scalars().all()

@router.post("", response_model=ProductResponse)
async def create_product(req: ProductCreate, db: AsyncSession = Depends(get_db)):
    stmt = select(Product).where(Product.sku == req.sku)
    res = await db.execute(stmt)
    if res.scalars().first():
        raise HTTPException(status_code=400, detail="Product SKU already exists")

    prod = Product(**req.model_dump())
    db.add(prod)
    await db.commit()
    await db.refresh(prod)
    return prod

@router.post("/sync-marketplaces")
async def sync_marketplaces(db: AsyncSession = Depends(get_db)):
    """
    Synchronizes unified multi-marketplace product feeds (Amazon, Flipkart, Meesho)
    into the database, updating prices and stock.
    """
    curated = marketplace_service.get_curated_catalog()
    added = 0
    updated = 0
    
    for item in curated:
        stmt = select(Product).where(Product.sku == item["sku"])
        res = await db.execute(stmt)
        existing = res.scalars().first()
        
        if existing:
            for k, v in item.items():
                setattr(existing, k, v)
            updated += 1
        else:
            new_prod = Product(**item)
            db.add(new_prod)
            added += 1
            
    await db.commit()
    return {
        "status": "SUCCESS",
        "message": f"Marketplace sync complete. {added} products added, {updated} updated across 16 categories.",
        "categories_covered": len(marketplace_service.CATEGORIES)
    }

@router.get("/{product_id}", response_model=ProductResponse)
async def get_product(product_id: str, db: AsyncSession = Depends(get_db)):
    stmt = select(Product).where(Product.id == product_id)
    res = await db.execute(stmt)
    prod = res.scalars().first()
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")
    return prod

@router.put("/{product_id}", response_model=ProductResponse)
async def update_product(product_id: str, req: ProductUpdate, db: AsyncSession = Depends(get_db)):
    stmt = select(Product).where(Product.id == product_id)
    res = await db.execute(stmt)
    prod = res.scalars().first()
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")

    update_data = req.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        setattr(prod, field, val)

    await db.commit()
    await db.refresh(prod)
    return prod

@router.delete("/{product_id}")
async def delete_product(product_id: str, db: AsyncSession = Depends(get_db)):
    stmt = select(Product).where(Product.id == product_id)
    res = await db.execute(stmt)
    prod = res.scalars().first()
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")
    await db.delete(prod)
    await db.commit()
    return {"status": "DELETED", "product_id": product_id}
