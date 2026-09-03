import { NotificationLog, NotificationType, NotificationStatus } from "../models/NotificationLog";
import { enqueueJob } from "./job-queue.service";
import { logger } from "./logger.service";

let cachedTransporter: any = null;
let triedTransporter = false;

export function getTransporter() {
  if (triedTransporter) return cachedTransporter;
  triedTransporter = true;

  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  if (!user || !pass) return null;

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const nodemailer = require("nodemailer");
    cachedTransporter = nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE || "gmail",
      auth: { user, pass },
    });
  } catch {
    cachedTransporter = null;
  }
  return cachedTransporter;
}

/**
 * Sends a notification email and durably logs the attempt. Never claims
 * delivery it didn't attempt: with no EMAIL_USER/EMAIL_PASS configured, this
 * logs the notification to the console (clearly labeled dev-only) and
 * records status LOGGED_ONLY — the same honest pattern already used for
 * password-reset links in this codebase, applied consistently here.
 */
export async function sendNotification(params: {
  type: NotificationType;
  recipientEmail: string;
  subject: string;
  body: string;
  bookingId?: string;
}) {
  const { type, recipientEmail, subject, body, bookingId } = params;
  const transporter = getTransporter();

  if (!transporter) {
    if (process.env.NODE_ENV !== "production") {
      console.log(`\n📧 [DEV NOTIFICATION] ${type} → ${recipientEmail}`);
      console.log(`   Subject: ${subject}`);
      console.log(`   ${body}\n`);
    }
    await NotificationLog.create({
      type,
      recipientEmail,
      subject,
      body,
      status: NotificationStatus.LOGGED_ONLY,
      bookingId,
    });
    return;
  }

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: recipientEmail,
      subject,
      text: body,
    });
    await NotificationLog.create({
      type,
      recipientEmail,
      subject,
      body,
      status: NotificationStatus.SENT,
      bookingId,
    });
  } catch (error: any) {
    logger.error("notification.send_failed", { type, recipientEmail, message: error.message });
    const failedLog = await NotificationLog.create({
      type,
      recipientEmail,
      subject,
      body,
      status: NotificationStatus.FAILED,
      bookingId,
      errorMessage: error.message,
    });

    // Durable retry, not a fire-and-forget dead end: an email failing
    // (transient SMTP hiccup, provider rate limit) previously meant the
    // guest never got their booking confirmation/refund notice unless
    // someone noticed the FAILED row and manually resent it. The job
    // persists in MongoDB — a process restart before the retry fires does
    // not lose it, unlike an in-memory setTimeout retry would.
    await enqueueJob(
      "notification.email_retry",
      { notificationLogId: failedLog._id.toString(), recipientEmail, subject, body },
      { maxAttempts: 5 }
    ).catch((enqueueErr: any) => {
      logger.error("notification.retry_enqueue_failed", { notificationLogId: failedLog._id.toString(), message: enqueueErr?.message });
    });
  }
}
