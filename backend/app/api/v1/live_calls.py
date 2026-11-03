import json
import os
import uuid
import logging
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, HTTPException, Body, UploadFile, File, Request, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime
from pydantic import BaseModel

from app.core.config import settings
from app.core.database import get_db, AsyncSessionLocal
from app.models.call import Call
from app.models.customer import Customer
from app.models.user import User
from app.services.conversation_orchestrator import orchestrator
from app.services.speech_service import speech_service
from app.services.vision_service import vision_service
from app.services.human_handoff_service import human_handoff_service
from app.services.ai_engine import ai_engine
from app.services.call_queue_manager import call_queue_manager
from app.services.call_signaling import call_signaling
from app.schemas.call import CallResponse, TurnRequest

logger = logging.getLogger(__name__)
router = APIRouter()

class VoiceSynthesisRequest(BaseModel):
    text: str
    language: Optional[str] = "en"
    call_id: Optional[str] = None

@router.post("/start")
async def start_live_call(
    caller_number: str = "+91-98401-00199",
    direction: str = "INBOUND",
    language: str = "en",
    db: AsyncSession = Depends(get_db)
):
    """
    Initializes a new live voice call session with concurrency throttle & rate-limiting checks.
    Returns initial greeting tailored to the selected language.
    """
    # 1. Rate Limiting Check
    if not call_queue_manager.check_rate_limit(caller_number):
        raise HTTPException(
            status_code=429,
            detail="Rate limit exceeded. Too many call requests in a short period."
        )

    # 2. Acquire Concurrency Slot
    acquired = await call_queue_manager.acquire_concurrency_slot(timeout=4.0)
    if not acquired:
        raise HTTPException(
            status_code=503,
            detail="All AI voice agent channels are currently saturated. Please try again shortly."
        )

    greeting = ai_engine.LANGUAGE_GREETINGS.get(language, ai_engine.LANGUAGE_GREETINGS["en"])

    call = Call(
        direction=direction,
        caller_number=caller_number,
        receiver_number="+91-44-6789-0100",
        status="IN_PROGRESS",
        language=language,
        detected_languages=[language],
        start_time=datetime.utcnow(),
        transcript=[{
            "speaker": "ai",
            "text": greeting,
            "timestamp": datetime.utcnow().isoformat(),
            "language": language
        }]
    )
    db.add(call)
    await db.commit()
    await db.refresh(call)

    # Initialize in-memory dialog state
    session = await orchestrator.get_or_create_session(db, call.id, caller_number, direction)
    session.language = language
    session.turns = call.transcript

    tts = await speech_service.synthesize_speech(greeting, language, call_id=call.id)

    return {
        "call_id": call.id,
        "caller_number": call.caller_number,
        "status": call.status,
        "language": language,
        "greeting_text": greeting,
        "tts": tts,
        "started_at": call.start_time.isoformat()
    }

