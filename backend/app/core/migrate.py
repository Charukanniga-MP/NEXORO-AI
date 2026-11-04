import sqlite3
import os
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)

MIGRATIONS = {
    "users": [
        ("username", "TEXT"),
    ],
    "customers": [
        ("customer_code", "TEXT"),
        ("username", "TEXT"),
        ("hashed_password", "TEXT"),
        ("address_line1", "TEXT"),
        ("address_line2", "TEXT"),
        ("city", "TEXT DEFAULT 'Chennai'"),
        ("state", "TEXT DEFAULT 'Tamil Nadu'"),
        ("pincode", "TEXT DEFAULT '600001'"),
        ("landmark", "TEXT"),
        ("role", "TEXT DEFAULT 'CUSTOMER'"),
        ("is_active", "BOOLEAN DEFAULT 1"),
        ("total_orders_count", "INTEGER DEFAULT 0"),
        ("avatar_url", "TEXT"),
        ("upi_id", "TEXT DEFAULT 'user@okhdfcbank'"),
        ("wallet_balance", "NUMERIC(10, 2) DEFAULT 500.00"),
    ],
    "products": [
        ("original_price", "NUMERIC(10, 2)"),
        ("discount_pct", "INTEGER DEFAULT 0"),
        ("currency", "TEXT DEFAULT 'INR'"),
        ("image_url", "TEXT"),
        ("rating", "FLOAT DEFAULT 4.5"),
        ("reviews_count", "INTEGER DEFAULT 120"),
        ("in_stock", "BOOLEAN DEFAULT 1"),
        ("delivery_estimate", "TEXT DEFAULT 'Delivery in 2-3 business days'"),
        ("specifications", "TEXT DEFAULT '{}'"),
        ("source_marketplace", "TEXT DEFAULT 'AMAZON'"),
        ("source_product_id", "TEXT"),
        ("supplier_cost", "NUMERIC(10, 2)"),
    ],
    "orders": [
        ("customer_name", "TEXT"),
        ("customer_phone", "TEXT"),
        ("customer_email", "TEXT"),
        ("subtotal", "NUMERIC(10, 2) DEFAULT 0.0"),
        ("delivery_fee", "NUMERIC(10, 2) DEFAULT 0.0"),
        ("discount_amount", "NUMERIC(10, 2) DEFAULT 0.0"),
        ("coupon_code", "TEXT"),
        ("transaction_id", "TEXT"),
        ("ai_call_status", "TEXT DEFAULT 'PENDING'"),
        ("ai_call_id", "TEXT"),
        ("ai_call_summary", "TEXT"),
        ("customer_confirmed", "BOOLEAN"),
        ("retry_count", "INTEGER DEFAULT 0"),
        ("preferred_language", "TEXT DEFAULT 'en'"),
    ],
    "calls": [
        ("order_id", "TEXT"),
        ("appointment_id", "TEXT"),
        ("complaint_id", "TEXT"),
        ("payment_id", "TEXT"),
        ("agent_id", "TEXT"),
        ("agent_name", "TEXT"),
        ("category", "TEXT DEFAULT 'ORDER_CONFIRMATION'"),
        ("call_reason", "TEXT"),
        ("escalated_to_human", "BOOLEAN DEFAULT 0"),
        ("call_type", "TEXT DEFAULT 'INBOUND'"),
        ("confirmation_status", "TEXT"),
        ("retry_count", "INTEGER DEFAULT 0"),
        ("next_retry_at", "DATETIME"),
    ]
}

def run_sqlite_migrations(db_path: str = "nexora.db"):
    if not os.path.exists(db_path):
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    for table, columns in MIGRATIONS.items():
        cursor.execute(f"PRAGMA table_info({table})")
        existing_cols = {row[1] for row in cursor.fetchall()}

        for col_name, col_type in columns:
            if col_name not in existing_cols:
                try:
                    sql = f"ALTER TABLE {table} ADD COLUMN {col_name} {col_type}"
                    cursor.execute(sql)
                    logger.info(f"Added column {col_name} to {table}")
                except Exception as e:
                    logger.warning(f"Could not add {col_name} to {table}: {e}")

    try:
        cursor.execute("UPDATE users SET username = 'admin' WHERE email = 'admin@nexora.ai' AND (username IS NULL OR username = '')")
        cursor.execute("UPDATE users SET username = 'admin_khaira' WHERE email = 'admin@khairacompany.com' AND (username IS NULL OR username = '')")
    except Exception:
        pass

    conn.commit()
    conn.close()

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    run_sqlite_migrations()
