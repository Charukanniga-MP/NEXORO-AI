from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func, or_, and_
from datetime import datetime

from app.core.database import get_db
from app.models.call import Call
from app.models.order import Order
from app.models.customer import Customer
from app.models.appointment import Appointment
from app.models.complaint import Complaint
from app.models.user import User
from app.services.automated_call_service import automated_call_service

router = APIRouter()

class AICallLogItem(BaseModel):
    id: str
    category: str = "ORDER_CONFIRMATION"
    category_display: str = "Order Confirmation"
    order_id: Optional[str] = None
    order_number: Optional[str] = None
    customer_id: Optional[str] = None
    customer_code: Optional[str] = None
    customer_name: Optional[str] = None
    agent_id: Optional[str] = None
    agent_name: Optional[str] = None
    phone_number: str
    preferred_language: str
    call_initiation_time: str
    duration_seconds: int
    call_status: str
    confirmation_status: Optional[str] = None
    summary: Optional[str] = None
    transcript: List[Dict[str, Any]] = []
    recording_url: Optional[str] = None
    retry_count: int = 0
    escalated_to_human: bool = False

class AICallingStats(BaseModel):
    total_calls: int
    completed_calls: int
    unanswered_calls: int
    failed_calls: int
    pending_calls: int
    escalated_calls: int
    confirmed_orders: int
    cancelled_orders: int
    avg_duration_seconds: float
    categories: Dict[str, int]
    language_distribution: Dict[str, int]
    active_agents_count: int

class TriggerCallRequest(BaseModel):
    category: str = "ORDER_CONFIRMATION"
    customer_id: Optional[str] = None
    phone_number: Optional[str] = None
    order_id: Optional[str] = None
    appointment_id: Optional[str] = None
    complaint_id: Optional[str] = None
    language: Optional[str] = "en"
    simulate_outcome: Optional[str] = "SUCCESS" # SUCCESS, QUESTION_ANSWERED, CANCEL_REQUESTED, NOT_ANSWERED, FAILED
    bypass_duplicate_check: Optional[bool] = False

class AgentStatusUpdate(BaseModel):
    status: str # AVAILABLE, BUSY, ON_CALL, OFFLINE

class AssignAgentRequest(BaseModel):
    call_id: str
    agent_id: str

@router.get("/logs", response_model=List[AICallLogItem])
async def list_ai_call_logs(
    category: Optional[str] = None,
    status: Optional[str] = None,
    language: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    db: AsyncSession = Depends(get_db)
):
    query = select(Call).order_by(desc(Call.start_time))

    if category and category.upper() != "ALL":
        query = query.where(Call.category == category.upper())
    if status and status.upper() != "ALL":
        query = query.where(Call.status == status.upper())
    if language and language.lower() != "all":
        query = query.where(Call.language == language.lower())
    if search:
        search_pattern = f"%{search.strip()}%"
        query = query.where(
            or_(
                Call.caller_number.contains(search_pattern),
                Call.receiver_number.contains(search_pattern),
                Call.summary.contains(search_pattern),
                Call.agent_name.contains(search_pattern),
                Call.order_id.contains(search_pattern)
            )
        )

    query = query.offset(offset).limit(limit)
    res = await db.execute(query)
    calls = res.scalars().all()

    items = []
    for call in calls:
        cust_code = None
        cust_name = None
        ord_number = call.order_id

        if call.customer_id:
            c_stmt = select(Customer).where(Customer.id == call.customer_id)
            c_res = await db.execute(c_stmt)
            cust = c_res.scalars().first()
            if cust:
                cust_code = cust.customer_code
                cust_name = cust.name

        if call.order_id and not ord_number:
            o_stmt = select(Order).where(or_(Order.id == call.order_id, Order.order_number == call.order_id))
            o_res = await db.execute(o_stmt)
            ord_obj = o_res.scalars().first()
            if ord_obj:
                ord_number = ord_obj.order_number

        cat = call.category or "ORDER_CONFIRMATION"
        cat_display = automated_call_service.CATEGORIES.get(cat, cat.replace("_", " ").title())

        items.append(
            AICallLogItem(
                id=call.id,
                category=cat,
                category_display=cat_display,
                order_id=call.order_id,
                order_number=ord_number or (call.order_id if call.order_id else None),
                customer_id=call.customer_id,
                customer_code=cust_code or "CUST-GUEST",
                customer_name=cust_name or "Valued Customer",
                agent_id=call.agent_id,
                agent_name=call.agent_name or "Sarah Jenkins (AI Agent Specialist)",
                phone_number=call.receiver_number,
                preferred_language=call.language or "en",
                call_initiation_time=call.start_time.isoformat() if call.start_time else datetime.utcnow().isoformat(),
                duration_seconds=call.duration_seconds or 0,
                call_status=call.status,
                confirmation_status=call.confirmation_status,
                summary=call.summary,
                transcript=call.transcript or [],
                recording_url=call.recording_url,
                retry_count=call.retry_count or 0,
                escalated_to_human=bool(call.escalated_to_human)
            )
        )

    return items

