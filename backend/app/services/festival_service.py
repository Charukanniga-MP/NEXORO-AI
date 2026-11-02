import logging
from datetime import datetime
from typing import Dict, Any, List, Optional
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_

from app.models.product import Product

logger = logging.getLogger(__name__)

INDIAN_FESTIVALS_CALENDAR = {
    11: {
        "id": "diwali",
        "name": "Diwali Festival of Lights 2026",
        "short_name": "Diwali Dhamaka",
        "month": "November",
        "season_title": "Grand Diwali Festive Mega Sale",
        "greeting": "Happy Diwali & Prosperous New Year! 🪔✨",
        "tagline": "Grand Diwali Dhamaka — Up to 75% OFF + Extra 25% with Code DIWALI2026",
        "subheading": "Light up your celebrations with trending Diwali deals across Electronics, Festive Ethnic Wear, Smart TVs, Dry Fruit Hampers, and Brass Diyas!",
        "coupon_code": "DIWALI2026",
        "coupon_discount_pct": 25,
        "min_order": 499,
        "banner_gradient": "from-amber-600 via-orange-600 to-rose-700",
        "accent_color": "#f59e0b",
        "badge": "🪔 GRAND DIWALI MEGA SALE LIVE",
        "keywords": ["diwali", "festive", "light", "gold", "saree", "kurta", "tv", "speaker", "dry fruit", "sweet", "brass", "pooja", "soundbar", "headphone", "smart", "5g"],
        "target_categories": ["Electronics", "Mobiles and Accessories", "Women's Fashion", "Men's Fashion", "Home Appliances", "Kitchen Products", "Grocery"]
    },
    12: {
        "id": "christmas",
        "name": "Christmas & Year-End Carnival 2026",
        "short_name": "Christmas Mega Offer",
        "month": "December",
        "season_title": "Year-End Festive Celebration",
        "greeting": "Merry Christmas & Season's Greetings! 🎄🎅",
        "tagline": "Holiday Carnival — Up to 70% OFF + Extra 20% with Code XMAS2026",
        "subheading": "Celebrate the holiday season with special gifts, winter electronics, lifestyle gear, and party essentials!",
        "coupon_code": "XMAS2026",
        "coupon_discount_pct": 20,
        "min_order": 499,
        "banner_gradient": "from-emerald-700 via-teal-800 to-rose-800",
        "accent_color": "#10b981",
        "badge": "🎄 CHRISTMAS MEGA CARNIVAL LIVE",
        "keywords": ["christmas", "winter", "jacket", "party", "gift", "smart", "headphone"],
        "target_categories": ["Electronics", "Fashion and Clothing", "Grocery", "Home Appliances"]
    },
    1: {
        "id": "pongal",
        "name": "Pongal & Makar Sankranti Harvest Sale 2027",
        "short_name": "Pongal Mega Sale",
        "month": "January",
        "season_title": "Harvest Festival Special Offers",
        "greeting": "Happy Pongal & Makar Sankranti! 🌾☀️",
        "tagline": "Harvest Mega Offers — Up to 65% OFF + Extra 15% with Code PONGAL2027",
        "subheading": "Celebrate tradition with traditional cookware, fresh pantry goods, festive ethnic wear, and electronics!",
        "coupon_code": "PONGAL2027",
        "coupon_discount_pct": 15,
        "min_order": 499,
        "banner_gradient": "from-yellow-600 via-amber-600 to-orange-700",
        "accent_color": "#eab308",
        "badge": "🌾 PONGAL FESTIVE HARVEST SALE",
        "keywords": ["pongal", "traditional", "cookware", "saree", "dhoti", "sweet"],
        "target_categories": ["Kitchen Products", "Women's Fashion", "Men's Fashion", "Grocery"]
    }
}