@router.post("/request-call")
async def request_customer_call(
    request: Request,
    caller_number: Optional[str] = Query(None),
    caller_name: Optional[str] = Query(None),
    language: Optional[str] = Query(None),
    customer_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    body_data = {}
    try:
        body_data = await request.json()
    except Exception:
        body_data = {}
    if not isinstance(body_data, dict):
        body_data = {}
    caller_number = body_data.get("caller_number") or caller_number or "+91-98401-00199"
    caller_name = body_data.get("caller_name") or caller_name or "Valued Customer"
    language = body_data.get("language") or language or "en"
    customer_id = body_data.get("customer_id") or customer_id
    """
    Called when a Customer clicks 'CALL AI AGENT'.
    Creates a Call in REQUESTED status and rings all active AI Agent consoles in real-time.
    """
    if not call_queue_manager.check_rate_limit(caller_number):
        raise HTTPException(
            status_code=429,
            detail="Rate limit exceeded. Please wait a moment before calling again."
        )

    # Find or link customer if available
    if not customer_id:
        cust_stmt = select(Customer).where(Customer.phone == caller_number)
        cust_res = await db.execute(cust_stmt)
        matched_cust = cust_res.scalars().first()
        if matched_cust:
            customer_id = matched_cust.id
            caller_name = matched_cust.name

    call = Call(
        id=str(uuid.uuid4()),
        direction="INBOUND",
        caller_number=caller_number,
        receiver_number="+91-44-6789-0100",
        customer_id=customer_id,
        status="REQUESTED",
        language=language,
        detected_languages=[language],
        start_time=datetime.utcnow(),
        transcript=[]
    )
    db.add(call)
    await db.commit()
    await db.refresh(call)

    call_payload = {
        "id": call.id,
        "caller_name": caller_name,
        "caller_number": call.caller_number,
        "customer_id": customer_id,
        "language": language,
        "status": "REQUESTED",
        "created_at": call.start_time.isoformat()
    }

    # Broadcast incoming ring event to all AI Agent Consoles
    await call_signaling.notify_call_requested(call_payload)

    return {
        "call_id": call.id,
        "status": "REQUESTED",
        "caller_name": caller_name,
        "caller_number": call.caller_number,
        "language": language,
        "started_at": call.start_time.isoformat()
    }

@router.get("/pending-requests")
async def get_pending_call_requests():
    """Returns currently ringing / requested calls for the Agent Console."""
    return call_signaling.get_pending_calls()

@router.post("/{call_id}/accept")
@router.post("/accept")
async def accept_call_request(
    request: Request,
    call_id: Optional[str] = None,
    agent_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """
    AI Agent accepts the incoming call.
    Transitions status to IN_PROGRESS, generates greeting, and notifies customer socket.
    Accepts call_id in path or body, validates session, avoids foreign key issues,
    and returns immediately without blocking on external network services.
    """
    body_data = {}
    try:
        body_data = await request.json()
    except Exception:
        body_data = {}
    if not isinstance(body_data, dict):
        body_data = {}

    target_call_id = call_id or body_data.get("call_id") or body_data.get("id") or request.query_params.get("call_id")
    target_agent_id = body_data.get("agent_id") or agent_id or request.query_params.get("agent_id")

    # If call_id was not explicitly specified, inspect active pending calls
    if not target_call_id:
        pending_list = call_signaling.get_pending_calls()
        if pending_list:
            target_call_id = pending_list[0].get("id") or pending_list[0].get("call_id")

    if not target_call_id:
        raise HTTPException(status_code=400, detail="Missing call_id for call acceptance.")

    logger.info(f"Processing call acceptance for call_id={target_call_id}, agent_id={target_agent_id}")

    # Check Call in DB
    stmt = select(Call).where(Call.id == target_call_id)
    res = await db.execute(stmt)
    call = res.scalars().first()

    # If call not yet persisted in DB but registered in signaling, create it
    if not call:
        pending_info = call_signaling.pending_calls.get(target_call_id, {})
        call = Call(
            id=target_call_id,
            direction="INBOUND",
            caller_number=pending_info.get("caller_number", "+91-98401-00199"),
            receiver_number="+91-44-6789-0100",
            customer_id=pending_info.get("customer_id"),
            status="IN_PROGRESS",
            language=pending_info.get("language", "en"),
            detected_languages=[pending_info.get("language", "en")],
            start_time=datetime.utcnow(),
            transcript=[]
        )
        db.add(call)
        await db.commit()
        await db.refresh(call)

    language = call.language or "en"
    greeting = ai_engine.LANGUAGE_GREETINGS.get(language, ai_engine.LANGUAGE_GREETINGS.get("en", "Welcome to Khaira Company!"))

    # Resolve safe agent foreign key
    valid_agent_id = None
    if target_agent_id:
        user_stmt = select(User).where((User.id == target_agent_id) | (User.email == target_agent_id))
        user_res = await db.execute(user_stmt)
        matched_user = user_res.scalars().first()
        if matched_user:
            valid_agent_id = matched_user.id
        else:
            default_agent_stmt = select(User).where(User.role == "AGENT")
            default_agent_res = await db.execute(default_agent_stmt)
            default_agent = default_agent_res.scalars().first()
            if default_agent:
                valid_agent_id = default_agent.id

    call.status = "IN_PROGRESS"
    call.transferred_to_user_id = valid_agent_id

    if not call.transcript:
        call.transcript = [{
            "speaker": "ai",
            "text": greeting,
            "timestamp": datetime.utcnow().isoformat(),
            "language": language
        }]

    await db.commit()
    await db.refresh(call)

    # Initialize dialog state in orchestrator
    try:
        session = await orchestrator.get_or_create_session(db, call.id, call.caller_number, call.direction)
        session.language = language
        session.turns = call.transcript
    except Exception as orch_err:
        logger.warning(f"Orchestrator session initialization notice: {orch_err}")

    # Fast / non-blocking TTS generation with safe fallback
    tts = {
        "text": greeting,
        "language": language,
        "audio_url": None,
        "audio_generated": False
    }
    try:
        tts = await asyncio.wait_for(
            speech_service.synthesize_speech(greeting, language, call_id=call.id),
            timeout=2.0
        )
    except Exception as tts_err:
        logger.warning(f"Initial greeting TTS deferred: {tts_err}")

    call_info = {
        "id": call.id,
        "call_id": call.id,
        "status": "IN_PROGRESS",
        "caller_number": call.caller_number,
        "language": language,
        "greeting": greeting,
        "greeting_text": greeting,
        "tts": tts,
        "transcript": call.transcript
    }

    # Broadcast to customer and agent sockets
    await call_signaling.notify_call_accepted(target_call_id, call_info)
    logger.info(f"Call {target_call_id} successfully accepted and transitioned to IN_PROGRESS.")

    return call_info

@router.post("/{call_id}/cancel")
async def cancel_call_request(call_id: str, db: AsyncSession = Depends(get_db)):
    """Customer cancels call while waiting/ringing."""
    if call_id in call_signaling.pending_calls:
        del call_signaling.pending_calls[call_id]
    stmt = select(Call).where(Call.id == call_id)
    res = await db.execute(stmt)
    call = res.scalars().first()
    if call and call.status == "REQUESTED":
        call.status = "CANCELLED"
        call.outcome = "CANCELLED_BY_CUSTOMER"
        call.end_time = datetime.utcnow()
        await db.commit()
    await call_signaling.notify_call_rejected(call_id, reason="Customer cancelled call")
    return {"status": "CANCELLED", "call_id": call_id}

class AgentSpeakRequest(BaseModel):
    call_id: str
    text: str
    language: Optional[str] = "en"

@router.post("/agent-speak")
async def agent_speak(req: AgentSpeakRequest, db: AsyncSession = Depends(get_db)):
    """Allows human agent to send a message / speak directly to customer."""
    tts = await speech_service.synthesize_speech(req.text, req.language or "en", call_id=req.call_id)
    turn = {
        "speaker": "agent",
        "reply_text": req.text,
        "language": req.language or "en",
        "tts": tts,
        "timestamp": datetime.utcnow().isoformat()
    }
    await call_signaling.notify_transcript_turn(req.call_id, turn)
    return turn

@router.post("/{call_id}/reject")
async def reject_call_request(
    call_id: str,
    request: Request,
    reason: Optional[str] = Query("Agent busy"),
    db: AsyncSession = Depends(get_db)
):
    body_data = {}
    try:
        body_data = await request.json()
    except Exception:
        body_data = {}
    if not isinstance(body_data, dict):
        body_data = {}
    reason = body_data.get("reason") or reason or "Agent busy"
    """Rejects or cancels a requested call."""
    stmt = select(Call).where(Call.id == call_id)
    res = await db.execute(stmt)
    call = res.scalars().first()
    if call:
        call.status = "REJECTED"
        call.outcome = "REJECTED_BUSY"
        call.end_time = datetime.utcnow()
        await db.commit()

    await call_signaling.notify_call_rejected(call_id, reason)
    return {"status": "REJECTED", "call_id": call_id, "reason": reason}


class TransferCallRequest(BaseModel):
    reason: str
    department: Optional[str] = "Customer Support"
    target_agent_id: Optional[str] = None
    summary: Optional[str] = None
    priority: Optional[str] = "HIGH"

@router.post("/{call_id}/transfer")
async def transfer_call_to_human(
    call_id: str,
    req: TransferCallRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Transfers an active call to a human specialist department or staff agent.
    Creates an official HandoffTicket, updates Call status, and alerts all agent consoles.
    """
    stmt = select(Call).where(Call.id == call_id)
    res = await db.execute(stmt)
    call = res.scalars().first()
    if not call:
        raise HTTPException(status_code=404, detail="Call record not found")

    target_user_id = req.target_agent_id
    specialist_name = "Human Specialist"
    if target_user_id:
        u_stmt = select(User).where(User.id == target_user_id)
        u_res = await db.execute(u_stmt)
        u = u_res.scalars().first()
        if u:
            specialist_name = u.full_name
    else:
        spec_stmt = select(User).where(
            User.role.in_(["AGENT", "ADMIN"]),
            User.status == "AVAILABLE"
        )
        spec_res = await db.execute(spec_stmt)
        spec_user = spec_res.scalars().first()
        if spec_user:
            target_user_id = spec_user.id
            specialist_name = spec_user.full_name

    summary_text = req.summary or f"Call escalated: {req.reason}. Caller: {call.caller_number}"
    ticket = await human_handoff_service.create_handoff_request(
        db=db,
        call_id=call_id,
        reason=req.reason,
        ai_summary=summary_text,
        context_notes={
            "transferred_by": "Agent Console",
            "department": req.department,
            "target_user_id": target_user_id,
            "priority": req.priority,
            "language": call.language or "en"
        },
        target_department=req.department or "Customer Support"
    )

    call.status = "TRANSFERRED"
    call.outcome = "HANDOFF_TO_HUMAN"
    call.transferred_to_user_id = target_user_id
    await db.commit()
    await db.refresh(call)

    transfer_turn = {
        "speaker": "system",
        "text": f"Call escalated to {req.department or 'Customer Support'} ({specialist_name}). Ticket: ESC-{ticket.id[:8].upper()}",
        "timestamp": datetime.utcnow().isoformat(),
        "ticket_id": ticket.id
    }
    await call_signaling.notify_transcript_turn(call_id, transfer_turn)

    return {
        "success": True,
        "status": "TRANSFERRED",
        "ticket_id": ticket.id,
        "ticket_number": f"ESC-{ticket.id[:8].upper()}",
        "specialist_name": specialist_name,
        "target_department": req.department,
        "message": f"Call successfully transferred to {specialist_name} in {req.department}."
    }

class ChangeLanguageRequest(BaseModel):
    language: str

@router.post("/{call_id}/change-language")
async def change_call_language(
    call_id: str,
    req: ChangeLanguageRequest,
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Call).where(Call.id == call_id)
    res = await db.execute(stmt)
    call = res.scalars().first()
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")

    call.language = req.language
    if req.language not in (call.detected_languages or []):
        call.detected_languages = (call.detected_languages or []) + [req.language]
    await db.commit()

    lang_names = {
        "en": "English",
        "ta": "Tamil (தமிழ்)",
        "hi": "Hindi (हिन्दी)",
        "te": "Telugu (తెలుగు)",
        "ml": "Malayalam (മലയാളം)"
    }
    chosen_name = lang_names.get(req.language, req.language.upper())
    turn = {
        "speaker": "system",
        "text": f"Conversation language updated to {chosen_name}.",
        "language": req.language,
        "timestamp": datetime.utcnow().isoformat()
    }
    await call_signaling.notify_transcript_turn(call_id, turn)
    return {"success": True, "language": req.language, "language_name": chosen_name}

@router.get("/console-stats")
async def get_console_stats(db: AsyncSession = Depends(get_db)):
    """
    Computes live dashboard statistics for the Agent Operator Console:
    - Calls Today
    - Waiting Calls
    - Active Calls
    - Avg Duration (seconds)
    """
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

    # 1. Calls today
    c_today_stmt = select(func.count(Call.id)).where(Call.start_time >= today_start)
    c_today_res = await db.execute(c_today_stmt)
    calls_today = c_today_res.scalar() or 0

    # 2. Active calls
    active_stmt = select(func.count(Call.id)).where(Call.status == "IN_PROGRESS")
    active_res = await db.execute(active_stmt)
    active_calls = active_res.scalar() or 0

    # 3. Waiting calls in queue
    waiting_calls = len(call_signaling.get_pending_calls())

    # 4. Avg duration of completed calls today
    avg_stmt = select(func.avg(Call.duration_seconds)).where(
        Call.start_time >= today_start,
        Call.duration_seconds.isnot(None),
        Call.duration_seconds > 0
    )
    avg_res = await db.execute(avg_stmt)
    avg_dur = avg_res.scalar() or 0.0

    return {
        "calls_today": calls_today,
        "waiting_calls": waiting_calls,
        "active_calls": active_calls,
        "avg_duration_seconds": round(float(avg_dur), 1)
    }


@router.post("/upload-images")
async def upload_images(
    files: List[UploadFile] = File(...)
):
    """
    Accepts 2 or more uploaded images for Multimodal Vision AI.
    Saves to data_storage/uploads/ and runs computer vision inspection.
    Returns uploaded metadata, dominant colors, detected categories, and public URLs.
    """
    uploads_dir = os.path.join(settings.STORAGE_DIR, "uploads")
    os.makedirs(uploads_dir, exist_ok=True)

    results = []
    for file in files:
        file_ext = os.path.splitext(file.filename)[1] or ".jpg"
        unique_name = f"vision_{uuid.uuid4().hex[:10]}{file_ext}"
        saved_path = os.path.join(uploads_dir, unique_name)
        
        contents = await file.read()
        with open(saved_path, "wb") as f:
            f.write(contents)
            
        analysis = vision_service.analyze_image_file(saved_path, original_filename=file.filename)
        results.append(analysis)

    return {
        "status": "SUCCESS",
        "uploaded_count": len(results),
        "images": results
    }

@router.post("/synthesize-voice")
async def synthesize_voice(
    payload: VoiceSynthesisRequest
):
    """
    Synthesizes speech on demand with natural Edge-TTS neural models.
    Supports English, Tamil, Hindi, Telugu, and Malayalam.
    """
    tts = await speech_service.synthesize_speech(
        text=payload.text,
        language=payload.language or "en",
        call_id=payload.call_id
    )
    return tts

@router.post("/turn")
async def process_call_turn(
    request: Request,
    call_id: Optional[str] = Query(None),
    user_text: Optional[str] = Query(None),
    language: Optional[str] = Query("auto"),
    image_urls: Optional[List[str]] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """
    Processes a conversational turn for the call.
    Accepts JSON body or query parameters.
    Executes multimodal Vision AI (if images provided), business workflows, grounded RAG,
    sentiment analysis, and neural speech synthesis.
    """
    body_data: Dict[str, Any] = {}
    try:
        body_data = await request.json()
    except Exception:
        body_data = {}
    if not isinstance(body_data, dict):
        body_data = {}

    c_id = body_data.get("call_id") or call_id
    text = body_data.get("user_text") or body_data.get("text") or user_text or ""
    lang = body_data.get("language") or language or "auto"
    imgs = body_data.get("image_urls") or image_urls or []

    # Ensure call session exists, or auto-create one seamlessly
    call = None
    if c_id:
        stmt = select(Call).where(Call.id == c_id)
        res = await db.execute(stmt)
        call = res.scalars().first()

    if not call:
        c_id = c_id or str(uuid.uuid4())
        initial_lang = lang if lang != "auto" else "en"
        greeting = ai_engine.LANGUAGE_GREETINGS.get(initial_lang, ai_engine.LANGUAGE_GREETINGS["en"])
        call = Call(
            id=c_id,
            direction="INBOUND",
            caller_number="+91-98401-00199",
            receiver_number="+91-44-6789-0100",
            status="IN_PROGRESS",
            language=initial_lang,
            detected_languages=[initial_lang],
            start_time=datetime.utcnow(),
            transcript=[{
                "speaker": "ai",
                "text": greeting,
                "timestamp": datetime.utcnow().isoformat(),
                "language": initial_lang
            }]
        )
        db.add(call)
        await db.commit()
        await db.refresh(call)

    result = await orchestrator.process_user_turn(
        db=db,
        call_id=c_id,
        user_text=text,
        forced_language=lang,
        image_urls=imgs
    )

    # If AI requested handoff, create transfer ticket
    handoff_ticket = None
    if result.get("trigger_handoff"):
        handoff_ticket = await human_handoff_service.create_handoff_request(
            db=db,
            call_id=c_id,
            reason=result.get("handoff_reason", "Caller needs human specialist"),
            ai_summary=f"Caller asked: '{text}'. Transferred for specialized human support.",
            context_notes={"last_query": text, "language": result.get("language", "en")},
            target_department="Customer Support"
        )
        call.status = "TRANSFERRED"
        call.outcome = "HANDOFF_TO_HUMAN"
        await db.commit()

    # Broadcast turn update to Agent Console & monitoring
    await call_signaling.notify_transcript_turn(c_id, {
        "speaker": "ai",
        "user_query": text,
        "reply_text": result["reply_text"],
        "language": result["language"],
        "sentiment": result.get("sentiment", "NEUTRAL"),
        "transcript": result["turn_history"]
    })

    return {
        "call_id": c_id,
        "reply_text": result["reply_text"],
        "language": result["language"],
        "intent": result["intent"],
        "sentiment": result.get("sentiment", "NEUTRAL"),
        "grounded": result["grounded"],
        "trigger_handoff": result["trigger_handoff"],
        "is_terminal": result.get("is_terminal", False),
        "handoff_ticket_id": handoff_ticket.id if handoff_ticket else None,
        "sources": result["sources"],
        "tts": result["tts"],
        "transcript": result["turn_history"]
    }

@router.post("/audio-turn")
async def process_audio_turn(
    call_id: str,
    audio_base64: str = Body(..., embed=True),
    language: Optional[str] = "auto",
    db: AsyncSession = Depends(get_db)
):
    """
    Direct Speech-to-Text audio turn endpoint.
    Accepts base64 audio from client, transcribes, processes through workflows/RAG, and synthesizes neural audio.
    """
    stmt = select(Call).where(Call.id == call_id)
    res = await db.execute(stmt)
    call = res.scalars().first()
    if not call:
        raise HTTPException(status_code=404, detail="Call session not found")

    # Transcribe audio chunk
    stt_result = await speech_service.transcribe_audio_chunk(audio_base64, language=language)
    transcribed_text = stt_result.get("text", "").strip()

    if not transcribed_text:
        # Default fallback prompt if speech was inaudible
        transcribed_text = "Hello, can you hear me?"

    # Execute conversational turn
    return await process_call_turn(
        call_id=call_id,
        user_text=transcribed_text,
        language=stt_result.get("detected_language", language),
        db=db
    )

@router.post("/barge-in")
async def trigger_barge_in(call_id: str):
    """
    Handles caller interruption: immediately cancels active speech synthesis and playback.
    """
    orchestrator.handle_barge_in(call_id)
    return {"status": "INTERRUPTED", "call_id": call_id}

@router.post("/end")
async def end_live_call(
    request: Request,
    call_id: Optional[str] = Query(None),
    outcome: Optional[str] = Query("RESOLVED_BY_AI"),
    db: AsyncSession = Depends(get_db)
):
    body_data = {}
    try:
        body_data = await request.json()
    except Exception:
        body_data = {}
    if not isinstance(body_data, dict):
        body_data = {}
    call_id = body_data.get("call_id") or call_id
    outcome = body_data.get("outcome") or outcome or "RESOLVED_BY_AI"
    if not call_id:
        raise HTTPException(status_code=400, detail="call_id is required")
    """
    Ends active call, releases concurrency slot, and stores final transcripts and summaries.
    """
    call = await orchestrator.finalize_call(db, call_id, outcome=outcome)
    call_queue_manager.release_concurrency_slot()
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")

    end_data = {
        "call_id": call.id,
        "status": call.status,
        "duration_seconds": call.duration_seconds,
        "summary": call.summary,
        "outcome": call.outcome
    }

    await call_signaling.notify_call_ended(call_id, end_data)
    return end_data

@router.websocket("/ws/agent-calls")
@router.websocket("/ws/agent-console")
async def agent_console_websocket(websocket: WebSocket):
    """
    WebSocket endpoint for the real-time AI Agent Operator Console.
    Receives incoming call rings, accepted calls, and live transcript turns.
    Relays WebRTC signals and agent speech to customer.
    """
    await websocket.accept()
    call_signaling.register_agent(websocket)
    logger.info("Agent Console connected to live dispatch websocket.")
    try:
        await websocket.send_json({
            "event": "SYNC_PENDING",
            "calls": call_signaling.get_pending_calls()
        })
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
                continue
            try:
                msg = json.loads(data)
                ev = msg.get("event")
                c_id = msg.get("call_id")
                if ev in ("webrtc_offer", "webrtc_answer", "webrtc_ice") and c_id:
                    await call_signaling.relay_webrtc_signal(c_id, websocket, msg)
                elif ev == "agent_message" and c_id:
                    text = msg.get("text", "")
                    await call_signaling.notify_transcript_turn(c_id, {
                        "speaker": "agent",
                        "user_query": "",
                        "reply_text": text,
                        "language": msg.get("language", "en"),
                        "timestamp": datetime.utcnow().isoformat()
                    })
            except Exception:
                pass
    except WebSocketDisconnect:
        logger.info("Agent Console disconnected from websocket.")
    except Exception as e:
        logger.warning(f"Error in Agent Console websocket: {e}")
    finally:
        call_signaling.unregister_agent(websocket)

@router.websocket("/ws/{call_id}")
async def call_websocket_endpoint(websocket: WebSocket, call_id: str):
    """
    Bidirectional WebSocket stream for real-time audio/text conversations, WebRTC signaling, and interruptions.
    """
    await websocket.accept()
    call_signaling.register_call_socket(call_id, websocket)
    logger.info(f"WebSocket client connected for call {call_id}")

    try:
        # Check if call is already accepted, and send state to customer
        async with AsyncSessionLocal() as session:
            stmt = select(Call).where(Call.id == call_id)
            res = await session.execute(stmt)
            call = res.scalars().first()
            if call and call.status == "IN_PROGRESS":
                greeting = ai_engine.LANGUAGE_GREETINGS.get(call.language or "en", ai_engine.LANGUAGE_GREETINGS["en"])
                await websocket.send_json({
                    "event": "CALL_ACCEPTED",
                    "call_id": call_id,
                    "call": {
                        "id": call.id,
                        "status": "IN_PROGRESS",
                        "language": call.language,
                        "greeting_text": greeting,
                        "transcript": call.transcript
                    }
                })

        while True:
            raw_data = await websocket.receive_text()
            if raw_data == "ping":
                await websocket.send_text("pong")
                continue
            try:
                data = json.loads(raw_data)
            except Exception:
                continue

            event = data.get("event")
            if event in ("webrtc_offer", "webrtc_answer", "webrtc_ice"):
                await call_signaling.relay_webrtc_signal(call_id, websocket, data)

            elif event == "user_message":
                text = data.get("text", "")
                lang = data.get("language", "auto")

                # 1. Immediately notify Agent Console of customer speech
                await call_signaling.notify_transcript_turn(call_id, {
                    "speaker": "customer",
                    "text": text,
                    "user_query": text,
                    "language": lang if lang != "auto" else "en",
                    "timestamp": datetime.utcnow().isoformat()
                })

                async with AsyncSessionLocal() as session:
                    result = await orchestrator.process_user_turn(
                        db=session,
                        call_id=call_id,
                        user_text=text,
                        forced_language=lang
                    )
                    await session.commit()

                resp = {
                    "event": "ai_response",
                    "speaker": "ai",
                    "reply_text": result["reply_text"],
                    "language": result["language"],
                    "sentiment": result.get("sentiment", "NEUTRAL"),
                    "grounded": result["grounded"],
                    "trigger_handoff": result["trigger_handoff"],
                    "is_terminal": result.get("is_terminal", False),
                    "tts": result["tts"],
                    "sources": result["sources"]
                }
                await websocket.send_json(resp)
                await call_signaling.notify_transcript_turn(call_id, {
                    "speaker": "ai",
                    "user_query": text,
                    "reply_text": result["reply_text"],
                    "language": result["language"],
                    "sentiment": result.get("sentiment", "NEUTRAL"),
                    "tts": result["tts"],
                    "timestamp": datetime.utcnow().isoformat()
                })

            elif event == "interruption":
                orchestrator.handle_barge_in(call_id)
                await websocket.send_json({
                    "event": "playback_halted",
                    "call_id": call_id
                })

    except WebSocketDisconnect:
        logger.info(f"WebSocket client disconnected for call {call_id}")
    except Exception as e:
        logger.error(f"Error in call websocket: {e}")
        try:
            await websocket.close()
        except Exception:
            pass
    finally:
        call_signaling.unregister_call_socket(call_id, websocket)
