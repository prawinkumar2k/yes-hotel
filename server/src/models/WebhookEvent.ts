import mongoose, { Document, Schema } from "mongoose";

/**
 * Durable idempotency record for inbound payment-gateway webhooks. Razorpay
 * (like most gateways) makes no delivery-exactly-once guarantee — the same
 * event can arrive multiple times (retries, duplicate delivery). The unique
 * index on `eventId` is the actual database-level guarantee that a webhook
 * delivered N times produces exactly one business effect: the second and
 * subsequent inserts throw a duplicate-key error, which the handler treats
 * as "already processed" rather than reprocessing.
 */
export interface IWebhookEvent extends Document {
  provider: string;
  eventId: string;
  eventType: string;
  payload: Record<string, any>;
  processedAt: Date;
}

const WebhookEventSchema = new Schema<IWebhookEvent>(
  {
    provider: { type: String, required: true, default: "RAZORPAY" },
    eventId: { type: String, required: true },
    eventType: { type: String, required: true },
    payload: { type: Schema.Types.Mixed },
    processedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

WebhookEventSchema.index({ provider: 1, eventId: 1 }, { unique: true });

export const WebhookEvent = mongoose.model<IWebhookEvent>("WebhookEvent", WebhookEventSchema);