# Dedicated high-demand Diwali specialty products
DIWALI_SPECIALTY_PRODUCTS = [
    {
        "sku": "DIWALI-DIYA-001",
        "name": "Handcrafted Solid Brass Peacock Diya Set (Pack of 4)",
        "category": "Kitchen Products",
        "description": "Exquisite traditional brass oil lamps handcrafted by Indian artisans. Perfect for auspicious Diwali Laxmi Pooja and festive home lighting.",
        "price": Decimal("899.00"),
        "original_price": Decimal("1899.00"),
        "discount_pct": 53,
        "currency": "INR",
        "rating": 4.9,
        "reviews_count": 480,
        "image_url": "https://images.unsplash.com/photo-1605371924599-2d0365da1ae0?w=600&auto=format&fit=crop&q=80",
        "stock_quantity": 80,
        "delivery_estimate": "Express Festive Delivery Tomorrow by 1 PM",
        "specifications": {
            "Material": "100% Pure Solid Brass",
            "Height": "6.5 inches",
            "Weight": "450g per Diya",
            "Finish": "Antique Golden Lacquer Polish"
        },
        "source_marketplace": "DIRECT",
        "source_product_id": "DIW-DIYA-99",
        "supplier_cost": Decimal("500.00")
    },
    {
        "sku": "DIWALI-SWEET-002",
        "name": "Royal Kaju Katli & Roasted Dry Fruit Gift Hamper (1kg Box)",
        "category": "Grocery",
        "description": "Luxurious Diwali royal celebration box featuring silver vark pure cashew Kaju Katli, California Almonds, Kashmiri Walnuts, and Roasted Cashews.",
        "price": Decimal("1299.00"),
        "original_price": Decimal("2499.00"),
        "discount_pct": 48,
        "currency": "INR",
        "rating": 4.95,
        "reviews_count": 620,
        "image_url": "https://images.unsplash.com/photo-1599785209707-a456fc1337bb?w=600&auto=format&fit=crop&q=80",
        "stock_quantity": 120,
        "delivery_estimate": "Express Festive Delivery in 24 Hours",
        "specifications": {
            "Contents": "Kaju Katli (500g), Jumbo Almonds (250g), Cashews (250g)",
            "Purity": "100% Pure Ghee & Natural Nuts",
            "Packaging": "Velvet Gold Embossed Gift Box"
        },
        "source_marketplace": "DIRECT",
        "source_product_id": "DIW-HAMPER-01",
        "supplier_cost": Decimal("850.00")
    },
    {
        "sku": "DIWALI-SAREE-003",
        "name": "Pure Banarasi Kanjivaram Silk Zari Woven Saree (Festive Crimson)",
        "category": "Women's Fashion",
        "description": "Opulent festive designer saree in rich crimson red and gold zari border with matching blouse piece. Traditional elegance for Diwali night.",
        "price": Decimal("2799.00"),
        "original_price": Decimal("6999.00"),
        "discount_pct": 60,
        "currency": "INR",
        "rating": 4.88,
        "reviews_count": 395,
        "image_url": "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=600&auto=format&fit=crop&q=80",
        "stock_quantity": 40,
        "delivery_estimate": "Express Delivery Tomorrow",
        "specifications": {
            "Fabric": "Art Silk with Metallic Gold Zari Weave",
            "Length": "6.3 meters (includes blouse)",
            "Care": "Dry Clean Only"
        },
        "source_marketplace": "DIRECT",
        "source_product_id": "DIW-SAREE-44",
        "supplier_cost": Decimal("1600.00")
    },
    {
        "sku": "DIWALI-KURTA-004",
        "name": "Men's Royal Jacquard Embroidered Kurta Pajama with Nehru Jacket",
        "category": "Men's Fashion",
        "description": "Sophisticated 3-piece ethnic celebration set crafted in breathable jacquard silk with mandarin collar and pocket square.",
        "price": Decimal("2199.00"),
        "original_price": Decimal("4999.00"),
        "discount_pct": 56,
        "currency": "INR",
        "rating": 4.82,
        "reviews_count": 290,
        "image_url": "https://images.unsplash.com/photo-1597983073493-88cd35cf93b0?w=600&auto=format&fit=crop&q=80",
        "stock_quantity": 50,
        "delivery_estimate": "Express Delivery Tomorrow",
        "specifications": {
            "Includes": "Silk Kurta, Churidar Pajama, Brocade Nehru Jacket",
            "Fabric": "Jacquard Silk Blend",
            "Fit": "Tailored Regular Fit"
        },
        "source_marketplace": "DIRECT",
        "source_product_id": "DIW-KURTA-21",
        "supplier_cost": Decimal("1250.00")
    },
    {
        "sku": "DIWALI-LIGHT-005",
        "name": "Smart App-Controlled RGBIC Diwali Fairy String Lights (20m)",
        "category": "Home Appliances",
        "description": "Waterproof smart string lights with 200 vibrant LEDs, music sync mode, schedule timers, and 16 million colors controlled via Wi-Fi/Bluetooth.",
        "price": Decimal("1199.00"),
        "original_price": Decimal("2499.00"),
        "discount_pct": 52,
        "currency": "INR",
        "rating": 4.75,
        "reviews_count": 410,
        "image_url": "https://images.unsplash.com/photo-1514517521153-1be72277b32f?w=600&auto=format&fit=crop&q=80",
        "stock_quantity": 90,
        "delivery_estimate": "Delivery Tomorrow",
        "specifications": {
            "Length": "20 Meters (200 LEDs)",
            "Connectivity": "Wi-Fi + BLE + Alexa/Google Assistant",
            "Waterproof": "IP65 Outdoor & Indoor Safe"
        },
        "source_marketplace": "DIRECT",
        "source_product_id": "DIW-LIGHT-88",
        "supplier_cost": Decimal("680.00")
    }
]

