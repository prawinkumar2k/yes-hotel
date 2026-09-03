import { Request, Response } from "express";
import crypto from "crypto";
import { Payment, PaymentTxStatus } from "../models/Payment";
import { Refund, RefundStatus } from "../models/Refund";
import { Booking, PaymentStatus } from "../models/Booking";
import { WebhookEvent } from "../models/WebhookEvent";
import { createAuditLog } from "../services/audit.service";
import { AuditActorType } from "../models/AuditLog";
import {
  finalizePaymentSuccess,
  PaymentAmountMismatchError,
} from "../services/payment-reconciliation.service";
import { IllegalBookingTransitionError } from "../services/booking-state.service";
import { logger } from "../services/logger.service";

/**
 * Razorpay webhook contract (https://razorpay.com/docs/webhooks/):
 *
 *   POST body (JSON, must be verified against the RAW bytes, not a
 *   re-serialized object — re-serializing can change key order/whitespace
 *   and break the HMAC comparison):
 *   {
 *     "entity": "event",
 *     "event": "payment.captured",
 *     "payload": { "payment": { "entity": { "id": "pay_xxx", "order_id": "order_xxx",
 *                                            "amount": 150000, "status": "captured",
 *                                            "notes": { "bookingId": "..." }, ... } } }
 *   }
 *
 *   Header "x-razorpay-signature": hex HMAC-SHA256 of the raw body, keyed by
 *   the webhook secret configured in the Razorpay dashboard (RAZORPAY_WEBHOOK_SECRET
 *   here) — this is a DIFFERENT secret from RAZORPAY_KEY_SECRET.
 *
 *   Razorpay does not guarantee exactly-once delivery or a globally unique
 *   top-level event id in every account configuration, so idempotency here
 *   is keyed on (eventType + the gateway entity id the event is about),
 *   which is stable across redeliveries of the same event.
 */

