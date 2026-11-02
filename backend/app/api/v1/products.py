from typing import List, Optional, Dict, Any
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
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
from app.services.category_specification_service import category_spec_service

router = APIRouter()

class AskAIProductRequest(BaseModel):
    question: str
    language: Optional[str] = "en"

class AskAIProductResponse(BaseModel):
    answer: str
    language: str
    product_id: str
    product_name: str
    status: str = "SUCCESS"

class AddProductReviewRequest(BaseModel):
    name: str
    rating: int
    title: str
    comment: str

def enrich_product_specs(prod: Product):
    if not prod:
        return
    existing = dict(prod.specifications or {})
    cat = prod.category or "Electronics"
    price_val = float(prod.price)

    # 1. Category-specific specifications
    cat_specs = category_spec_service.get_category_specifications(
        category=cat,
        name=prod.name,
        existing_specs=existing,
        price=price_val
    )
    for k, v in cat_specs.items():
        if k not in existing:
            existing[k] = v

    # 2. Images: if not in specs, ensure image_url is present
    if "images" not in existing or not existing["images"]:
        existing["images"] = [prod.image_url] if prod.image_url else []

    # 3. Warranty & Returns & Certifications
    if "Warranty" not in existing or not existing["Warranty"]:
        existing["Warranty"] = category_spec_service.get_warranty_info(cat, prod.name)
    if "Return Policy" not in existing or not existing["Return Policy"]:
        existing["Return Policy"] = category_spec_service.get_return_policy(cat)
    if "Certifications" not in existing or not existing["Certifications"]:
        existing["Certifications"] = category_spec_service.get_certifications(cat)

    # 4. Authentic Reviews
    if "customer_reviews" not in existing or not existing["customer_reviews"]:
        existing["customer_reviews"] = category_spec_service.get_authentic_reviews(cat, prod.name, prod.rating)

    # 5. Variants
    if "variants" not in existing or not existing["variants"]:
        existing["variants"] = category_spec_service.get_category_variants(cat, price_val, prod.sku, prod.name)

    existing["tax_rate"] = category_spec_service.get_tax_rate(cat)
    existing["colors"] = category_spec_service.get_category_colors(cat)
    prod.specifications = existing

def answer_product_inquiry(product_data: dict, question: str, language: str = "en") -> str:
    name = product_data.get("name", "Product")
    cat = product_data.get("category", "General")
    price = product_data.get("price", 0)
    orig = product_data.get("original_price", price)
    disc = product_data.get("discount_pct", 0)
    stock = product_data.get("stock_quantity", 0)
    specs = product_data.get("specifications", {})
    warranty = specs.get("Warranty", category_spec_service.get_warranty_info(cat, name))
    return_pol = specs.get("Return Policy", category_spec_service.get_return_policy(cat))
    cert = specs.get("Certifications", category_spec_service.get_certifications(cat))
    delivery = product_data.get("delivery_estimate", "2-3 business days")

    q_lower = (question or "").lower()
    lang = (language or "en").lower()[:2]

    # 1. Warranty & Returns
    if any(w in q_lower for w in ["warranty", "guarantee", "return", "replacement", "refund", "ரிட்டர்ன்", "வாரண்டி", "वारंटी", "वापसी"]):
        if lang == "ta":
            return f"'{name}' தயாரிப்பிற்கான உத்தரவாதம்: {warranty}. இதன் ரிட்டர்ன் பாலிசி: {return_pol}."
        elif lang == "hi":
            return f"'{name}' के लिए वारंटी: {warranty}। रिटर्न पॉलिसी: {return_pol}।"
        elif lang == "te":
            return f"'{name}' కోసం వారంటీ: {warranty}. రిటర్న్ పాలసీ: {return_pol}."
        elif lang == "ml":
            return f"'{name}' ന് വേണ്ടിയുള്ള വാറന്റി: {warranty}. റിട്ടേൺ പോളിസി: {return_pol}."
        else:
            return f"The warranty for '{name}' is: {warranty}. Return policy: {return_pol}."

    # 2. Price, Discount, and Offers
    if any(w in q_lower for w in ["price", "cost", "discount", "offer", "விலை", "தள்ளுபடி", "कीमत", "छूट", "ధర"]):
        if lang == "ta":
            return f"'{name}' விற்பனை விலை ₹{price}. அசல் விலை ₹{orig} (தள்ளுபடி {disc}%). கூப்பன் 'DIWALI2026' பயன்படுத்தினால் கூடுதல் 25% தள்ளுபடி கிடைக்கும்."
        elif lang == "hi":
            return f"'{name}' की बिक्री कीमत ₹{price} है। मूल कीमत ₹{orig} है ({disc}% छूट)। चेकआउट पर कूपन 'DIWALI2026' से अतिरिक्त 25% छूट मिलेगी।"
        elif lang == "te":
            return f"'{name}' అమ్మకపు ధర ₹{price}. అసలు ధర ₹{orig} ({disc}% తగ్గింపు). కూపన్ 'DIWALI2026' తో అదనంగా 25% తగ్గింపు పొందండి."
        elif lang == "ml":
            return f"'{name}' ന്റെ വില ₹{price} ആണ് (യഥാർത്ഥ വില ₹{orig}, {disc}% കിഴിവ്). 'DIWALI2026' കൂപ്പൺ ഉപയോഗിച്ച് അധികം 25% കിഴിവ് നേടാം."
        else:
            return f"The selling price for '{name}' is ₹{price} (M.R.P. ₹{orig}, Save {disc}%). You can also apply coupon 'DIWALI2026' for an extra 25% instant festive discount."

    # 3. Stock & Availability
    if any(w in q_lower for w in ["stock", "available", "இருப்பு", "स्टॉक", "లభ్యత", "ലభ്യമാണോ"]):
        if stock > 0:
            if lang == "ta":
                return f"ஆம்! '{name}' தற்போது ஸ்டாக்கில் உள்ளது ({stock} பொருட்கள் உள்ளன). உடனடியாக ஆர்டர் செய்து விரைவு டெலிவரி பெறலாம்."
            elif lang == "hi":
                return f"हाँ! '{name}' वर्तमान में स्टॉक में उपलब्ध है ({stock} यूनिट उपलब्ध हैं)। तुरंत ऑर्डर कर सकते हैं।"
            elif lang == "te":
                return f"అవును! '{name}' ప్రస్తుతం స్టాక్‌లో ఉంది ({stock} యూనిట్లు అందుబాటులో ఉన్నాయి)."
            elif lang == "ml":
                return f"അതെ! '{name}' ഇപ്പോൾ സ്റ്റോക്കിൽ ലഭ്യമാണ് ({stock} എണ്ണം ബാക്കിയുണ്ട്)."
            else:
                return f"Yes, '{name}' is currently In Stock with {stock} units available at our central fulfillment warehouse."
        else:
            if lang == "ta":
                return f"மன்னிக்கவும், '{name}' தற்போது இருப்பில் இல்லை. விரைவில் மீண்டும் கிடைக்கும்."
            elif lang == "hi":
                return f"क्षमा करें, '{name}' वर्तमान में आउट ऑफ स्टॉक है।"
            else:
                return f"Currently '{name}' is Out of Stock. It will be restocked shortly."

    # 4. Specifications & Features
    key_specs = [f"{k}: {v}" for k, v in specs.items() if k not in ["images", "customer_reviews", "variants", "colors", "tax_rate"]][:5]
    specs_summary = ", ".join(key_specs) if key_specs else "Premium Certified Quality"
    if lang == "ta":
        return f"'{name}' இன் முக்கிய விவரக்குறிப்புகள்: {specs_summary}. சான்றிதழ்கள்: {cert}. டெலிவரி: {delivery}."
    elif lang == "hi":
        return f"'{name}' के मुख्य विनिर्देश: {specs_summary}। प्रमाणपत्र: {cert}। डिलीवरी: {delivery}।"
    elif lang == "te":
        return f"'{name}' ముఖ్యమైన ఫీచర్లు: {specs_summary}. సర్టిఫికేషన్: {cert}। డెలివరీ: {delivery}."
    elif lang == "ml":
        return f"'{name}' ന്റെ പ്രധാന സവിശേഷതകൾ: {specs_summary}. സർട്ടിഫിക്കേഷൻ: {cert}। ഡെലിവറി: {delivery}."
    else:
        return f"Key specifications for '{name}': {specs_summary}. Certified under: {cert}. Estimated delivery: {delivery}." 

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
    for p in products:
        enrich_product_specs(p)
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
    enrich_product_specs(prod)
    return prod

