import logging
from datetime import datetime, timedelta
from decimal import Decimal
from sqlalchemy import select, func
from app.core.database import AsyncSessionLocal
from app.core.security import get_password_hash
from app.models.company import Company
from app.models.user import User
from app.models.customer import Customer
from app.models.category import Category
from app.models.product import Product
from app.models.order import Order
from app.models.payment import Payment
from app.models.appointment import Appointment
from app.models.complaint import Complaint
from app.models.knowledge import KnowledgeDoc, KnowledgeChunk
from app.models.call import Call
from app.models.campaign import Campaign, CampaignLead
from app.services.rag_engine import rag_engine
from app.services.marketplace_service import marketplace_service

logger = logging.getLogger(__name__)

async def seed_initial_data():
    """
    Seeds verified enterprise production data for Khaira Company E-Commerce & Voice Automation.
    Ensures categories, unified multi-marketplace products, customers, orders, payments,
    and multilingual outbound confirmation calls exist.
    """
    async with AsyncSessionLocal() as session:
        # 1. Company
        comp_check = await session.execute(select(Company))
        company = comp_check.scalars().first()
        if not company:
            logger.info("Seeding initial company data for Khaira Company...")
            company = Company(
                name="Khaira Company",
                industry="Unified E-Commerce & Autonomous Multilingual AI Voice Platform",
                phone="+91-80-6000-4400",
                email="support@khairacompany.example",
                address="Khaira Towers, 45 Central Expressway, Tech Corridor, Chennai, TN 600096",
                receptionist_name="Khaira AI",
                default_language="en",
                supported_languages=["en", "ta", "te", "ml", "kn", "hi"],
                greeting_template="Welcome to Khaira Company! My name is Khaira AI, your autonomous voice assistant. How may I assist you today?",
                handoff_phone="+91-80-6000-4499",
                auto_handoff_on_low_confidence=True,
                confidence_threshold="0.65",
                telephony_mode="browser_simulated"
            )
            session.add(company)
            await session.flush()
        else:
            if company.name != "Khaira Company":
                company.name = "Khaira Company"
                company.receptionist_name = "Khaira AI"
                company.supported_languages = ["en", "ta", "te", "ml", "kn", "hi"]
                await session.flush()

        # 2. Admin, Agent & Demo Customer Accounts
        admin_khaira_check = await session.execute(select(User).where(User.email == "admin@khairacompany.com"))
        admin_khaira = admin_khaira_check.scalars().first()
        if not admin_khaira:
            admin_user = User(
                company_id=company.id,
                email="admin@khairacompany.com",
                hashed_password=get_password_hash("admin"),
                full_name="Rajesh Khaira (Executive Administrator)",
                phone="+91-80-6000-4401",
                extension="100",
                department="Executive Operations",
                role="ADMIN",
                status="AVAILABLE",
                is_superuser=True
            )
            session.add(admin_user)
        else:
            admin_khaira.hashed_password = get_password_hash("admin")
            admin_khaira.role = "ADMIN"

        admin_nexora_check = await session.execute(select(User).where(User.email == "admin@nexora.ai"))
        admin_legacy = admin_nexora_check.scalars().first()
        if not admin_legacy:
            admin_legacy = User(
                company_id=company.id,
                email="admin@nexora.ai",
                hashed_password=get_password_hash("admin"),
                full_name="Alex Mercer (Administrator)",
                phone="9876543201",
                extension="104",
                department="Operations & IT",
                role="ADMIN",
                status="AVAILABLE",
                is_superuser=True
            )
            session.add(admin_legacy)
        else:
            admin_legacy.hashed_password = get_password_hash("admin")
            admin_legacy.role = "ADMIN"
            admin_legacy.is_active = True

        agent_nexora_check = await session.execute(select(User).where(User.email == "agent@nexora.ai"))
        agent_legacy = agent_nexora_check.scalars().first()
        if not agent_legacy:
            agent_legacy = User(
                company_id=company.id,
                username="agent",
                email="agent@nexora.ai",
                hashed_password=get_password_hash("agent"),
                full_name="Sarah Jenkins (AI Agent Specialist)",
                phone="+91-80-6000-4402",
                extension="102",
                department="Order Fulfillment & Dispatch",
                role="AGENT",
                status="AVAILABLE",
                is_superuser=False
            )
            session.add(agent_legacy)
        else:
            agent_legacy.hashed_password = get_password_hash("agent")
            agent_legacy.full_name = "Sarah Jenkins (AI Agent Specialist)"
            agent_legacy.username = "agent"
            agent_legacy.role = "AGENT"
            agent_legacy.department = "Order Fulfillment & Dispatch"
            agent_legacy.is_active = True

        agent_karthik_check = await session.execute(select(User).where(User.email == "karthik.rajan@nexora.ai"))
        agent_karthik = agent_karthik_check.scalars().first()
        if not agent_karthik:
            agent_karthik = User(
                company_id=company.id,
                username="karthik",
                email="karthik.rajan@nexora.ai",
                hashed_password=get_password_hash("agent"),
                full_name="Karthik Rajan (Regional Tamil Specialist)",
                phone="+91-80-6000-4403",
                extension="103",
                department="Tamil Voice Operations",
                role="AGENT",
                status="AVAILABLE",
                is_superuser=False
            )
            session.add(agent_karthik)

        agent_priya_check = await session.execute(select(User).where(User.email == "priya.sharma@nexora.ai"))
        agent_priya = agent_priya_check.scalars().first()
        if not agent_priya:
            agent_priya = User(
                company_id=company.id,
                username="priya",
                email="priya.sharma@nexora.ai",
                hashed_password=get_password_hash("agent"),
                full_name="Priya Sharma (Payment & Billing Specialist)",
                phone="+91-80-6000-4404",
                extension="104",
                department="Payments & Billing Solutions",
                role="AGENT",
                status="AVAILABLE",
                is_superuser=False
            )
            session.add(agent_priya)

        agent_vikram_check = await session.execute(select(User).where(User.email == "vikram.malhotra@nexora.ai"))
        agent_vikram = agent_vikram_check.scalars().first()
        if not agent_vikram:
            agent_vikram = User(
                company_id=company.id,
                username="vikram",
                email="vikram.malhotra@nexora.ai",
                hashed_password=get_password_hash("agent"),
                full_name="Vikram Malhotra (Senior Resolutions Manager)",
                phone="+91-80-6000-4405",
                extension="105",
                department="Executive Escalations & Complaints",
                role="AGENT",
                status="AVAILABLE",
                is_superuser=False
            )
            session.add(agent_vikram)

        demo_cust_check = await session.execute(select(User).where(User.email == "john.miller@example.com"))
        demo_cust_user = demo_cust_check.scalars().first()
        if not demo_cust_user:
            demo_cust_user = User(
                company_id=company.id,
                email="john.miller@example.com",
                hashed_password=get_password_hash("customer"),
                full_name="John Miller",
                phone="9876543210",
                extension="201",
                department="Customer Portal",
                role="CUSTOMER",
                status="AVAILABLE",
                is_superuser=False
            )
            session.add(demo_cust_user)
        else:
            demo_cust_user.hashed_password = get_password_hash("customer")
            demo_cust_user.phone = "9876543210"
            demo_cust_user.role = "CUSTOMER"
            demo_cust_user.is_active = True
        await session.flush()

        # 3. Categories (16 wide categories)
        cat_count_res = await session.execute(select(func.count(Category.id)))
        if (cat_count_res.scalar() or 0) < len(marketplace_service.CATEGORIES):
            for cat_data in marketplace_service.CATEGORIES:
                existing_cat = await session.execute(select(Category).where(Category.slug == cat_data["slug"]))
                if not existing_cat.scalars().first():
                    cat = Category(
                        name=cat_data["name"],
                        slug=cat_data["slug"],
                        icon=cat_data["icon"],
                        description=cat_data["description"]
                    )
                    session.add(cat)
            await session.flush()

        # 4. Multi-Marketplace Products (White-Labeled Unified Catalog)
        prod_count_res = await session.execute(select(func.count(Product.id)))
        if (prod_count_res.scalar() or 0) < 10:
            for item in marketplace_service.get_curated_catalog():
                p_check = await session.execute(select(Product).where(Product.sku == item["sku"]))
                if not p_check.scalars().first():
                    prod = Product(company_id=company.id, **item)
                    session.add(prod)
            await session.flush()

        # 5. Customers with Sequential Customer Codes (CUST-2026-00001, etc.)
        cust_check = await session.execute(select(Customer))
        existing_customers = cust_check.scalars().all()
        
        c1 = None
        c2 = None
        c3 = None
        c4 = None
        c5 = None

        if not existing_customers:
            c1 = Customer(
                company_id=company.id,
                customer_code="CUST-2026-00001",
                name="Ananya Sharma",
                phone="+91-98401-23456",
                email="ananya.sharma@example.com",
                hashed_password=get_password_hash("Customer@123"),
                address_line1="12 Anna Salai, T. Nagar",
                city="Chennai",
                state="Tamil Nadu",
                pincode="600017",
                preferred_language="ta",
                role="CUSTOMER",
                is_active=True,
                consent_for_outbound=True,
                total_calls_count=2,
                total_orders_count=1
            )
            c2 = Customer(
                company_id=company.id,
                customer_code="CUST-2026-00002",
                name="Vikramaditya Reddy",
                phone="+91-94401-87654",
                email="vikram.reddy@example.com",
                hashed_password=get_password_hash("Customer@123"),
                address_line1="45 Jubilee Hills, Road No 36",
                city="Hyderabad",
                state="Telangana",
                pincode="500033",
                preferred_language="te",
                role="CUSTOMER",
                is_active=True,
                consent_for_outbound=True,
                total_calls_count=1,
                total_orders_count=1
            )
            c3 = Customer(
                company_id=company.id,
                customer_code="CUST-2026-00003",
                name="Rahul Nair",
                phone="+91-94471-12345",
                email="rahul.nair@example.com",
                hashed_password=get_password_hash("Customer@123"),
                address_line1="78 Marine Drive, Ernakulam",
                city="Kochi",
                state="Kerala",
                pincode="682011",
                preferred_language="ml",
                role="CUSTOMER",
                is_active=True,
                consent_for_outbound=True,
                total_calls_count=1,
                total_orders_count=1
            )
            c4 = Customer(
                company_id=company.id,
                customer_code="CUST-2026-00004",
                name="Priya Gowda",
                phone="+91-98801-65432",
                email="priya.gowda@example.com",
                hashed_password=get_password_hash("Customer@123"),
                address_line1="89 Indiranagar 100ft Road",
                city="Bengaluru",
                state="Karnataka",
                pincode="560038",
                preferred_language="kn",
                role="CUSTOMER",
                is_active=True,
                consent_for_outbound=True,
                total_calls_count=1,
                total_orders_count=1
            )
            c5 = Customer(
                company_id=company.id,
                customer_code="CUST-2026-00005",
                name="Arjun Kapoor",
                phone="+91-98111-54321",
                email="arjun.kapoor@example.com",
                hashed_password=get_password_hash("Customer@123"),
                address_line1="102 Connaught Place",
                city="New Delhi",
                state="Delhi",
                pincode="110001",
                preferred_language="en",
                role="CUSTOMER",
                is_active=True,
                consent_for_outbound=True,
                total_calls_count=1,
                total_orders_count=1
            )
            session.add_all([c1, c2, c3, c4, c5])
            await session.flush()
        else:
            # Ensure existing customers have customer_code
            for idx, c in enumerate(existing_customers):
                if not c.customer_code:
                    c.customer_code = f"CUST-2026-{idx+1:05d}"
                if not c.hashed_password:
                    c.hashed_password = get_password_hash("Customer@123")
            await session.flush()
            c1 = existing_customers[0]
            c2 = existing_customers[1] if len(existing_customers) > 1 else c1
            c3 = existing_customers[2] if len(existing_customers) > 2 else c1
            c4 = existing_customers[3] if len(existing_customers) > 3 else c1
            c5 = existing_customers[4] if len(existing_customers) > 4 else c1

        # 6. Orders (ORD-2026-00001, etc.)
        order_count_res = await session.execute(select(func.count(Order.id)))
        if (order_count_res.scalar() or 0) < 3:
            ord1 = Order(
                company_id=company.id,
                customer_id=c1.id,
                order_number="ORD-2026-00001",
                customer_name=c1.name,
                customer_phone=c1.phone,
                customer_email=c1.email,
                items=[{
                    "sku": "ELE-ANC-001",
                    "name": "AuraWave Pro ANC Wireless Headphones",
                    "quantity": 1,
                    "unit_price": 2499.00,
                    "total": 2499.00
                }],
                subtotal=Decimal("2499.00"),
                delivery_fee=Decimal("0.00"),
                discount_amount=Decimal("0.00"),
                total_amount=Decimal("2499.00"),
                currency="INR",
                status="ORDER_CONFIRMED",
                payment_status="PAID",
                payment_method="UPI",
                transaction_id="TXN-2026-00001",
                tracking_number="TRK-88192019",
                courier_name="BlueDart Express",
                estimated_delivery=datetime.utcnow() + timedelta(days=2),
                shipping_address=f"{c1.address_line1}, {c1.city}, {c1.state} - {c1.pincode}",
                ai_call_status="COMPLETED",
                customer_confirmed=True,
                preferred_language="ta",
                ai_call_summary="வாடிக்கையாளர் Ananya Sharma ஆர்டர் ORD-2026-00001-ஐ உறுதிப்படுத்தினார். டெலிவரி முகவரி சரிபார்க்கப்பட்டது."
            )
            ord2 = Order(
                company_id=company.id,
                customer_id=c2.id,
                order_number="ORD-2026-00002",
                customer_name=c2.name,
                customer_phone=c2.phone,
                customer_email=c2.email,
                items=[{
                    "sku": "KIT-FRY-001",
                    "name": "CrispChef 4.5L Digital Air Fryer",
                    "quantity": 1,
                    "unit_price": 3899.00,
                    "total": 3899.00
                }],
                subtotal=Decimal("3899.00"),
                delivery_fee=Decimal("0.00"),
                discount_amount=Decimal("0.00"),
                total_amount=Decimal("3899.00"),
                currency="INR",
                status="ORDER_CONFIRMED",
                payment_status="PAID",
                payment_method="CREDIT_CARD",
                transaction_id="TXN-2026-00002",
                tracking_number="TRK-99201928",
                courier_name="BlueDart Express",
                estimated_delivery=datetime.utcnow() + timedelta(days=2),
                shipping_address=f"{c2.address_line1}, {c2.city}, {c2.state} - {c2.pincode}",
                ai_call_status="COMPLETED",
                customer_confirmed=True,
                preferred_language="te",
                ai_call_summary="కస్టమర్ Vikramaditya Reddy ఆర్డర్ ORD-2026-00002ని ధృవీకరించారు. డెలివరీ చిరునామా సరిచూడబడింది."
            )
            ord3 = Order(
                company_id=company.id,
                customer_id=c4.id,
                order_number="ORD-2026-00003",
                customer_name=c4.name,
                customer_phone=c4.phone,
                customer_email=c4.email,
                items=[{
                    "sku": "MOB-FLG-001",
                    "name": "NeoZenith Ultra 5G (8GB RAM / 256GB Storage)",
                    "quantity": 1,
                    "unit_price": 21999.00,
                    "total": 21999.00
                }],
                subtotal=Decimal("21999.00"),
                delivery_fee=Decimal("0.00"),
                discount_amount=Decimal("1000.00"),
                coupon_code="FESTIVE20",
                total_amount=Decimal("20999.00"),
                currency="INR",
                status="ORDER_CONFIRMED",
                payment_status="PAID",
                payment_method="UPI",
                transaction_id="TXN-2026-00003",
                tracking_number="TRK-77182910",
                courier_name="BlueDart Express",
                estimated_delivery=datetime.utcnow() + timedelta(days=2),
                shipping_address=f"{c4.address_line1}, {c4.city}, {c4.state} - {c4.pincode}",
                ai_call_status="COMPLETED",
                customer_confirmed=True,
                preferred_language="kn",
                ai_call_summary="ಗ್ರಾಹಕ Priya Gowda ಆರ್ಡರ್ ORD-2026-00003 ಅನ್ನು ದೃಢಪಡಿಸಿದರು. ವಿಳಾಸವನ್ನು ಪರಿಶೀಲಿಸಲಾಗಿದೆ."
            )
            session.add_all([ord1, ord2, ord3])
            await session.flush()

            # 7. AI Outbound Calls
            call1 = Call(
                company_id=company.id,
                customer_id=c1.id,
                order_id=ord1.id,
                direction="OUTBOUND",
                call_type="OUTBOUND_ORDER_CONFIRMATION",
                caller_number="+91-80-6000-4400",
                receiver_number=c1.phone,
                status="COMPLETED",
                language="ta",
                duration_seconds=36,
                latency_ms=270.0,
                intent="Order Confirmation",
                sentiment="POSITIVE",
                outcome="CONFIRMED",
                confirmation_status="CONFIRMED",
                summary=ord1.ai_call_summary,
                transcript=[
                    {"speaker": "ai", "text": "வணக்கம் Ananya Sharma! எங்கள் நிறுவனத்திற்கு உங்களை அன்புடன் வரவேற்கிறோம். உங்கள் ஆர்டர் ORD-2026-00001 பெறப்பட்டது.", "timestamp": datetime.utcnow().isoformat(), "language": "ta"},
                    {"speaker": "customer", "text": "ஆம், ஆர்டரை உறுதி செய்து அனுப்புங்கள்.", "timestamp": datetime.utcnow().isoformat(), "language": "ta"},
                    {"speaker": "ai", "text": "மிக்க நன்றி! விரைவில் பார்சல் அனுப்பி வைக்கப்படும்.", "timestamp": datetime.utcnow().isoformat(), "language": "ta"}
                ]
            )
            call2 = Call(
                company_id=company.id,
                customer_id=c2.id,
                order_id=ord2.id,
                direction="OUTBOUND",
                call_type="OUTBOUND_ORDER_CONFIRMATION",
                caller_number="+91-80-6000-4400",
                receiver_number=c2.phone,
                status="COMPLETED",
                language="te",
                duration_seconds=42,
                latency_ms=280.0,
                intent="Order Confirmation",
                sentiment="POSITIVE",
                outcome="CONFIRMED",
                confirmation_status="CONFIRMED",
                summary=ord2.ai_call_summary,
                transcript=[
                    {"speaker": "ai", "text": "నమస్కారం Vikramaditya Reddy! మా సంస్థకు స్వాగతం. మీ ఆర్డర్ ORD-2026-00002 నమోదైంది.", "timestamp": datetime.utcnow().isoformat(), "language": "te"},
                    {"speaker": "customer", "text": "అవును, కన్ఫర్మ్ చేయండి.", "timestamp": datetime.utcnow().isoformat(), "language": "te"},
                    {"speaker": "ai", "text": "చాలా ధన్యవాదాలు! రెండు రోజుల్లో డెలివరీ చేయబడుతుంది.", "timestamp": datetime.utcnow().isoformat(), "language": "te"}
                ]
            )
            call3 = Call(
                company_id=company.id,
                customer_id=c4.id,
                order_id=ord3.id,
                direction="OUTBOUND",
                call_type="OUTBOUND_ORDER_CONFIRMATION",
                caller_number="+91-80-6000-4400",
                receiver_number=c4.phone,
                status="COMPLETED",
                language="kn",
                duration_seconds=39,
                latency_ms=275.0,
                intent="Order Confirmation",
                sentiment="POSITIVE",
                outcome="CONFIRMED",
                confirmation_status="CONFIRMED",
                summary=ord3.ai_call_summary,
                transcript=[
                    {"speaker": "ai", "text": "ನಮಸ್ಕಾರ Priya Gowda! ನಮ್ಮ ಸಂಸ್ಥೆಗೆ ಸ್ವಾಗತ. ನಿಮ್ಮ ಆರ್ಡರ್ ORD-2026-00003 ಸ್ವೀಕರಿಸಲಾಗಿದೆ.", "timestamp": datetime.utcnow().isoformat(), "language": "kn"},
                    {"speaker": "customer", "text": "ಹೌದು, ದೃಢೀಕರಿಸಿ ಕಳುಹಿಸಿ.", "timestamp": datetime.utcnow().isoformat(), "language": "kn"},
                    {"speaker": "ai", "text": "ತುಂಬಾ ಧನ್ಯವಾದಗಳು! ಶೀಘ್ರದಲ್ಲೇ ಡೆಲಿವರಿ ಆಗಲಿದೆ.", "timestamp": datetime.utcnow().isoformat(), "language": "kn"}
                ]
            )
            session.add_all([call1, call2, call3])
            await session.flush()

            ord1.ai_call_id = call1.id
            ord2.ai_call_id = call2.id
            ord3.ai_call_id = call3.id

            # 8. Payments
            pay1 = Payment(
                order_id=ord1.id,
                customer_id=c1.id,
                transaction_id="TXN-2026-00001",
                amount=ord1.total_amount,
                currency="INR",
                payment_method="UPI",
                status="SUCCESS",
                gateway_name="RAZORPAY",
                gateway_payment_id="pay_khaira_001",
                receipt_number="RCP-ORD-2026-00001"
            )
            pay2 = Payment(
                order_id=ord2.id,
                customer_id=c2.id,
                transaction_id="TXN-2026-00002",
                amount=ord2.total_amount,
                currency="INR",
                payment_method="CREDIT_CARD",
                status="SUCCESS",
                gateway_name="RAZORPAY",
                gateway_payment_id="pay_khaira_002",
                receipt_number="RCP-ORD-2026-00002"
            )
            pay3 = Payment(
                order_id=ord3.id,
                customer_id=c4.id,
                transaction_id="TXN-2026-00003",
                amount=ord3.total_amount,
                currency="INR",
                payment_method="UPI",
                status="SUCCESS",
                gateway_name="RAZORPAY",
                gateway_payment_id="pay_khaira_003",
                receipt_number="RCP-ORD-2026-00003"
            )
            session.add_all([pay1, pay2, pay3])

        # 9. Knowledge Base & Grounded RAG Documents
        doc_count_res = await session.execute(select(func.count(KnowledgeDoc.id)))
        if (doc_count_res.scalar() or 0) == 0:
            doc_comp = KnowledgeDoc(
                company_id=company.id,
                title="Khaira Company Enterprise Profile & Official E-Commerce Policy",
                category="Company Policy",
                content="""
KHAIRA COMPANY ENTERPRISE PROFILE & OFFICIAL E-COMMERCE POLICY

Headquarters: Khaira Towers, 45 Central Expressway, Tech Corridor, Chennai, TN 600096.
Customer Support Helpline: +91-80-6000-4400 (Toll-free 24/7 autonomous multilingual AI voice assistance).
Official Email: support@khairacompany.example.

OPERATIONAL OVERVIEW:
Khaira Company operates an autonomous, high-volume AI-driven unified e-commerce platform and telephony network.
We provide certified multi-category consumer goods across 16 categories including Electronics, Mobiles, Fashion, Home Appliances, and Kitchenware.

ORDER CONFIRMATION & AUTONOMOUS CALLING POLICY:
Every order placed via Cash on Delivery or verified Online Payment receives an immediate, automated voice confirmation call in the customer's preferred language (English, Tamil, Telugu, Malayalam, or Kannada).
The AI agent clearly identifies itself, confirms items, quantities, and delivery address.

DELIVERY & RETURNS:
Standard express shipping delivers within 2 to 3 business days via BlueDart Express.
7-day easy returns and instant refunds upon product pickup.
""".strip()
            )
            session.add(doc_comp)
            await session.flush()
            await rag_engine.index_document(db=session, doc=doc_comp)

        await session.commit()
        logger.info("Khaira Company seed complete. All e-commerce, multi-marketplace catalog, and voice calling data verified.")

