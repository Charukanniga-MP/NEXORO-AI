from pydantic import BaseModel
from typing import List, Dict, Any, Optional

class DashboardKPIs(BaseModel):
    # Call Metrics
    total_calls: int
    incoming_calls: int
    outgoing_calls: int
    answered_calls: int
    missed_calls: int
    active_calls: int
    avg_duration_seconds: float
    avg_latency_ms: float
    csat_score: float # 1.0 to 5.0
    handoff_rate_percent: float
    resolved_by_ai_percent: float
    peak_concurrency: Optional[int] = 0
    queue_size: Optional[int] = 0
    data_source: Optional[str] = "Khaira Production Database"
    
    # E-Commerce & AI Voice Calling Organization Metrics
    total_customers: int = 0
    total_orders: int = 0
    today_orders: int = 0
    successful_payments: int = 0
    pending_payments: int = 0
    cancelled_orders: int = 0
    total_revenue: float = 0.0
    ai_calls_completed: int = 0
    ai_calls_pending: int = 0
    ai_calls_failed: int = 0

    # Extended AI Support & Operations Telemetry
    total_ai_agents: int = 4
    total_customer_calls: int = 0
    successful_calls: int = 0
    failed_calls: int = 0
    pending_calls: int = 0
    failed_payments: int = 0
    customer_complaints: int = 0
    customer_feedback: int = 0
    total_appointments: int = 0
    confirmed_appointments: int = 0
    scheduled_appointments: int = 0
    cancelled_appointments: int = 0

class LanguageDistribution(BaseModel):
    language: str
    code: str
    count: int
    percentage: float

class CallTrendPoint(BaseModel):
    time_label: str
    inbound: int
    outbound: int
    total: int

class EmployeePerformance(BaseModel):
    id: str
    name: str
    department: str
    status: str
    calls_handled: int
    transfers_accepted: int
    avg_resolution_minutes: float
    rating: float
