import { registerJobHandler } from "../services/job-queue.service";
import { getTransporter } from "../services/notification.service";
import { NotificationLog, NotificationStatus } from "../models/NotificationLog";
import { logger } from "../services/logger.service";

/**
 * Retries a previously-failed notification email. On success, updates the
 * ORIGINAL NotificationLog row to SENT (rather than creating a new log
 * entry) so the log stays an accurate one-row-per-notification-attempt
 * history. Throwing here is what tells job-queue.service to retry with
 * backoff (or dead-letter after maxAttempts) — this handler doesn't
 * implement its own retry logic, that belongs entirely to the queue.
 */
export function registerNotificationJobHandlers(): void {
  registerJobHandler("notification.email_retry", async (payload) => {
    const { notificationLogId, recipientEmail, subject, body } = payload;

    const transporter = getTransporter();
    if (!transporter) {
      // No email provider configured at all — retrying will never succeed.
      // Not the job's fault in the "transient failure" sense, but there is
      // nothing to retry into, so let it exhaust its attempts and
      // dead-letter rather than polling forever for a provider that will
      // never appear without a deploy config change.
      throw new Error("No email transporter configured — cannot retry");
    }

    await transporter.sendMail({ from: process.env.EMAIL_USER, to: recipientEmail, subject, text: body });

    await NotificationLog.findByIdAndUpdate(notificationLogId, {
      status: NotificationStatus.SENT,
      errorMessage: undefined,
    });
    logger.info("notification.retry_succeeded", { notificationLogId });
  });
}