@router.post("/public/{product_id}/ask-ai", response_model=AskAIProductResponse)
async def ask_ai_about_product(
    product_id: str,
    req: AskAIProductRequest,
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Product).where(
        or_(Product.id == product_id, Product.sku == product_id),
        Product.is_active == True
    )
    res = await db.execute(stmt)
    prod = res.scalars().first()
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")
    
    enrich_product_specs(prod)
    ans = answer_product_inquiry(
        product_data={
            "name": prod.name,
            "category": prod.category,
            "price": float(prod.price),
            "original_price": float(prod.original_price or prod.price),
            "discount_pct": prod.discount_pct,
            "stock_quantity": prod.stock_quantity,
            "sku": prod.sku,
            "specifications": prod.specifications or {},
            "delivery_estimate": prod.delivery_estimate or "2-3 business days"
        },
        question=req.question,
        language=req.language or "en"
    )
    return AskAIProductResponse(
        answer=ans,
        language=req.language or "en",
        product_id=prod.id,
        product_name=prod.name
    )

@router.post("/public/{product_id}/reviews")
async def add_product_review(
    product_id: str,
    req: AddProductReviewRequest,
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Product).where(
        or_(Product.id == product_id, Product.sku == product_id),
        Product.is_active == True
    )
    res = await db.execute(stmt)
    prod = res.scalars().first()
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")
    
    enrich_product_specs(prod)
    specs = dict(prod.specifications or {})
    revs = list(specs.get("customer_reviews", []))
    new_rev = {
        "id": f"rev-{datetime.utcnow().timestamp()}",
        "name": req.name,
        "rating": req.rating,
        "date": "Today, Verified Customer",
        "title": req.title,
        "comment": req.comment,
        "verified": True,
        "helpfulCount": 1
    }
    revs.insert(0, new_rev)
    specs["customer_reviews"] = revs
    prod.specifications = specs
    prod.reviews_count = (prod.reviews_count or 0) + 1
    all_ratings = [r.get("rating", 5) for r in revs if isinstance(r, dict)]
    if all_ratings:
        prod.rating = round(sum(all_ratings) / len(all_ratings), 1)
    await db.commit()
    await db.refresh(prod)
    return {"status": "SUCCESS", "review": new_rev, "rating": prod.rating, "reviews_count": prod.reviews_count}

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