function verifyRazorpaySignature(rawBody: Buffer, signatureHeader: string | undefined, secret: string): boolean {
  if (!signatureHeader) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  // Constant-time comparison — a timing side-channel on webhook signature
  // checks is a real, if narrow, attack surface.
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signatureHeader, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// POST /api/webhooks/razorpay
export const handleRazorpayWebhook = async (req: Request, res: Response) => {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) {
    // Fail closed, not open: if the secret isn't configured we cannot verify
    // authenticity, so we must reject rather than silently trust the body.
    logger.error("webhook.secret_not_configured", { requestId: req.id });
    return res.status(503).json({ success: false, message: "Webhook processing not configured" });
  }

  const rawBody = req.body as Buffer;
  if (!Buffer.isBuffer(rawBody)) {
    // Misconfigured body parsing (this route must receive the raw buffer,
    // not JSON already parsed by express.json()) — cannot verify signature.
    logger.error("webhook.non_raw_body", { requestId: req.id });
    return res.status(500).json({ success: false, message: "Server misconfiguration" });
  }

  const signatureHeader = req.headers["x-razorpay-signature"] as string | undefined;
  if (!verifyRazorpaySignature(rawBody, signatureHeader, webhookSecret)) {
    return res.status(400).json({ success: false, message: "Invalid webhook signature" });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return res.status(400).json({ success: false, message: "Malformed webhook payload" });
  }

  const eventType: string | undefined = event?.event;
  if (!eventType) {
    return res.status(400).json({ success: false, message: "Missing event type" });
  }

  // Derive a stable idempotency key from the entity the event is about, not
  // from delivery metadata (Razorpay's own x-razorpay-event-id header is not
  // guaranteed present on every account/plan). A redelivery of the same
  // event carries the same entity id + status, so this key collides on
  // resend and is distinct across genuinely different events.
  const entityId =
    event?.payload?.payment?.entity?.id ??
    event?.payload?.refund?.entity?.id ??
    event?.payload?.order?.entity?.id;
  if (!entityId) {
    return res.status(400).json({ success: false, message: "Unrecognized webhook payload shape" });
  }
  const idempotencyKey = `${eventType}:${entityId}`;

  // Fast-path dedupe: if this exact event was already durably marked
  // processed, acknowledge and stop without redoing work. The record is
  // only written AFTER successful processing (below) — never before —
  // so a transient failure here does not permanently swallow every future
  // retry of a genuinely unprocessed event. The deeper, always-correct
  // idempotency guarantee for payment.captured is the Payment collection's
  // own unique index on razorpayPaymentId (see finalizePaymentSuccess),
  // which holds even if two deliveries of the same event are processed
  // concurrently and both pass this check.
  const alreadyProcessed = await WebhookEvent.findOne({ provider: "RAZORPAY", eventId: idempotencyKey });
  if (alreadyProcessed) {
    return res.status(200).json({ success: true, message: "Event already processed" });
  }

  try {
    switch (eventType) {
      case "payment.captured": {
        const paymentEntity = event.payload.payment.entity;
        const bookingId = paymentEntity.notes?.bookingId;
        if (!bookingId) {
          logger.error("webhook.payment_captured_missing_booking_id", { requestId: req.id, razorpayPaymentId: paymentEntity.id });
          break;
        }
        try {
          await finalizePaymentSuccess({
            bookingId,
            razorpayOrderId: paymentEntity.order_id,
            razorpayPaymentId: paymentEntity.id,
            gatewayAmountPaise: paymentEntity.amount,
            source: "WEBHOOK",
          });
        } catch (err: any) {
          if (err instanceof PaymentAmountMismatchError) {
            // Quarantine, don't confirm: log loudly for operator review
            // rather than silently accepting a mismatched amount.
            logger.error("webhook.payment_amount_mismatch", { requestId: req.id, bookingId, message: err.message });
            await createAuditLog({
              actorType: AuditActorType.SYSTEM,
              action: "payment.amount_mismatch",
              resourceType: "Booking",
              resourceId: bookingId,
              metadata: { razorpayPaymentId: paymentEntity.id, message: err.message },
            });
          } else if (err instanceof IllegalBookingTransitionError) {
            // A payment can legitimately arrive for a booking that no longer
            // wants it — most commonly the guest cancelled between checkout
            // and this webhook landing. Not a transient failure (retrying
            // won't fix it), so don't rethrow into the 500/retry path — log
            // it for operator visibility and acknowledge the event.
            logger.error("webhook.payment_captured_illegal_transition", {
              requestId: req.id,
              bookingId,
              from: err.from,
              to: err.to,
            });
            await createAuditLog({
              actorType: AuditActorType.SYSTEM,
              action: "payment.captured_on_non_confirmable_booking",
              resourceType: "Booking",
              resourceId: bookingId,
              metadata: { razorpayPaymentId: paymentEntity.id, from: err.from, to: err.to },
            });
          } else {
            throw err;
          }
        }
        break;
      }

      case "payment.failed": {
        const paymentEntity = event.payload.payment.entity;
        const bookingId = paymentEntity.notes?.bookingId;
        await createAuditLog({
          actorType: AuditActorType.SYSTEM,
          action: "payment.failed",
          resourceType: "Booking",
          resourceId: bookingId,
          metadata: {
            razorpayPaymentId: paymentEntity.id,
            razorpayOrderId: paymentEntity.order_id,
            errorCode: paymentEntity.error_code,
            errorDescription: paymentEntity.error_description,
          },
        });
        break;
      }

      case "refund.processed": {
        const refundEntity = event.payload.refund.entity;
        const refund = await Refund.findOne({ razorpayRefundId: refundEntity.id });
        if (refund && refund.status !== RefundStatus.COMPLETED) {
          refund.status = RefundStatus.COMPLETED;
          await refund.save();
          await createAuditLog({
            actorType: AuditActorType.SYSTEM,
            action: "refund.confirmed_by_webhook",
            resourceType: "Refund",
            resourceId: refund._id.toString(),
            metadata: { razorpayRefundId: refundEntity.id },
          });
        }
        break;
      }

      case "refund.failed": {
        const refundEntity = event.payload.refund.entity;
        const refund = await Refund.findOne({ razorpayRefundId: refundEntity.id });
        if (refund && refund.status !== RefundStatus.FAILED) {
          refund.status = RefundStatus.FAILED;
          await refund.save();
          // Release the claimed refund balance back onto the payment — the
          // gateway ultimately did not honor this refund, so the amount
          // must become refundable again rather than staying locked out.
          await Payment.updateOne(
            { _id: refund.payment },
            { $inc: { refundedAmount: -refund.amount }, $set: { status: PaymentTxStatus.COMPLETED } }
          );
          await createAuditLog({
            actorType: AuditActorType.SYSTEM,
            action: "refund.failed_confirmed_by_webhook",
            resourceType: "Refund",
            resourceId: refund._id.toString(),
            metadata: { razorpayRefundId: refundEntity.id },
          });
        }
        break;
      }

      default:
        // Unhandled event type — acknowledged, not an error. Razorpay sends
        // many events this integration doesn't act on (e.g. order.paid is
        // redundant with payment.captured for this flow).
        break;
    }
  } catch (error: any) {
    logger.error("webhook.processing_failed", { requestId: req.id, idempotencyKey, message: error?.message, stack: error?.stack });
    // Deliberately NOT marked processed — Razorpay's own retry schedule will
    // redeliver this event, and it will be attempted again rather than
    // silently dropped. Return 5xx so Razorpay's delivery system treats this
    // as a failure worth retrying, per its documented retry behavior.
    return res.status(500).json({ success: false, message: "Webhook processing failed — will be retried" });
  }

  // Only now, after processing has genuinely succeeded, record the event as
  // done. A duplicate-key race here (two concurrent deliveries of the same
  // event both reaching this point) is harmless — both branches already
  // produced the same idempotent outcome above.
  await WebhookEvent.create({ provider: "RAZORPAY", eventId: idempotencyKey, eventType, payload: event }).catch(
    (error: any) => {
      if (error?.code !== 11000) logger.error("webhook.idempotency_marker_write_failed", { requestId: req.id, idempotencyKey, message: error?.message });
    }
  );

  return res.status(200).json({ success: true });
};
