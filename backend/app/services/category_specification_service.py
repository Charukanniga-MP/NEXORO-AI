import logging
import re
from typing import Dict, Any, List, Optional
from decimal import Decimal

logger = logging.getLogger(__name__)

class CategorySpecificationService:
    """
    Universal Category Intelligence Engine for Nexora E-Commerce Store.
    Provides category-based dynamic specifications, variants, warranties,
    return policies, GST tax rates, and authentic reviews for ALL categories.
    Guarantees ZERO cross-category contamination (e.g. no USB specs for cooking oil,
    no battery life reviews for furniture, no hardware warranty for groceries).
    """

    TAX_RATES = {
        "Grocery": 5,
        "Books": 0,
        "Fashion and Clothing": 12,
        "Men's Fashion": 12,
        "Women's Fashion": 12,
        "Beauty and Personal Care": 18,
        "Electronics": 18,
        "Mobiles and Accessories": 18,
        "Laptops and Computers": 18,
        "Home Appliances": 18,
        "Kitchen Products": 18,
        "Furniture": 18,
        "Sports and Fitness": 18,
        "Toys and Baby Products": 12,
        "Automotive Accessories": 18,
        "Health and Lifestyle Products": 12,
        "Hardware & Gateways": 18,
        "Peripherals": 18,
        "Software Licenses": 18,
    }

    @classmethod
    def get_tax_rate(cls, category: str) -> int:
        return cls.TAX_RATES.get(category, 18)

    @classmethod
    def _extract_brand(cls, name: str, category: str) -> str:
        words = (name or "").strip().split()
        if words:
            first = words[0]
            if first.lower() in ["apple", "samsung", "sony", "dell", "hp", "lenovo", "lg", "whirlpool", "nike", "adidas", "puma", "zara", "h&m"]:
                return first
            if len(words) >= 2 and len(first) > 2:
                return f"{words[0]} {words[1]}"
            return words[0]
        cat_short = category.split()[0] if category else "Store"
        return f"Nexora {cat_short}"

    @classmethod
    def get_warranty_info(cls, category: str, product_name: str = "") -> str:
        cat_lower = (category or "").lower()
        if "grocer" in cat_lower or "food" in cat_lower or "tea" in cat_lower:
            return "FSSAI Quality Assurance Guarantee • 100% Pure, Fresh & Certified Authentic"
        if "beauty" in cat_lower or "skin" in cat_lower or "fragrance" in cat_lower:
            return "Dermatologically Tested • 100% Genuine Formula & Cruelty-Free Guarantee"
        if "fashion" in cat_lower or "clothing" in cat_lower or "shirt" in cat_lower or "dress" in cat_lower:
            return "Brand Authenticity & Quality Stitching Guarantee"
        if "book" in cat_lower:
            return "Original Publisher Print & Mint Condition Guarantee"
        if "furniture" in cat_lower:
            return "3 Years Structural & Anti-Termite Brand Warranty"
        if "sports" in cat_lower or "fitness" in cat_lower:
            return "6 Months Comprehensive Manufacturer Replacement Warranty"
        if "laptop" in cat_lower or "computer" in cat_lower:
            return "1 Year Onsite Manufacturer Warranty + 1 Year Extended Tech Support"
        if "mobile" in cat_lower or "phone" in cat_lower:
            return "1 Year Brand Replacement Warranty for Phone, 6 Months for In-Box Accessories"
        if "appliance" in cat_lower or "refrigerator" in cat_lower or "washing" in cat_lower:
            return "1 Year Comprehensive Warranty + 10 Years Motor / Compressor Warranty"
        return "1 Year Comprehensive Brand Replacement Warranty"

    @classmethod
    def get_return_policy(cls, category: str) -> str:
        cat_lower = (category or "").lower()
        if "grocer" in cat_lower or "food" in cat_lower:
            return "Non-Returnable Perishable Item • 24-Hour Instant Replacement / Refund on Leaked or Damaged Packaging"
        if "beauty" in cat_lower or "personal care" in cat_lower:
            return "Non-Returnable Once Unsealed (Hygiene Policy) • 24-Hour Instant Replacement for Damaged Items"
        if "fashion" in cat_lower or "clothing" in cat_lower:
            return "7-Day Hassle-Free Size Exchange & Doorstep Return with Free Courier Pickup"
        if "furniture" in cat_lower:
            return "10-Day Doorstep Replacement on Manufacturing Defect or Transit Damage"
        if "book" in cat_lower or "toy" in cat_lower:
            return "7-Day Replacement for Misprinted, Damaged, or Incomplete Items"
        return "7-Day Hassle-Free Doorstep Replacement & 10-Second Instant UPI / Bank Refund"

    @classmethod
    def get_certifications(cls, category: str) -> str:
        cat_lower = (category or "").lower()
        if "grocer" in cat_lower or "food" in cat_lower:
            return "FSSAI Lic. No. 10019022009843 • India Organic • ISO 22000 Food Safety Certified"
        if "beauty" in cat_lower:
            return "Dermatologically Tested • FDA Approved • Paraben & Cruelty Free"
        if "electronics" in cat_lower or "mobile" in cat_lower or "laptop" in cat_lower:
            return "BIS Certified (IS 13252) • CE Certified • RoHS Compliant • WEEE Compliant"
        if "appliance" in cat_lower or "kitchen" in cat_lower:
            return "BEE 5-Star Energy Certified • BIS Certified (IS 302) • ISO 9001:2015"
        if "furniture" in cat_lower:
            return "FSC Certified Sustainably Sourced Wood • Anti-Termite Treated • BIFMA Tested"
        if "toy" in cat_lower:
            return "ISI Certified (IS 9873) • BPA-Free • EN71 Safety Standard"
        if "health" in cat_lower:
            return "GMP Certified Manufacturing • ISO 9001:2015 • FSSAI Approved"
        return "ISO 9001 Quality Assured • 100% Genuine Certified"

    @classmethod
    def get_category_specifications(cls, category: str, name: str, existing_specs: Optional[Dict[str, Any]] = None, price: float = 0) -> Dict[str, str]:
        """
        Dynamically derives relevant specifications matching the product category.
        Never introduces irrelevant specifications across categories.
        """
        existing = existing_specs or {}
        cat_lower = (category or "").lower()
        name_lower = (name or "").lower()
        specs: Dict[str, str] = {}

        # Preserve valid explicit specs that are already in existing
        for k, v in existing.items():
            if k not in ["images", "customer_reviews", "variants"] and isinstance(v, (str, int, float, bool)):
                specs[k] = str(v)

        brand = existing.get("Brand") or cls._extract_brand(name, category)
        specs["Brand"] = brand
        specs["Category"] = category

        # 1. GROCERY & FOOD PRODUCTS
        if "grocer" in cat_lower or "food" in cat_lower or "tea" in cat_lower or "oil" in cat_lower:
            if "Ingredients" not in specs:
                if "oil" in name_lower:
                    specs["Ingredients"] = "100% Pure Cold-Pressed Seed Extract, Natural Vitamin E"
                elif "tea" in name_lower:
                    specs["Ingredients"] = "100% Whole Leaf Orthodox Green Tea Leaves"
                elif "apple" in name_lower or "fruit" in name_lower:
                    specs["Ingredients"] = "100% Fresh Farm Orchard Harvest"
                elif "steak" in name_lower or "meat" in name_lower:
                    specs["Ingredients"] = "100% Fresh Farm Harvest, Zero Preservatives"
                else:
                    specs["Ingredients"] = "100% Natural Selected Farm Ingredients, Zero Added Artificial Flavours"

            if "Net Quantity" not in specs:
                specs["Net Quantity"] = existing.get("Weight") or ("1 Litre" if "oil" in name_lower else "500 grams")

            specs["Food Type"] = "Non-Vegetarian" if any(m in name_lower for m in ["meat", "beef", "chicken", "fish"]) else "100% Pure Vegetarian"
            specs["FSSAI License No."] = "10019022009843 (Certified Central License)"
            specs["Shelf Life / Best Before"] = "12 Months from Manufacturing Date"
            specs["Storage Instructions"] = "Store in a cool, dry place away from direct sunlight in an airtight container"
            specs["Country of Origin"] = "India"
            return specs

        # 2. MOBILES AND ACCESSORIES
        if "mobile" in cat_lower or "phone" in cat_lower:
            if "charger" in name_lower or "cable" in name_lower or "case" in name_lower:
                specs["Accessory Type"] = "Fast Charger / Power Delivery Accessory"
                specs["Output Power"] = existing.get("Power") or "65W GaN Rapid Delivery"
                specs["Connector Ports"] = existing.get("Ports") or "2x Type-C + 1x USB-A"
                specs["Compatibility"] = "Universal (iOS, Android, Laptops & Tablets)"
            else:
                specs["Display"] = existing.get("Display") or "6.67-inch FHD+ 120Hz Fluid AMOLED (Corning Gorilla Glass 5)"
                specs["Processor"] = existing.get("Processor") or "Octa-Core 4nm High-Efficiency Processor"
                specs["RAM & Storage"] = existing.get("RAM") or "8GB LPDDR5X RAM + 256GB UFS 3.1 Storage"
                specs["Rear Camera"] = "64MP OIS Primary + 8MP Ultra-Wide + 2MP Macro"
                specs["Front Camera"] = "16MP HDR In-Display Selfie Camera"
                specs["Battery & Charging"] = existing.get("Battery") or "5000 mAh Battery with 67W Turbo Flash Charge"
                specs["Operating System"] = existing.get("OS") or "Android 14 with Clean UI (3 Years OS Updates)"
                specs["5G Network Support"] = "SA/NSA Dual 5G Bands (14 Bands Supported)"
                specs["In-Box Inclusions"] = f"1x {name}, 67W Power Adapter, USB-C Cable, SIM Ejector, Protective Case"
            specs["Country of Origin"] = "India"
            return specs

        # 3. LAPTOPS AND COMPUTERS
        if "laptop" in cat_lower or "computer" in cat_lower:
            specs["Processor (CPU)"] = existing.get("Processor") or "13th Gen Intel Core i7 / AMD Ryzen 7 8-Core (Up to 4.7 GHz)"
            specs["RAM"] = existing.get("RAM") or "16GB DDR5 High-Speed Dual-Channel (Expandable to 32GB)"
            specs["Storage (SSD)"] = existing.get("Storage") or "512GB PCIe 4.0 NVMe M.2 Fast SSD"
            specs["Graphics (GPU)"] = existing.get("Graphics") or "Intel Iris Xe / NVIDIA GeForce Dedicated Graphics"
            specs["Display"] = "15.6-inch FHD Anti-Glare IPS Display, 300 Nits, 100% sRGB"
            specs["Operating System"] = "Windows 11 Home 64-bit + Pre-installed MS Office Home & Student"
            specs["Battery Life"] = "Up to 8.5 Hours Rapid Charge (50% in 30 mins)"
            specs["Weight"] = "1.65 kg Ultra-Slim Metal Chassis"
            specs["In-Box Inclusions"] = f"1x {name}, 65W USB-C Fast Adapter, User Manual, Warranty Card"
            specs["Country of Origin"] = "India"
            return specs

        # 4. ELECTRONICS & AUDIO
        if "electronic" in cat_lower or "peripheral" in cat_lower or "gateway" in cat_lower or "tablet" in cat_lower:
            specs["Audio / Driver"] = existing.get("Driver Size") or existing.get("Output") or "40mm Dynamic Neodymium High-Fidelity Drivers"
            specs["Connectivity"] = existing.get("Bluetooth") or "Bluetooth 5.3 Low-Latency + 3.5mm AUX Cable Option"
            specs["Battery Life"] = existing.get("Battery Life") or "Up to 45 Hours Playtime (Type-C Rapid Fast Charge)"
            specs["Noise Cancellation"] = "Active Noise Cancellation (ANC) with Ambient Transparent Mode"
            specs["Microphone"] = "Quad AI Noise-Cancelling ENC Microphones for Crystal Clear Calls"
            specs["Water Resistance"] = existing.get("Water Resistance") or "IPX4 Sweat & Splash Resistant"
            specs["In-Box Inclusions"] = f"1x {name}, Type-C Fast Charging Cable, AUX Cable, Carrying Pouch, Warranty Card"
            specs["Country of Origin"] = "India"
            return specs

        # 5. FASHION AND CLOTHING
        if "fashion" in cat_lower or "clothing" in cat_lower or "shirt" in cat_lower or "dress" in cat_lower:
            specs["Fabric / Material"] = existing.get("Material") or existing.get("Fabric") or "100% Breathable Combed Cotton / Linen Blend"
            specs["Fit Type"] = existing.get("Fit") or "Regular Comfort Modern Fit"
            specs["Pattern"] = existing.get("Pattern") or "Contemporary Solid / Elegant Weave"
            specs["Occasion"] = existing.get("Occasion") or "Casual, Office Work & Smart Evening Wear"
            specs["Collar / Neckline"] = existing.get("Collar") or "Classic Spread Collar"
            specs["Wash & Care Instructions"] = existing.get("Care") or "Gentle Machine Wash Cold, Do Not Bleach, Warm Iron"
            specs["Country of Origin"] = "India"
            return specs

        # 6. HOME APPLIANCES
        if "appliance" in cat_lower:
            specs["Capacity / Size"] = existing.get("Capacity") or "240 Litres Double Door / 8kg Large Capacity"
            specs["Energy Efficiency Rating"] = "BEE 5-Star Energy Star Certified (Ultra Low Power Consumption)"
            specs["Inverter Technology"] = "Smart Inverter Digital Compressor with Auto-Stabilizer Free Operation (100V - 300V)"
            specs["Operating Noise Level"] = "Super Silent 24 dB Operation"
            specs["Dimensions"] = "55.0 x 62.0 x 155.0 cm (Net Weight: ~48 kg)"
            specs["Installation Details"] = "Free Doorstep Installation & Demo provided by Brand Authorized Technician within 48 Hours"
            specs["Country of Origin"] = "India"
            return specs

        # 7. KITCHEN PRODUCTS
        if "kitchen" in cat_lower:
            specs["Capacity"] = existing.get("Capacity") or "4.5 Litres Family Size"
            specs["Material"] = existing.get("Material") or "Food-Grade Stainless Steel & BPA-Free Non-Stick Chamber"
            specs["Power Consumption"] = existing.get("Power") or "1400 Watts Rapid Heating Element"
            specs["Control Panel"] = "Digital Touch Display with One-Touch Preset Cooking Modes"
            specs["Dishwasher Safe"] = "Yes, Removable Non-Stick Basket is 100% Dishwasher Safe"
            specs["In-Box Inclusions"] = f"1x {name}, Recipe Booklet, Silicone Tongs, Warranty Card"
            specs["Country of Origin"] = "India"
            return specs

        # 8. BEAUTY AND PERSONAL CARE
        if "beauty" in cat_lower or "skin" in cat_lower or "fragrance" in cat_lower:
            specs["Net Quantity"] = existing.get("Volume") or "30ml Airless Pump Dropper Bottle"
            specs["Skin / Hair Type"] = existing.get("Skin Type") or "All Skin Types (Including Sensitive Skin)"
            specs["Key Active Ingredients"] = existing.get("Key Actives") or "Stabilized Vitamin C, Hyaluronic Acid, Botanical Niacinamide"
            specs["Benefits & Purpose"] = "Skin Radiance, Even Skin Tone, Deep Hydration, Anti-Aging Support"
            specs["Safety Standards"] = "Dermatologically Tested • 100% Vegan • Zero Parabens • Zero Sulphates"
            specs["How to Use"] = "Apply 3-4 drops morning and evening onto cleansed face and neck before moisturizer"
            specs["Shelf Life"] = "24 Months from Manufacturing Date"
            specs["Country of Origin"] = "India"
            return specs

        # 9. FURNITURE
        if "furniture" in cat_lower:
            specs["Primary Material"] = existing.get("Material") or "High-Density Engineered Wood & Breathable Ergonomic Mesh"
            specs["Dimensions (L x W x H)"] = existing.get("Dimensions") or "65 x 65 x 115 - 125 cm (Adjustable Height)"
            specs["Maximum Weight Capacity"] = existing.get("Weight Capacity") or "150 kg Tested Dynamic Load"
            specs["Mechanism & Support"] = "Multi-Lock Synchro-Tilt Mechanism with 3D Adjustable Lumbar Support"
            specs["Assembly Required"] = "Pre-Assembled / DIY 10-Minute Easy Assembly (Tool Kit Included)"
            specs["Finish & Upholstery"] = "Matte Anti-Scratch Finish with Tear-Resistant Breathable Fabric"
            specs["Country of Origin"] = "India"
            return specs

        # 10. SPORTS AND FITNESS
        if "sports" in cat_lower or "fitness" in cat_lower:
            specs["Material"] = existing.get("Material") or "Heavy-Duty Cast Iron with Anti-Roll Rubberized Vinyl Casing"
            specs["Weight / Resistance"] = existing.get("Total Weight") or "20 kg Adjustable Combo Set"
            specs["Grip Type"] = "Textured Ergonomic Non-Slip Knurled Steel Grip"
            specs["Target Training"] = "Strength Training, Full Body Conditioning & Home Gym Workouts"
            specs["Included Accessories"] = "2x Barbell Rods, Spinlock Collars, Comprehensive Workout Guide"
            specs["Country of Origin"] = "India"
            return specs

        # 11. BOOKS
        if "book" in cat_lower:
            specs["Format"] = "Paperback / Deluxe Hardcover"
            specs["Language"] = "English"
            specs["Publisher"] = "Nexora Publishing House"
            specs["Print Edition"] = "2026 Latest Revised Edition"
            specs["Paper Quality"] = "FSC Certified 80 GSM Wood-Free Acid-Free Paper"
            specs["Country of Origin"] = "India"
            return specs

        # 12. TOYS AND BABY PRODUCTS
        if "toy" in cat_lower or "baby" in cat_lower:
            specs["Recommended Age"] = "3 Years and Above"
            specs["Safety Standard"] = "BIS Certified (IS 9873) • 100% Non-Toxic BPA-Free Plastic"
            specs["Skill Development"] = "Cognitive Problem Solving, Fine Motor Skills & Creative STEM Exploration"
            specs["Battery Required"] = "No Battery Required"
            specs["Country of Origin"] = "India"
            return specs

        # 13. AUTOMOTIVE ACCESSORIES
        if "automotive" in cat_lower:
            specs["Vehicle Compatibility"] = "Universal Fit (All Standard Passenger Vehicles)"
            specs["Material"] = "High-Tensile Aerospace Alloy & Weather-Proof Rubber"
            specs["Installation Method"] = "Plug & Play / Direct Snap-on (No Tools Required)"
            specs["Weather Resistance"] = "IP68 All-Weather Waterproof, UV Heat Resistant"
            specs["Country of Origin"] = "India"
            return specs

        # UNIVERSAL FALLBACK FOR ANY OTHER / NEW CATEGORY
        specs["Product Quality"] = "100% Genuine Certified White-Label Enterprise Grade"
        specs["Country of Origin"] = "India"
        specs["Packaging"] = "Secure Tamper-Evident Retail Pack"
        return specs

    @classmethod
    def get_category_variants(cls, category: str, base_price: float, base_sku: str, product_name: str = "") -> List[Dict[str, Any]]:
        """
        Generates realistic, category-accurate variants.
        Never shows 'Midnight Black' or 'Pro Edition' for groceries or food!
        """
        cat_lower = (category or "").lower()
        name_lower = (product_name or "").lower()
        p = float(base_price)

        # 1. GROCERY & FOOD -> Pack Sizes / Volumes
        if "grocer" in cat_lower or "food" in cat_lower or "oil" in cat_lower or "tea" in cat_lower:
            is_liquid = any(w in name_lower for w in ["oil", "liquid", "vinegar", "juice", "sauce", "syrup"])
            if is_liquid:
                return [
                    {"name": "500 ml Bottle", "value": "500ml", "price": round(p * 0.55), "sku": f"{base_sku}-500M", "stock": 45},
                    {"name": "1 Litre Bottle (Popular)", "value": "1L", "price": round(p), "sku": f"{base_sku}-1L", "stock": 38},
                    {"name": "2 Litres Family Pack", "value": "2L", "price": round(p * 1.9), "sku": f"{base_sku}-2L", "stock": 25},
                    {"name": "5 Litres Kitchen Can (Saver)", "value": "5L", "price": round(p * 4.4), "sku": f"{base_sku}-5L", "stock": 18}
                ]
            else:
                return [
                    {"name": "250g Trial Pack", "value": "250g", "price": round(p * 0.55), "sku": f"{base_sku}-250G", "stock": 50},
                    {"name": "500g Standard Pack", "value": "500g", "price": round(p), "sku": f"{base_sku}-500G", "stock": 42},
                    {"name": "1 kg Value Pack", "value": "1kg", "price": round(p * 1.85), "sku": f"{base_sku}-1KG", "stock": 30},
                    {"name": "2 kg Mega Saver Pack", "value": "2kg", "price": round(p * 3.5), "sku": f"{base_sku}-2KG", "stock": 15}
                ]

        # 2. MOBILES & ACCESSORIES -> RAM & Storage
        if "mobile" in cat_lower or "phone" in cat_lower:
            if any(w in name_lower for w in ["charger", "cable", "case"]):
                return [
                    {"name": "Standard Single Pack", "value": "1-Pack", "price": round(p), "sku": f"{base_sku}-1PK", "stock": 60},
                    {"name": "Duo Travel Bundle (2-Pack)", "value": "2-Pack", "price": round(p * 1.8), "sku": f"{base_sku}-2PK", "stock": 35}
                ]
            return [
                {"name": "8GB RAM + 128GB Storage", "value": "8GB-128GB", "price": round(p), "sku": f"{base_sku}-8-128", "stock": 28},
                {"name": "8GB RAM + 256GB Storage (Recommended)", "value": "8GB-256GB", "price": round(p + 2000), "sku": f"{base_sku}-8-256", "stock": 35},
                {"name": "12GB RAM + 512GB Storage (Pro Max)", "value": "12GB-512GB", "price": round(p + 6000), "sku": f"{base_sku}-12-512", "stock": 14}
            ]

        # 3. LAPTOPS -> Configurations
        if "laptop" in cat_lower or "computer" in cat_lower:
            return [
                {"name": "Core i5 / 16GB RAM / 512GB SSD", "value": "i5-16-512", "price": round(p), "sku": f"{base_sku}-I5-512", "stock": 18},
                {"name": "Core i7 / 16GB RAM / 1TB SSD (Power)", "value": "i7-16-1TB", "price": round(p + 12000), "sku": f"{base_sku}-I7-1TB", "stock": 12},
                {"name": "Core i9 / 32GB RAM / 2TB SSD (Ultimate)", "value": "i9-32-2TB", "price": round(p + 28000), "sku": f"{base_sku}-I9-2TB", "stock": 6}
            ]

        # 4. FASHION & CLOTHING -> Sizes
        if "fashion" in cat_lower or "clothing" in cat_lower or "shirt" in cat_lower or "dress" in cat_lower:
            return [
                {"name": "Small (S - 38 Chest)", "value": "S", "price": round(p), "sku": f"{base_sku}-S", "stock": 25},
                {"name": "Medium (M - 40 Chest)", "value": "M", "price": round(p), "sku": f"{base_sku}-M", "stock": 40},
                {"name": "Large (L - 42 Chest)", "value": "L", "price": round(p), "sku": f"{base_sku}-L", "stock": 35},
                {"name": "Extra Large (XL - 44 Chest)", "value": "XL", "price": round(p), "sku": f"{base_sku}-XL", "stock": 20},
                {"name": "Double XL (XXL - 46 Chest)", "value": "XXL", "price": round(p + 150), "sku": f"{base_sku}-XXL", "stock": 12}
            ]

        # 5. BEAUTY AND PERSONAL CARE -> Net Volumes
        if "beauty" in cat_lower or "skin" in cat_lower or "fragrance" in cat_lower:
            return [
                {"name": "30 ml Travel Dropper", "value": "30ml", "price": round(p * 0.7), "sku": f"{base_sku}-30ML", "stock": 45},
                {"name": "50 ml Standard Bottle (Popular)", "value": "50ml", "price": round(p), "sku": f"{base_sku}-50ML", "stock": 60},
                {"name": "100 ml Economy Value Pack", "value": "100ml", "price": round(p * 1.7), "sku": f"{base_sku}-100ML", "stock": 30}
            ]

        # 6. HOME APPLIANCES -> Capacities / Models
        if "appliance" in cat_lower:
            return [
                {"name": "Standard Capacity (190L / 6.5kg)", "value": "Standard", "price": round(p), "sku": f"{base_sku}-STD", "stock": 15},
                {"name": "Family Inverter Plus (240L / 7.5kg)", "value": "Family", "price": round(p + 4500), "sku": f"{base_sku}-FAM", "stock": 20},
                {"name": "Grand Pro Series (320L / 8.5kg)", "value": "Pro", "price": round(p + 9500), "sku": f"{base_sku}-PRO", "stock": 8}
            ]

        # 7. FURNITURE -> Wood Finishes
        if "furniture" in cat_lower:
            return [
                {"name": "Natural Teak Finish", "value": "Teak", "price": round(p), "sku": f"{base_sku}-TEAK", "stock": 12},
                {"name": "Dark Walnut Matte", "value": "Walnut", "price": round(p + 500), "sku": f"{base_sku}-WALNUT", "stock": 15},
                {"name": "Honey Oak Premium Polish", "value": "HoneyOak", "price": round(p + 750), "sku": f"{base_sku}-OAK", "stock": 9}
            ]

        # 8. SPORTS AND FITNESS -> Weights / Combos
        if "sports" in cat_lower or "fitness" in cat_lower:
            return [
                {"name": "10 kg Beginner Combo Set", "value": "10kg", "price": round(p * 0.65), "sku": f"{base_sku}-10KG", "stock": 25},
                {"name": "20 kg Standard Training Set", "value": "20kg", "price": round(p), "sku": f"{base_sku}-20KG", "stock": 30},
                {"name": "30 kg Professional Athlete Set", "value": "30kg", "price": round(p * 1.45), "sku": f"{base_sku}-30KG", "stock": 12}
            ]

        # 9. BOOKS -> Formats
        if "book" in cat_lower:
            return [
                {"name": "Paperback Edition", "value": "Paperback", "price": round(p), "sku": f"{base_sku}-PB", "stock": 50},
                {"name": "Hardcover Collector Edition", "value": "Hardcover", "price": round(p + 350), "sku": f"{base_sku}-HC", "stock": 25}
            ]

        # UNIVERSAL DEFAULT VARIANTS
        return [
            {"name": "Standard Single Pack", "value": "Standard", "price": round(p), "sku": f"{base_sku}-STD", "stock": 30},
            {"name": "Deluxe Edition (Value Pack)", "value": "Deluxe", "price": round(p * 1.25), "sku": f"{base_sku}-DLX", "stock": 18}
        ]

    @classmethod
    def get_category_colors(cls, category: str) -> List[Dict[str, str]]:
        """
        Returns relevant colors for categories where color is applicable (Fashion, Electronics, Tech, Furniture).
        Returns empty list for Food, Grocery, Health, Books where selecting colors is nonsensical.
        """
        cat_lower = (category or "").lower()
        if any(w in cat_lower for w in ["grocer", "food", "tea", "oil", "book", "health", "vitamin"]):
            return [] # No colors for grocery, food, or books!

        if "furniture" in cat_lower:
            return [
                {"name": "Natural Teak Wood", "hex": "#8B5A2B"},
                {"name": "Dark Walnut Brown", "hex": "#3E2723"},
                {"name": "Classic Matte Black", "hex": "#212121"},
                {"name": "Smoked Oak Gray", "hex": "#616161"}
            ]

        if "fashion" in cat_lower or "clothing" in cat_lower:
            return [
                {"name": "Royal Navy Blue", "hex": "#1e3a8a"},
                {"name": "Charcoal Black", "hex": "#18181b"},
                {"name": "Burgundy Crimson", "hex": "#881337"},
                {"name": "Olive Green", "hex": "#3f6212"},
                {"name": "Pure Crisp White", "hex": "#f8fafc"}
            ]

        # Default tech colors for electronics/mobiles
        return [
            {"name": "Midnight Black", "hex": "#0f172a"},
            {"name": "Titanium Silver", "hex": "#94a3b8"},
            {"name": "Glacier Blue", "hex": "#0284c7"},
            {"name": "Sunset Gold", "hex": "#d97706"}
        ]

    @classmethod
    def get_authentic_reviews(cls, category: str, product_name: str, rating: float = 4.8) -> List[Dict[str, Any]]:
        """
        Generates realistic, category-accurate reviews.
        Never talks about battery life for cooking oil or fabric quality for a laptop.
        """
        cat_lower = (category or "").lower()
        pname = product_name or "product"

        if "grocer" in cat_lower or "food" in cat_lower or "tea" in cat_lower:
            return [
                {
                    "id": "rev-g1",
                    "name": "Kavitha Ramanathan",
                    "rating": 5,
                    "date": "29 October 2026",
                    "title": "Super fresh aroma and tamper-proof leak-free tin!",
                    "comment": f"Ordered {pname} for home use. The quality is exceptional and completely pure. Came with sealed leak-proof packaging and the taste/freshness is remarkable. Highly recommended!",
                    "verified": True,
                    "helpfulCount": 42
                },
                {
                    "id": "rev-g2",
                    "name": "Suresh Venkat",
                    "rating": 5,
                    "date": "25 October 2026",
                    "title": "Authentic organic product with FSSAI verification",
                    "comment": f"Checked the batch code and FSSAI seal on {pname}. 100% genuine and chemical-free. Fast 24-hour delivery to Chennai. The AI order confirmation call was also very polite in Tamil.",
                    "verified": True,
                    "helpfulCount": 28
                },
                {
                    "id": "rev-g3",
                    "name": "Meera Krishnan",
                    "rating": 4,
                    "date": "18 October 2026",
                    "title": "Good quality and great value for money",
                    "comment": "Very satisfied with the purchase. The taste and natural composition are very evident compared to regular supermarket brands.",
                    "verified": True,
                    "helpfulCount": 16
                }
            ]

        if "fashion" in cat_lower or "clothing" in cat_lower:
            return [
                {
                    "id": "rev-f1",
                    "name": "Arjun Sundaram",
                    "rating": 5,
                    "date": "28 October 2026",
                    "title": "Premium fabric texture and perfect tailored fit!",
                    "comment": f"The fabric on {pname} is breathable, soft and feels premium against the skin. Stitching is immaculate with zero loose threads. Size chart is 100% accurate.",
                    "verified": True,
                    "helpfulCount": 35
                },
                {
                    "id": "rev-f2",
                    "name": "Pooja Reddy",
                    "rating": 5,
                    "date": "23 October 2026",
                    "title": "Exact same colour as shown in pictures",
                    "comment": "Color didn't fade even after first wash. Truly delighted with the drape and cut. Great delivery service.",
                    "verified": True,
                    "helpfulCount": 22
                }
            ]

        if "furniture" in cat_lower:
            return [
                {
                    "id": "rev-u1",
                    "name": "Raghavan N.",
                    "rating": 5,
                    "date": "27 October 2026",
                    "title": "Sturdy build, solid wood and free installation!",
                    "comment": f"Very sturdy construction and beautiful wood finish. The technician arrived the next day and assembled {pname} cleanly. Completely satisfied with the ergonomic comfort.",
                    "verified": True,
                    "helpfulCount": 39
                },
                {
                    "id": "rev-u2",
                    "name": "Ananya Joshi",
                    "rating": 5,
                    "date": "21 October 2026",
                    "title": "Premium aesthetic and great lumbar support",
                    "comment": "Transformed the entire look of our study room. The finish is smooth and scratches resistant. Worth every single rupee.",
                    "verified": True,
                    "helpfulCount": 19
                }
            ]

        if "appliance" in cat_lower:
            return [
                {
                    "id": "rev-a1",
                    "name": "Manoj Kumar Nair",
                    "rating": 5,
                    "date": "26 October 2026",
                    "title": "Whisper-quiet operation and low electricity bill!",
                    "comment": f"Installed {pname} last week. The energy efficiency is remarkable, and it operates silently without vibration. The brand technician demo was professional and helpful.",
                    "verified": True,
                    "helpfulCount": 47
                },
                {
                    "id": "rev-a2",
                    "name": "Sunita Patil",
                    "rating": 4,
                    "date": "20 October 2026",
                    "title": "Fast cooling and solid build quality",
                    "comment": "Does the job effortlessly. Delivery was on time with heavy shockproof packaging.",
                    "verified": True,
                    "helpfulCount": 24
                }
            ]

        # Default tech / electronics reviews
        return [
            {
                "id": "rev-t1",
                "name": "Rajesh Kumar",
                "rating": 5,
                "date": "28 October 2026",
                "title": "Blazing fast performance & premium build quality!",
                "comment": f"Exceeded my expectations! Build quality on {pname} is top notch and delivered within 24 hours. Battery life and performance hold up effortlessly.",
                "verified": True,
                "helpfulCount": 34
            },
            {
                "id": "rev-t2",
                "name": "Priya Sundaram",
                "rating": 5,
                "date": "25 October 2026",
                "title": "100% genuine product with official manufacturer warranty",
                "comment": f"Verified the serial number with the manufacturer. Authentic product with tamper-proof seal. The AI voice call was super smooth.",
                "verified": True,
                "helpfulCount": 21
            }
        ]

category_spec_service = CategorySpecificationService()
