import logging
import asyncio
import json
from typing import Dict, Set, Any
from fastapi import WebSocket

logger = logging.getLogger(__name__)

class CallSignalingManager:
    """
    Coordinates real-time call events between Customers, AI Agents, and Admin Monitoring.
    Lifecycle: REQUESTED -> RINGING -> ACCEPTED -> ACTIVE -> ENDED / REJECTED / CANCELLED.
    Relays WebRTC P2P signaling (offer, answer, ICE candidates) for live two-way browser audio.
    """
    def __init__(self):
        # Set of active Agent WebSockets (Agent Consoles)
        self.agent_sockets: Set[WebSocket] = set()
        # Map of call_id -> Set of WebSockets (Customer + Agent session participants)
        self.call_sockets: Dict[str, Set[WebSocket]] = {}
        # In-memory registry of pending call requests
        self.pending_calls: Dict[str, Dict[str, Any]] = {}

    def register_agent(self, ws: WebSocket):
        self.agent_sockets.add(ws)
        logger.info(f"Agent WebSocket registered. Active agent sockets: {len(self.agent_sockets)}")

    def unregister_agent(self, ws: WebSocket):
        self.agent_sockets.discard(ws)
        logger.info(f"Agent WebSocket disconnected. Active agent sockets: {len(self.agent_sockets)}")

    def register_call_socket(self, call_id: str, ws: WebSocket):
        if call_id not in self.call_sockets:
            self.call_sockets[call_id] = set()
        self.call_sockets[call_id].add(ws)
        logger.info(f"Registered socket for call {call_id}. Total sockets on call: {len(self.call_sockets[call_id])}")

    def unregister_call_socket(self, call_id: str, ws: WebSocket):
        if call_id in self.call_sockets:
            self.call_sockets[call_id].discard(ws)
            if not self.call_sockets[call_id]:
                del self.call_sockets[call_id]

    async def broadcast_to_agents(self, message: Dict[str, Any]):
        """Sends real-time incoming call request to all active AI Agent consoles."""
        dead_sockets = set()
        for ws in list(self.agent_sockets):
            try:
                await ws.send_json(message)
            except Exception as e:
                logger.warning(f"Error broadcasting to agent socket: {e}")
                dead_sockets.add(ws)
        self.agent_sockets -= dead_sockets

    async def broadcast_to_call(self, call_id: str, message: Dict[str, Any]):
        """Sends real-time updates to customer and agent participants in a specific call."""
        if call_id in self.call_sockets:
            dead_sockets = set()
            for ws in list(self.call_sockets[call_id]):
                try:
                    await ws.send_json(message)
                except Exception as e:
                    logger.warning(f"Error sending to call {call_id}: {e}")
                    dead_sockets.add(ws)
            self.call_sockets[call_id] -= dead_sockets

    async def relay_webrtc_signal(self, call_id: str, sender_ws: WebSocket, message: Dict[str, Any]):
        """
        Relays WebRTC SDP offer, SDP answer, and ICE candidates between Customer and Agent.
        Avoids duplicate delivery to agents already subscribed via call sockets.
        """
        delivered = set()
        # 1. Relay to other call sockets attached to this call_id
        if call_id in self.call_sockets:
            dead_sockets = set()
            for ws in list(self.call_sockets[call_id]):
                if ws != sender_ws:
                    try:
                        await ws.send_json(message)
                        delivered.add(ws)
                    except Exception as e:
                        dead_sockets.add(ws)
            self.call_sockets[call_id] -= dead_sockets

        # 2. Relay to agent console sockets only if not already delivered
        dead_agents = set()
        for ws in list(self.agent_sockets):
            if ws != sender_ws and ws not in delivered:
                try:
                    await ws.send_json(message)
                    delivered.add(ws)
                except Exception as e:
                    dead_agents.add(ws)
        self.agent_sockets -= dead_agents

    async def notify_call_requested(self, call_data: Dict[str, Any]):
        call_id = call_data["id"]
        self.pending_calls[call_id] = call_data
        event = {
            "event": "INCOMING_CALL",
            "call": call_data,
            "timestamp": call_data.get("created_at")
        }
        await self.broadcast_to_agents(event)

    async def notify_call_accepted(self, call_id: str, call_data: Dict[str, Any]):
        if call_id in self.pending_calls:
            del self.pending_calls[call_id]
        event = {
            "event": "CALL_ACCEPTED",
            "call_id": call_id,
            "call": call_data
        }
        await self.broadcast_to_agents(event)
        await self.broadcast_to_call(call_id, event)

    async def notify_call_rejected(self, call_id: str, reason: str = "Agent busy"):
        if call_id in self.pending_calls:
            del self.pending_calls[call_id]
        event = {
            "event": "CALL_REJECTED",
            "call_id": call_id,
            "reason": reason
        }
        await self.broadcast_to_agents(event)
        await self.broadcast_to_call(call_id, event)

    async def notify_call_ended(self, call_id: str, call_data: Dict[str, Any]):
        if call_id in self.pending_calls:
            del self.pending_calls[call_id]
        event = {
            "event": "CALL_ENDED",
            "call_id": call_id,
            "call": call_data
        }
        await self.broadcast_to_agents(event)
        await self.broadcast_to_call(call_id, event)

    async def notify_transcript_turn(self, call_id: str, turn: Dict[str, Any]):
        event = {
            "event": "TRANSCRIPT_TURN",
            "call_id": call_id,
            "turn": turn
        }
        await self.broadcast_to_agents(event)
        await self.broadcast_to_call(call_id, event)

    def get_pending_calls(self):
        return list(self.pending_calls.values())

call_signaling = CallSignalingManager()
