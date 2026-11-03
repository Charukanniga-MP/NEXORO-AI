import random
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.core.database import get_db
from app.models.complaint import Complaint
from app.models.customer import Customer
from app.schemas.complaint import ComplaintCreate, ComplaintUpdate, ComplaintResponse
from app.services.event_dispatcher import event_dispatcher

router = APIRouter()

@router.get("", response_model=List[ComplaintResponse])
async def list_complaints(
    status: Optional[str] = None,
    priority: Optional[str] = None,
    customer_id: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db)
):
    query = select(Complaint).order_by(desc(Complaint.created_at))
    if status:
        query = query.where(Complaint.status == status)
    if priority:
        query = query.where(Complaint.priority == priority)
    if customer_id:
        query = query.where(Complaint.customer_id == customer_id)
    query = query.offset(offset).limit(limit)
    res = await db.execute(query)
    return res.scalars().all()

@router.post("", response_model=ComplaintResponse)
async def create_complaint(req: ComplaintCreate, db: AsyncSession = Depends(get_db)):
    ticket_num = f"TKT-{random.randint(100000, 999999)}"
    
    complaint = Complaint(
        ticket_number=ticket_num,
        customer_id=req.customer_id,
        order_id=req.order_id,
        title=req.title,
        description=req.description,
        category=req.category,
        priority=req.priority,
        status="OPEN"
    )
    db.add(complaint)
    await db.commit()
    await db.refresh(complaint)

    # Automated Event Detection: Customer Complaint Registration Call
    c_stmt = select(Customer).where(Customer.id == complaint.customer_id)
    c_res = await db.execute(c_stmt)
    customer = c_res.scalars().first()
    if customer:
        await event_dispatcher.on_complaint_created(
            complaint=complaint,
            customer=customer,
            db=db,
            simulate_outcome="QUESTION_ANSWERED"
        )

    return complaint

@router.put("/{complaint_id}", response_model=ComplaintResponse)
async def update_complaint(complaint_id: str, req: ComplaintUpdate, db: AsyncSession = Depends(get_db)):
    stmt = select(Complaint).where(Complaint.id == complaint_id)
    res = await db.execute(stmt)
    complaint = res.scalars().first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    update_data = req.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        setattr(complaint, field, val)

    if req.status in ["RESOLVED", "CLOSED"] and not complaint.resolved_at:
        complaint.resolved_at = datetime.utcnow()

    await db.commit()
    await db.refresh(complaint)
    return complaint