@router.get("/stats", response_model=AICallingStats)
async def get_ai_calling_stats(db: AsyncSession = Depends(get_db)):
    stmt = select(Call)
    res = await db.execute(stmt)
    calls = res.scalars().all()

    total = len(calls)
    completed = sum(1 for c in calls if c.status == "COMPLETED")
    confirmed = sum(1 for c in calls if c.confirmation_status == "CONFIRMED")
    cancelled = sum(1 for c in calls if c.confirmation_status in ["CANCEL_REQUESTED", "CANCELLED"])
    unanswered = sum(1 for c in calls if c.status == "NOT_ANSWERED")
    failed = sum(1 for c in calls if c.status in ["FAILED", "CALL_FAILED"])
    pending = sum(1 for c in calls if c.status in ["PENDING", "INITIATED", "RINGING", "RETRY_SCHEDULED"])
    escalated = sum(1 for c in calls if c.status == "ESCALATED" or c.escalated_to_human)

    avg_dur = sum(c.duration_seconds or 0 for c in calls) / max(1, total)

    # Categories Breakdown
    cat_counts: Dict[str, int] = {k: 0 for k in automated_call_service.CATEGORIES.keys()}
    for c in calls:
        cat_key = c.category or "ORDER_CONFIRMATION"
        cat_counts[cat_key] = cat_counts.get(cat_key, 0) + 1

    # Language Breakdown
    lang_dist: Dict[str, int] = {"en": 0, "ta": 0, "te": 0, "ml": 0, "kn": 0, "hi": 0}
    for c in calls:
        l = (c.language or "en").lower()
        lang_dist[l] = lang_dist.get(l, 0) + 1

    # Active AI Agents Count
    agent_stmt = select(func.count(User.id)).where(User.role == "AGENT", User.is_active == True)
    agent_res = await db.execute(agent_stmt)
    active_agents = agent_res.scalar() or 0

    return AICallingStats(
        total_calls=total,
        completed_calls=completed,
        unanswered_calls=unanswered,
        failed_calls=failed,
        pending_calls=pending,
        escalated_calls=escalated,
        confirmed_orders=confirmed,
        cancelled_orders=cancelled,
        avg_duration_seconds=round(avg_dur, 1),
        categories=cat_counts,
        language_distribution=lang_dist,
        active_agents_count=active_agents
    )

@router.post("/trigger")
async def trigger_automated_call(req: TriggerCallRequest, db: AsyncSession = Depends(get_db)):
    """
    Manually triggers an automated AI voice call for any of the 8 categories.
    """
    customer = None
    if req.customer_id:
        c_stmt = select(Customer).where(Customer.id == req.customer_id)
        c_res = await db.execute(c_stmt)
        customer = c_res.scalars().first()

    if not customer and req.phone_number:
        c_stmt = select(Customer).where(Customer.phone == req.phone_number)
        c_res = await db.execute(c_stmt)
        customer = c_res.scalars().first()

    if not customer:
        # Fallback to demo customer or create temporary
        c_stmt = select(Customer)
        c_res = await db.execute(c_stmt)
        customer = c_res.scalars().first()

    if not customer:
        raise HTTPException(status_code=404, detail="No customer record found to call")

    # Fetch entity
    entity_obj = None
    entity_type = "order"
    if req.order_id:
        o_stmt = select(Order).where(or_(Order.id == req.order_id, Order.order_number == req.order_id))
        o_res = await db.execute(o_stmt)
        entity_obj = o_res.scalars().first()
        entity_type = "order"
    elif req.appointment_id:
        a_stmt = select(Appointment).where(or_(Appointment.id == req.appointment_id, Appointment.appointment_number == req.appointment_id))
        a_res = await db.execute(a_stmt)
        entity_obj = a_res.scalars().first()
        entity_type = "appointment"
    elif req.complaint_id:
        cmp_stmt = select(Complaint).where(or_(Complaint.id == req.complaint_id, Complaint.ticket_number == req.complaint_id))
        cmp_res = await db.execute(cmp_stmt)
        entity_obj = cmp_res.scalars().first()
        entity_type = "complaint"
    else:
        # Default fetch most recent order
        o_stmt = select(Order).where(Order.customer_id == customer.id).order_by(desc(Order.created_at))
        o_res = await db.execute(o_stmt)
        entity_obj = o_res.scalars().first()
        entity_type = "order"

    result = await automated_call_service.dispatch_automated_call(
        db=db,
        category=req.category,
        customer=customer,
        entity_type=entity_type,
        entity_obj=entity_obj,
        language=req.language or customer.preferred_language or "en",
        simulate_outcome=req.simulate_outcome or "SUCCESS",
        bypass_duplicate_check=bool(req.bypass_duplicate_check)
    )
    return result

