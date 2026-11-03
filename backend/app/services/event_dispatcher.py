import logging
from typing import Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.order import Order
from app.models.customer import Customer
from app.models.payment import Payment
from app.models.appointment import Appointment
from app.models.complaint import Complaint
from app.services.automated_call_service import automated_call_service

logger = logging.getLogger(__name__)

class EventDispatcher:
    """
    Automated System Event Detector and AI Calling Coordinator.
    Detects business and lifecycle events across orders, payments, appointments, and complaints,
    and automatically initiates human-like AI voice calls to the customer's mobile number.
    Zero manual triggering required.
    """

    async def on_order_created(
        self,
        order: Order,
        customer: Customer,
        db: AsyncSession,
        simulate_outcome: str = "SUCCESS"
    ) -> Dict[str, Any]:
        """
        Triggered when a new customer order is placed.
        Immediately dispatches Order Confirmation AI Call.
        """
        logger.info(f"[EVENT_DETECTED] ORDER_CREATED: Order #{order.order_number} for customer {customer.name}")
        return await automated_call_service.dispatch_automated_call(
            db=db,
            category="ORDER_CONFIRMATION",
            customer=customer,
            entity_type="order",
            entity_obj=order,
            language=order.preferred_language or customer.preferred_language or "en",
            simulate_outcome=simulate_outcome
        )

    async def on_payment_success(
        self,
        payment: Payment,
        order: Order,
        customer: Customer,
        db: AsyncSession,
        simulate_outcome: str = "SUCCESS"
    ) -> Dict[str, Any]:
        """
        Triggered when payment is verified and successful.
        Dispatches Payment Confirmation AI Call.
        """
        logger.info(f"[EVENT_DETECTED] PAYMENT_SUCCESS: TXN #{payment.transaction_id} for Order #{order.order_number}")
        return await automated_call_service.dispatch_automated_call(
            db=db,
            category="PAYMENT_CONFIRMATION",
            customer=customer,
            entity_type="payment",
            entity_obj=payment,
            language=order.preferred_language or customer.preferred_language or "en",
            simulate_outcome=simulate_outcome
        )

    async def on_payment_failed(
        self,
        payment: Payment,
        order: Order,
        customer: Customer,
        db: AsyncSession,
        simulate_outcome: str = "QUESTION_ANSWERED"
    ) -> Dict[str, Any]:
        """
        Triggered when payment fails or times out.
        Dispatches Payment Failure guidance call explaining error and offering retry link / COD.
        """
        logger.info(f"[EVENT_DETECTED] PAYMENT_FAILED: TXN #{payment.transaction_id} for Order #{order.order_number}")
        return await automated_call_service.dispatch_automated_call(
            db=db,
            category="PAYMENT_FAILURE",
            customer=customer,
            entity_type="payment",
            entity_obj=payment,
            language=order.preferred_language or customer.preferred_language or "en",
            simulate_outcome=simulate_outcome
        )

    async def on_order_delayed(
        self,
        order: Order,
        customer: Customer,
        db: AsyncSession,
        simulate_outcome: str = "QUESTION_ANSWERED"
    ) -> Dict[str, Any]:
        """
        Triggered when order status changes to delayed.
        Dispatches Order Delay Notification call with updated delivery estimate.
        """
        logger.info(f"[EVENT_DETECTED] ORDER_DELAYED: Order #{order.order_number}")
        return await automated_call_service.dispatch_automated_call(
            db=db,
            category="ORDER_DELAY",
            customer=customer,
            entity_type="order",
            entity_obj=order,
            language=order.preferred_language or customer.preferred_language or "en",
            simulate_outcome=simulate_outcome
        )

    async def on_order_cancelled(
        self,
        order: Order,
        customer: Customer,
        db: AsyncSession,
        simulate_outcome: str = "SUCCESS"
    ) -> Dict[str, Any]:
        """
        Triggered when order is cancelled.
        Dispatches Order Cancellation call explaining cancellation and refund terms.
        """
        logger.info(f"[EVENT_DETECTED] ORDER_CANCELLED: Order #{order.order_number}")
        return await automated_call_service.dispatch_automated_call(
            db=db,
            category="ORDER_CANCELLED",
            customer=customer,
            entity_type="order",
            entity_obj=order,
            language=order.preferred_language or customer.preferred_language or "en",
            simulate_outcome=simulate_outcome
        )

    async def on_appointment_created(
        self,
        appointment: Appointment,
        customer: Customer,
        db: AsyncSession,
        simulate_outcome: str = "SUCCESS"
    ) -> Dict[str, Any]:
        """
        Triggered when a customer or agent books an appointment.
        Dispatches Appointment Confirmation call with slot and location details.
        """
        logger.info(f"[EVENT_DETECTED] APPOINTMENT_CREATED: #{appointment.appointment_number}")
        return await automated_call_service.dispatch_automated_call(
            db=db,
            category="APPOINTMENT_CONFIRMATION",
            customer=customer,
            entity_type="appointment",
            entity_obj=appointment,
            language=customer.preferred_language or "en",
            simulate_outcome=simulate_outcome
        )

    async def on_appointment_rescheduled(
        self,
        appointment: Appointment,
        customer: Customer,
        db: AsyncSession,
        simulate_outcome: str = "QUESTION_ANSWERED"
    ) -> Dict[str, Any]:
        """
        Triggered when an appointment is rescheduled or delayed.
        Dispatches Appointment Reschedule call with available slot choices.
        """
        logger.info(f"[EVENT_DETECTED] APPOINTMENT_RESCHEDULED: #{appointment.appointment_number}")
        return await automated_call_service.dispatch_automated_call(
            db=db,
            category="APPOINTMENT_RESCHEDULE",
            customer=customer,
            entity_type="appointment",
            entity_obj=appointment,
            language=customer.preferred_language or "en",
            simulate_outcome=simulate_outcome
        )

    async def on_complaint_created(
        self,
        complaint: Complaint,
        customer: Customer,
        db: AsyncSession,
        simulate_outcome: str = "QUESTION_ANSWERED"
    ) -> Dict[str, Any]:
        """
        Triggered when a customer submits or escalates a complaint.
        Dispatches Customer Complaint acknowledgment and 24-hour resolution assurance call.
        """
        logger.info(f"[EVENT_DETECTED] COMPLAINT_CREATED: Ticket #{complaint.ticket_number}")
        return await automated_call_service.dispatch_automated_call(
            db=db,
            category="CUSTOMER_COMPLAINT",
            customer=customer,
            entity_type="complaint",
            entity_obj=complaint,
            language=customer.preferred_language or "en",
            simulate_outcome=simulate_outcome
        )

    async def on_order_delivered(
        self,
        order: Order,
        customer: Customer,
        db: AsyncSession,
        simulate_outcome: str = "SUCCESS"
    ) -> Dict[str, Any]:
        """
        Triggered when package delivery is confirmed.
        Dispatches Customer Feedback collection call.
        """
        logger.info(f"[EVENT_DETECTED] ORDER_DELIVERED: Order #{order.order_number} feedback call")
        return await automated_call_service.dispatch_automated_call(
            db=db,
            category="CUSTOMER_FEEDBACK",
            customer=customer,
            entity_type="order",
            entity_obj=order,
            language=order.preferred_language or customer.preferred_language or "en",
            simulate_outcome=simulate_outcome
        )

event_dispatcher = EventDispatcher()

