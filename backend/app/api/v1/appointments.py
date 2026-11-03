import random
from typing import List, Optional
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.core.database import get_db
from app.models.appointment import Appointment
from app.models.customer import Customer
from app.schemas.appointment import AppointmentCreate, AppointmentUpdate, AppointmentResponse, SlotCheckRequest
from app.services.event_dispatcher import event_dispatcher

router = APIRouter()

@router.get("", response_model=List[AppointmentResponse])
async def list_appointments(
    status: Optional[str] = None,
    customer_id: Optional[str] = None,
    employee_id: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db)
):
    query = select(Appointment).order_by(Appointment.scheduled_time.asc())
    if status:
        query = query.where(Appointment.status == status)
    if customer_id:
        query = query.where(Appointment.customer_id == customer_id)
    if employee_id:
        query = query.where(Appointment.employee_id == employee_id)
    query = query.offset(offset).limit(limit)
    res = await db.execute(query)
    return res.scalars().all()

@router.post("", response_model=AppointmentResponse)
async def create_appointment(req: AppointmentCreate, db: AsyncSession = Depends(get_db)):
    appt_num = f"APT-{random.randint(10000, 99999)}"
    
    appt = Appointment(
        appointment_number=appt_num,
        customer_id=req.customer_id,
        employee_id=req.employee_id,
        service_name=req.service_name,
        scheduled_time=req.scheduled_time,
        duration_minutes=req.duration_minutes,
        location_type=req.location_type,
        location_details=req.location_details,
        notes=req.notes,
        status="SCHEDULED"
    )
    db.add(appt)
    await db.commit()
    await db.refresh(appt)

    # Automated Event Detection: Trigger Appointment Confirmation AI Call
    c_stmt = select(Customer).where(Customer.id == appt.customer_id)
    c_res = await db.execute(c_stmt)
    customer = c_res.scalars().first()
    if customer:
        await event_dispatcher.on_appointment_created(
            appointment=appt,
            customer=customer,
            db=db,
            simulate_outcome="SUCCESS"
        )

    return appt

@router.post("/available-slots")
async def check_available_slots(req: SlotCheckRequest, db: AsyncSession = Depends(get_db)):
    """
    Returns available business slots for a given date.
    """
    try:
        date_obj = datetime.strptime(req.date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

    # Generate standard business slots: 09:30, 11:00, 14:00, 15:30, 17:00
    slot_hours = [
        (9, 30),
        (11, 0),
        (14, 0),
        (15, 30),
        (17, 0)
    ]
    
    slots = []
    for h, m in slot_hours:
        slot_dt = datetime(date_obj.year, date_obj.month, date_obj.day, h, m)
        # Check if already booked
        stmt = select(Appointment).where(
            Appointment.scheduled_time == slot_dt,
            Appointment.status.in_(["SCHEDULED", "CONFIRMED"])
        )
        res = await db.execute(stmt)
        is_booked = res.scalars().first() is not None
        
        slots.append({
            "datetime": slot_dt.isoformat(),
            "time_display": slot_dt.strftime("%I:%M %p"),
            "is_available": not is_booked,
            "duration_minutes": 30
        })

    return {"date": req.date, "slots": slots}

@router.put("/{appointment_id}", response_model=AppointmentResponse)
async def update_appointment(appointment_id: str, req: AppointmentUpdate, db: AsyncSession = Depends(get_db)):
    stmt = select(Appointment).where(Appointment.id == appointment_id)
    res = await db.execute(stmt)
    appt = res.scalars().first()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")

    old_status = appt.status
    old_time = appt.scheduled_time
    update_data = req.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        setattr(appt, field, val)

    await db.commit()
    await db.refresh(appt)

    # Automated Event Detection: Reschedule / Delay Call
    time_changed = req.scheduled_time and req.scheduled_time != old_time
    status_changed_to_rescheduled = req.status in ["RESCHEDULED", "DELAYED"] and req.status != old_status
    if time_changed or status_changed_to_rescheduled:
        c_stmt = select(Customer).where(Customer.id == appt.customer_id)
        c_res = await db.execute(c_stmt)
        customer = c_res.scalars().first()
        if customer:
            await event_dispatcher.on_appointment_rescheduled(
                appointment=appt,
                customer=customer,
                db=db,
                simulate_outcome="QUESTION_ANSWERED"
            )

    return appt