@router.post("/retry/{call_id}")
async def retry_ai_call(call_id: str, db: AsyncSession = Depends(get_db)):
    """
    Retries an outbound call and enforces retry rules (max 3 retries -> auto escalate).
    """
    return await automated_call_service.retry_call(call_id=call_id, db=db)

@router.post("/escalate/{call_id}")
async def escalate_ai_call(
    call_id: str,
    reason: str = Query("Manual administrator escalation to human desk"),
    db: AsyncSession = Depends(get_db)
):
    """
    Escalates an AI call to a human operator desk with handoff ticket creation.
    """
    return await automated_call_service.escalate_call_to_human(call_id=call_id, reason=reason, db=db)

@router.get("/agents")
async def list_ai_agents(db: AsyncSession = Depends(get_db)):
    """
    Lists all AI agents with contact details, availability, department, and performance stats.
    """
    stmt = select(User).where(User.role == "AGENT").order_by(User.full_name.asc())
    res = await db.execute(stmt)
    agents = res.scalars().all()

    result = []
    for ag in agents:
        # Compute calls handled count
        c_stmt = select(func.count(Call.id)).where(Call.agent_id == ag.id)
        c_res = await db.execute(c_stmt)
        calls_count = c_res.scalar() or 0

        # Language specialty
        lang_spec = ["English", "Tamil"] if "Tamil" in (ag.department or "") or ag.username == "karthik" else ["English", "Hindi"]

        result.append({
            "id": ag.id,
            "username": ag.username,
            "full_name": ag.full_name,
            "email": ag.email,
            "phone": ag.phone,
            "extension": ag.extension,
            "department": ag.department,
            "status": ag.status, # AVAILABLE, BUSY, ON_CALL, OFFLINE
            "calls_handled": calls_count,
            "csat_rating": 4.9 if ag.username == "karthik" else 4.8,
            "languages": lang_spec,
            "avatar_url": ag.avatar_url or f"https://api.dicebear.com/7.x/bottts/svg?seed={ag.username or ag.id}"
        })

    return result

@router.put("/agents/{agent_id}/status")
async def update_agent_status(
    agent_id: str,
    req: AgentStatusUpdate,
    db: AsyncSession = Depends(get_db)
):
    """
    Allows administrators to change AI agent availability status.
    """
    if req.status not in ["AVAILABLE", "BUSY", "ON_CALL", "OFFLINE"]:
        raise HTTPException(status_code=400, detail="Invalid status. Allowed: AVAILABLE, BUSY, ON_CALL, OFFLINE")

    stmt = select(User).where(User.id == agent_id)
    res = await db.execute(stmt)
    agent = res.scalars().first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    agent.status = req.status
    await db.commit()
    await db.refresh(agent)

    return {
        "success": True,
        "agent_id": agent.id,
        "name": agent.full_name,
        "status": agent.status
    }

@router.post("/assign-agent")
async def assign_agent_to_call(
    req: AssignAgentRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Assigns an AI agent to an active or historical call.
    """
    c_stmt = select(Call).where(Call.id == req.call_id)
    c_res = await db.execute(c_stmt)
    call = c_res.scalars().first()
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")

    u_stmt = select(User).where(User.id == req.agent_id)
    u_res = await db.execute(u_stmt)
    agent = u_res.scalars().first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    call.agent_id = agent.id
    call.agent_name = agent.full_name
    await db.commit()
    await db.refresh(call)

    return {
        "success": True,
        "call_id": call.id,
        "assigned_agent": agent.full_name,
        "department": agent.department
    }