class FestivalService:
    """
    Intelligent Festival Detection and Festive Campaign Engine.
    Detects upcoming/current festivals based on calendar/month (e.g. Diwali in November),
    and delivers tailored trending products, festive banner configurations, and coupon incentives.
    """

    def get_active_festival(self, month: Optional[int] = None) -> Dict[str, Any]:
        if not month:
            month = datetime.now().month
        
        # In November (or default), Diwali is the flagship festival
        festival_info = INDIAN_FESTIVALS_CALENDAR.get(month, INDIAN_FESTIVALS_CALENDAR[11])
        return festival_info

    async def get_festival_offer_data(self, db: AsyncSession, month: Optional[int] = None) -> Dict[str, Any]:
        fest = self.get_active_festival(month)

        # 1. Ensure specialty festival products exist in DB
        for item in DIWALI_SPECIALTY_PRODUCTS:
            chk = select(Product).where(Product.sku == item["sku"])
            chk_res = await db.execute(chk)
            if not chk_res.scalars().first():
                db.add(Product(**item))
        await db.commit()

        # 2. Query trending festival products from database
        # Prioritize specialty items and top-rated items in target festive categories
        target_cats = fest.get("target_categories", [])
        stmt = (
            select(Product)
            .where(
                Product.is_active == True,
                or_(
                    Product.sku.startswith("DIWALI-"),
                    Product.category.in_(target_cats)
                )
            )
            .order_by(
                Product.sku.startswith("DIWALI-").desc(),
                Product.rating.desc(),
                Product.reviews_count.desc()
            )
            .limit(12)
        )
        res = await db.execute(stmt)
        trending = res.scalars().all()

        return {
            "festival": fest,
            "trending_products": [
                {
                    "id": p.id,
                    "sku": p.sku,
                    "name": p.name,
                    "category": p.category,
                    "description": p.description,
                    "price": float(p.price),
                    "original_price": float(p.original_price or p.price * Decimal("1.4")),
                    "discount_pct": p.discount_pct or 40,
                    "currency": p.currency,
                    "rating": p.rating,
                    "reviews_count": p.reviews_count,
                    "image_url": p.image_url,
                    "delivery_estimate": p.delivery_estimate,
                    "is_festival_special": p.sku.startswith("DIWALI-") or p.discount_pct >= 45,
                    "festival_badge": "🪔 Diwali Special Deal" if p.sku.startswith("DIWALI-") else f"⚡ {p.discount_pct}% OFF Festive Price"
                }
                for p in trending
            ],
            "upcoming_festivals": [
                {"name": f["name"], "month": f["month"], "tagline": f["tagline"], "coupon": f["coupon_code"]}
                for f in INDIAN_FESTIVALS_CALENDAR.values()
            ]
        }

festival_service = FestivalService()
